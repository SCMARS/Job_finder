const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const fs = require('fs');

const API_KEY = process.env.TWOCAPTCHA_API_KEY;

async function solveCaptcha(imageBase64) {
  console.log('📤 Отправляю CAPTCHA в 2captcha...');
  
  // Отправляем на 2captcha
  const res = await fetch(`http://2captcha.com/in.php`, {
    method: "POST",
    body: new URLSearchParams({
      key: API_KEY,
      method: "base64",
      body: imageBase64,
      json: 1,
    }),
  });
  const data = await res.json();

  if (data.status !== 1) {
    throw new Error("Не удалось отправить капчу: " + JSON.stringify(data));
  }

  const captchaId = data.request;
  console.log(`⏳ CAPTCHA ID: ${captchaId}, ждем решения...`);

  // Ждем решения
  let attempts = 0;
  while (attempts < 24) { // 2 минуты максимум
    await new Promise(r => setTimeout(r, 5000));
    attempts++;
    
    const check = await fetch(
      `http://2captcha.com/res.php?key=${API_KEY}&action=get&id=${captchaId}&json=1`
    );
    const checkData = await check.json();

    console.log(`🔄 Попытка ${attempts}: ${checkData.request}`);

    if (checkData.status === 1) {
      console.log(`✅ CAPTCHA решена: "${checkData.request}"`);
      return checkData.request; // решенный текст
    }
    if (checkData.request !== "CAPCHA_NOT_READY") {
      throw new Error("Ошибка 2captcha: " + checkData.request);
    }
  }
  
  throw new Error("Timeout: CAPTCHA не была решена за 2 минуты");
}

async function main() {
  console.log('🚀 Запуск теста CAPTCHA...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Переходим на конкретную вакансию где есть CAPTCHA
  console.log('🌐 Переход на страницу с CAPTCHA...');
  await page.goto("https://www.arbeitsagentur.de/jobsuche/jobdetail/12265-446593_JB4856617-S", {
    waitUntil: 'domcontentloaded',
    timeout: 10000
  });

  // Принимаем cookies
  console.log('🍪 Ищем кнопку cookies...');
  try {
    await page.waitForSelector('button', { timeout: 5000 });
    
    // Ищем все возможные варианты кнопок cookies
    const cookieSelectors = [
      "button[data-testid='uc-accept-all-button']",
      "button#uc-btn-accept-banner", 
      "button:contains('Alle Cookies akzeptieren')",
      "[data-testid='uc-accept-all-button']",
      ".uc-btn-accept-banner",
      "#consentAcceptAll",
      "[id*='accept']",
      "[class*='accept-all']",
      "button[title*='akzeptieren']"
    ];
    
    let cookieBtn = null;
    for (const selector of cookieSelectors) {
      try {
        cookieBtn = await page.$(selector);
        if (cookieBtn) {
          console.log(`🎯 Найдена кнопка cookies: ${selector}`);
          break;
        }
      } catch (e) {}
    }
    
    // Если не нашли по селекторам, ищем по тексту "Alle Cookies akzeptieren"
    if (!cookieBtn) {
      console.log('🔍 Ищем кнопку "Alle Cookies akzeptieren" по тексту...');
      cookieBtn = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button, div, span, a'));
        return buttons.find(btn => 
          btn.textContent && btn.textContent.trim() === 'Alle Cookies akzeptieren'
        );
      });
    }
    
    if (cookieBtn && cookieBtn.asElement) {
      console.log('🎯 Кликаем "Alle Cookies akzeptieren" первый раз...');
      await cookieBtn.asElement().click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // ВТОРОЙ КЛИК! Ищем кнопку еще раз
      console.log('🔄 Ищем "Alle Cookies akzeptieren" для второго клика...');
      const cookieBtn2 = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button, div, span, a'));
        return buttons.find(btn => 
          btn.textContent && btn.textContent.trim() === 'Alle Cookies akzeptieren'
        );
      });
      
      if (cookieBtn2 && cookieBtn2.asElement) {
        console.log('🎯 Кликаем "Alle Cookies akzeptieren" ВТОРОЙ раз...');
        await cookieBtn2.asElement().click();
        console.log('✅ Cookies приняты после двух кликов!');
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.log('✅ Cookies приняты после первого клика');
      }
    } else {
      console.log('⚠️ Cookie кнопка не найдена, продолжаем...');
    }
  } catch (e) {
    console.log('⚠️ Ошибка с cookies:', e.message);
  }

  // Кликаем на секцию контактов
  console.log('📧 Ищем секцию контактов...');
  
  // Пробуем разные способы найти контакты
  const contactSelectors = [
    '#jobdetails-kontaktdaten-block',
    '#jobdetails-kontaktdaten-heading',
    'h3[text*="Informationen zur Bewerbung"]',
    'h4[text*="Kontaktdaten"]',
    '.contact-section',
    '.kontakt',
    '[data-testid="contact"]'
  ];
  
  let contactSection = null;
  
  for (const selector of contactSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        contactSection = element;
        console.log(`✅ Найдена секция контактов: ${selector}`);
        break;
      }
    } catch (e) {
      // продолжаем поиск
    }
  }
  
  // Также ищем по тексту
  if (!contactSection) {
    try {
      await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        for (const el of elements) {
          if (el.textContent && el.textContent.includes('Informationen zur Bewerbung')) {
            el.click();
            return true;
          }
        }
        return false;
      });
      console.log('✅ Кликнули по тексту "Informationen zur Bewerbung"');
    } catch (e) {
      console.log('⚠️ Не удалось найти секцию контактов');
    }
  } else {
    await contactSection.click();
    console.log('✅ Секция контактов открыта');
  }
  
  await new Promise(resolve => setTimeout(resolve, 5000)); // Ждем дольше для загрузки CAPTCHA

  // Ищем CAPTCHA
  console.log('🔍 Ищем CAPTCHA...');
  const captchaSelectors = [
    "img[alt='Sicherheitsabfrage']",
    "img[src*='captcha']", 
    "#kontaktdaten-captcha-image",
    "img[id*='captcha']",
    ".captcha img",
    "img[title*='captcha']",
    "img[title*='Sicherheit']",
    ".sicherheitsabfrage img",
    "[data-testid*='captcha'] img"
  ];

  let captchaElement = null;
  let usedSelector = '';

  for (const selector of captchaSelectors) {
    try {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        captchaElement = elements[0];
        usedSelector = selector;
        console.log(`🎯 Найден CAPTCHA: ${selector}`);
        break;
      }
    } catch (e) {
      // продолжаем поиск
    }
  }

  if (!captchaElement) {
    console.log('❌ CAPTCHA не найдена!');
    console.log('📄 Содержимое страницы:');
    const content = await page.content();
    console.log(content.substring(0, 1000) + '...');
    await browser.close();
    return;
  }

  // Прокручиваем к CAPTCHA и ждем загрузки
  console.log('📜 Прокручиваем к CAPTCHA...');
  await captchaElement.scrollIntoView();
         await new Promise(resolve => setTimeout(resolve, 3000));

  // Проверяем размеры
  const elementInfo = await captchaElement.evaluate(el => ({
    width: el.offsetWidth,
    height: el.offsetHeight,
    src: el.src,
    complete: el.complete
  }));
  console.log('📐 Размеры CAPTCHA:', elementInfo);

  // Делаем скриншот
  console.log('📸 Делаю скриншот CAPTCHA...');
  const captchaBuffer = await captchaElement.screenshot({ 
    type: 'png'
  });
  
  // Сохраняем на диск для проверки
  fs.writeFileSync('captcha_debug.png', captchaBuffer);
  console.log('💾 Скриншот сохранен в captcha_debug.png');
  
  const captchaBase64 = captchaBuffer.toString("base64");
  console.log(`📊 Размер base64: ${captchaBase64.length} символов`);

  // Отправляем в 2captcha
  try {
    const captchaText = await solveCaptcha(captchaBase64);
    console.log(`🎉 CAPTCHA решена: "${captchaText}"`);

    // Вводим в поле
    console.log('⌨️ Ввожу решение в поле...');
    const inputField = await page.$('#kontaktdaten-captcha-input') ||
                      await page.$('input[name*="captcha"]') ||
                      await page.$('input[placeholder*="Zeichen"]');
    
    if (inputField) {
      await inputField.clear();
      await inputField.type(captchaText, { delay: 100 });
      console.log('✅ Текст введен');

      // Нажимаем кнопку отправки
      const submitBtn = await page.$('#kontaktdaten-captcha-absenden-button') ||
                       await page.$('button[type="submit"]') ||
                       await page.$('input[value*="Absenden"]');
      
      if (submitBtn) {
        await submitBtn.click();
        console.log('🔘 Кнопка отправки нажата');
        
        // Ждем результата
                 await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Проверяем результат
        const newContent = await page.content();
        if (newContent.includes('captcha') || newContent.includes('Sicherheitsabfrage')) {
          console.log('❌ CAPTCHA все еще присутствует');
        } else {
          console.log('🎉 CAPTCHA успешно решена!');
        }
      } else {
        console.log('❌ Кнопка отправки не найдена');
      }
    } else {
      console.log('❌ Поле ввода не найдено');
    }

  } catch (error) {
    console.error('❌ Ошибка при решении CAPTCHA:', error.message);
  }

  console.log('⏸️ Оставляю браузер открытым для проверки...');
  // await browser.close();
}

main().catch(console.error); 