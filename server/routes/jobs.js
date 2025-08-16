const express = require('express');
const router = express.Router();
const bundesagenturService = require('../services/bundesagenturService');
const logger = require('../utils/logger');

/**
 * GET /api/jobs/search
 * Search for jobs using various parameters
 */
router.get('/search', async (req, res) => {
  try {
    // Convert publishedSince from days to ISO date string
    let publishedSince = req.query.publishedSince;
    if (publishedSince && !isNaN(publishedSince)) {
      const days = parseInt(publishedSince);
      const date = new Date();
      date.setDate(date.getDate() - days);
      publishedSince = date.toISOString();
    }

    const searchParams = {
      keywords: req.query.keywords,
      location: req.query.location,
      employmentType: req.query.employmentType,
      radius: parseInt(req.query.radius) || 25,
      publishedSince,
      page: parseInt(req.query.page) || 1,
      size: Math.min(parseInt(req.query.size) || 50, 200) // Max 200 results per request
    };

    logger.jobs.info('Job search request', { searchParams, ip: req.ip });

    const results = await bundesagenturService.searchJobs(searchParams);
    
    res.json({
      success: true,
      data: results,
      message: `Found ${results.totalCount} jobs, returned ${results.jobs.length}`
    });
  } catch (error) {
    logger.jobs.error('Job search failed', { 
      error: error.message, 
      searchParams: req.query 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to search jobs',
      message: error.message
    });
  }
});

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
 * Advanced job search with complex filters
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
      size
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

    const results = await bundesagenturService.searchJobs(searchParams);
    
    res.json({
      success: true,
      data: results,
      message: `Found ${results.totalCount} jobs, returned ${results.jobs.length}`
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