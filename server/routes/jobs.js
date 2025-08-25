const express = require('express');
const router = express.Router();
const bundesagenturService = require('../services/bundesagenturService');
const contactEnrichmentService = require('../services/contactEnrichmentService'); // Add this
const logger = require('../utils/logger');
const blacklistService = require('../services/blacklistService');

/**
 * GET & POST /api/jobs/search
 * Search for jobs using various parameters
 */
const searchJobs = async (req, res) => {
  try {
    // Support both GET (query params) and POST (body params)
    const params = req.method === 'GET' ? req.query : req.body;
    
    // Convert publishedSince from days to ISO date string
    let publishedSince = params.publishedSince;
    if (publishedSince && !isNaN(publishedSince)) {
      const days = parseInt(publishedSince);
      const date = new Date();
      date.setDate(date.getDate() - days);
      publishedSince = date.toISOString();
    }

    const searchParams = {
      keywords: params.keywords,
      location: params.location,
      employmentType: params.employmentType,
      radius: parseInt(params.radius) || 25,
      publishedSince,
      page: parseInt(params.page) || 1,
      size: Math.min(parseInt(params.size) || 50, 200) // Max 200 results per request
    };

    const requestedSize = parseInt(params.size) || 50;
    const startTs = Date.now();

    logger.jobs.info('Job search request', { searchParams, ip: req.ip, method: req.method });

    // Fetch pages until we have at least requestedSize after blacklist filtering
    let aggregatedJobs = [];
    let currentPage = searchParams.page;
    let totalCount = 0;
    let pagesFetched = 0;
    const perPage = searchParams.size;

    while (aggregatedJobs.length < requestedSize) {
      const pageResults = await bundesagenturService.searchJobs({ ...searchParams, page: currentPage, size: perPage });
      pagesFetched += 1;
      totalCount = pageResults.totalCount || totalCount;

      let pageJobs = pageResults.jobs || [];
      // Apply blacklist filter by company name
      if (pageJobs.length > 0) {
        const before = pageJobs.length;
        pageJobs = pageJobs.filter(j => !blacklistService.isBlockedCompany(j.company));
        const removed = before - pageJobs.length;
        if (removed > 0) {
          logger.jobs.info('Filtered jobs by blacklist (page level)', { removed, remaining: pageJobs.length, page: currentPage });
        }
      }

      aggregatedJobs = aggregatedJobs.concat(pageJobs);

      // Stop if this page returned less than perPage (no more pages)
      if (!pageResults.jobs || pageResults.jobs.length < perPage) {
        logger.jobs.info('No more pages available from source', { currentPage, perPage, aggregated: aggregatedJobs.length });
        break;
      }
      
      // Stop if we likely reached the end by totalCount
      const maxPages = perPage > 0 ? Math.ceil((totalCount || 0) / perPage) : 1;
      if (currentPage >= maxPages) {
        break;
      }

      currentPage += 1;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    // Enforce requested size cap after aggregation
    const cappedJobs = aggregatedJobs.slice(0, requestedSize);

    // Prepare results object consistent with previous response shape
    const results = {
      jobs: cappedJobs,
      totalCount: totalCount,
      page: searchParams.page,
      searchParams: searchParams,
      timestamp: new Date().toISOString(),
      meta: {
        requestedSize,
        returnedCount: cappedJobs.length,
        pagesFetched,
        durationMs: Date.now() - startTs
      }
    };

    // Contact enrichment (kept as before)
    if (results.jobs && results.jobs.length > 0) {
      logger.jobs.info('Starting contact enrichment', { jobCount: results.jobs.length });
      
      try {
        let enrichmentOptions = {
          useWebScraping: true,
          useApollo: false
        };
        const jobCount = results.jobs.length;
        if (jobCount <= 5) {
          enrichmentOptions.batchSize = 3;
          enrichmentOptions.delayBetweenBatches = 1000;
        } else if (jobCount <= 15) {
          enrichmentOptions.batchSize = 3;
          enrichmentOptions.delayBetweenBatches = 1500;
        } else {
          enrichmentOptions.batchSize = 4;
          enrichmentOptions.delayBetweenBatches = 500;
        }
      
        results.jobs = await contactEnrichmentService.enrichJobs(results.jobs, enrichmentOptions);
        logger.jobs.info('Contact enrichment completed', { 
          enrichedCount: results.jobs.filter(job => job.contactEmail || job.contactPhone).length 
        });
      } catch (enrichmentError) {
        logger.jobs.error('Contact enrichment failed', { 
          error: enrichmentError.message,
          jobCount: results.jobs.length 
        });
        // Continue without enrichment
      }
    }
    
    res.json({
      success: true,
      data: results,
      message: `Found ${totalCount} jobs, returned ${results.jobs.length} (target ${requestedSize}, pages ${results.meta.pagesFetched}, ${results.meta.durationMs}ms)`
    });
  } catch (error) {
    logger.jobs.error('Job search failed', { 
      error: error.message, 
      searchParams: req.method === 'GET' ? req.query : req.body 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to search jobs',
      message: error.message
    });
  }
};

// Support both GET and POST for /search
router.get('/search', searchJobs);
router.post('/search', searchJobs);

/**
 * GET /api/jobs/:id
 * Get detailed information about a specific job
 */
router.get('/:id', async (req, res) => {
  try {
    const jobId = req.params.id;
    
    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
    }

    logger.jobs.info('Job details request', { jobId });

    const jobDetails = await bundesagenturService.getJobDetails(jobId);
    
    if (!jobDetails) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: jobDetails
    });
  } catch (error) {
    logger.jobs.error('Failed to fetch job details', { 
      jobId: req.params.id, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job details',
      message: error.message
    });
  }
});

/**
 * POST /api/jobs/search
 * Advanced job search with contact enrichment
 */
router.post('/search', async (req, res) => {
  try {
    const {
      keywords,
      location,
      employmentType,
      radius,
      publishedSince,
      salaryMin,
      salaryMax,
      workingTime,
      page,
      size,
      enableEnrichment = true  // Add enrichment option
    } = req.body;

    // Validate required fields
    if (!keywords && !location) {
      return res.status(400).json({
        success: false,
        error: 'Either keywords or location must be provided'
      });
    }

    // Convert publishedSince from days to ISO date string
    let convertedPublishedSince = publishedSince;
    if (publishedSince && !isNaN(publishedSince)) {
      const days = parseInt(publishedSince);
      const date = new Date();
      date.setDate(date.getDate() - days);
      convertedPublishedSince = date.toISOString();
    }

    const searchParams = {
      keywords,
      location,
      employmentType,
      radius: radius || 25,
      publishedSince: convertedPublishedSince,
      salaryMin,
      salaryMax,
      workingTime,
      page: page || 1,
      size: Math.min(size || 50, 200)
    };

    logger.jobs.info('Advanced job search request', { searchParams, ip: req.ip });

    // Step 1: Get jobs from Bundesagentur
    const results = await bundesagenturService.searchJobs(searchParams);
    
    // Step 2: Apply Zeitarbeit and blacklist filtering
    if (results.jobs && results.jobs.length > 0) {
      const before = results.jobs.length;
      let zeitarbeitFiltered = 0;
      
      // Filter out Zeitarbeit companies and blacklisted companies
      results.jobs = results.jobs.filter(job => {
        const isBlocked = blacklistService.isBlockedCompany(job.company);
        if (isBlocked && blacklistService.isZeitarbeit(job.company)) {
          zeitarbeitFiltered++;
        }
        return !isBlocked;
      });
      
      const removed = before - results.jobs.length;
      if (removed > 0) {
        logger.jobs.info('🚫 Filtered jobs by blacklist', { 
          removed, 
          zeitarbeitAgencies: zeitarbeitFiltered,
          remaining: results.jobs.length,
          filteredPercent: Math.round((removed / before) * 100) + '%'
        });
      }
    }

    if (enableEnrichment && results.jobs && results.jobs.length > 0) {
      logger.jobs.info('Starting contact enrichment', { jobCount: results.jobs.length });
      
      // Адаптивные настройки в зависимости от количества вакансий
      let enrichmentOptions = {
        useWebScraping: true,
        useApollo: false
      };
      
      if (results.jobs.length <= 5) {
        // Малое количество - быстрая обработка
        enrichmentOptions.batchSize = 3;
        enrichmentOptions.delayBetweenBatches = 1000;
      } else if (results.jobs.length <= 15) {
        // Среднее количество - осторожная обработка
        enrichmentOptions.batchSize = 3;
        enrichmentOptions.delayBetweenBatches = 1500;
      } else {
        // Большое количество - ускоренная обработка с контролем капчи
        enrichmentOptions.batchSize = 4;
        enrichmentOptions.delayBetweenBatches = 500;
        logger.jobs.warn('Large job batch detected, using accelerated enrichment', {
          jobCount: results.jobs.length
        });
      }
      
      try {
        // Добавляем timeout для больших запросов
        const timeoutMs = 10800000; // 3 часа для долгих серий с CAPTCHA
        const enrichmentPromise = contactEnrichmentService.enrichJobs(results.jobs, enrichmentOptions);
        const enrichmentResult = await Promise.race([
          enrichmentPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Enrichment timed out')), timeoutMs))
        ]);
        results.jobs = enrichmentResult;

        logger.jobs.info('Contact enrichment completed', { 
          enrichedCount: results.jobs.filter(job => job.contactEmail || job.contactPhone).length 
        });
      } catch (enrichmentError) {
        logger.jobs.error('Contact enrichment failed', { 
          error: enrichmentError.message,
          jobCount: results.jobs.length 
        });
        // Продолжаем без enrichment
      }
    }

    res.json({
      success: true,
      data: results,
      message: `Found ${results.totalCount} jobs, returned ${results.jobs.length} (limited to ${searchParams.size}${enableEnrichment ? ', enriched' : ''})`
    });
  } catch (error) {
    logger.jobs.error('Advanced job search failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to search jobs',
      message: error.message
    });
  }
});

/**
 * GET /api/jobs/stats/summary
 * Get search statistics and summary
 */
router.get('/stats/summary', async (req, res) => {
  try {
    // This could be expanded to include actual statistics from a database
    const stats = {
      totalSearches: 0,
      totalJobsFound: 0,
      lastSearchTime: null,
      averageJobsPerSearch: 0,
      topKeywords: [],
      topLocations: []
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.jobs.error('Failed to fetch job statistics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

module.exports = router; 