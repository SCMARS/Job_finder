const express = require('express');
const router = express.Router();
const googleSheetsService = require('../services/googleSheetsService');
const logger = require('../utils/logger');

/**
 * POST /api/sheets/save-jobs
 * Save jobs to Google Sheets
 */
router.post('/save-jobs', async (req, res) => {
  try {
    const { jobs } = req.body;
    
    if (!jobs || !Array.isArray(jobs)) {
      return res.status(400).json({
        success: false,
        error: 'Jobs array is required'
      });
    }

    logger.sheets.info('Saving jobs to Google Sheets', { 
      count: jobs.length,
      ip: req.ip 
    });

    const result = await googleSheetsService.saveJobs(jobs);
    
    res.json({
      success: true,
      data: result,
      message: `Successfully saved ${result.saved} jobs to Google Sheets`
    });
  } catch (error) {
    logger.sheets.error('Failed to save jobs to Google Sheets', { 
      error: error.message,
      jobCount: req.body.jobs?.length 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to save jobs',
      message: error.message
    });
  }
});

/**
 * PUT /api/sheets/job/:jobId/status
 * Update job status in Google Sheets
 */
router.put('/job/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params;
    const updates = req.body;
    
    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
    }

    logger.sheets.info('Updating job status', { 
      jobId,
      updates,
      ip: req.ip 
    });

    const success = await googleSheetsService.updateJobStatus(jobId, updates);
    
    if (success) {
      res.json({
        success: true,
        message: `Job ${jobId} status updated successfully`
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Job not found',
        message: `No job found with ID: ${jobId}`
      });
    }
  } catch (error) {
    logger.sheets.error('Failed to update job status', { 
      jobId: req.params.jobId,
      error: error.message 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to update job status',
      message: error.message
    });
  }
});

/**
 * GET /api/sheets/jobs/status/:status
 * Get jobs by processing status
 */
router.get('/jobs/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    
    logger.sheets.info('Fetching jobs by status', { 
      status,
      ip: req.ip 
    });

    const jobs = await googleSheetsService.getJobsByStatus(status);
    
    res.json({
      success: true,
      data: jobs,
      message: `Found ${jobs.length} jobs with status: ${status}`
    });
  } catch (error) {
    logger.sheets.error('Failed to fetch jobs by status', { 
      status: req.params.status,
      error: error.message 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch jobs',
      message: error.message
    });
  }
});

/**
 * POST /api/sheets/initialize
 * Initialize Google Sheets with headers
 */
router.post('/initialize', async (req, res) => {
  try {
    logger.sheets.info('Initializing Google Sheets', { ip: req.ip });

    await googleSheetsService.ensureHeaders();
    
    res.json({
      success: true,
      message: 'Google Sheets initialized successfully'
    });
  } catch (error) {
    logger.sheets.error('Failed to initialize Google Sheets', { 
      error: error.message 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to initialize Google Sheets',
      message: error.message
    });
  }
});

/**
 * GET /api/sheets/test-connection
 * Test Google Sheets connection
 */
router.get('/test-connection', async (req, res) => {
  try {
    logger.sheets.info('Testing Google Sheets connection', { ip: req.ip });

    await googleSheetsService.initialize();
    
    res.json({
      success: true,
      message: 'Google Sheets connection successful'
    });
  } catch (error) {
    logger.sheets.error('Google Sheets connection test failed', { 
      error: error.message 
    });
    
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      message: error.message
    });
  }
});

/**
 * GET /api/sheets/stats
 * Get Google Sheets statistics
 */
router.get('/stats', async (req, res) => {
  try {
    logger.sheets.info('Fetching Google Sheets statistics', { ip: req.ip });

    // Get jobs by different statuses and additional statistics
    const days = parseInt(req.query.days) || 30;
    const [
      newJobs,
      enrichedJobs,
      inCampaignJobs,
      convertedJobs,
      errorJobs,
      topCompanies,
      topLocations,
      byDate
    ] = await Promise.all([
      googleSheetsService.getJobsByStatus('New'),
      googleSheetsService.getJobsByStatus('Enriched'),
      googleSheetsService.getJobsByStatus('In Campaign'),
      googleSheetsService.getJobsByStatus('Converted'),
      googleSheetsService.getJobsByStatus('Error'),
      googleSheetsService.getTopCompanies(5),
      googleSheetsService.getTopLocations(4),
      googleSheetsService.getJobsByDate(days)
    ]);

    const totalJobs = newJobs.length + enrichedJobs.length + inCampaignJobs.length + convertedJobs.length + errorJobs.length;
    
    const stats = {
      totalJobs,
      byStatus: {
        new: newJobs.length,
        enriched: enrichedJobs.length,
        inCampaign: inCampaignJobs.length,
        converted: convertedJobs.length,
        error: errorJobs.length
      },
      conversionRate: totalJobs > 0 ? (convertedJobs.length / totalJobs * 100).toFixed(2) : '0.00',
      topCompanies,
      topLocations,
      byDate
    };
    
    res.json({
      success: true,
      data: stats,
      message: 'Statistics fetched successfully'
    });
  } catch (error) {
    logger.sheets.error('Failed to fetch Google Sheets statistics', { 
      error: error.message 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

module.exports = router; 