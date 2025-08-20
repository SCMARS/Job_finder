const bundesagenturService = require('./bundesagenturService');
const googleSheetsService = require('./googleSheetsService');
const apolloService = require('./apolloService');
const instantlyService = require('./instantlyService');
const pipedriveService = require('./pipedriveService');
const contactEnrichmentService = require('./contactEnrichmentService');
const logger = require('../utils/logger');
const cron = require('cron');

class AutomationService {
  constructor() {
    this.isRunning = false;
    this.lastRunTime = null;
    this.scheduledJobs = new Map();
    this.totalRuns = 0;
    this.successfulRuns = 0;
    this.failedRuns = 0;
    this.lastRunStatus = 'Never';
    // Aggregates for stats
    this.sumJobsProcessed = 0;
    this.sumContactsEnriched = 0;
    // Multiple cities for comprehensive search
    this.searchCities = [
      'Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 
      'Stuttgart', 'Dusseldorf', 'Leipzig', 'Dortmund', 'Essen',
      'Bremen', 'Dresden', 'Hanover', 'Nuremberg', 'Duisburg'
    ];
    
    this.defaultSearchParams = {
      keywords: 'software',
      location: 'Deutschland',
      radius: 100,
      size: 50, // Per city (global cap enforced below)
      publishedSince: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // Last 30 days
    };
  }

  /**
   * Run the complete automation workflow
   * @param {Object} options - Automation options
   * @returns {Promise<Object>} Automation results
   */
  async runAutomation(options = {}) {
    if (this.isRunning) {
      throw new Error('Automation is already running');
    }

    try {
      this.isRunning = true;
      const startTime = new Date();

      logger.automation.info('Starting automation workflow', { options });

      const results = {
        startTime: startTime.toISOString(),
        endTime: null,
        steps: {
          jobSearch: { status: 'pending', data: null, error: null },
          sheetsStorage: { status: 'pending', data: null, error: null },
          enrichment: { status: 'pending', data: null, error: null },
          instantlyIntegration: { status: 'pending', data: null, error: null },
          pipedriveIntegration: { status: 'pending', data: null, error: null }
        },
        summary: {
          jobsFound: 0,
          jobsSaved: 0,
          contactsEnriched: 0,
          failedEnrichments: 0,
          leadsAdded: 0,
          dealsCreated: 0
        }
      };

      // Step 1: Search for jobs across multiple cities
      try {
        const searchParams = { ...this.defaultSearchParams, ...options.searchParams };
        const cap = Math.min(parseInt(searchParams.size) || 50, 200);
        let allJobs = [];
        let totalFound = 0;

        logger.automation.info('Starting multi-city job search', { 
          cities: this.searchCities.length,
          keywords: searchParams.keywords 
        });

        // Search in each city
        for (const city of this.searchCities) {
          try {
            const citySearchParams = { ...searchParams, location: city };
            const cityResults = await bundesagenturService.searchJobs(citySearchParams);
            
            if (cityResults.jobs && cityResults.jobs.length > 0) {
              allJobs = allJobs.concat(cityResults.jobs);
              totalFound += cityResults.totalCount || cityResults.jobs.length;
              
              logger.automation.info('City search completed', { 
                city: city,
                found: cityResults.jobs.length,
                total: cityResults.totalCount
              });
            }

            // Stop early when we have enough jobs collected
            if (allJobs.length >= cap) {
              logger.automation.info('Reached desired cap, stopping city search loop', { cap });
              break;
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (cityError) {
            logger.automation.warn('City search failed', { 
              city: city, 
              error: cityError.message 
            });
            // Continue with other cities
          }
        }

        // Remove duplicates based on job ID
        const uniqueJobs = allJobs.filter((job, index, self) => 
          index === self.findIndex(j => j.id === job.id)
        );
        
        // Enforce global cap across all cities
        const cappedJobs = uniqueJobs.slice(0, cap);
        
        results.steps.jobSearch.status = 'completed';
        results.steps.jobSearch.data = { 
          jobs: cappedJobs, 
          totalCount: totalFound,
          citiesSearched: this.searchCities.length
        };
        results.summary.jobsFound = cappedJobs.length;

        logger.automation.info('Multi-city job search completed', { 
          totalJobs: cappedJobs.length,
          uniqueJobs: cappedJobs.length,
          totalFound: totalFound,
          cities: this.searchCities.length
        });
      } catch (error) {
        results.steps.jobSearch.status = 'failed';
        results.steps.jobSearch.error = error.message;
        logger.automation.error('Job search failed', { error: error.message });
        throw error;
      }

      // Step 2: (Skipped) Save to sheets will occur AFTER enrichment to include real contacts
      results.steps.sheetsStorage.status = 'skipped';

      // Step 3: Enrich jobs with real contact information
      if (options.enableEnrichment !== false && results.steps.jobSearch.data.jobs.length > 0) {
        try {
          logger.automation.info('Starting enhanced contact enrichment', {
            jobsToEnrich: results.steps.jobSearch.data.jobs.length
          });

          const enriched = [];
          for (const job of results.steps.jobSearch.data.jobs) {
            try {
              const enrichedJob = await contactEnrichmentService.enrichJob(job);
              enriched.push(enrichedJob);
              results.summary.contactsEnriched++;
            } catch (error) {
              results.summary.failedEnrichments = (results.summary.failedEnrichments || 0) + 1;
              results.errors = results.errors || [];
              results.errors.push({ jobId: job.id, error: error.message });
            }

            // Respect rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          results.steps.enrichment.status = 'completed';
          results.steps.enrichment.data = { enrichedCount: results.summary.contactsEnriched };

          // Save enriched jobs to Google Sheets
          try {
            const saveRes = await googleSheetsService.saveJobs(enriched);
            results.steps.sheetsStorage.status = 'completed_after_enrichment';
            results.steps.sheetsStorage.data = saveRes;
            results.summary.jobsSaved = saveRes.saved;
            logger.automation.info('Enriched jobs saved to Google Sheets', { saved: saveRes.saved });
          } catch (e) {
            results.steps.sheetsStorage.status = 'failed_after_enrichment';
            results.steps.sheetsStorage.error = e.message;
            logger.automation.error('Failed to save enriched jobs to sheets', { error: e.message });
          }
        } catch (error) {
          results.steps.enrichment.status = 'failed';
          results.steps.enrichment.error = error.message;
          logger.automation.error('Contact enrichment failed', { error: error.message });
          throw error;
        }
      }

      // Step 4: Add contacts to Instantly campaign
      if (options.instantlyCampaignId && results.steps.enrichment.data?.enrichedContacts?.length > 0) {
        try {
          const instantlyResults = await this.addContactsToInstantly(
            options.instantlyCampaignId,
            results.steps.enrichment.data.enrichedContacts
          );
          
          results.steps.instantlyIntegration.status = 'completed';
          results.steps.instantlyIntegration.data = instantlyResults;
          results.summary.leadsAdded = instantlyResults.successful;

          logger.automation.info('Contacts added to Instantly', { 
            added: instantlyResults.successful 
          });
        } catch (error) {
          results.steps.instantlyIntegration.status = 'failed';
          results.steps.instantlyIntegration.error = error.message;
          logger.automation.error('Instantly integration failed', { error: error.message });
        }
      }

      // Step 5: Check for positive responses and create Pipedrive leads
      if (options.checkInstantlyResponses && options.instantlyCampaignId) {
        try {
          const pipedriveResults = await this.processInstantlyResponses(
            options.instantlyCampaignId
          );
          
          results.steps.pipedriveIntegration.status = 'completed';
          results.steps.pipedriveIntegration.data = pipedriveResults;
          results.summary.dealsCreated = pipedriveResults.dealsCreated;

          logger.automation.info('Pipedrive integration completed', { 
            deals: pipedriveResults.dealsCreated 
          });
        } catch (error) {
          results.steps.pipedriveIntegration.status = 'failed';
          results.steps.pipedriveIntegration.error = error.message;
          logger.automation.error('Pipedrive integration failed', { error: error.message });
        }
      }

      // Mark run success and update aggregates
      results.endTime = new Date().toISOString();
      this.totalRuns += 1;
      this.successfulRuns += 1;
      this.lastRunStatus = 'success';
      this.lastRunTime = results.endTime;
      this.sumJobsProcessed += results.summary.jobsFound;
      this.sumContactsEnriched += results.summary.contactsEnriched;

      return results;
    } catch (e) {
      // Failure path
      this.totalRuns += 1;
      this.failedRuns += 1;
      this.lastRunStatus = 'failed';
      this.lastRunTime = new Date().toISOString();
      throw e;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Enrich job contacts using Apollo
   * @param {Array} jobs - Array of jobs to enrich
   * @returns {Promise<Object>} Enrichment results
   */
  async enrichJobContacts(jobs) {
    const results = {
      totalJobs: jobs.length,
      successfulEnrichments: 0,
      failedEnrichments: 0,
      enrichedContacts: [],
      errors: []
    };

    for (const job of jobs) {
      try {
        const enrichmentResult = await apolloService.enrichJob(job);
        
        if (enrichmentResult.status === 'completed' && enrichmentResult.contacts.length > 0) {
          results.successfulEnrichments++;
          
          // Get the best contact
          const bestContact = apolloService.getBestContact(enrichmentResult.contacts);
          if (bestContact) {
            // Add job context to contact
            bestContact.jobId = job.id;
            bestContact.jobTitle = job.title;
            bestContact.jobUrl = job.externalUrl;
            bestContact.applicationDeadline = job.applicationDeadline;
            
            results.enrichedContacts.push(bestContact);

            // Update Google Sheets with enriched data
            await googleSheetsService.updateJobStatus(job.id, {
              enrichedEmail: bestContact.email,
              enrichedPhone: bestContact.phone,
              apolloStatus: 'Completed',
              processingStatus: 'Enriched'
            });
          }
        } else {
          results.failedEnrichments++;
          
          // Update sheets with no contacts found status
          await googleSheetsService.updateJobStatus(job.id, {
            apolloStatus: 'No contacts found',
            processingStatus: 'Manual Needed'
          });
        }

        // Add delay to respect Apollo rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.failedEnrichments++;
        results.errors.push({
          jobId: job.id,
          error: error.message
        });

        // Update sheets with error status
        await googleSheetsService.updateJobStatus(job.id, {
          apolloStatus: 'Error',
          processingStatus: 'Error'
        });
      }
    }

    return results;
  }

  /**
   * Add enriched contacts to Instantly campaign
   * @param {string} campaignId - Instantly campaign ID
   * @param {Array} contacts - Array of enriched contacts
   * @returns {Promise<Object>} Instantly results
   */
  async addContactsToInstantly(campaignId, contacts) {
    const results = await instantlyService.bulkAddLeads(campaignId, contacts);

    // Update Google Sheets with Instantly status
    for (const contact of contacts) {
      const status = results.errors.some(err => err.email === contact.email) ? 'Failed' : 'Added';
      await googleSheetsService.updateJobStatus(contact.jobId, {
        instantlyStatus: status,
        processingStatus: status === 'Added' ? 'In Campaign' : 'Error'
      });
    }

    return results;
  }

  /**
   * Process Instantly responses and create Pipedrive leads for positive ones
   * @param {string} campaignId - Instantly campaign ID
   * @returns {Promise<Object>} Processing results
   */
  async processInstantlyResponses(campaignId) {
    const results = {
      totalReplies: 0,
      positiveReplies: 0,
      dealsCreated: 0,
      errors: []
    };

    try {
      // Get recent replies (last 24 hours)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const replies = await instantlyService.getCampaignReplies(campaignId, { since });
      
      results.totalReplies = replies.length;

      for (const reply of replies) {
        if (reply.isPositive) {
          results.positiveReplies++;

          try {
            // Get job and contact info from Google Sheets
            const jobInfo = await this.getJobInfoByEmail(reply.email);
            
            if (jobInfo) {
              const responseData = {
                contact: {
                  email: reply.email,
                  company: jobInfo.company,
                  fullName: `${jobInfo.company} Contact`, // Use company name as fallback
                  phone: jobInfo.enrichedPhone || null
                },
                jobTitle: jobInfo.title,
                jobUrl: jobInfo.externalUrl,
                applicationDeadline: jobInfo.applicationDeadline
              };

              const leadResult = await pipedriveService.createLeadFromResponse(responseData);
              
              if (leadResult.success) {
                results.dealsCreated++;

                // Update Google Sheets
                await googleSheetsService.updateJobStatus(jobInfo.id, {
                  pipedriveStatus: 'Deal Created',
                  processingStatus: 'Converted'
                });

                // Add note to Pipedrive deal with the original reply
                await pipedriveService.addNoteToDeal(
                  leadResult.dealId,
                  `Original Email Reply:\n\nSubject: ${reply.subject}\n\nMessage:\n${reply.message}`
                );
              }
            }
          } catch (error) {
            results.errors.push({
              replyId: reply.id,
              email: reply.email,
              error: error.message
            });
          }
        }
      }
    } catch (error) {
      logger.automation.error('Failed to process Instantly responses', { error: error.message });
      throw error;
    }

    return results;
  }

  /**
   * Get job information by contact email from Google Sheets
   * @param {string} email - Contact email
   * @returns {Promise<Object|null>} Job information
   */
  async getJobInfoByEmail(email) {
    try {
      return await googleSheetsService.getJobByEnrichedEmail(email);
    } catch (error) {
      logger.automation.error('Failed to get job info by email', { 
        email: email.substring(0, 3) + '***',
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Schedule automation to run at regular intervals
   * @param {string} cronPattern - Cron pattern for scheduling
   * @param {Object} options - Automation options
   * @returns {string} Job ID
   */
  scheduleAutomation(cronPattern, options = {}) {
    const jobId = `automation_${Date.now()}`;
    
    try {
      const job = new cron.CronJob(cronPattern, async () => {
        try {
          logger.automation.info('Running scheduled automation', { jobId, options });
          await this.runAutomation(options);
        } catch (error) {
          logger.automation.error('Scheduled automation failed', { 
            jobId, 
            error: error.message 
          });
        }
      });

      this.scheduledJobs.set(jobId, job);
      job.start();

      logger.automation.info('Automation scheduled', { jobId, cronPattern });
      
      return jobId;
    } catch (error) {
      logger.automation.error('Failed to schedule automation', { 
        jobId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Stop scheduled automation
   * @param {string} jobId - Job ID to stop
   * @returns {boolean} Success status
   */
  stopScheduledAutomation(jobId) {
    try {
      const job = this.scheduledJobs.get(jobId);
      if (job) {
        job.stop();
        this.scheduledJobs.delete(jobId);
        
        logger.automation.info('Scheduled automation stopped', { jobId });
        return true;
      }
      return false;
    } catch (error) {
      logger.automation.error('Failed to stop scheduled automation', { 
        jobId, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Stop all scheduled automations
   * @returns {Array} Array of stopped job IDs
   */
  stopAllScheduledAutomations() {
    const stoppedJobs = [];
    
    try {
      for (const [jobId, job] of this.scheduledJobs) {
        job.stop();
        stoppedJobs.push(jobId);
        
        logger.automation.info('Stopped scheduled automation', { jobId });
      }
      
      this.scheduledJobs.clear();
      
      logger.automation.info('All scheduled automations stopped', { 
        count: stoppedJobs.length 
      });
      
      return stoppedJobs;
    } catch (error) {
      logger.automation.error('Failed to stop all scheduled automations', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get automation status
   * @returns {Object} Current automation status
   */
  getStatus() {
    const isScheduled = this.scheduledJobs.size > 0;
    const nextRun = isScheduled ? this.getNextRunTime() : null;
    const totalRunsSafe = Math.max(this.totalRuns || 0, 1);
    const avgJobsPerRun = (this.sumJobsProcessed || 0) / totalRunsSafe;
    const avgEnrichmentRate = (this.sumContactsEnriched || 0) && (this.sumJobsProcessed || 0)
      ? ((this.sumContactsEnriched / this.sumJobsProcessed) * 100)
      : 0;
    
    return {
      isRunning: this.isRunning,
      isScheduled: isScheduled,
      lastRun: this.lastRunTime,
      nextRun: nextRun,
      scheduleCron: isScheduled ? this.getCurrentCronPattern() : null,
      defaultSearchParams: {
        keywords: this.defaultSearchParams.keywords,
        location: this.defaultSearchParams.location,
        radius: this.defaultSearchParams.radius,
        size: this.defaultSearchParams.size,
        publishedSince: this.calculateDaysSince(this.defaultSearchParams.publishedSince)
      },
      stats: {
        totalRuns: this.totalRuns || 0,
        successfulRuns: this.successfulRuns || 0,
        failedRuns: this.failedRuns || 0,
        lastRunStatus: this.lastRunStatus || 'Never',
        avgJobsPerRun: Number(avgJobsPerRun.toFixed(1)),
        avgEnrichmentRate: Number(avgEnrichmentRate.toFixed(1)),
        avgConversionRate: 0
      }
    };
  }

  /**
   * Calculate days since a date for frontend display
   */
  calculateDaysSince(dateString) {
    if (!dateString) return 30;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Get next run time (simplified)
   */
  getNextRunTime() {
    // For now return a placeholder - could be enhanced with actual cron calculation
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Next day
  }

  /**
   * Get current cron pattern (simplified)
   */
  getCurrentCronPattern() {
    return '0 9 * * MON'; // Default pattern
  }

  /**
   * Update default search parameters
   * @param {Object} newParams - New search parameters
   */
  updateDefaultSearchParams(newParams) {
    this.defaultSearchParams = { ...this.defaultSearchParams, ...newParams };
    logger.automation.info('Default search parameters updated', { 
      newParams: this.defaultSearchParams 
    });
  }

  /**
   * Update jobs in Google Sheets with enrichment data
   * @param {Array} enrichedJobs - Array of enriched jobs
   */
  async updateJobsWithEnrichmentData(enrichedJobs) {
    try {
      logger.automation.info('Updating Google Sheets with enrichment data', {
        jobsToUpdate: enrichedJobs.length
      });

      const updatePromises = enrichedJobs.map(async (job) => {
        if (job.enrichment?.status === 'completed' && job.contactEmail) {
          try {
            await googleSheetsService.updateJobEnrichmentStatus(job.id, {
              contactEmail: job.contactEmail,
              contactPhone: job.contactPhone || '',
              contactName: job.contactName || '',
              contactTitle: job.contactTitle || '',
              enrichmentStatus: job.enrichment.confidence === 'high' ? 'Apollo Verified' : 'Generated',
              enrichmentSource: job.enrichment.realContacts?.length > 0 ? 'Apollo.io' : 'Fallback Strategy',
              enrichmentScore: job.enrichment.emailValidation?.score || 0,
              lastEnriched: job.enrichment.completedAt
            });
          } catch (updateError) {
            logger.automation.warn('Failed to update job enrichment in sheets', {
              jobId: job.id,
              error: updateError.message
            });
          }
        }
      });

      await Promise.allSettled(updatePromises);
    } catch (error) {
      logger.automation.error('Failed updating enrichment data in sheets', { error: error.message });
    }
  }

  /**
   * Extract enriched contacts for Instantly integration
   * @param {Array} enrichedJobs - Array of enriched jobs
   * @returns {Array} Array of contacts ready for Instantly
   */
  extractEnrichedContacts(enrichedJobs) {
    const contacts = [];

    enrichedJobs.forEach(job => {
      if (job.contactEmail && job.enrichment?.status === 'completed') {
        contacts.push({
          email: job.contactEmail,
          firstName: job.contactName?.split(' ')[0] || 'Hiring',
          lastName: job.contactName?.split(' ').slice(1).join(' ') || 'Manager',
          companyName: job.company,
          jobTitle: job.contactTitle || 'HR Representative',
          website: job.companyWebsite || job.companyDomain,
          industry: job.industryCategory || 'Unknown',
          companySize: job.companySize || 'Medium',
          source: 'Job Automation System',
          customFields: {
            jobId: job.id,
            jobTitle: job.title,
            jobLocation: job.location,
            enrichmentSource: job.enrichment.realContacts?.length > 0 ? 'Apollo.io' : 'Generated',
            enrichmentConfidence: job.enrichment.confidence,
            salary: job.salary,
            publishedDate: job.publishedDate
          }
        });
      }
    });

    logger.automation.info('Extracted contacts for Instantly', {
      totalContacts: contacts.length,
      apolloContacts: contacts.filter(c => c.customFields.enrichmentSource === 'Apollo.io').length,
      generatedContacts: contacts.filter(c => c.customFields.enrichmentSource === 'Generated').length
    });

    return contacts;
  }
}

module.exports = new AutomationService(); 