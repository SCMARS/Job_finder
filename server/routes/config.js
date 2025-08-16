const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * GET /api/config
 * Get current configuration (without sensitive data)
 */
router.get('/', async (req, res) => {
  try {
    const config = {
      bundesagentur: {
        baseURL: process.env.BUNDESAGENTUR_API_URL,
        configured: !!process.env.BUNDESAGENTUR_API_KEY
      },
      googleSheets: {
        spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
        credentialsConfigured: !!process.env.GOOGLE_SHEETS_CREDENTIALS_PATH
      },
      apollo: {
        baseURL: process.env.APOLLO_API_URL,
        configured: !!process.env.APOLLO_API_KEY
      },
      instantly: {
        baseURL: process.env.INSTANTLY_API_URL,
        configured: !!process.env.INSTANTLY_API_KEY
      },
      pipedrive: {
        companyDomain: process.env.PIPEDRIVE_COMPANY_DOMAIN,
        configured: !!process.env.PIPEDRIVE_API_TOKEN
      },
      automation: {
        searchInterval: process.env.SEARCH_INTERVAL_HOURS || '24',
        maxResults: process.env.MAX_RESULTS_PER_SEARCH || '100',
        defaultLocation: process.env.DEFAULT_LOCATION || 'Germany'
      }
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Failed to get configuration', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get configuration',
      message: error.message
    });
  }
});

/**
 * POST /api/config/validate
 * Validate configuration and API connections
 */
router.post('/validate', async (req, res) => {
  try {
    const validationResults = {
      bundesagentur: await validateBundesagentur(),
      googleSheets: await validateGoogleSheets(),
      apollo: await validateApollo(),
      instantly: await validateInstantly(),
      pipedrive: await validatePipedrive()
    };

    const allValid = Object.values(validationResults).every(result => result.valid);

    res.json({
      success: allValid,
      data: validationResults,
      message: allValid ? 'All configurations valid' : 'Some configurations need attention'
    });
  } catch (error) {
    logger.error('Configuration validation failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Configuration validation failed',
      message: error.message
    });
  }
});

/**
 * GET /api/config/campaigns
 * Get available Instantly campaigns
 */
router.get('/campaigns', async (req, res) => {
  try {
    const instantlyService = require('../services/instantlyService');
    const campaigns = await instantlyService.getCampaigns();

    res.json({
      success: true,
      data: campaigns,
      message: `Found ${campaigns.length} campaigns`
    });
  } catch (error) {
    logger.error('Failed to fetch campaigns', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns',
      message: error.message
    });
  }
});

/**
 * GET /api/config/pipelines
 * Get available Pipedrive pipeline stages
 */
router.get('/pipelines', async (req, res) => {
  try {
    const pipedriveService = require('../services/pipedriveService');
    const stages = await pipedriveService.getPipelineStages();

    res.json({
      success: true,
      data: stages,
      message: `Found ${stages.length} pipeline stages`
    });
  } catch (error) {
    logger.error('Failed to fetch pipeline stages', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pipeline stages',
      message: error.message
    });
  }
});

/**
 * Validation helper functions
 */

async function validateBundesagentur() {
  try {
    const bundesagenturService = require('../services/bundesagenturService');
    await bundesagenturService.searchJobs({ keywords: 'test', size: 1 });
    return { valid: true, message: 'Connection successful' };
  } catch (error) {
    return { valid: false, message: error.message };
  }
}

async function validateGoogleSheets() {
  try {
    const googleSheetsService = require('../services/googleSheetsService');
    await googleSheetsService.initialize();
    return { valid: true, message: 'Connection successful' };
  } catch (error) {
    return { valid: false, message: error.message };
  }
}

async function validateApollo() {
  try {
    if (!process.env.APOLLO_API_KEY) {
      return { valid: false, message: 'API key not configured' };
    }
    const apolloService = require('../services/apolloService');
    await apolloService.searchOrganizations('test');
    return { valid: true, message: 'Connection successful' };
  } catch (error) {
    return { valid: false, message: error.message };
  }
}

async function validateInstantly() {
  try {
    if (!process.env.INSTANTLY_API_KEY) {
      return { valid: false, message: 'API key not configured' };
    }
    const instantlyService = require('../services/instantlyService');
    await instantlyService.getCampaigns();
    return { valid: true, message: 'Connection successful' };
  } catch (error) {
    return { valid: false, message: error.message };
  }
}

async function validatePipedrive() {
  try {
    if (!process.env.PIPEDRIVE_API_TOKEN) {
      return { valid: false, message: 'API token not configured' };
    }
    const pipedriveService = require('../services/pipedriveService');
    await pipedriveService.getPipelineStages();
    return { valid: true, message: 'Connection successful' };
  } catch (error) {
    return { valid: false, message: error.message };
  }
}

module.exports = router; 