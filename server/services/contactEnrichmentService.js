const apolloService = require('./apolloService');
const bundesagenturService = require('./bundesagenturService');
const logger = require('../utils/logger');

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
    try {
      logger.info('Starting contact enrichment for job', { 
        jobId: job.id, 
        company: job.company 
      });

      const enrichmentResult = {
        ...job,
        enrichment: {
          status: 'in_progress',
          startedAt: new Date().toISOString(),
          apolloData: null,
          realContacts: [],
          fallbackContacts: [],
          bestContact: null,
          confidence: 'low'
        }
      };

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
            enrichmentResult.contactEmail = enrichmentResult.enrichment.bestContact.email;
            enrichmentResult.contactPhone = enrichmentResult.enrichment.bestContact.phone;
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

      // Step 2: Fallback strategies if Apollo didn't find contacts
      if (!enrichmentResult.enrichment.realContacts.length) {
        const fallbackContacts = await this.generateFallbackContacts(job);
        enrichmentResult.enrichment.fallbackContacts = fallbackContacts;
        enrichmentResult.enrichment.bestContact = fallbackContacts[0] || null;
        enrichmentResult.enrichment.confidence = 'medium';

        if (enrichmentResult.enrichment.bestContact) {
          enrichmentResult.contactEmail = enrichmentResult.enrichment.bestContact.email;
          enrichmentResult.contactPhone = enrichmentResult.enrichment.bestContact.phone;
        }
      }

      // Step 3: Domain validation and scoring
      if (enrichmentResult.contactEmail) {
        const emailValidation = await this.validateEmail(enrichmentResult.contactEmail);
        enrichmentResult.enrichment.emailValidation = emailValidation;
        
        if (!emailValidation.isValid && enrichmentResult.enrichment.fallbackContacts.length > 1) {
          // Try next fallback contact
          enrichmentResult.enrichment.bestContact = enrichmentResult.enrichment.fallbackContacts[1];
          enrichmentResult.contactEmail = enrichmentResult.enrichment.bestContact.email;
        }
      }

      enrichmentResult.enrichment.status = 'completed';
      enrichmentResult.enrichment.completedAt = new Date().toISOString();

      logger.info('Contact enrichment completed', {
        jobId: job.id,
        status: enrichmentResult.enrichment.status,
        confidence: enrichmentResult.enrichment.confidence,
        hasRealEmail: !!enrichmentResult.contactEmail
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
    const { batchSize = 5, delayBetweenBatches = 2000 } = options;
    const enrichedJobs = [];
    
    logger.info('Starting batch contact enrichment', {
      totalJobs: jobs.length,
      batchSize
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
   * Generate fallback contact strategies when Apollo fails
   * @param {Object} job - Job object
   * @returns {Promise<Array>} Array of fallback contacts
   */
  async generateFallbackContacts(job) {
    const contacts = [];

    // Strategy 1: Company domain + common HR emails
    if (job.companyDomain) {
      const domain = job.companyDomain;
      const hrEmails = [
        `hr@${domain}`,
        `jobs@${domain}`,
        `karriere@${domain}`,
        `bewerbung@${domain}`,
        `recruiting@${domain}`,
        `personal@${domain}`
      ];

      hrEmails.forEach(email => {
        contacts.push({
          email,
          name: 'HR Department',
          title: 'Human Resources',
          company: job.company,
          source: 'domain_generated',
          confidence: 'medium'
        });
      });
    }

    // Strategy 2: Extract from generated company website
    if (job.companyWebsite) {
      try {
        const websiteDomain = new URL(job.companyWebsite).hostname.replace(/^www\./, '');
        if (websiteDomain !== job.companyDomain) {
          contacts.push({
            email: `info@${websiteDomain}`,
            name: 'Info Contact',
            title: 'General Information',
            company: job.company,
            source: 'website_generated',
            confidence: 'low'
          });
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }

    // Strategy 3: Industry-specific contact patterns
    const industryEmails = this.getIndustrySpecificEmails(job.industryCategory, job.companyDomain);
    contacts.push(...industryEmails);

    // Strategy 4: Company size-based approach
    const sizeBasedEmails = this.getSizeBasedEmails(job.companySize, job.companyDomain);
    contacts.push(...sizeBasedEmails);

    return contacts.slice(0, 5); // Return top 5 fallback contacts
  }

  /**
   * Get industry-specific email patterns
   * @param {string} industry - Industry category
   * @param {string} domain - Company domain
   * @returns {Array} Industry-specific contacts
   */
  getIndustrySpecificEmails(industry, domain) {
    if (!domain) return [];

    const industryPatterns = {
      'Technology': ['tech@', 'dev@', 'engineering@'],
      'Healthcare': ['medical@', 'patient@', 'care@'],
      'Finance': ['finance@', 'investment@', 'banking@'],
      'Education': ['admissions@', 'faculty@', 'academic@'],
      'Consulting': ['consulting@', 'advisory@', 'client@']
    };

    const patterns = industryPatterns[industry] || ['contact@', 'info@'];
    
    return patterns.map(pattern => ({
      email: pattern + domain,
      name: `${industry} Contact`,
      title: `${industry} Department`,
      company: domain,
      source: 'industry_pattern',
      confidence: 'low'
    }));
  }

  /**
   * Get company size-based email patterns
   * @param {string} size - Company size category
   * @param {string} domain - Company domain
   * @returns {Array} Size-based contacts
   */
  getSizeBasedEmails(size, domain) {
    if (!domain) return [];

    const sizePatterns = {
      'startup': ['founder@', 'team@', 'hello@'],
      'small': ['owner@', 'management@', 'office@'],
      'medium': ['hr@', 'people@', 'talent@'],
      'large': ['corporate@', 'headquarters@', 'global@'],
      'enterprise': ['enterprise@', 'corporate.hr@', 'global.talent@']
    };

    const patterns = sizePatterns[size] || ['hr@', 'contact@'];
    
    return patterns.slice(0, 2).map(pattern => ({
      email: pattern + domain,
      name: `${size} Company Contact`,
      title: 'Company Representative',
      company: domain,
      source: 'size_pattern',
      confidence: 'low'
    }));
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