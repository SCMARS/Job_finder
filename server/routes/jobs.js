const express = require('express');
const router = express.Router();
const bundesagenturService = require('../services/bundesagenturService');
const contactEnrichmentService = require('../services/contactEnrichmentService'); // Add this
const logger = require('../utils/logger');

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
      size: Math.min(parseInt(params.size) || 50, 20) // Max 20 results per request (to prevent system overload)
    };

    logger.jobs.info('Job search request', { searchParams, ip: req.ip, method: req.method });

    const results = await bundesagenturService.searchJobs(searchParams);
    
    // КРИТИЧЕСКИЙ FIX: ограничиваем количество jobs по запрошенному size
    const requestedSize = parseInt(params.size) || 50;
    if (results.jobs && results.jobs.length > requestedSize) {
      logger.jobs.info(`Limiting results from ${results.jobs.length} to ${requestedSize}`, { searchParams });
      results.jobs = results.jobs.slice(0, requestedSize);
    }

    // КРИТИЧЕСКИЙ FIX: включаем enrichment для извлечения контактов
    if (results.jobs && results.jobs.length > 0) {
      logger.jobs.info('Starting contact enrichment', { jobCount: results.jobs.length });
      
      try {
                  const enrichmentOptions = {
            useWebScraping: true,
            useApollo: false,
            batchSize: 1,
            delayBetweenBatches: 5000
          };
        
        results.jobs = await contactEnrichmentService.enrichJobs(results.jobs, enrichmentOptions);
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
      message: `Found ${results.totalCount} jobs, returned ${results.jobs.length} (limited to ${requestedSize}, enriched)`
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
    
    // Step 2: Enrich with real contacts if enabled and we have jobs
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
        enrichmentOptions.delayBetweenBatches = 2000;
      } else if (results.jobs.length <= 15) {
        // Среднее количество - осторожная обработка
        enrichmentOptions.batchSize = 2;
        enrichmentOptions.delayBetweenBatches = 4000;
      } else {
        // Большое количество - очень осторожная обработка
        enrichmentOptions.batchSize = 1; // По одной!
        enrichmentOptions.delayBetweenBatches = 6000;
        logger.jobs.warn('Large job batch detected, using conservative enrichment', {
          jobCount: results.jobs.length
        });
      }
      
      try {
        // Добавляем timeout для больших запросов
        const timeoutMs = results.jobs.length > 15 ? 300000 : 180000; // 5 минут для больших, 3 минуты для обычных
        
        const enrichmentPromise = contactEnrichmentService.enrichJobs(results.jobs, enrichmentOptions);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Enrichment timeout')), timeoutMs)
        );
        
        const enrichedJobs = await Promise.race([enrichmentPromise, timeoutPromise]);
        
        results.jobs = enrichedJobs;
        logger.jobs.info('Contact enrichment completed', { 
          enrichedCount: enrichedJobs.length 
        });
      } catch (enrichmentError) {
        logger.jobs.warn('Contact enrichment failed, continuing with basic results', {
          error: enrichmentError.message
        });
      }
    }
    
    res.json({
      success: true,
      data: results,
      message: `Found ${results.totalCount} jobs, returned ${results.jobs.length}${enableEnrichment ? ' (enriched)' : ''}`
    });
  } catch (error) {
    logger.jobs.error('Advanced job search failed', { 
      error: error.message, 
      searchParams: req.body 
    });
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