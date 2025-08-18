const puppeteer = require('puppeteer');
const axios = require('axios');
const logger = require('../utils/logger');
const captchaService = require('./captchaService');

class WebScrapingService {
  constructor() {
    this.browser = null;
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    // Simple in-process pool limiter for page scrapes
    this.maxConcurrentScrapes = 6;
    this.currentScrapes = 0;
    this.scrapeQueue = [];
  }

  async _acquireSlot() {
    if (this.currentScrapes >= this.maxConcurrentScrapes) {
      await new Promise(resolve => this.scrapeQueue.push(resolve));
    }
    this.currentScrapes++;
  }

  _releaseSlot() {
    this.currentScrapes--;
    const next = this.scrapeQueue.shift();
    if (next) next();
  }

  async initBrowser() {
    if (this.browser) {
      try {
        // Проверяем что браузер еще работает
        await this.browser.version();
        return this.browser;
      } catch (error) {
        logger.info('Browser connection lost, creating new one', { error: error.message });
        this.browser = null;
      }
    }

    try {
      // Не убиваем системные браузеры. Используем отдельный встроенный Chromium Puppeteer.

      // Use Puppeteer's built-in Chromium with улучшенными настройками
      this.browser = await puppeteer.launch({
        headless: 'new',
        defaultViewport: null,
        // userDataDir отключен чтобы избежать SingletonLock
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--start-maximized',
          '--disable-gpu',
          '--no-first-run',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ],
        protocolTimeout: 120000,
        timeout: 60000 // 60 секунд timeout
      });
      
      logger.info('Successfully launched new Puppeteer Chromium browser');
    return this.browser;
    } catch (launchError) {
      logger.error('FAILED to launch Puppeteer Chromium', {
        error: launchError.message,
        stack: launchError.stack
      });
      throw new Error('Failed to launch Puppeteer Chromium: ' + launchError.message);
    }
  }

  /**
   * Scrape Arbeitsagentur job page for contact information
   */
  async scrapeArbeitsagenturContacts(jobId) {
    const url = `https://www.arbeitsagentur.de/jobsuche/jobdetail/${jobId}`;
    const contacts = [];
    
    try {
      await this._acquireSlot();
      logger.info('Scraping Arbeitsagentur job page with advanced bypassing', {
        jobId,
        url
      });

      logger.info('Initializing browser for CAPTCHA testing', { jobId });
      const browser = await this.initBrowser();
      
      // Check if we already have a page with this job open
      const pages = await browser.pages();
      let page = pages.find(p => p.url().includes(jobId));
      
      if (page) {
        logger.info('Found existing page with job', { 
          jobId,
          url: page.url().substring(0, 100)
        });
      } else {
        // Always create a new page for each job to get individual contacts
        logger.info('Creating new page for individual job extraction', { jobId });
        page = await browser.newPage();
        // Set default page timeouts to be generous for CAPTCHA flows
        try { await page.setDefaultTimeout(60000); } catch {}
        try { await page.setDefaultNavigationTimeout(90000); } catch {}
        
        // Network interception: block heavy resources
        try {
          await page.setRequestInterception(true);
          page.on('request', (req) => {
            try {
              const url = req.url();
              const resourceType = req.resourceType();
              const isCaptcha = /captcha/i.test(url) || /id-aas-service\/ct\/v1\/captcha/i.test(url);
              if (isCaptcha) return req.continue();
              // Allow only essential types
              const allowTypes = new Set(['document', 'xhr', 'fetch', 'script', 'stylesheet', 'other']);
              if (!allowTypes.has(resourceType)) return req.abort();
              // Block common heavy hosts
              if (/(google-analytics|gtag|doubleclick|facebook|hotjar|segment)\./i.test(url)) return req.abort();
              // Block images/fonts/styles explicitly
              if (/\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|eot)(\?|$)/i.test(url)) return req.abort();
              return req.continue();
            } catch { try { req.continue(); } catch {} }
          });
        } catch {}
        
        // Set user agent and headers
      await page.setUserAgent(this.userAgent);
      await page.setViewport({ width: 1920, height: 1080 });

        // Set headers to look more like real browser
        await page.setExtraHTTPHeaders({
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'max-age=0',
          'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'none',
          'sec-fetch-user': '?1',
        });

        // Navigate to job page
        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });
        
        logger.info('🎯 NEW PAGE OPENED for job! Starting automated processing...', {
          jobId,
          url: url.substring(0, 100),
          instructions: [
            '1. Browser session is persistent',
            '2. Will handle cookies automatically', 
            '3. Will solve CAPTCHA via 2Captcha',
            '4. Will extract real contacts only'
          ]
        });
        
        // Wait less time since cookies are already accepted
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds instead of 30
      }

      // Сначала обрабатываем cookies, потом CAPTCHA
      const browserPages = await browser.pages();
      
      // Cookie handling только для первых страниц (экономия ресурсов)
      if (browserPages.length <= 3) {
        await this.handleCookieBanner(page, jobId);
      } else {
        logger.info('Пропускаем cookie handling (уже обработано)', { 
          jobId, 
          totalPages: browserPages.length 
        });
      }
      
      // CAPTCHA handling ВСЕГДА - может появиться на любой странице!
      await this.handleCaptchaWithTwoCaptcha(page, jobId);
      // После капчи: еще раз раскрыть блок и подождать контакты, затем извлечь их сразу
      try {
        const contactSection = await page.$('#jobdetails-kontaktdaten-block');
        if (contactSection) { await contactSection.click().catch(()=>{}); }
        await page.waitForFunction(() => {
          const root = document.querySelector('#jobdetails-kontaktdaten-block') || document.body;
          const t = (root?.innerText || '').toLowerCase();
          return t.includes('telefon') || t.includes('e-mail') || t.includes('e‑mail') || document.querySelector('a[href^="mailto:"]') || document.querySelector('a[href^="tel:"]');
        }, { timeout: 8000 });
        const labeledAfterCaptcha = await page.evaluate(() => {
          const out = { emails: [], phones: [] };
          const root = document.querySelector('#jobdetails-kontaktdaten-block') || document.body;
          if (!root) return out;
          const seen = new Set();
          const pushUnique = (arr, val) => { const v = String(val || '').trim(); if (v && !seen.has(v)) { seen.add(v); arr.push(v); } };
          const walk = (node) => {
            const anchors = node.querySelectorAll ? node.querySelectorAll('a[href^="mailto:"], a[href^="tel:"]') : [];
            anchors.forEach(a => {
              const href = a.getAttribute('href') || '';
              if (/^mailto:/i.test(href)) pushUnique(out.emails, href.replace(/^mailto:/i, ''));
              if (/^tel:/i.test(href)) pushUnique(out.phones, href.replace(/^tel:/i, ''));
            });
            const txt = (node.innerText || '').replace(/[\u00A0\u202F\u2007]/g,' ').replace(/[\u200B\u200C\u200D]/g,'');
            const pm = txt.match(/Telefon\s*:\s*([+0-9\s()\-]{8,})/i); if (pm) pushUnique(out.phones, pm[1]);
            const em = txt.match(/E-?Mail\s*:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i); if (em) pushUnique(out.emails, em[1]);
            if (node.shadowRoot) walk(node.shadowRoot);
            const children = node.children ? Array.from(node.children) : [];
            children.forEach(walk);
          };
          walk(root);
          return out;
        });
        const pageUrlAfter = await page.url();
        let addedEmails = 0; let addedPhones = 0;
        (labeledAfterCaptcha.emails||[]).forEach(e => { contacts.push({ type:'email', value:String(e).trim(), source:pageUrlAfter, confidence:'high' }); addedEmails++; });
        (labeledAfterCaptcha.phones||[]).forEach(p => {
          const norm = String(p).replace(/[^\d+]/g,'');
          const garbage = /^([0-9]{1,3}\s+){2,}[0-9]{1,3}$/.test(String(p).trim());
          if (!garbage && /^\+49\d{7,15}$/.test(norm)) { contacts.push({ type:'phone', value:String(p).trim(), source:pageUrlAfter, confidence:'high' }); addedPhones++; }
        });
        if (addedEmails || addedPhones) {
          logger.info('✅ Immediate contacts extracted after CAPTCHA', { jobId, emails: addedEmails, phones: addedPhones });
        }
      } catch (e) {
        // продолжаем обычный поток
      }
      
      logger.info('Extracting contacts from page', { 
        jobId,
        currentUrl: page.url().substring(0, 100)
      });
      
      // СНАЧАЛА: пробуем извлечь контакты напрямую из DOM (после раскрытия секции и/или CAPTCHA)
      try {
        const domContacts = await page.evaluate(() => {
          const result = { emails: [], phones: [] };
          const root = document.querySelector('#jobdetails-kontaktdaten-block') || document.body;
          if (!root) return result;
          const seen = new Set();
          const pushUnique = (arr, val) => { const v = String(val || '').trim(); if (v && !seen.has(v)) { seen.add(v); arr.push(v); } };
          const collect = (node) => {
            try {
              // anchors
              const anchors = node.querySelectorAll ? node.querySelectorAll('a[href^="mailto:"], a[href^="tel:"]') : [];
              anchors.forEach(a => {
                const href = a.getAttribute('href') || '';
                if (/^mailto:/i.test(href)) pushUnique(result.emails, href.replace(/^mailto:/i, ''));
                if (/^tel:/i.test(href)) pushUnique(result.phones, href.replace(/^tel:/i, ''));
              });
              // labeled text
              const txt = (node.innerText || '').replace(/[\u00A0\u202F\u2007]/g,' ').replace(/[\u200B\u200C\u200D]/g,'');
              const pm = txt.match(/Telefon\s*:\s*([+0-9\s()\-]{8,})/i); if (pm) pushUnique(result.phones, pm[1]);
              const em = txt.match(/E-?Mail\s*:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[a-zA-Z]{2,})/i); if (em) pushUnique(result.emails, em[1]);
              // shadow DOM recursion
              if (node.shadowRoot) collect(node.shadowRoot);
              const children = node.children ? Array.from(node.children) : [];
              children.forEach(collect);
            } catch {}
          };
          collect(root);
          return result;
        });

        if (domContacts) {
          const pageUrl = await page.url();
          (domContacts.emails || []).forEach((email) => {
            contacts.push({ type: 'email', value: (email || '').trim(), source: pageUrl, confidence: 'high' });
          });
          (domContacts.phones || []).forEach((phone) => {
            contacts.push({ type: 'phone', value: (phone || '').trim(), source: pageUrl, confidence: 'high' });
          });

          if ((domContacts.emails?.length || 0) > 0 || (domContacts.phones?.length || 0) > 0) {
            logger.info('DOM contacts extracted', { jobId, emails: domContacts.emails?.length || 0, phones: domContacts.phones?.length || 0 });
          } else {
            // Second pass: explicitly parse visible lines with Telefon/E-Mail labels
            const labeled = await page.evaluate(() => {
              const result = { emails: [], phones: [] };
              const root = document.querySelector('#jobdetails-kontaktdaten-block') || document.body;
              if (!root) return result;
              const seen = new Set();
              const pushUnique = (arr, val) => { const v = String(val || '').trim(); if (v && !seen.has(v)) { seen.add(v); arr.push(v); } };
              const scan = (node) => {
                const text = (node.innerText || '').replace(/[\u00A0\u202F\u2007]/g, ' ').replace(/[\u200B\u200C\u200D]/g, '');
                const pm = text.match(/Telefon\s*:\s*([+0-9\s()\-]{8,})/i); if (pm) pushUnique(result.phones, pm[1]);
                const em = text.match(/E-?Mail\s*:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[a-zA-Z]{2,})/i); if (em) pushUnique(result.emails, em[1]);
                if (node.shadowRoot) scan(node.shadowRoot);
                const children = node.children ? Array.from(node.children) : [];
                children.forEach(scan);
              };
              scan(root);
              return result;
            });
            if (labeled) {
              const pageUrl = await page.url();
              (labeled.emails || []).forEach((email) => contacts.push({ type: 'email', value: String(email || '').trim(), source: pageUrl, confidence: 'high' }));
              (labeled.phones || []).forEach((phone) => contacts.push({ type: 'phone', value: String(phone || '').trim(), source: pageUrl, confidence: 'high' }));
              if ((labeled.emails?.length || 0) > 0 || (labeled.phones?.length || 0) > 0) {
                logger.info('DOM contacts extracted (labeled pass)', { jobId, emails: labeled.emails?.length || 0, phones: labeled.phones?.length || 0 });
              }
            }
          }
        }
      } catch (e) {
        logger.warn('DOM contact extraction failed', { jobId, error: (e && e.message) ? e.message : String(e) });
      }

      // Wait a bit for any dynamic content
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Get initial content
      let content = await page.content();
      
      // STEP 1: ОТКЛЮЧЕНО - НЕ ПЕРЕХОДИМ ПО ВНЕШНИМ ССЫЛКАМ
      // Ищем контакты только на самом сайте Arbeitsagentur.de
      logger.info('Searching for contacts directly on Arbeitsagentur page (no external links)', { jobId });
      
      
      // ГЛАВНОЕ: извлекаем контакты с помощью специализированной функции
      const extractedContacts = this.extractContactsFromHTML(content, url);
      contacts.push(...extractedContacts);
      
      // Debug info после извлечения
      logger.info('Email search debug', {
        jobId,
        pageLength: content.length,
        containsFerchau: content.toLowerCase().includes('ferchau'),
        containsLukas: content.toLowerCase().includes('lukas'),
        containsMeyer: content.toLowerCase().includes('meyer'),
        totalEmailsFound: extractedContacts.filter(c => c.type === 'email').length,
        totalPhonesFound: extractedContacts.filter(c => c.type === 'phone').length,
        allEmails: extractedContacts.filter(c => c.type === 'email').map(c => c.value).slice(0, 5)
      });
      
      // Phone search debug
      const phoneMatches = content.match(/(\+?\d{1,4}[\s\-\(\)]?\d{1,4}[\s\-\(\)]?\d{1,4}[\s\-\(\)]?\d{1,4}[\s\-\(\)]?\d{0,4})/g) || [];
      logger.info('Phone search debug', {
        jobId,
        containsTelefon: content.toLowerCase().includes('telefon'),
        containsPhone: content.toLowerCase().includes('phone'),
        phoneMatches: phoneMatches.slice(0, 10),
        phoneMatchesCount: phoneMatches.length,
        fullGermanPhones: content.match(/\+49[\s\-]?\d{2,4}[\s\-]?\d{3,8}[\s\-]?\d{0,4}/g) || [],
        telefonPatterns: (content.match(/(Telefon|Tel|Phone|Fon):\s*[\+\d\s\-\(\)]{8,20}/gi) || []).map(p => p.substring(0, 50))
      });

      // Defer page close until after fallback external link extraction to avoid context destruction

      // Если не нашли реальные контакты (email/phone), ищем внешнюю ссылку
      const hasRealContacts = contacts.some(c => {
        if (c.type === 'email' && c.value && !String(c.value).startsWith('http')) {
          return true;
        }
        if (c.type === 'phone' && c.value) {
          const norm = String(c.value).replace(/[^\d+]/g, '');
          const garbage = /^([0-9]{1,3}\s+){2,}[0-9]{1,3}$/.test(String(c.value).trim());
          if (!garbage && /^\+49\d{7,15}$/.test(norm)) {
            return true;
          }
        }
        return false;
      });
      
      // Также проверяем есть ли индикаторы внешней вакансии
      const hasExternalSiteIndicators = content.includes('Externe Seite öffnen') || 
                                       content.includes('jobexport.de') ||
                                       content.includes('Vollständige Stellenbeschreibung bei unserem Kooperationspartner') ||
                                       content.includes('bei unserem Kooperationspartner einsehen') ||
                                       content.includes('Полное описание вакансии смотрите у нашего партнера') ||
                                       content.includes('Открыть внешнюю страницу');
      
      if (!hasRealContacts || hasExternalSiteIndicators) {
        logger.info('❌ Реальные контакты не найдены или обнаружена внешняя вакансия, ищем внешнюю ссылку', { 
          jobId,
          hasRealContacts,
          hasExternalSiteIndicators,
          contactsFound: contacts.length
        });
        
        try {
          const externalLinks = await page.$$eval('a', links => 
            links.map(link => ({
              text: link.textContent.trim(),
              href: link.href,
              title: link.title || ''
            })).filter(link => 
              link.text.includes('Externe Seite öffnen') ||
              link.text.includes('Открыть внешнюю страницу') ||
              link.text.includes('jobexport') ||
              link.text.includes('Stellenbeschreibung') ||
              link.text.includes('Kooperationspartner') ||
              link.href.includes('jobexport') ||
              link.href.includes('stepstone') ||
              link.href.includes('xing') ||
              link.href.includes('jobs.de')
            )
          );
          
          if (externalLinks.length > 0) {
            const externalUrl = externalLinks[0].href;
            logger.info('🔗 Извлечена ссылка на внешний сайт как замена контактов', { 
              jobId,
              externalUrl: externalUrl.substring(0, 100),
              linkText: externalLinks[0].text
            });
            
            // Добавляем ссылку как контакт
            contacts.push({
              value: externalUrl,
              type: 'external_link',
              confidence: 'high',
              source: 'arbeitsagentur_fallback_link'
            });
          }
        } catch (linkError) {
                    logger.info('Ошибка при извлечении fallback ссылки', { 
            jobId, 
            error: (linkError && linkError.message) ? linkError.message : String(linkError)
          });

        }
      }

      // Управление страницами - закрываем лишние страницы чтобы экономить память
      const currentPages = await browser.pages();
      if (currentPages.length > 8 && process.env.PUPPETEER_CLOSE_TABS === 'true') { // Close only if explicitly allowed by env
        try {
          await page.close();
          logger.info('Page closed after extraction to free resources', { jobId, totalPages: currentPages.length });
        } catch (e) {
          logger.warn('Page close skipped due to context', { jobId, error: (e && e.message) ? e.message : String(e) });
        }
      } else {
        logger.info('Keeping page open for future use', { jobId, totalPages: currentPages.length });
      }
      
      // ПРИНУДИТЕЛЬНОЕ ЗАКРЫТИЕ при большом количестве страниц
      if (currentPages.length > 12 && process.env.PUPPETEER_CLOSE_TABS === 'true') {
        logger.warn('Too many browser pages open, closing some', { 
          jobId, 
          totalPages: currentPages.length 
        });
        
        // Закрываем все кроме первой страницы
        for (let i = 1; i < currentPages.length - 1; i++) {
          try {
            await currentPages[i].close();
          } catch (err) {
            // Игнорируем ошибки закрытия
          }
        }
      }

      logger.info('Arbeitsagentur page scraped successfully', {
        jobId,
        contactsFound: contacts.length,
        hasRealContacts
      });

      this._releaseSlot();
      return contacts;

    } catch (error) {
      logger.error('Failed to scrape Arbeitsagentur contacts', {
        jobId,
        error: error.message,
        stack: error.stack
      });
    this._releaseSlot();
    return contacts;
    }
  }

  /**
   * Extract contacts from HTML content
   */
  extractContactsFromHTML(html, sourceUrl) {
    const contacts = [];

    try {
      // Normalize unicode whitespace and zero-width characters to improve regex matching
      if (typeof html === 'string') {
        html = html
          .replace(/[\u00A0\u202F\u2007]/g, ' ') // NBSPs to regular spaces
          .replace(/[\u200B\u200C\u200D]/g, '')   // zero-width spaces
          .replace(/[\t\r\f\v]+/g, ' ');
      }
      // Enhanced email regex that captures more patterns
      const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
      
      // Enhanced phone regex for German phone numbers
      const phoneRegex = /(\+?\d{1,4}[\s\-\(\)]?\d{1,4}[\s\-\(\)]?\d{1,4}[\s\-\(\)]?\d{1,4}[\s\-\(\)]?\d{0,4})/g;
      
      // Additional specific patterns for German phones
      const germanPhoneRegex = /(\+49[\s\-]?\d{2,4}[\s\-]?\d{3,8}[\s\-]?\d{0,4})/g;
      const phoneWithTextRegex = /(Telefon|Tel|Phone|Fon):\s*([\+\d\s\-\(\)]{8,20})/gi;

      // Find emails using multiple methods
      const textEmails = html.match(emailRegex) || [];
      
      // Search in HTML attributes and scripts
      const htmlEmailRegex = /(?:href=["']mailto:|data-email=["']|email["']\s*:\s*["'])([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
      const htmlEmails = [];
      let htmlMatch;
      while ((htmlMatch = htmlEmailRegex.exec(html)) !== null) {
        htmlEmails.push(htmlMatch[1]);
      }
      
      // Search after "E-Mail:" pattern (common in German job postings)
      const emailAfterLabel = html.match(/E-Mail:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi) || [];
      const cleanEmailsAfterLabel = emailAfterLabel.map(match => {
        const emailMatch = match.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        return emailMatch ? emailMatch[1] : null;
      }).filter(Boolean);
      
      // Phones
      const textPhones = html.match(phoneRegex) || [];
      const specificGermanPhones = html.match(germanPhoneRegex) || [];
      const phonesAfterLabel = [];
      let phoneMatch;
      while ((phoneMatch = phoneWithTextRegex.exec(html)) !== null) {
        phonesAfterLabel.push(phoneMatch[2]);
      }
 
      // Combine and normalize
      const emails = Array.from(new Set([...textEmails, ...htmlEmails, ...cleanEmailsAfterLabel]))
        .map(e => (e || '').trim());
      const phones = Array.from(new Set([...specificGermanPhones, ...phonesAfterLabel, ...textPhones]))
        .map(p => (p || '').replace(/\s+/g, ' ').trim());
 
      // Validate and push emails
      emails.forEach(email => {
        if (email && /@/.test(email)) {
          contacts.push({ type: 'email', value: email.toLowerCase(), source: sourceUrl, confidence: 'medium' });
        }
      });
 
      // Filter phones to likely real German numbers
      phones.forEach(phone => {
        const normalized = phone.replace(/[^\d+]/g, '');
        // Drop obvious numeric garbage sequences (e.g., '0 0 640 512')
        const isGarbageBlocks = /^([0-9]{1,3}\s+){2,}[0-9]{1,3}$/.test(phone.trim());
        if (isGarbageBlocks) return;
        if ((/^\+49\d{7,15}$/.test(normalized) || /^0\d{7,15}$/.test(normalized))) {
          contacts.push({ type: 'phone', value: phone, source: sourceUrl, confidence: 'medium' });
        }
      });
 
      return contacts;
    } catch (error) {
      return contacts;
    }
  }

  /**
   * Scrape website for contact information
   */
  async scrapeWebsiteContacts(website) {
    const contacts = [];
    
    try {
      // Try axios first
      try {
        const response = await axios.get(website, {
          timeout: 5000,
          headers: {
            'User-Agent': this.userAgent
          }
        });
        
        const extractedContacts = this.extractContactsFromHTML(response.data, website);
        contacts.push(...extractedContacts);
        
        logger.info('Website scraped successfully via axios', {
          website,
          contactsFound: extractedContacts.length
        });
        
        return contacts;
      } catch (axiosError) {
        logger.warn('Axios scraping failed, trying puppeteer', {
          website,
          error: axiosError.message
        });
      }

      // Fallback to puppeteer
      const browser = await this.initBrowser();
      const page = await browser.newPage();
      
      await page.setUserAgent(this.userAgent);
      await page.setViewport({ width: 1920, height: 1080 });
      
      await page.goto(website, { 
        waitUntil: 'domcontentloaded',
        timeout: 8000 
      });

      const content = await page.content();
      const extractedContacts = this.extractContactsFromHTML(content, website);
      contacts.push(...extractedContacts);
      
      await page.close();
      
      logger.info('Website scraped successfully via puppeteer', {
        website,
        contactsFound: extractedContacts.length
      });

      return contacts;

    } catch (error) {
      logger.error('Website scraping failed completely', {
        website,
        error: error.message
      });
      return contacts;
    }
  }

  /**
   * Автоматически обрабатывает CAPTCHA на странице через 2Captcha API
   * @param {Page} page - Страница Puppeteer
   * @param {string} jobId - ID вакансии для логирования
   * @returns {Promise<boolean>} - true если CAPTCHA была решена или не найдена
   */
  async handleCaptchaWithTwoCaptcha(page, jobId) {
    try {
      logger.info('🔍 Проверяю наличие CAPTCHA на странице...', { jobId });

      // Ждем загрузки страницы
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Проверяем наличие секции "Informationen zur Bewerbung" и кликаем если нужно
      try {
        logger.info('🔍 Ищу секцию "Informationen zur Bewerbung"...', { jobId });
        
        // РЕАЛЬНЫЙ селектор секции найденный на сайте
        const bewerbungsInfoSelectors = [
          '#jobdetails-kontaktdaten-block', // Основной блок
          '#jobdetails-kontaktdaten-heading' // Заголовок
        ];
        
        let bewerbungsInfo = null;
        for (const selector of bewerbungsInfoSelectors) {
          try {
            bewerbungsInfo = await page.$(selector);
            if (bewerbungsInfo) {
              logger.info(`🎯 Найдена секция "Informationen zur Bewerbung": ${selector}`, { jobId });
              break;
            }
          } catch (err) {
            // Продолжаем поиск
          }
        }
        
        if (bewerbungsInfo) {
          logger.info('🖱️ Кликаю на секцию...', { jobId });
      try {
        await page.waitForFunction(() => {
          const root = document.querySelector('#jobdetails-kontaktdaten-block');
          if (!root) return false;
          const t = (root.innerText || '').toLowerCase();
          return t.includes('telefon') || t.includes('e-mail') || t.includes('e‑mail');
        }, { timeout: 5000 });
      } catch (e) {
        // continue
      }
          await bewerbungsInfo.click();
          await new Promise(resolve => setTimeout(resolve, 3000));
          logger.info('✅ Секция открыта', { jobId });
        } else {
          logger.info('ℹ️ Секция "Informationen zur Bewerbung" не найдена', { jobId });
        }
        
      } catch (err) {
        logger.info('Ошибка при поиске секции "Informationen zur Bewerbung"', { 
          jobId, 
          error: err.message 
        });
      }

      // РЕАЛЬНЫЕ селекторы CAPTCHA найденные на сайте (ПРОВЕРЕНЫ!)
      const captchaSelectors = [
        'img[alt="Sicherheitsabfrage"]', // ✅ РАБОТАЕТ! Найден в тесте первым
        '#kontaktdaten-captcha-image', 
        'img[src*="/captcha/"]', 
        'img[src*="captcha"]',
        'img[id*="captcha"]',
        'img[title*="captcha"]',
        'img[title*="Sicherheit"]'
      ];

      let captchaElement = null;
      let usedSelector = '';

      // Проверяем каждый селектор
      for (const selector of captchaSelectors) {
        try {
          const elements = await page.$$(selector);
          if (elements.length > 0) {
            // Проверяем что элемент видимый
            const isVisible = await elements[0].evaluate(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            });
            
            if (isVisible) {
              captchaElement = elements[0];
              usedSelector = selector;
              logger.info(`🎯 Найден CAPTCHA элемент: ${selector}`, { jobId });
              break;
            }
          }
        } catch (err) {
          // Продолжаем поиск
        }
      }

      // Дополнительный поиск: ищем любые изображения в секции со словом "Sicherheitsabfrage"
      if (!captchaElement) {
        try {
          logger.info('Ищу CAPTCHA в текстовых секциях...', { jobId });
          const allImages = await page.$$('img');
          
          for (const img of allImages) {
            try {
              const src = await img.evaluate(el => el.src);
              const parentHtml = await img.evaluate(el => {
                let parent = el.parentElement;
                let depth = 0;
                while (parent && depth < 3) {
                  const html = parent.innerHTML.toLowerCase();
                  if (html.includes('sicherheitsabfrage') || html.includes('captcha') || 
                      html.includes('zeichen') || html.includes('kontaktdaten')) {
                    return html.substring(0, 200);
                  }
                  parent = parent.parentElement;
                  depth++;
                }
                return '';
              });

              if (parentHtml) {
                const rect = await img.boundingBox();
                if (rect && rect.width > 50 && rect.height > 20) {
                  captchaElement = img;
                  usedSelector = 'manual-search-in-sicherheitsabfrage';
                  logger.info(`🎯 Найден CAPTCHA в контексте: ${parentHtml.substring(0, 100)}`, { 
                    jobId, 
                    src: src.substring(0, 100) 
                  });
                  break;
                }
              }
            } catch (err) {
              // Продолжаем поиск
            }
          }
        } catch (err) {
          logger.info('Ошибка при расширенном поиске CAPTCHA', { jobId, error: err.message });
        }
      }

      if (!captchaElement) {
        // Дополнительная отладка - проверяем содержимое страницы
        const pageContent = await page.content();
        const hasCaptchaText = pageContent.toLowerCase().includes('sicherheitsabfrage');
        const hasZeichenText = pageContent.toLowerCase().includes('dargestellte zeichen');
        const hasFormText = pageContent.toLowerCase().includes('textfeld');
        
        logger.info('🔍 CAPTCHA анализ страницы', { 
          jobId,
          hasCaptchaText,
          hasZeichenText, 
          hasFormText,
          pageLength: pageContent.length,
          url: await page.url()
        });
        
        // Поиск всех img элементов для отладки
        const allImgSrcs = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('img')).map(img => ({
            src: img.src.substring(0, 100),
            alt: img.alt,
            width: img.width,
            height: img.height
          }));
        });
        
        logger.info('🖼️ Все изображения на странице', { jobId, images: allImgSrcs.slice(0, 10) });
        
        if (hasCaptchaText || hasZeichenText) {
          logger.warning('⚠️ Найден текст CAPTCHA но изображение не обнаружено!', { jobId });
          return false; // Есть CAPTCHA но не можем найти
        }
        
        logger.info('ℹ️ CAPTCHA не найдена на странице', { jobId });
        return true; // Не ошибка, просто нет CAPTCHA
      }

      // Прокручиваем к CAPTCHA элементу и ждем полной загрузки
      await captchaElement.scrollIntoView();
      await new Promise(resolve => setTimeout(resolve, 3000)); // Ждем дольше для полной загрузки
      
      // Проверяем размеры элемента перед скриншотом
      const elementSize = await captchaElement.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          visible: rect.width > 0 && rect.height > 0,
          src: el.src || 'no src',
          complete: el.complete || false
        };
      });
      
      logger.info('📐 Размеры CAPTCHA элемента:', { elementSize, jobId });
      
      if (!elementSize.visible || elementSize.width < 50 || elementSize.height < 20) {
        logger.error('❌ CAPTCHA элемент слишком мал или невидим', { elementSize, jobId });
        
        // Попробуем еще раз подождать и проверить
        await new Promise(resolve => setTimeout(resolve, 5000));
        const retrySize = await captchaElement.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0,
            src: el.src || 'no src',
            complete: el.complete || false
          };
        });
        
        logger.info('📐 Повторная проверка размеров CAPTCHA:', { retrySize, jobId });
        
        if (!retrySize.visible || retrySize.width < 50 || retrySize.height < 20) {
          return false;
        }
      }

      // Ждем еще немного для полной загрузки изображения
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Делаем скриншот CAPTCHA
      logger.info('📷 Делаю скриншот CAPTCHA...', { jobId, selector: usedSelector });
      const umlautRegex = /[äöüÄÖÜß]/;
      const startTime = Date.now();
      const maxDurationMs = 60000; // 60 сек на все попытки
      let attemptIndex = 0;
      let captchaText = null;
 
      while (Date.now() - startTime < maxDurationMs && attemptIndex < 3) {
        attemptIndex += 1;
        // 1) Пытаемся скачать по прямому URL src
        let captchaScreenshot = null;
        try {
          const src = await captchaElement.evaluate(el => el.getAttribute('src'));
          if (src && src.startsWith('http')) {
            const resp = await axios.get(src, { responseType: 'arraybuffer' });
            captchaScreenshot = Buffer.from(resp.data);
            logger.info(`📥 [CAPTCHA attempt #${attemptIndex}] downloaded by URL, bytes=${captchaScreenshot.length}`, { jobId });
          }
        } catch (e) {
          logger.warn('⚠️ Не удалось скачать CAPTCHA по URL, fallback на screenshot()', { jobId, attemptIndex, error: (e && e.message) ? e.message : String(e) });
        }
 
        // 2) Fallback: screenshot элемента
        if (!captchaScreenshot) {
          captchaScreenshot = await captchaElement.screenshot();
          logger.info(`📊 [CAPTCHA attempt #${attemptIndex}] bytes=${captchaScreenshot?.length || 0}`, { jobId });
        }
        if (!captchaScreenshot || captchaScreenshot.length === 0) {
          logger.error('❌ Не удалось получить изображение CAPTCHA (0 байт)', { jobId });
          return false;
        }
 
        logger.info('🔍 Отправляю CAPTCHA в 2Captcha...', { jobId, attemptIndex });
        const solved = await captchaService.solveCaptcha(captchaScreenshot);
        if (!solved) {
          logger.error('2Captcha вернула пустой результат', { jobId });
        } else {
          logger.info(`✅ 2Captcha решила CAPTCHA: "${solved}"`, { jobId, attemptIndex });
          captchaText = solved;
        }
 
        // Если есть умляуты/ß — перезагрузить изображение
        if (!captchaText || umlautRegex.test(captchaText)) {
          const reloaded = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const btn = buttons.find(b => /Anderes Bild laden|Neues Bild|Neues Captcha/i.test((b.textContent || ''))) 
                    || document.querySelector('#kontaktdaten-captcha-neues-bild-button');
            if (btn && typeof btn.click === 'function') {
              btn.click();
              return true;
            }
            return false;
          });
          logger.info(`🔄 Перезагрузка изображения CAPTCHA: ${reloaded ? 'кнопка найдена' : 'кнопка не найдена'}`, { jobId, attemptIndex });
          await new Promise(r => setTimeout(r, 2500));
          try {
            const refreshed = await page.$(usedSelector || 'img[alt="Sicherheitsabfrage"]');
            if (refreshed) captchaElement = refreshed;
          } catch {}
          continue;
        }
 
        break;
      }
 
      if (!captchaText) {
        logger.error('❌ Не удалось получить валидный текст CAPTCHA за отведенное время', { jobId });
        return false;
      }
 
      // РЕАЛЬНЫЙ селектор поля ввода CAPTCHA найденный на сайте
      const captchaInput = await page.$('#kontaktdaten-captcha-input');
      logger.info('🎯 Найдено поле ввода CAPTCHA: #kontaktdaten-captcha-input', { jobId });
 
      if (!captchaInput) {
        logger.error('❌ Не найдено поле для ввода CAPTCHA', { jobId });
        return false;
      }
 
      // Очищаем поле и вводим решение
      await captchaInput.evaluate(el => el.value = '');
      await captchaInput.type(captchaText, { delay: 120 });
 
      logger.info(`⌨️ Ввёл текст CAPTCHA: "${captchaText}"`, { jobId });
 
      // РЕАЛЬНЫЙ селектор кнопки отправки CAPTCHA найденный на сайте
      let submitButton = await page.$('#kontaktdaten-captcha-absenden-button');
      if (submitButton) {
        logger.info('🎯 Найдена кнопка отправки: #kontaktdaten-captcha-absenden-button', { jobId });
      } else {
        // Доп. поиск кнопки отправки по тексту и типу
        submitButton = await page.evaluateHandle(() => {
          const candidates = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]'));
          const match = candidates.find(el => {
            const t = (el.textContent || '').trim().toLowerCase();
            const v = (el.getAttribute('value') || '').trim().toLowerCase();
            return t === 'absenden' || t.includes('absenden') || v === 'absenden' || v.includes('absenden');
          });
          return match || null;
        });
        if (submitButton && (await submitButton.asElement()) !== null) {
          logger.info('🎯 Найдена альтернативная кнопка отправки по тексту "Absenden"', { jobId });
        } else {
          submitButton = null;
        }
      }
 
      if (submitButton) {
        // Отправляем форму
        await submitButton.click();
        logger.info('🔘 Кнопка отправки CAPTCHA нажата', { jobId });
        
        // Ждем обработки формы
        await new Promise(resolve => setTimeout(resolve, 5000));

        // На некоторых страницах нужно нажать кнопку раскрытия секции в заголовке
        try {
          await page.evaluate(() => {
            const headingBtn = document.querySelector('#jobdetails-kontaktdaten-heading button');
            if (headingBtn) headingBtn.click();
          });
        } catch {}
        
        // Проверяем успешность решения
        const pageAfterSubmit = await page.content();
        const stillHasCaptcha = await page.evaluate(() => {
          const selectors = [
            'img[alt="Sicherheitsabfrage"]',
            '#kontaktdaten-captcha-image',
            'img[src*="/captcha/"]',
            'img[src*="captcha"]'
          ];
          const el = selectors.map(sel => document.querySelector(sel)).find(Boolean);
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        });
 
        if (!stillHasCaptcha) {
          logger.info('🎉 CAPTCHA успешно решена и отправлена!', { jobId });
          // Повторно раскрываем блок контактов на всякий случай
          try {
            const section = await page.$('#jobdetails-kontaktdaten-block');
            if (section) { await section.click().catch(()=>{}); }
          } catch {}
          // Ждем появления контактов после успешной отправки
          try {
            await page.waitForFunction(() => {
              const root = document.querySelector('#jobdetails-kontaktdaten-block') || document.body;
              const t = (root?.innerText || '').toLowerCase();
              return t.includes('telefon') || t.includes('e-mail') || t.includes('e‑mail') || document.querySelector('a[href^="mailto:"]') || document.querySelector('a[href^="tel:"]');
            }, { timeout: 8000 });
            // Immediate labeled extraction after CAPTCHA success
            const labeled = await page.evaluate(() => {
              const out = { emails: [], phones: [] };
              const root = document.querySelector('#jobdetails-kontaktdaten-block') || document.body;
              if (!root) return out;
              const seen = new Set();
              const pushUnique = (arr, val) => { const v = String(val || '').trim(); if (v && !seen.has(v)) { seen.add(v); arr.push(v); } };
              const walk = (node) => {
                const anchors = node.querySelectorAll ? node.querySelectorAll('a[href^="mailto:"], a[href^="tel:"]') : [];
                anchors.forEach(a => {
                  const href = a.getAttribute('href') || '';
                  if (/^mailto:/i.test(href)) pushUnique(out.emails, href.replace(/^mailto:/i, ''));
                  if (/^tel:/i.test(href)) pushUnique(out.phones, href.replace(/^tel:/i, ''));
                });
                const txt = (node.innerText || '').replace(/[\u00A0\u202F\u2007]/g,' ').replace(/[\u200B\u200C\u200D]/g,'');
                const pm = txt.match(/Telefon\s*:\s*([+0-9\s()\-]{8,})/i); if (pm) pushUnique(out.phones, pm[1]);
                const em = txt.match(/E-?Mail\s*:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i); if (em) pushUnique(out.emails, em[1]);
                if (node.shadowRoot) walk(node.shadowRoot);
                const children = node.children ? Array.from(node.children) : [];
                children.forEach(walk);
              };
              walk(root);
              return out;
            });
            const pageUrl = await page.url();
            (labeled.emails||[]).forEach(e => contacts.push({ type:'email', value:String(e).trim(), source:pageUrl, confidence:'high' }));
            (labeled.phones||[]).forEach(p => {
              const norm = String(p).replace(/[^\d+]/g,'');
              const garbage = /^([0-9]{1,3}\s+){2,}[0-9]{1,3}$/.test(String(p).trim());
              if (!garbage && /^\+49\d{7,15}$/.test(norm)) {
                contacts.push({ type:'phone', value:String(p).trim(), source:pageUrl, confidence:'high' });
              }
            });
          } catch (e) { /* continue */ }
          return true;
        } else {
          logger.warning('⚠️ CAPTCHA все еще присутствует после отправки', { jobId });
          // Попытка программной отправки родительской формы
          try {
            const submitted = await page.evaluate(() => {
              const input = document.querySelector('#kontaktdaten-captcha-input');
              if (!input) return false;
              let form = input.closest('form');
              if (!form) form = document.querySelector('form[action*="captcha"], form[id*="captcha"]');
              if (form) {
                if (typeof form.requestSubmit === 'function') form.requestSubmit(); else form.submit();
                return true;
              }
              return false;
            });
            if (submitted) {
              logger.info('🔘 Родительская форма отправлена программно', { jobId });
              await new Promise(r => setTimeout(r, 4000));
              const still = await page.evaluate(() => !!document.querySelector('img[alt="Sicherheitsabfrage"], #kontaktdaten-captcha-image, img[src*="/captcha/"]'));
              if (!still) return true;
            }
          } catch {}
          // Доп. попытки с альтернативным регистром
          try {
            const captchaInputAlt = await page.$('#kontaktdaten-captcha-input');
            if (captchaInputAlt) {
              // lower-case попытка
              await captchaInputAlt.evaluate(el => el.value = '');
              await captchaInputAlt.type((captchaText || '').toLowerCase(), { delay: 100 });
              await submitButton.click();
              await new Promise(r => setTimeout(r, 3000));
              // раскрыть секцию ещё раз
              try { const s = await page.$('#jobdetails-kontaktdaten-block'); if (s) await s.click().catch(()=>{}); } catch {}
              const stillLower = await page.evaluate(() => {
                const sel = document.querySelector('img[alt="Sicherheitsabfrage"], #kontaktdaten-captcha-image, img[src*="/captcha/"]');
                if (!sel) return false;
                const r = sel.getBoundingClientRect(); const st = getComputedStyle(sel);
                return r.width>0 && r.height>0 && st.display!=='none' && st.visibility!=='hidden';
              });
              if (!stillLower) {
                logger.info('✅ CAPTCHA принята после lower-case попытки', { jobId });
                try {
                  await page.waitForFunction(() => !!(document.querySelector('a[href^="mailto:"]') || document.querySelector('a[href^="tel:"]')), { timeout: 5000 });
                } catch {}
                return true;
              }
              // upper-case попытка
              await captchaInputAlt.evaluate(el => el.value = '');
              await captchaInputAlt.type((captchaText || '').toUpperCase(), { delay: 100 });
              await submitButton.click();
              await new Promise(r => setTimeout(r, 3000));
              try { const s2 = await page.$('#jobdetails-kontaktdaten-block'); if (s2) await s2.click().catch(()=>{}); } catch {}
              const stillUpper = await page.evaluate(() => {
                const sel = document.querySelector('img[alt="Sicherheitsabfrage"], #kontaktdaten-captcha-image, img[src*="/captcha/"]');
                if (!sel) return false;
                const r = sel.getBoundingClientRect(); const st = getComputedStyle(sel);
                return r.width>0 && r.height>0 && st.display!=='none' && st.visibility!=='hidden';
              });
              if (!stillUpper) {
                logger.info('✅ CAPTCHA принята после upper-case попытки', { jobId });
                try {
                  await page.waitForFunction(() => !!(document.querySelector('a[href^="mailto:"]') || document.querySelector('a[href^="tel:"]')), { timeout: 5000 });
                } catch {}
                return true;
              }
            }
          } catch (e) {
            logger.warn('⚠️ Ошибка при альтернативных попытках ввода CAPTCHA', { jobId, error: (e && e.message) ? e.message : String(e) });
          }

          // Если CAPTCHA все еще на месте — делаем до 2 дополнительных циклов решения
          for (let retry = 1; retry <= 2; retry++) {
            logger.info(`🔄 Повторное решение CAPTCHA (цикл ${retry}/2)`, { jobId });
            // Перезагрузить изображение
            await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button, a'));
              const btn = buttons.find(b => /Anderes Bild laden|Neues Bild|Neues Captcha/i.test((b.textContent || ''))) 
                      || document.querySelector('#kontaktdaten-captcha-neues-bild-button');
              if (btn && typeof btn.click === 'function') (btn).click();
            });
            await new Promise(r => setTimeout(r, 2500));

            // Обновим ссылку на элемент и скачаем по URL
            let newCaptchaEl = await page.$(usedSelector || 'img[alt="Sicherheitsabfrage"]');
            if (!newCaptchaEl) newCaptchaEl = captchaElement; // fallback
            let buf = null;
            try {
              const src2 = await newCaptchaEl.evaluate(el => el.getAttribute('src'));
              if (src2 && src2.startsWith('http')) {
                const resp2 = await axios.get(src2, { responseType: 'arraybuffer' });
                buf = Buffer.from(resp2.data);
              }
            } catch {}
            if (!buf) buf = await newCaptchaEl.screenshot();
            const solved2 = await captchaService.solveCaptcha(buf);
            if (!solved2) {
              logger.warn('⚠️ Повторное решение вернуло пусто, продолжаю следующий цикл', { jobId, retry });
              continue;
            }
            // Вводим новый ответ
            const inputAgain = await page.$('#kontaktdaten-captcha-input');
            if (!inputAgain) return false;
            await inputAgain.evaluate(el => el.value = '');
            await inputAgain.type(solved2, { delay: 100 });
            const submitAgain = await page.$('#kontaktdaten-captcha-absenden-button');
            if (submitAgain) await submitAgain.click(); else await inputAgain.press('Enter');
            await new Promise(r => setTimeout(r, 4000));

            const htmlAfterRetry = await page.content();
            if (!htmlAfterRetry.includes('Sicherheitsabfrage')) {
              logger.info('✅ CAPTCHA принята после повторного решения', { jobId, retry });
              try {
                await page.waitForFunction(() => {
                  return !!(document.querySelector('a[href^="mailto:"]') || document.querySelector('a[href^="tel:"]'));
                }, { timeout: 5000 });
              } catch {}
              return true;
            }
          }

          return false;
        }
      } else {
        logger.warning('⚠️ Кнопка отправки CAPTCHA не найдена', { jobId });
        // Пробуем отправить через Enter
        await captchaInput.press('Enter');
        await new Promise(resolve => setTimeout(resolve, 3000));
        logger.info('⌨️ Отправил CAPTCHA через Enter', { jobId });
        return true;
      }

    } catch (error) {
      logger.error('❌ Ошибка при обработке CAPTCHA через 2Captcha:', {
        jobId,
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * УЛУЧШЕННАЯ обработка баннера cookies с множественными стратегиями
   * @param {Page} page - Страница Puppeteer
   * @param {string} jobId - ID вакансии для логирования
   * @returns {Promise<boolean>} - true если cookies приняты или баннер не найден
   */
  async handleCookieBanner(page, jobId) {
    try {
      logger.info('🍪 УЛУЧШЕННАЯ обработка cookies - запуск всех стратегий...', { jobId });

      // СТРАТЕГИЯ 1: Установка cookies напрямую через HTTP
      try {
        const cookiesList = [
          { name: 'cookie-consent', value: 'accepted', domain: '.arbeitsagentur.de' },
          { name: 'cookie-analytics', value: 'true', domain: '.arbeitsagentur.de' },
          { name: 'cookie-preferences', value: 'all', domain: '.arbeitsagentur.de' },
          { name: 'cookieAccepted', value: 'true', domain: '.arbeitsagentur.de' },
          { name: 'usercentrics-consent', value: 'accepted', domain: '.arbeitsagentur.de' },
          { name: 'uc_consent', value: 'accepted', domain: '.arbeitsagentur.de' },
          { name: 'cookielawinfo-checkbox-necessary', value: 'yes', domain: '.arbeitsagentur.de' },
          { name: 'cookielawinfo-checkbox-analytics', value: 'yes', domain: '.arbeitsagentur.de' },
          { name: 'cookielawinfo-checkbox-advertisement', value: 'yes', domain: '.arbeitsagentur.de' }
        ];
        
        await page.setCookie(...cookiesList);
        logger.info('✅ HTTP Cookies установлены напрямую', { jobId, count: cookiesList.length });
      } catch (cookieError) {
        logger.info('⚠️ HTTP Cookies установить не удалось', { jobId, error: cookieError.message });
      }

      // СТРАТЕГИЯ 2: LocalStorage и SessionStorage
      try {
        await page.evaluate(() => {
          const storageItems = [
            ['cookieConsent', 'accepted'],
            ['usercentrics_consent', 'true'],
            ['cookie_preference', 'all'],
            ['privacy_policy_accepted', 'true'],
            ['gdpr_consent', 'true']
          ];
          
          storageItems.forEach(([key, value]) => {
            try {
              localStorage.setItem(key, value);
              sessionStorage.setItem(key, value);
            } catch (e) {
              // Игнорируем ошибки
            }
          });
          
          console.log('✅ Storage данные установлены');
        });
        logger.info('✅ LocalStorage и SessionStorage настроены', { jobId });
      } catch (storageError) {
        logger.info('⚠️ Storage настроить не удалось', { jobId });
      }

      // СТРАТЕГИЯ 3: Ждем появления cookie модали с увеличенным таймаутом
      let cookieModalFound = false;
      
      for (let attempt = 0; attempt < 15; attempt++) { // Увеличил до 15 попыток
        console.log(`🔍 Расширенный поиск cookie modal ${attempt + 1}/15...`);
        
        // Прокручиваем страницу вверх и вниз для поиска модали
        if (attempt % 3 === 0) {
          await page.evaluate(() => {
            window.scrollTo(0, 0); // Вверх
          });
        } else if (attempt % 3 === 1) {
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight); // Вниз  
          });
        }
        
        // Проверяем наличие модального окна более тщательно
        const modalExists = await page.evaluate(() => {
          const bodyText = document.body.textContent || '';
          const htmlContent = document.documentElement.innerHTML || '';
          
          // Основные индикаторы
          const hasMainText = bodyText.includes('Verwendung von Cookies und anderen Technologien');
          const hasAcceptButton = bodyText.includes('Alle Cookies akzeptieren');
          const hasRejectButton = bodyText.includes('Alle Cookies ablehnen');
          
          // Альтернативные индикаторы
          const hasCookieText = bodyText.includes('Cookie') && bodyText.includes('akzeptieren');
          const hasConsentText = bodyText.includes('Einwilligung') || bodyText.includes('Zustimmung');
          const hasPrivacyText = bodyText.includes('Datenschutz') && bodyText.includes('Cookie');
          
          // Проверяем HTML на наличие модальных элементов
          const hasModalElements = htmlContent.includes('cookie-modal') || 
                                  htmlContent.includes('consent-modal') ||
                                  htmlContent.includes('privacy-modal') ||
                                  htmlContent.includes('usercentrics') ||
                                  htmlContent.includes('cookie-banner');
          
          const found = hasMainText || hasAcceptButton || hasRejectButton || 
                       hasCookieText || hasConsentText || hasPrivacyText || hasModalElements;
          
          if (found) {
            console.log('🎯 Cookie modal ОБНАРУЖЕН:', {
              hasMainText, hasAcceptButton, hasRejectButton,
              hasCookieText, hasConsentText, hasPrivacyText, hasModalElements
            });
          }
          
          return found;
        });

        if (modalExists) {
          cookieModalFound = true;
          logger.info('✅ Cookie consent модал найден!', { jobId, attempt: attempt + 1 });
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1500)); // Увеличенный интервал
      }

      if (!cookieModalFound) {
        console.log('ℹ️ Cookie modal не найден после расширенного поиска - возможно уже принят');
        logger.info('ℹ️ Cookie modal не найден - cookies возможно уже приняты', { jobId });
        return true; // Продолжаем работу
      }

      // СТРАТЕГИЯ 4: JavaScript API - расширенный список
      const jsApiResult = await page.evaluate(() => {
        console.log('🔧 Пытаюсь принять cookies через расширенный JavaScript API...');
        
        const jsApiAttempts = [
          // Стандартные API
          () => window.acceptAllCookies && window.acceptAllCookies(),
          () => window.cookieConsent && window.cookieConsent.accept(),
          () => window.cmp && window.cmp.acceptAll(),
          
          // Usercentrics API
          () => window.usercentrics && window.usercentrics.acceptAll(),
          () => window.UC_UI && window.UC_UI.acceptAllConsents(),
          
          // OneTrust API
          () => window.OneTrust && window.OneTrust.AllowAll(),
          () => window.Optanon && window.Optanon.Allow(),
          
          // Custom APIs
          () => window.gtag && window.gtag('consent', 'update', {'analytics_storage': 'granted', 'ad_storage': 'granted'}),
          () => window._paq && window._paq.push(['setConsentGiven']),
          
          // Component-based approaches
          () => {
            const cookieComponent = document.querySelector('bahf-cookie-disclaimer-dpl3');
            if (cookieComponent && cookieComponent.acceptAll) {
              cookieComponent.acceptAll();
              return true;
            }
            return false;
          },
          () => {
            const usercentrics = document.querySelector('[data-testid="uc-accept-all-button"]');
            if (usercentrics) {
              usercentrics.click();
              return true;
            }
            return false;
          }
        ];
        
        for (let i = 0; i < jsApiAttempts.length; i++) {
          try {
            const result = jsApiAttempts[i]();
            if (result) {
              console.log(`✅ Cookies приняты через JavaScript API метод ${i + 1}`);
              return true;
            }
          } catch (e) {
            // Продолжаем попытки
          }
        }
        
        console.log('⚠️ Все JavaScript API методы не сработали');
        return false;
      });
      
      if (jsApiResult) {
        logger.info('✅ Cookies приняты через расширенный JavaScript API', { jobId });
        await new Promise(resolve => setTimeout(resolve, 2000)); // Ждем применения
        return true;
      }

      // СТРАТЕГИЯ 5: Клик по кнопкам - улучшенный поиск
      logger.info('🎯 Расширенный поиск кнопок принятия cookies...', { jobId });
      
      const buttonClicked = await page.evaluate(() => {
        console.log('🔘 РАСШИРЕННЫЙ поиск кнопок в DOM...');
        
        // Все возможные селекторы кнопок
        const selectors = [
          'button', 'input[type="button"]', 'input[type="submit"]', 
          'a[role="button"]', '[role="button"]', '.button', 
          '[data-testid*="accept"]', '[data-testid*="consent"]',
          '[id*="accept"]', '[id*="consent"]', '[class*="accept"]',
          '[class*="consent"]', '[aria-label*="accept"]'
        ];
        
        const allButtons = [];
        selectors.forEach(selector => {
          try {
            const elements = Array.from(document.querySelectorAll(selector));
            allButtons.push(...elements);
          } catch (e) {
            // Игнорируем ошибки селекторов
          }
        });
        
        console.log(`Найдено ${allButtons.length} элементов для проверки`);
        
        // Расширенный список текстов для поиска
        const acceptTexts = [
          'Alle Cookies akzeptieren',
          'Akzeptieren',
          'Zustimmen', 
          'Einverstanden',
          'OK',
          'Accept All',
          'Accept all cookies',
          'Alle akzeptieren',
          'Alles akzeptieren',
          'Cookies akzeptieren',
          'Zustimmen und weiter',
          'Verstanden'
        ];
        
        for (let i = 0; i < allButtons.length; i++) {
          const button = allButtons[i];
          const text = (button.textContent || '').trim();
          const ariaLabel = button.getAttribute('aria-label') || '';
          const title = button.getAttribute('title') || '';
          const id = button.getAttribute('id') || '';
          const className = button.getAttribute('class') || '';
          
          // Проверяем все возможные атрибуты
          const allText = [text, ariaLabel, title, id, className].join(' ').toLowerCase();
          
          for (const acceptText of acceptTexts) {
            if (text === acceptText || 
                text.includes(acceptText) ||
                ariaLabel.includes(acceptText) ||
                title.includes(acceptText) ||
                allText.includes(acceptText.toLowerCase())) {
              
              // Проверяем видимость более тщательно
              const rect = button.getBoundingClientRect();
              const isVisible = rect.width > 0 && rect.height > 0;
              const style = window.getComputedStyle(button);
              const isDisplayed = style.display !== 'none' && style.visibility !== 'hidden';
              
              if (isVisible && isDisplayed) {
                console.log(`🎯 НАЙДЕНА КНОПКА: "${text}" (${acceptText})`);
                
                // Прокручиваем к кнопке перед кликом
                button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Пытаемся несколько способов клика
                try {
                  button.click();
                  console.log('✅ Кнопка нажата через click()!');
                  return true;
                } catch (e1) {
                  try {
                    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    console.log('✅ Кнопка нажата через dispatchEvent!');
                    return true;
                  } catch (e2) {
                    try {
                      button.focus();
                      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
                      console.log('✅ Кнопка нажата через Enter!');
                      return true;
                    } catch (e3) {
                      console.log('⚠️ Все способы клика не сработали для этой кнопки');
                    }
                  }
                }
              }
            }
          }
        }
        
        console.log('❌ Подходящая кнопка принятия cookies не найдена');
        return false;
      });

      if (buttonClicked) {
        logger.info('✅ Кнопка принятия cookies успешно нажата!', { jobId });
        
        // Ждем применения и возможного второго клика
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // СТРАТЕГИЯ 6: Второй клик если нужен
        logger.info('🔄 Проверяю нужен ли второй клик...', { jobId });
        
        const secondClickNeeded = await page.evaluate(() => {
          const bodyText = document.body.textContent || '';
          return bodyText.includes('Alle Cookies akzeptieren') || bodyText.includes('Auswahl bestätigen');
        });
        
        if (secondClickNeeded) {
          logger.info('🎯 Нужен второй клик - ищем еще раз...', { jobId });
          await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
            for (const button of buttons) {
              const text = (button.textContent || '').trim();
              if (text === 'Alle Cookies akzeptieren' || text === 'Auswahl bestätigen') {
                const rect = button.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  button.click();
                  console.log('✅ Второй клик выполнен!');
                  return true;
                }
              }
            }
            return false;
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        logger.info('✅ Процесс принятия cookies завершен', { jobId });
        return true;
      }

      // СТРАТЕГИЯ 7: Последняя попытка - принудительное скрытие модали
      logger.info('🎯 Последняя попытка - принудительное скрытие cookie модали...', { jobId });
      
      await page.evaluate(() => {
        // Ищем и скрываем все возможные модальные окна
        const modalSelectors = [
          '[class*="cookie"]', '[class*="consent"]', '[class*="privacy"]',
          '[id*="cookie"]', '[id*="consent"]', '[id*="privacy"]',
          '[data-testid*="cookie"]', '[data-testid*="consent"]',
          '.modal', '.overlay', '.banner', '[role="dialog"]'
        ];
        
        modalSelectors.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              const text = (el.textContent || '').toLowerCase();
              if (text.includes('cookie') || text.includes('consent') || text.includes('datenschutz')) {
                el.style.display = 'none';
                el.remove();
                console.log('🚫 Принудительно скрыт cookie элемент');
              }
            });
          } catch (e) {
            // Игнорируем ошибки
          }
        });
      });

      logger.info('⚠️ Cookies принятие завершено принудительно', { jobId });
      return true;

    } catch (error) {
      logger.error('❌ Критическая ошибка при обработке cookies:', {
        jobId,
        error: error.message,
        stack: error.stack
      });
      return true; // Продолжаем работу даже при ошибке
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = new WebScrapingService(); 