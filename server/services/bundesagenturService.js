const axios = require('axios');
const logger = require('../utils/logger');

class BundesagenturService {
  constructor() {
    // Official API endpoint from documentation
    this.baseURL = process.env.BUNDESAGENTUR_API_URL || 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service';
    // Official clientId for authentication
    this.clientId = process.env.BUNDESAGENTUR_CLIENT_ID || 'jobboerse-jobsuche';
    this.defaultParams = {
      size: process.env.MAX_RESULTS_PER_SEARCH || 100,
      page: 1  // API requires page to be >= 1
    };

    // English to German city translation map
    this.cityTranslations = {
      // Major German cities
      'munich': 'München',
      'Munich': 'München',
      'MUNICH': 'München',
      'cologne': 'Köln',
      'Cologne': 'Köln',
      'COLOGNE': 'Köln',
      'nuremberg': 'Nürnberg',
      'Nuremberg': 'Nürnberg',
      'NUREMBERG': 'Nürnberg',
      'dresden': 'Dresden',
      'Dresden': 'Dresden',
      'frankfurt': 'Frankfurt',
      'Frankfurt': 'Frankfurt',
      'hamburg': 'Hamburg',
      'Hamburg': 'Hamburg',
      'berlin': 'Berlin',
      'Berlin': 'Berlin',
      'stuttgart': 'Stuttgart',
      'Stuttgart': 'Stuttgart',
      'dusseldorf': 'Düsseldorf',
      'Dusseldorf': 'Düsseldorf',
      'Düsseldorf': 'Düsseldorf',
      'DUSSELDORF': 'Düsseldorf',
      'hannover': 'Hannover',
      'Hannover': 'Hannover',
      'hanover': 'Hannover',
      'Hanover': 'Hannover',
      'leipzig': 'Leipzig',
      'Leipzig': 'Leipzig',
      'dortmund': 'Dortmund',
      'Dortmund': 'Dortmund',
      'essen': 'Essen',
      'Essen': 'Essen',
      'bremen': 'Bremen',
      'Bremen': 'Bremen',
      'duisburg': 'Duisburg',
      'Duisburg': 'Duisburg',
      'bochum': 'Bochum',
      'Bochum': 'Bochum',
      'wuppertal': 'Wuppertal',
      'Wuppertal': 'Wuppertal',
      'bielefeld': 'Bielefeld',
      'Bielefeld': 'Bielefeld',
      'bonn': 'Bonn',
      'Bonn': 'Bonn',
      'muenster': 'Münster',
      'Muenster': 'Münster',
      'munster': 'Münster',
      'Munster': 'Münster',
      'karlsruhe': 'Karlsruhe',
      'Karlsruhe': 'Karlsruhe',
      'mannheim': 'Mannheim',
      'Mannheim': 'Mannheim',
      'augsburg': 'Augsburg',
      'Augsburg': 'Augsburg',
      'wiesbaden': 'Wiesbaden',
      'Wiesbaden': 'Wiesbaden',
      'gelsenkirchen': 'Gelsenkirchen',
      'Gelsenkirchen': 'Gelsenkirchen',
      'moenchengladbach': 'Mönchengladbach',
      'Moenchengladbach': 'Mönchengladbach',
      'monchengladbach': 'Mönchengladbach',
      'Monchengladbach': 'Mönchengladbach',
      'braunschweig': 'Braunschweig',
      'Braunschweig': 'Braunschweig',
      'brunswick': 'Braunschweig',
      'Brunswick': 'Braunschweig',
      'chemnitz': 'Chemnitz',
      'Chemnitz': 'Chemnitz',
      'kiel': 'Kiel',
      'Kiel': 'Kiel',
      'aachen': 'Aachen',
      'Aachen': 'Aachen',
      'halle': 'Halle',
      'Halle': 'Halle',
      'magdeburg': 'Magdeburg',
      'Magdeburg': 'Magdeburg',
      'freiburg': 'Freiburg',
      'Freiburg': 'Freiburg',
      'krefeld': 'Krefeld',
      'Krefeld': 'Krefeld',
      'luebeck': 'Lübeck',
      'Luebeck': 'Lübeck',
      'lubeck': 'Lübeck',
      'Lubeck': 'Lübeck',
      'oberhausen': 'Oberhausen',
      'Oberhausen': 'Oberhausen',
      'erfurt': 'Erfurt',
      'Erfurt': 'Erfurt',
      'mainz': 'Mainz',
      'Mainz': 'Mainz',
      'rostock': 'Rostock',
      'Rostock': 'Rostock',
      'kassel': 'Kassel',
      'Kassel': 'Kassel',
      'hagen': 'Hagen',
      'Hagen': 'Hagen',
      'potsdam': 'Potsdam',
      'Potsdam': 'Potsdam',
      'saarbruecken': 'Saarbrücken',
      'Saarbruecken': 'Saarbrücken',
      'saarbrucken': 'Saarbrücken',
      'Saarbrucken': 'Saarbrücken',
      'hamm': 'Hamm',
      'Hamm': 'Hamm',
      'muelheim': 'Mülheim',
      'Muelheim': 'Mülheim',
      'mulheim': 'Mülheim',
      'Mulheim': 'Mülheim',
      'ludwigshafen': 'Ludwigshafen',
      'Ludwigshafen': 'Ludwigshafen',
      'leverkusen': 'Leverkusen',
      'Leverkusen': 'Leverkusen',
      'oldenburg': 'Oldenburg',
      'Oldenburg': 'Oldenburg',
      'neuss': 'Neuss',
      'Neuss': 'Neuss',
      'heidelberg': 'Heidelberg',
      'Heidelberg': 'Heidelberg',
      'paderborn': 'Paderborn',
      'Paderborn': 'Paderborn',
      'darmstadt': 'Darmstadt',
      'Darmstadt': 'Darmstadt',
      'regensburg': 'Regensburg',
      'Regensburg': 'Regensburg',
      'wuerzburg': 'Würzburg',
      'Wuerzburg': 'Würzburg',
      'wurzburg': 'Würzburg',
      'Wurzburg': 'Würzburg',
      'ingolstadt': 'Ingolstadt',
      'Ingolstadt': 'Ingolstadt',
      'heilbronn': 'Heilbronn',
      'Heilbronn': 'Heilbronn',
      'ulm': 'Ulm',
      'Ulm': 'Ulm',
      'wolfsburg': 'Wolfsburg',
      'Wolfsburg': 'Wolfsburg',
      'offenbach': 'Offenbach',
      'Offenbach': 'Offenbach',
      'pforzheim': 'Pforzheim',
      'Pforzheim': 'Pforzheim',
      'goettingen': 'Göttingen',
      'Goettingen': 'Göttingen',
      'gottingen': 'Göttingen',
      'Gottingen': 'Göttingen',
      'bottrop': 'Bottrop',
      'Bottrop': 'Bottrop',
      'trier': 'Trier',
      'Trier': 'Trier',
      'recklinghausen': 'Recklinghausen',
      'Recklinghausen': 'Recklinghausen',
      'reutlingen': 'Reutlingen',
      'Reutlingen': 'Reutlingen',
      'koblenz': 'Koblenz',
      'Koblenz': 'Koblenz',
      'remscheid': 'Remscheid',
      'Remscheid': 'Remscheid',
      'bergisch': 'Bergisch Gladbach',
      'gladbach': 'Bergisch Gladbach',
      'salzgitter': 'Salzgitter',
      'Salzgitter': 'Salzgitter',
      'cottbus': 'Cottbus',
      'Cottbus': 'Cottbus',
      'siegen': 'Siegen',
      'Siegen': 'Siegen',
      'hildesheim': 'Hildesheim',
      'Hildesheim': 'Hildesheim',
      'berlin': 'Berlin',
      'germany': 'Deutschland',
      'Germany': 'Deutschland',
      'GERMANY': 'Deutschland'
    };
  }

  /**
   * Translate English city name to German
   * @param {string} location - City name in English or German
   * @returns {string} German city name
   */
  translateCityName(location) {
    if (!location) return location;
    
    // Check if translation exists
    const germanName = this.cityTranslations[location];
    if (germanName) {
      logger.jobs.info('City name translated', { original: location, translated: germanName });
      return germanName;
    }
    
    // If no translation found, return original (might already be German)
    return location;
  }

  /**
   * Search for jobs using Bundesagentur official API
   * @param {Object} searchParams - Search parameters
   * @param {string} searchParams.keywords - Keywords to search for (was parameter)
   * @param {string} searchParams.location - Location filter (wo parameter)
   * @param {string} searchParams.employmentType - Employment type (arbeitszeit parameter)
   * @param {number} searchParams.radius - Search radius in km (umkreis parameter)
   * @param {string} searchParams.publishedSince - Date filter (veroeffentlichtseit parameter)
   * @returns {Promise<Object>} Search results
   */
  async searchJobs(searchParams = {}) {
    try {
      logger.jobs.info('Starting job search', { searchParams });

      // Convert to English city names - API works better with English names
      const englishLocation = this.translateToEnglish(searchParams.location) || searchParams.location || process.env.DEFAULT_LOCATION || 'Deutschland';

      const params = {
        ...this.defaultParams,
        was: searchParams.keywords || '',
        wo: englishLocation,
        umkreis: searchParams.radius || 25,
        veroeffentlichtseit: this.getDaysSincePublished(searchParams.publishedSince),
        arbeitszeit: this.mapEmploymentType(searchParams.employmentType),
        ...searchParams,
        // Override location with English version
        location: englishLocation
      };

      // Remove empty parameters
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });

      const config = {
        method: 'GET',
        url: `${this.baseURL}/pc/v4/jobs`,
        params,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'JobAutomationSystem/1.0',
          'X-API-Key': this.clientId
        }
      };

      logger.jobs.debug('Making API request', { url: config.url, params: config.params });

      const response = await axios(config);
      
      const results = {
        jobs: this.parseJobResults(response.data),
        totalCount: response.data.maxErgebnisse || 0,
        page: params.page || 0,
        searchParams: searchParams,
        timestamp: new Date().toISOString()
      };

      logger.jobs.info('Job search completed', { 
        totalFound: results.totalCount, 
        returned: results.jobs.length 
      });

      return results;
    } catch (error) {
      logger.jobs.error('Error searching jobs', { 
        error: error.message, 
        status: error.response?.status,
        data: error.response?.data 
      });
      throw new Error(`Failed to search jobs: ${error.message}`);
    }
  }

  /**
   * Parse job results from API response
   * @param {Object} data - Raw API response data
   * @returns {Array} Parsed job listings
   */
  parseJobResults(data) {
    if (!data || !data.stellenangebote) {
      return [];
    }

    return data.stellenangebote.map(job => ({
      id: job.hashId || job.refnr, 
      title: job.titel || job.beruf, 
      company: job.arbeitgeber || 'Not specified',
      location: job.arbeitsort?.ort || 'Not specified',
      employmentType: job.befristung,
      workingTime: job.arbeitszeit,
      description: job.stellenbeschreibung || '',
      requirements: job.anforderungen || '',
      benefits: job.arbeitgeberdarstellung || '',
      applicationDeadline: job.bewerbungsschluss,
      publishedDate: job.aktuelleVeroeffentlichungsdatum,
      externalUrl: job.externeUrl || this.generateJobUrl(job),
      contactEmail: this.extractContactEmail(job),
      contactPhone: this.extractContactPhone(job),
      salary: this.extractSalary(job),
      companyWebsite: this.extractCompanyWebsite(job),
      companyDomain: this.extractCompanyDomain(job),
      companySize: this.extractCompanySize(job),
      industryCategory: this.extractIndustryCategory(job),
      workingHours: job.arbeitszeit,
      keywords: job.beruf || [],
      region: job.arbeitsort?.region,
      postalCode: job.arbeitsort?.plz,
      coordinates: job.arbeitsort?.koordinaten,
      referenceNumber: job.refnr,
      hashId: job.hashId, // Keep separate hashId field
      rawData: job
    }));
  }

  /**
   * Extract contact email from job data
   * @param {Object} job - Job data
   * @returns {string|null} Contact email
   */
  extractContactEmail(job) {
    // Try to extract email from various fields
    const textFields = [
      job.stellenbeschreibung,
      job.arbeitgeberdarstellung,
      job.bewerbungshinweise,
      job.titel,
      job.beruf
    ].filter(Boolean);

    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    
    for (const text of textFields) {
      const match = text.match(emailRegex);
      if (match) {
        return match[0];
      }
    }

    // Generate potential email based on company name if no email found
    if (job.arbeitgeber) {
      const companyEmail = this.generateCompanyEmail(job.arbeitgeber);
      if (companyEmail) {
        return companyEmail;
      }
    }

    return null;
  }

  /**
   * Generate potential company email from company name
   * @param {string} companyName - Company name
   * @returns {string|null} Generated email
   */
  generateCompanyEmail(companyName) {
    if (!companyName) return null;

    // Clean company name
    let cleanName = companyName
      .toLowerCase()
      .replace(/gmbh|ag|se|kg|ohg|mbh|ltd|inc|corp|llc/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();

    if (cleanName.length < 3) return null;

    // Take first part if too long
    if (cleanName.length > 15) {
      cleanName = cleanName.substring(0, 15);
    }

    // Common HR email patterns
    const patterns = [
      `hr@${cleanName}.de`,
      `jobs@${cleanName}.de`,
      `karriere@${cleanName}.de`,
      `bewerbung@${cleanName}.de`
    ];

    // Return first pattern as most likely
    return patterns[0];
  }

  /**
   * Extract contact phone from job data
   * @param {Object} job - Job data
   * @returns {string|null} Contact phone
   */
  extractContactPhone(job) {
    const textFields = [
      job.stellenbeschreibung,
      job.arbeitgeberdarstellung,
      job.bewerbungshinweise
    ].filter(Boolean);

    // German phone number patterns
    const phoneRegex = /(?:\+49|0)[1-9]\d{1,14}/g;
    
    for (const text of textFields) {
      const match = text.match(phoneRegex);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  /**
   * Extract salary information from job data
   * @param {Object} job - Job data
   * @returns {string|null} Salary information
   */
  extractSalary(job) {
    // First try the verguetung field
    if (job.verguetung) {
      return job.verguetung;
    }

    // Search for salary in various text fields
    const textFields = [
      job.titel,
      job.stellenbeschreibung,
      job.arbeitgeberdarstellung
    ].filter(Boolean);

    // German salary patterns
    const salaryPatterns = [
      /(\d{1,3}\.?\d{0,3})\s*(?:bis|-)?\s*(\d{1,3}\.?\d{0,3})?\s*(?:€|EUR|Euro)\s*(?:brutto|netto)?/gi,
      /(?:entgelt|gehalt|vergütung|lohn):\s*(\d{1,3}\.?\d{0,3})\s*(?:bis|-)?\s*(\d{1,3}\.?\d{0,3})?\s*(?:€|EUR|Euro)/gi,
      /(\d{1,3}\.?\d{0,3})\s*k\s*€?/gi, // e.g., "50k €"
      /TV-L|TVöD|Entgeltgruppe|EG\s*\d+/gi // Public sector pay scales
    ];

    for (const text of textFields) {
      for (const pattern of salaryPatterns) {
        const match = text.match(pattern);
        if (match) {
          return match[0];
        }
      }
    }

    // Generate estimated salary based on job title
    return this.estimateSalaryByTitle(job.titel || job.beruf);
  }

  /**
   * Estimate salary based on job title
   * @param {string} title - Job title
   * @returns {string|null} Estimated salary range
   */
  estimateSalaryByTitle(title) {
    if (!title) return null;

    const titleLower = title.toLowerCase();
    
    // Senior positions
    if (titleLower.includes('senior') || titleLower.includes('lead') || titleLower.includes('architect')) {
      return '70.000 - 90.000 € brutto/Jahr';
    }
    
    // Management positions
    if (titleLower.includes('manager') || titleLower.includes('leiter') || titleLower.includes('head')) {
      return '80.000 - 120.000 € brutto/Jahr';
    }
    
    // Software/IT positions
    if (titleLower.includes('software') || titleLower.includes('developer') || titleLower.includes('engineer')) {
      return '50.000 - 70.000 € brutto/Jahr';
    }
    
    // Junior positions
    if (titleLower.includes('junior') || titleLower.includes('trainee') || titleLower.includes('praktikant')) {
      return '35.000 - 50.000 € brutto/Jahr';
    }
    
    // Medical positions
    if (titleLower.includes('pflege') || titleLower.includes('krankenschwester') || titleLower.includes('arzt')) {
      return '40.000 - 65.000 € brutto/Jahr';
    }
    
    // Teaching positions
    if (titleLower.includes('lehrer') || titleLower.includes('dozent') || titleLower.includes('professor')) {
      return '45.000 - 70.000 € brutto/Jahr';
    }

    // Default range for other positions
    return '40.000 - 60.000 € brutto/Jahr';
  }

  /**
   * Extract company website from job data
   * @param {Object} job - Job data
   * @returns {string|null} Company website URL
   */
  extractCompanyWebsite(job) {
    // Try to extract website from various fields
    const textFields = [
      job.stellenbeschreibung,
      job.arbeitgeberdarstellung,
      job.bewerbungshinweise
    ].filter(Boolean);

    // Website patterns
    const websitePatterns = [
      /https?:\/\/(?:www\.)?([a-zA-Z0-9-]+\.(?:[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?))(?:\/[^\s]*)?/gi,
      /www\.([a-zA-Z0-9-]+\.(?:[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?))/gi,
      /([a-zA-Z0-9-]+\.(?:de|com|org|net|eu|info))(?![a-zA-Z])/gi
    ];

    for (const text of textFields) {
      for (const pattern of websitePatterns) {
        const matches = text.match(pattern);
        if (matches) {
          // Clean and return first valid match
          let website = matches[0];
          if (!website.startsWith('http')) {
            website = 'https://' + website.replace(/^www\./, '');
          }
          return website;
        }
      }
    }

    // Try to generate from company name
    return this.generateCompanyWebsite(job.arbeitgeber);
  }

  /**
   * Generate potential company website from company name
   * @param {string} companyName - Company name
   * @returns {string|null} Generated website URL
   */
  generateCompanyWebsite(companyName) {
    if (!companyName) return null;

    // Clean company name for domain generation
    let cleanName = companyName
      .toLowerCase()
      .replace(/gmbh|ag|se|kg|ohg|mbh|ltd|inc|corp|llc/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();

    if (cleanName.length < 3) return null;

    // Take first part if too long
    if (cleanName.length > 20) {
      cleanName = cleanName.substring(0, 20);
    }

    return `https://www.${cleanName}.de`;
  }

  /**
   * Extract company domain from website or generate from name
   * @param {Object} job - Job data
   * @returns {string|null} Company domain
   */
  extractCompanyDomain(job) {
    const website = this.extractCompanyWebsite(job);
    if (website) {
      try {
        const url = new URL(website);
        return url.hostname.replace(/^www\./, '');
      } catch (e) {
        // If URL parsing fails, try to extract domain manually
        const domainMatch = website.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
        return domainMatch ? domainMatch[1] : null;
      }
    }
    return null;
  }

  /**
   * Extract company size information
   * @param {Object} job - Job data
   * @returns {string|null} Company size category
   */
  extractCompanySize(job) {
    const textFields = [
      job.stellenbeschreibung,
      job.arbeitgeberdarstellung
    ].filter(Boolean);

    // Company size indicators
    const sizePatterns = [
      { pattern: /(?:startup|start-up|gründung)/gi, size: 'startup' },
      { pattern: /(?:mitarbeiter|employees|team).*?(\d+)/gi, size: 'custom' },
      { pattern: /(?:klein|small|kmu)/gi, size: 'small' },
      { pattern: /(?:mittel|medium)/gi, size: 'medium' },
      { pattern: /(?:groß|large|konzern|corporation)/gi, size: 'large' },
      { pattern: /(?:international|global|worldwide)/gi, size: 'enterprise' }
    ];

    for (const text of textFields) {
      for (const { pattern, size } of sizePatterns) {
        const match = text.match(pattern);
        if (match) {
          if (size === 'custom' && match[1]) {
            const employeeCount = parseInt(match[1]);
            if (employeeCount < 50) return 'small';
            if (employeeCount < 250) return 'medium';
            if (employeeCount < 1000) return 'large';
            return 'enterprise';
          }
          return size;
        }
      }
    }

    // Default based on company name
    const companyName = job.arbeitgeber?.toLowerCase() || '';
    if (companyName.includes('gmbh') || companyName.includes('ag')) {
      return 'medium';
    }
    if (companyName.includes('konzern') || companyName.includes('group')) {
      return 'large';
    }

    return 'medium'; // Default assumption
  }

  /**
   * Extract industry category from job data
   * @param {Object} job - Job data
   * @returns {string|null} Industry category
   */
  extractIndustryCategory(job) {
    const textFields = [
      job.titel,
      job.beruf,
      job.stellenbeschreibung,
      job.arbeitgeberdarstellung
    ].filter(Boolean);

    // Industry keywords mapping
    const industryPatterns = [
      { pattern: /(?:software|IT|tech|digital|entwicklung|programming)/gi, industry: 'Technology' },
      { pattern: /(?:medizin|medical|pflege|kranken|health|gesundheit)/gi, industry: 'Healthcare' },
      { pattern: /(?:bank|finanz|finance|insurance|versicherung)/gi, industry: 'Finance' },
      { pattern: /(?:bildung|education|schule|university|lehrer)/gi, industry: 'Education' },
      { pattern: /(?:einzelhandel|retail|verkauf|sales|marketing)/gi, industry: 'Retail' },
      { pattern: /(?:produktion|manufacturing|industrie|fabrik)/gi, industry: 'Manufacturing' },
      { pattern: /(?:beratung|consulting|service|dienstleistung)/gi, industry: 'Consulting' },
      { pattern: /(?:logistik|transport|spedition|delivery)/gi, industry: 'Logistics' },
      { pattern: /(?:energie|energy|umwelt|environment|green)/gi, industry: 'Energy' },
      { pattern: /(?:automotive|auto|car|fahrzeug)/gi, industry: 'Automotive' }
    ];

    for (const text of textFields) {
      for (const { pattern, industry } of industryPatterns) {
        if (pattern.test(text)) {
          return industry;
        }
      }
    }

    return 'Other';
  }

  /**
   * Generate job URL when external URL is not available
   * @param {Object} job - Job object from API
   * @returns {string} Generated job URL
   */
  generateJobUrl(job) {
    if (job.hashId) {
      // Use Arbeitsagentur direct link with hashId
      return `https://www.arbeitsagentur.de/jobsuche/jobdetail/${job.hashId}`;
    } else if (job.refnr) {
      // Use reference number for search
      return `https://www.arbeitsagentur.de/jobsuche/suche?was=${encodeURIComponent(job.titel || '')}&wo=${encodeURIComponent(job.arbeitsort?.ort || '')}&referenznummer=${job.refnr}`;
    }
    // Fallback to general search
    return `https://www.arbeitsagentur.de/jobsuche/suche?was=${encodeURIComponent(job.titel || '')}&wo=${encodeURIComponent(job.arbeitsort?.ort || '')}`;
  }

  /**
   * Convert date to days since published parameter
   * @param {string} publishedSince - ISO date string
   * @returns {number} Days since published
   */
  getDaysSincePublished(publishedSince) {
    if (!publishedSince) return undefined;

    const now = new Date();
    const since = new Date(publishedSince);
    const daysDiff = Math.floor((now - since) / (1000 * 60 * 60 * 24));

    // API accepts 0-100 days
    return Math.min(Math.max(daysDiff, 0), 100);
  }

  /**
   * Translate city name from German to English (reverse translation)
   * @param {string} location - City name in German or English
   * @returns {string} City name in English
   */
  translateToEnglish(location) {
    if (!location) return location;

    // Create reverse mapping (German -> English)
    const englishTranslations = {
      'München': 'Munich',
      'Köln': 'Cologne',
      'Nürnberg': 'Nuremberg',
      'Düsseldorf': 'Dusseldorf',
      'Braunschweig': 'Brunswick',
      'Hannover': 'Hanover'
    };

    const englishName = englishTranslations[location];
    if (englishName) {
      logger.jobs.info('City name translated to English', { original: location, translated: englishName });
      return englishName;
    }

    return location; // Return original if no translation found
  }

  /**
   * Map employment type to API parameter
   * @param {string} employmentType - Employment type
   * @returns {string} API parameter value
   */
  mapEmploymentType(employmentType) {
    if (!employmentType) return undefined;

    const mapping = {
      'VOLLZEIT': 'vz',
      'TEILZEIT': 'tz',
      'SCHICHT_NACHTARBEIT_WOCHENENDE': 'snw',
      'HEIM_TELEARBEIT': 'ho',
      'MINIJOB': 'mj'
    };

    return mapping[employmentType.toUpperCase()] || employmentType;
  }

  /**
   * Get job details by ID
   * @param {string} jobId - Job reference number or hash ID
   * @returns {Promise<Object>} Job details
   */
  async getJobDetails(jobId) {
    try {
      logger.jobs.info('Fetching job details', { jobId });

      // Try different possible endpoints for job details
      const possibleUrls = [
        `${this.baseURL}/pc/v4/jobs/${jobId}`,
        `${this.baseURL}/pc/v4/app/jobs/${jobId}`
      ];

      let lastError;
      
      for (const url of possibleUrls) {
        try {
          const config = {
            method: 'GET',
            url: url,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'JobAutomationSystem/1.0',
              'X-API-Key': this.clientId
            }
          };

          const response = await axios(config);
          return this.parseJobResults({ stellenangebote: [response.data] })[0];
        } catch (error) {
          lastError = error;
          logger.jobs.debug('Job details endpoint failed', { url, error: error.message });
          continue;
        }
      }

      // If all endpoints fail, return a limited job object
      logger.jobs.warn('Job details endpoints not available, returning limited info', { jobId });
      return {
        id: jobId,
        title: 'Details not available',
        company: 'Unknown',
        location: 'Unknown',
        description: 'Job details endpoint not available. Please use the external URL to view full details.',
        externalUrl: null,
        referenceNumber: jobId,
        rawData: null
      };

    } catch (error) {
      logger.jobs.error('Error fetching job details', { 
        jobId, 
        error: error.message 
      });
      throw new Error(`Failed to fetch job details: ${error.message}`);
    }
  }
}

module.exports = new BundesagenturService(); 