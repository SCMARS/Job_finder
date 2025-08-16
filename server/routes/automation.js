const express = require('express');
const router = express.Router();
const automationService = require('../services/automationService');
const logger = require('../utils/logger');


router.post('/run', async (req, res) => {
  try {
    const options = req.body;
    
    logger.automation.info('Manual automation run requested', { 
      options, 
      ip: req.ip 
    });

    const results = await automationService.runAutomation(options);
    
    res.json({
      success: true,
      data: results,
      message: `Automation completed. Found ${results.summary.jobsFound} jobs, enriched ${results.summary.contactsEnriched} contacts.`
    });
  } catch (error) {
    logger.automation.error('Manual automation run failed', { 
      error: error.message,
      options: req.body 
    });
    
    res.status(500).json({
      success: false,
      error: 'Automation failed',
      message: error.message
    });
  }
});


router.get('/status', async (req, res) => {
  try {
    const status = automationService.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.automation.error('Failed to get automation status', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get status',
      message: error.message
    });
  }
});


router.post('/schedule', async (req, res) => {
  try {
    const { cronPattern, options } = req.body;
    
    if (!cronPattern) {
      return res.status(400).json({
        success: false,
        error: 'Cron pattern is required'
      });
    }

    logger.automation.info('Scheduling automation', { 
      cronPattern, 
      options,
      ip: req.ip 
    });

    const jobId = automationService.scheduleAutomation(cronPattern, options);
    
    res.json({
      success: true,
      data: { jobId, cronPattern, options },
      message: `Automation scheduled with job ID: ${jobId}`
    });
  } catch (error) {
    logger.automation.error('Failed to schedule automation', { 
      error: error.message,
      request: req.body 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to schedule automation',
      message: error.message
    });
  }
});

router.post('/stop-schedule', async (req, res) => {
  try {
    logger.automation.info('Stopping all scheduled automations', { ip: req.ip });

    const stoppedJobs = automationService.stopAllScheduledAutomations();
    
    res.json({
      success: true,
      data: { stoppedJobs },
      message: `Stopped ${stoppedJobs.length} scheduled automation(s)`
    });
  } catch (error) {
    logger.automation.error('Failed to stop scheduled automations', { 
      error: error.message 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to stop scheduled automations',
      message: error.message
    });
  }
});

router.delete('/schedule/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    logger.automation.info('Stopping scheduled automation', { jobId, ip: req.ip });

    const success = automationService.stopScheduledAutomation(jobId);
    
    if (success) {
      res.json({
        success: true,
        message: `Scheduled automation ${jobId} stopped successfully`
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Scheduled job not found',
        message: `No scheduled automation found with ID: ${jobId}`
      });
    }
  } catch (error) {
    logger.automation.error('Failed to stop scheduled automation', { 
      jobId: req.params.jobId,
      error: error.message 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to stop scheduled automation',
      message: error.message
    });
  }
});


router.put('/search-params', async (req, res) => {
  try {
    const newParams = req.body;
    
    logger.automation.info('Updating default search parameters', { 
      newParams,
      ip: req.ip 
    });

    automationService.updateDefaultSearchParams(newParams);
    
    res.json({
      success: true,
      data: automationService.getStatus().defaultSearchParams,
      message: 'Default search parameters updated successfully'
    });
  } catch (error) {
    logger.automation.error('Failed to update search parameters', { 
      error: error.message,
      newParams: req.body 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to update search parameters',
      message: error.message
    });
  }
});


router.post('/test-integrations', async (req, res) => {
  try {
    logger.automation.info('Testing service integrations', { ip: req.ip });

    const results = {
      bundesagentur: { status: 'pending', error: null },
      googleSheets: { status: 'pending', error: null },
      apollo: { status: 'pending', error: null },
      instantly: { status: 'pending', error: null },
      pipedrive: { status: 'pending', error: null }
    };

    // Test Bundesagentur API
    try {
      const bundesagenturService = require('../services/bundesagenturService');
      await bundesagenturService.searchJobs({ keywords: 'test', size: 1 });
      results.bundesagentur.status = 'success';
    } catch (error) {
      results.bundesagentur.status = 'failed';
      results.bundesagentur.error = error.message;
    }

    // Test Google Sheets
    try {
      const googleSheetsService = require('../services/googleSheetsService');
      await googleSheetsService.initialize();
      results.googleSheets.status = 'success';
    } catch (error) {
      results.googleSheets.status = 'failed';
      results.googleSheets.error = error.message;
    }

    // Test Apollo API
    try {
      const apolloService = require('../services/apolloService');
      await apolloService.searchOrganizations('test');
      results.apollo.status = 'success';
    } catch (error) {
      results.apollo.status = 'failed';
      results.apollo.error = error.message;
    }

    // Test Instantly API
    try {
      const instantlyService = require('../services/instantlyService');
      await instantlyService.getCampaigns();
      results.instantly.status = 'success';
    } catch (error) {
      results.instantly.status = 'failed';
      results.instantly.error = error.message;
    }

    // Test Pipedrive API
    try {
      const pipedriveService = require('../services/pipedriveService');
      await pipedriveService.getPipelineStages();
      results.pipedrive.status = 'success';
    } catch (error) {
      results.pipedrive.status = 'failed';
      results.pipedrive.error = error.message;
    }

    const allSuccess = Object.values(results).every(result => result.status === 'success');

    res.json({
      success: allSuccess,
      data: results,
      message: allSuccess ? 'All integrations working' : 'Some integrations failed'
    });
  } catch (error) {
    logger.automation.error('Integration test failed', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Integration test failed',
      message: error.message
    });
  }
});

module.exports = router; 