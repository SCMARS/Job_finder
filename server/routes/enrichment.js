const express = require('express');
const router = express.Router();
const contactEnrichmentService = require('../services/contactEnrichmentService');
const bundesagenturService = require('../services/bundesagenturService');
const logger = require('../utils/logger');

/**
 * Test contact enrichment workflow
 * POST /api/enrichment/test
 */
router.post('/test', async (req, res) => {
  try {
    const { keywords = 'software', location = 'Berlin', size = 5 } = req.body;

    logger.info('Testing contact enrichment workflow', { keywords, location, size });

    // Step 1: Search for jobs
    const jobSearchResult = await bundesagenturService.searchJobs({
      keywords,
      location,
      size: Math.min(size, 10), // Limit for testing
      page: 1
    });

    if (!jobSearchResult.jobs || jobSearchResult.jobs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No jobs found for enrichment testing',
        data: { searchParams: { keywords, location, size } }
      });
    }

    // Step 2: Enrich jobs with contact information
    const enrichedJobs = await contactEnrichmentService.enrichJobs(
      jobSearchResult.jobs,
      {
        batchSize: 2, // Small batches for testing
        delayBetweenBatches: 1000 // 1 second delay for testing
      }
    );

    // Step 3: Get enrichment statistics
    const enrichmentStats = contactEnrichmentService.getEnrichmentStats(enrichedJobs);

    // Step 4: Prepare response with detailed breakdown
    const response = {
      success: true,
      message: 'Contact enrichment test completed',
      data: {
        searchResults: {
          totalFound: jobSearchResult.totalCount,
          jobsProcessed: jobSearchResult.jobs.length,
          searchParams: { keywords, location, size }
        },
        enrichmentResults: {
          stats: enrichmentStats,
          jobs: enrichedJobs.map(job => ({
            id: job.id,
            title: job.title,
            company: job.company,
            companyDomain: job.companyDomain,
            companyWebsite: job.companyWebsite,
            industryCategory: job.industryCategory,
            companySize: job.companySize,
            originalContactEmail: job.contactEmail,
            enrichment: {
              status: job.enrichment?.status,
              confidence: job.enrichment?.confidence,
              realContactsFound: job.enrichment?.realContacts?.length || 0,
              fallbackContactsGenerated: job.enrichment?.fallbackContacts?.length || 0,
              bestContact: job.enrichment?.bestContact ? {
                email: job.enrichment.bestContact.email,
                name: job.enrichment.bestContact.name,
                title: job.enrichment.bestContact.title,
                source: job.enrichment.bestContact.source,
                confidence: job.enrichment.bestContact.confidence
              } : null,
              emailValidation: job.enrichment?.emailValidation
            }
          }))
        },
        instantlyReadyContacts: enrichedJobs
          .filter(job => job.contactEmail && job.enrichment?.status === 'completed')
          .map(job => ({
            email: job.contactEmail,
            firstName: job.contactName?.split(' ')[0] || 'Hiring',
            lastName: job.contactName?.split(' ').slice(1).join(' ') || 'Manager',
            companyName: job.company,
            jobTitle: job.contactTitle || 'HR Representative',
            enrichmentSource: job.enrichment.realContacts?.length > 0 ? 'Apollo.io' : 'Generated'
          }))
      }
    };

    logger.info('Contact enrichment test results', {
      jobsProcessed: enrichedJobs.length,
      successfulEnrichments: enrichmentStats.completed,
      realContactsFound: enrichmentStats.realContactsFound,
      instantlyReadyContacts: response.data.instantlyReadyContacts.length
    });

    res.json(response);

  } catch (error) {
    logger.error('Contact enrichment test failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Contact enrichment test failed',
      error: error.message
    });
  }
});

/**
 * Enrich a single job with contact information
 * POST /api/enrichment/job
 */
router.post('/job', async (req, res) => {
  try {
    const { job } = req.body;

    if (!job || !job.company) {
      return res.status(400).json({
        success: false,
        message: 'Job object with company name is required'
      });
    }

    logger.info('Enriching single job', { jobId: job.id, company: job.company });

    const enrichedJob = await contactEnrichmentService.enrichJob(job);

    res.json({
      success: true,
      message: 'Job enrichment completed',
      data: {
        original: job,
        enriched: enrichedJob,
        enrichmentSummary: {
          status: enrichedJob.enrichment?.status,
          confidence: enrichedJob.enrichment?.confidence,
          contactFound: !!enrichedJob.contactEmail,
          apolloUsed: enrichedJob.enrichment?.realContacts?.length > 0,
          fallbackUsed: enrichedJob.enrichment?.fallbackContacts?.length > 0
        }
      }
    });

  } catch (error) {
    logger.error('Single job enrichment failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Job enrichment failed',
      error: error.message
    });
  }
});

/**
 * Get enrichment statistics for multiple jobs
 * POST /api/enrichment/stats
 */
router.post('/stats', async (req, res) => {
  try {
    const { jobs } = req.body;

    if (!jobs || !Array.isArray(jobs)) {
      return res.status(400).json({
        success: false,
        message: 'Array of jobs is required'
      });
    }

    const stats = contactEnrichmentService.getEnrichmentStats(jobs);

    res.json({
      success: true,
      message: 'Enrichment statistics calculated',
      data: stats
    });

  } catch (error) {
    logger.error('Failed to calculate enrichment statistics', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to calculate statistics',
      error: error.message
    });
  }
});

module.exports = router; 