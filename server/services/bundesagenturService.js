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
   * Parse job results from API response (simple version for speed)
   * @param {Object} data - Raw API response
   * @returns {Array} Array of job objects
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
      contactEmail: this.extractContactEmail(job),  // Simple method
      contactPhone: this.extractContactPhone(job),  // Simple method
      salary: this.extractSalary(job),
      companyWebsite: this.extractCompanyWebsite(job), // Simple method
      companyDomain: this.extractCompanyDomain(job),
      companySize: this.extractCompanySize(job),
      industryCategory: this.extractIndustryCategory(job),
      workingHours: job.arbeitszeit,
      keywords: job.beruf || [],
      region: job.arbeitsort?.region,
      postalCode: job.arbeitsort?.plz,
      coordinates: job.arbeitsort?.koordinaten,
      referenceNumber: job.refnr,
      hashId: job.hashId,
      rawData: job
    }));
  }

  /**
   * Extract contact email from job data (simplified)
   */
  extractContactEmail(job) {
    // Simple email extraction without complex regex
    const text = (job.stellenbeschreibung || '') + ' ' + (job.arbeitgeberdarstellung || '');
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    
    if (emailMatch) {
      return emailMatch[0];
    }

    // NO FAKE EMAIL GENERATION! Return null if not found
    return null;
  }

  /**
   * Extract contact phone from job data (simplified)
   */
  extractContactPhone(job) {
    const text = (job.stellenbeschreibung || '') + ' ' + (job.arbeitgeberdarstellung || '');
    const phoneMatch = text.match(/\+49[\s\-]?[\d\s\-]{8,15}|0[\d\s\-]{8,15}/);
    
    if (phoneMatch) {
      const phone = phoneMatch[0];
      // Фильтрируем мусорные номера (job IDs)
      if (phone.match(/^\d{10}-\d$/)) {
        return null; // Это job ID, не телефон
      }
      return phone;
    }
    
    return null;
  }

  /**
   * Parse contact information from Arbeitsagentur job page
   */
  async parseJobContactInfo(jobId) {
    try {
      const detailUrl = `https://www.arbeitsagentur.de/jobsuche/jobdetail/${jobId}`;
      
      logger.info('Parsing contact info from job page', {
        jobId,
        url: detailUrl,
        module: 'bundesagentur'
      });

      const response = await axios.get(detailUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const html = response.data;
      const contacts = {
        emails: [],
        phones: [],
        contactPerson: null,
        companyWebsite: null
      };

      // Extract emails
      const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      if (emailMatches) {
        contacts.emails = [...new Set(emailMatches)]; // Remove duplicates
      }

      // Extract phone numbers (German format)
      const phoneMatches = html.match(/(?:\+49|0)\s*\d{2,4}[\s\-]?\d{3,9}[\s\-]?\d{1,9}/g);
      if (phoneMatches) {
        contacts.phones = [...new Set(phoneMatches.map(phone => phone.replace(/\s+/g, ' ').trim()))];
      }

      // Extract contact person name
      const contactPersonMatch = html.match(/(?:Herr|Frau)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*)/);
      if (contactPersonMatch) {
        contacts.contactPerson = contactPersonMatch[0];
      }

      // Extract company homepage
      const homepageMatch = html.match(/Homepage[^<]*<[^>]*href="([^"]+)"/i) ||
                          html.match(/Internetseite[^<]*<[^>]*href="([^"]+)"/i);
      if (homepageMatch) {
        contacts.companyWebsite = homepageMatch[1];
      }

      logger.info('Contact parsing completed', {
        jobId,
        emailsFound: contacts.emails.length,
        phonesFound: contacts.phones.length,
        hasContactPerson: !!contacts.contactPerson,
        hasWebsite: !!contacts.companyWebsite,
        module: 'bundesagentur'
      });

      return contacts;

    } catch (error) {
      logger.warn('Failed to parse contact info from job page', {
        jobId,
        error: error.message,
        module: 'bundesagentur'
      });
      
      return {
        emails: [],
        phones: [],
        contactPerson: null,
        companyWebsite: null
      };
    }
  }

  /**
   * Extract company website from job data (simplified)
   */
  extractCompanyWebsite(job) {
    const text = (job.stellenbeschreibung || '') + ' ' + (job.arbeitgeberdarstellung || '');
    const websiteMatch = text.match(/https?:\/\/[^\s]+|www\.[^\s]+/);
    
    if (websiteMatch) {
      let website = websiteMatch[0];
      if (!website.startsWith('http')) {
        website = 'https://' + website;
      }
      return website;
    }

    // DON'T generate fake websites - return null if not found
    return null;
  }

  /**
   * Extract company domain (simplified)
   */
  extractCompanyDomain(job) {
    const website = this.extractCompanyWebsite(job);
    if (website) {
      const match = website.match(/\/\/(?:www\.)?([^\/]+)/);
      return match ? match[1] : null;
    }
    
    // Generate real domain pattern for email generation only
    if (job.arbeitgeber) {
      const domain = job.arbeitgeber.toLowerCase()
        .replace(/gmbh|ag|se|kg|ohg|ltd|inc|corp|llc/gi, '')
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 10);
      if (domain.length > 3) {
        return `${domain}.de`;
      }
    }
    
    return null;
  }

  /**
   * Extract salary information (simplified)
   */
  extractSalary(job) {
    return job.verguetung || '';
  }

  /**
   * Extract company size (simplified)
   */
  extractCompanySize(job) {
    return job.betriebsgroesse || '';
  }

  /**
   * Extract industry category (simplified)
   */
  extractIndustryCategory(job) {
    return job.branchengruppe || job.branche || '';
  }

  /**
   * Generate job URL (simplified)
   */
  generateJobUrl(job) {
    const id = job.hashId || job.refnr;
    return `https://www.arbeitsagentur.de/jobsuche/jobdetail/${id}`;
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