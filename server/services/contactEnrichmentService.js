const apolloService = require('./apolloService');
const bundesagenturService = require('./bundesagenturService');
const logger = require('../utils/logger');
const webScrapingService = require('./webScrapingService'); // Added import for webScrapingService

/**
 * Contact Enrichment Service
 * Orchestrates the complete workflow from job data to real contact information
 */
class ContactEnrichmentService {
  constructor() {
    this.rateLimitDelay = 1000; // 1 second between requests
    this.maxRetries = 3;
  }

  /**
   * Enrich a single job with real contact information
   * @param {Object} job - Job object from Bundesagentur
   * @returns {Promise<Object>} Enriched job with real contact data
   */
  async enrichJob(job) {
    // Initialize enrichment result
    const enrichmentResult = {
      ...job,
      enrichment: {
        status: 'started',
        startedAt: new Date().toISOString(),
        realContacts: [],
        confidence: 'none'
      }
    };

    try {
      // Step 0: Check if job already has contact info from original data
      if (job.contactEmail || job.contactPhone) {
        logger.info('Using existing contact data from job', {
          jobId: job.id,
          hasEmail: !!job.contactEmail,
          hasPhone: !!job.contactPhone
        });
        
        const existingContacts = [];
        if (job.contactEmail) {
          existingContacts.push({
            type: 'email',
            value: job.contactEmail,
            source: 'arbeitsagentur_original',
            confidence: 'high'
          });
        }
        if (job.contactPhone) {
          existingContacts.push({
            type: 'phone', 
            value: job.contactPhone,
            source: 'arbeitsagentur_original',
            confidence: 'high'
          });
        }
        
        if (existingContacts.length > 0) {
          enrichmentResult.enrichment.realContacts = existingContacts;
          enrichmentResult.enrichment.bestContact = existingContacts[0];
          enrichmentResult.enrichment.confidence = 'high';
          enrichmentResult.enrichment.hasRealEmail = !!job.contactEmail;
          
          // Set final contact fields
          if (job.contactEmail) {
            enrichmentResult.contactEmail = job.contactEmail;
          }
          if (job.contactPhone) {
            enrichmentResult.contactPhone = job.contactPhone;
          }
          
          enrichmentResult.enrichment.status = 'completed';
          enrichmentResult.enrichment.completedAt = new Date().toISOString();
          
          logger.info('Used existing contact data from job', {
            jobId: job.id,
            contactEmail: job.contactEmail,
            contactPhone: job.contactPhone,
            confidence: 'high'
          });
          
          return enrichmentResult;
        }
      }

      // Step 1: Parse contacts directly from Arbeitsagentur job page with advanced bypassing
      let arbeitsagenturContacts = null;
      if (job.id) {
        logger.info('Starting Arbeitsagentur scraping', { jobId: job.id });
        try {
          arbeitsagenturContacts = await webScrapingService.scrapeArbeitsagenturContacts(job.id);
          
          logger.info('Arbeitsagentur scraping completed', { 
            jobId: job.id, 
            contactsFound: arbeitsagenturContacts ? arbeitsagenturContacts.length : 0,
            hasContacts: !!(arbeitsagenturContacts && arbeitsagenturContacts.length > 0)
          });
          
          if (arbeitsagenturContacts && arbeitsagenturContacts.length > 0) {
            enrichmentResult.enrichment.arbeitsagenturData = { contacts: arbeitsagenturContacts };
            enrichmentResult.enrichment.realContacts = arbeitsagenturContacts;
            enrichmentResult.enrichment.bestContact = arbeitsagenturContacts[0];
            
            // Debug first few contacts
            logger.info('DEBUG: First 3 contacts found', {
              jobId: job.id,
              contact0: arbeitsagenturContacts[0] ? {email: arbeitsagenturContacts[0].value, type: arbeitsagenturContacts[0].type, confidence: arbeitsagenturContacts[0].confidence} : null,
              contact1: arbeitsagenturContacts[1] ? {email: arbeitsagenturContacts[1].value, type: arbeitsagenturContacts[1].type, confidence: arbeitsagenturContacts[1].confidence} : null,
              contact2: arbeitsagenturContacts[2] ? {email: arbeitsagenturContacts[2].value, type: arbeitsagenturContacts[2].type, confidence: arbeitsagenturContacts[2].confidence} : null
            });
            
            // Set email and phone from the contacts list
            const emailContact = arbeitsagenturContacts.find(c => c.type === 'email');
            const phoneContact = arbeitsagenturContacts.find(c => c.type === 'phone');
            const externalLinkContact = arbeitsagenturContacts.find(c => c.type === 'external_link');
            
            if (emailContact) {
              enrichmentResult.contactEmail = emailContact.value;
            }
            if (phoneContact) {
              // Дополнительная проверка на мусорные номера (job IDs)
              const phone = phoneContact.value;
              if (!phone.match(/^\d{10}-\d$/)) {
                enrichmentResult.contactPhone = phone;
              } else {
                logger.info('Отфильтрован мусорный номер (job ID)', { 
                  jobId: job.id, 
                  rejectedPhone: phone 
                });
              }
            }
            // НОВОЕ: обработка внешних ссылок
            // Проверяем что НЕТ реальных контактов (email или нормального телефона)
            const hasRealEmail = emailContact && emailContact.value && !emailContact.value.startsWith('http');
            const hasRealPhone = phoneContact && phoneContact.value && 
                                !phoneContact.value.match(/^\d{10}-\d$/) && 
                                !phoneContact.value.match(/^\d+\s\d+\s\d+/) && 
                                phoneContact.value.length > 7;
            
            if (externalLinkContact && !hasRealEmail && !hasRealPhone) {
              enrichmentResult.contactEmail = externalLinkContact.value;
              enrichmentResult.contactType = 'external_link';
              logger.info('🔗 Присвоена внешняя ссылка как контакт', { 
                jobId: job.id, 
                externalLink: enrichmentResult.contactEmail ? enrichmentResult.contactEmail.substring(0, 50) + '...' : 'undefined',
                hasRealEmail,
                hasRealPhone,
                phoneContactValue: phoneContact?.value?.substring(0, 20)
              });
            }
            
            // Присваиваем полный массив контактов к результату
            enrichmentResult.contacts = arbeitsagenturContacts.map(contact => ({
              type: contact.type,
              value: contact.value,
              confidence: contact.confidence,
              source: contact.source || 'arbeitsagentur'
            }));
            
            logger.info('Real contacts found via Arbeitsagentur page scraping', {
              jobId: job.id,
              contactsFound: arbeitsagenturContacts.length,
              primaryEmail: arbeitsagenturContacts[0].value,
              primaryType: arbeitsagenturContacts[0].type,
              primaryConfidence: arbeitsagenturContacts[0].confidence,
              emailFound: !!emailContact,
              phoneFound: !!phoneContact,
              confidence: 'very_high',
              methods: ['arbeitsagentur_advanced_scraping']
            });
            
            // Skip further enrichment steps if we found real contacts
            enrichmentResult.enrichment.confidence = 'very_high';
            enrichmentResult.enrichment.hasRealEmail = true;
            enrichmentResult.enrichment.status = 'completed';
            
            return enrichmentResult;
          } else {
            // Если нет контактных данных, сохраняем ссылку на вакансию
            const jobUrl = `https://www.arbeitsagentur.de/jobsuche/jobdetail/${job.id}`;
            enrichmentResult.jobUrl = jobUrl;
            logger.info('Нет контактных данных - сохранена ссылка на вакансию', { 
              jobId: job.id, 
              jobUrl 
            });
          }
        } catch (error) {
          logger.warn('Failed to scrape Arbeitsagentur contacts', {
            jobId: job.id,
            error: error.message
          });
          // В случае ошибки тоже сохраняем ссылку
          const jobUrl = `https://www.arbeitsagentur.de/jobsuche/jobdetail/${job.id}`;
          enrichmentResult.jobUrl = jobUrl;
        }
      }

      // Step 1: Use Apollo.io to find real contacts
      try {
        const apolloResult = await apolloService.enrichJob(job);
        enrichmentResult.enrichment.apolloData = apolloResult;

        if (apolloResult.contacts && apolloResult.contacts.length > 0) {
          enrichmentResult.enrichment.realContacts = apolloResult.contacts;
          enrichmentResult.enrichment.bestContact = apolloService.getBestContact(apolloResult.contacts);
          enrichmentResult.enrichment.confidence = 'high';
          
          // Update job with real contact info
          if (enrichmentResult.enrichment.bestContact) {
            if (enrichmentResult.enrichment.bestContact.type === 'email') {
              enrichmentResult.contactEmail = enrichmentResult.enrichment.bestContact.value;
            }
            if (enrichmentResult.enrichment.bestContact.type === 'phone') {
              enrichmentResult.contactPhone = enrichmentResult.enrichment.bestContact.value;
            }
            // Legacy support for old format
            enrichmentResult.contactName = enrichmentResult.enrichment.bestContact.name;
            enrichmentResult.contactTitle = enrichmentResult.enrichment.bestContact.title;
          }

          logger.info('Real contacts found via Apollo', {
            jobId: job.id,
            contactsFound: apolloResult.contacts.length,
            bestContact: enrichmentResult.enrichment.bestContact?.email?.substring(0, 5) + '***'
          });
        }
      } catch (apolloError) {
        logger.warn('Apollo enrichment failed, using fallback strategies', {
          jobId: job.id,
          error: apolloError.message
        });
      }

      // NO FALLBACK! Only real contacts
      if (!enrichmentResult.enrichment.realContacts.length) {
        // Попытка fallback: если у вакансии есть внешняя ссылка (externeUrl / externalUrl), вернем ее как контакт
        const externalUrlFromJob = job.externalUrl || job.rawData?.externeUrl;
        if (externalUrlFromJob) {
          enrichmentResult.contactEmail = externalUrlFromJob;
          enrichmentResult.contactType = 'external_link';
          enrichmentResult.enrichment.bestContact = { type: 'external_link', value: externalUrlFromJob };
          enrichmentResult.enrichment.confidence = 'medium';
          enrichmentResult.enrichment.hasRealEmail = false;
          logger.info('Using externalUrl from job as fallback external_link', {
            jobId: job.id,
            externalUrl: externalUrlFromJob?.substring(0, 80)
          });
        } else {
          logger.info('No real contacts found and no externalUrl available', {
            jobId: job.id,
            message: 'No contact enrichment available'
          });
          // Set everything to null - no fake data!
          enrichmentResult.enrichment.bestContact = null;
          enrichmentResult.enrichment.confidence = 'none';
          enrichmentResult.contactEmail = null;
          enrichmentResult.contactPhone = null;
          enrichmentResult.contactName = null;
          enrichmentResult.contactTitle = null;
          enrichmentResult.enrichment.hasRealEmail = false;
        }
      }

      // Step 3: Email validation (but NO fallback!)
      if (enrichmentResult.contactEmail) {
        const emailValidation = await this.validateEmail(enrichmentResult.contactEmail);
        enrichmentResult.enrichment.emailValidation = emailValidation;
        
        // NO FALLBACK! Keep real email even if validation fails
        logger.info('Email validation completed - keeping real email regardless', {
          jobId: job.id,
          isValid: emailValidation.isValid,
          email: enrichmentResult.contactEmail.substring(0, 10) + '***'
        });
      }

      enrichmentResult.enrichment.status = 'completed';
      enrichmentResult.enrichment.completedAt = new Date().toISOString();

      logger.info('Contact enrichment completed', {
        jobId: job.id,
        status: enrichmentResult.enrichment.status,
        confidence: enrichmentResult.enrichment.confidence,
        hasRealEmail: !!enrichmentResult.contactEmail,
        hasRealPhone: !!enrichmentResult.contactPhone
      });

      return enrichmentResult;

    } catch (error) {
      logger.error('Contact enrichment failed', {
        jobId: job.id,
        error: error.message
      });

      return {
        ...job,
        enrichment: {
          status: 'failed',
          error: error.message,
          completedAt: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Enrich multiple jobs with contact information
   * @param {Array} jobs - Array of job objects
   * @returns {Promise<Array>} Array of enriched jobs
   */
  async enrichJobs(jobs, options = {}) {
    // Для больших объемов используем меньший batch size
    const defaultBatchSize = jobs.length > 10 ? 3 : 3; // держим 3 по умолчанию
    const defaultDelay = jobs.length > 10 ? 1500 : 800; // ускоряем задержки
    
    const { 
      batchSize = defaultBatchSize, 
      delayBetweenBatches = defaultDelay,
      useWebScraping = true,
      useApollo = false 
    } = options;
    
    const enrichedJobs = [];
    
    logger.info('Starting batch contact enrichment', {
      totalJobs: jobs.length,
      batchSize,
      delayBetweenBatches,
      useWebScraping,
      strategy: jobs.length > 10 ? 'conservative' : 'normal'
    });

    // Process in batches to respect rate limits
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      logger.info('Processing enrichment batch', {
        batchNumber,
        batchSize: batch.length,
        totalBatches: Math.ceil(jobs.length / batchSize)
      });

      // Process batch in parallel
      const batchPromises = batch.map(job => this.enrichJob(job));
      const batchResults = await Promise.allSettled(batchPromises);

      // Collect results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          enrichedJobs.push(result.value);
        } else {
          logger.error('Job enrichment failed in batch', {
            jobId: batch[index].id,
            error: result.reason?.message
          });
          // Add job with failed enrichment
          enrichedJobs.push({
            ...batch[index],
            enrichment: {
              status: 'failed',
              error: result.reason?.message
            }
          });
        }
      });

      // Delay between batches
      if (i + batchSize < jobs.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    const successfulEnrichments = enrichedJobs.filter(job => 
      job.enrichment?.status === 'completed' && job.contactEmail
    ).length;

    logger.info('Batch contact enrichment completed', {
      totalJobs: jobs.length,
      successfulEnrichments,
      successRate: ((successfulEnrichments / jobs.length) * 100).toFixed(1) + '%'
    });

    return enrichedJobs;
  }

  /**
   * Validate email address format and domain
   * @param {string} email - Email to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateEmail(email) {
    const validation = {
      email,
      isValid: false,
      format: false,
      domain: false,
      mx: false,
      score: 0
    };

    // Format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    validation.format = emailRegex.test(email);

    if (!validation.format) {
      return validation;
    }

    // Domain validation
    const domain = email.split('@')[1];
    validation.domain = domain && domain.includes('.');

    // Simple domain check (not checking MX records for now to avoid complexity)
    if (validation.domain) {
      const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
      const isPersonalDomain = commonDomains.includes(domain.toLowerCase());
      
      validation.mx = !isPersonalDomain; // Assume business domains are valid
      validation.score = validation.mx ? 80 : 40; // Higher score for business domains
    }

    validation.isValid = validation.format && validation.domain;

    return validation;
  }

  /**
   * Get enrichment statistics
   * @param {Array} enrichedJobs - Array of enriched jobs
   * @returns {Object} Enrichment statistics
   */
  getEnrichmentStats(enrichedJobs) {
    const total = enrichedJobs.length;
    const completed = enrichedJobs.filter(job => job.enrichment?.status === 'completed').length;
    const withRealContacts = enrichedJobs.filter(job => 
      job.enrichment?.realContacts?.length > 0
    ).length;
    const withFallbackContacts = enrichedJobs.filter(job => 
      job.enrichment?.fallbackContacts?.length > 0
    ).length;
    const withValidEmails = enrichedJobs.filter(job => 
      job.contactEmail && job.enrichment?.emailValidation?.isValid
    ).length;

    return {
      total,
      completed,
      completionRate: ((completed / total) * 100).toFixed(1) + '%',
      realContactsFound: withRealContacts,
      realContactsRate: ((withRealContacts / total) * 100).toFixed(1) + '%',
      fallbackContactsUsed: withFallbackContacts,
      validEmailsFound: withValidEmails,
      validEmailRate: ((withValidEmails / total) * 100).toFixed(1) + '%'
    };
  }
}

module.exports = new ContactEnrichmentService(); 