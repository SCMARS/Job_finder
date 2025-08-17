const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    this.credentialsPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;
    this.initialized = false;
  }

  /**
   * Initialize Google Sheets API
   */
  async initialize() {
    try {
      if (this.initialized) return;

      logger.sheets.info('Initializing Google Sheets service');

      // Check if credentials file exists
      if (!this.credentialsPath || !fs.existsSync(this.credentialsPath)) {
        throw new Error('Google Sheets credentials file not found');
      }

      // Load credentials
      const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
      
      // Create JWT auth
      const auth = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        ['https://www.googleapis.com/auth/spreadsheets']
      );

      // Initialize Sheets API
      this.sheets = google.sheets({ version: 'v4', auth });
      this.initialized = true;

      logger.sheets.info('Google Sheets service initialized successfully');
    } catch (error) {
      logger.sheets.error('Failed to initialize Google Sheets service', { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure the spreadsheet has the correct headers
   */
  async ensureHeaders() {
    try {
      await this.initialize();

      const headers = [
        'ID',
        'Company Name',
        'Job Title',
        'Location',
        'Employment Type',
        'Description',
        'Requirements',
        'Job URL',
        'Contact Email', // Real extracted email
        'Contact Phone', // Real extracted phone
        'Salary',
        'Published Date',
        'Application Deadline',
        'Enrichment Confidence', // Confidence level
        'Has Real Email', // Yes/No flag
        'Enrichment Status', // Status of enrichment process
        'Instantly Status',
        'Pipedrive Status',
        'Processing Status',
        'Created At',
        'Updated At'
      ];

      // Check if headers exist
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A1:U1'
      });

      if (!response.data.values || response.data.values.length === 0) {
        // Add headers if they don't exist
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'A1:U1',
          valueInputOption: 'RAW',
          resource: {
            values: [headers]
          }
        });

        logger.sheets.info('Headers added to spreadsheet');
      }
    } catch (error) {
      logger.sheets.error('Failed to ensure headers', { error: error.message });
      throw error;
    }
  }

  /**
   * Save job data to Google Sheets
   * @param {Array} jobs - Array of job objects
   * @returns {Promise<Object>} Result with count of saved jobs
   */
  async saveJobs(jobs) {
    try {
      await this.ensureHeaders();

      if (!jobs || jobs.length === 0) {
        return { saved: 0, skipped: 0, errors: 0 };
      }

      logger.sheets.info('Saving jobs to Google Sheets', { count: jobs.length });

      // For large datasets, process in batches to avoid API limits
      const BATCH_SIZE = 200;
      let totalSaved = 0;

      if (jobs.length > BATCH_SIZE) {
        logger.sheets.info('Processing large dataset in batches', { 
          totalJobs: jobs.length, 
          batchSize: BATCH_SIZE 
        });

        for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
          const batch = jobs.slice(i, i + BATCH_SIZE);
          const rows = batch.map(job => this.jobToRow(job));
          
          const nextRow = await this.getNextEmptyRow();
          const range = `A${nextRow}:U${nextRow + rows.length - 1}`;

          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: range,
            valueInputOption: 'RAW',
            resource: {
              values: rows
            }
          });

          totalSaved += batch.length;
          logger.sheets.info('Batch saved', { 
            batch: Math.floor(i / BATCH_SIZE) + 1,
            saved: batch.length,
            total: totalSaved
          });

          // Small delay between batches to avoid rate limiting
          if (i + BATCH_SIZE < jobs.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } else {
        // Process normally for smaller datasets
        const rows = jobs.map(job => this.jobToRow(job));
        
        const nextRow = await this.getNextEmptyRow();
        const range = `A${nextRow}:U${nextRow + rows.length - 1}`;

        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: range,
          valueInputOption: 'RAW',
          resource: {
            values: rows
          }
        });

        totalSaved = jobs.length;
      }

      logger.sheets.info('Jobs saved successfully', { 
        count: totalSaved
      });

      return { saved: totalSaved, skipped: 0, errors: 0 };
    } catch (error) {
      logger.sheets.error('Failed to save jobs', { 
        error: error.message, 
        jobCount: jobs?.length 
      });
      throw error;
    }
  }

  /**
   * Update job status in Google Sheets
   * @param {string} jobId - Job ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<boolean>} Success status
   */
  async updateJobStatus(jobId, updates) {
    try {
      await this.initialize();

      // Find the job row by ID
      const jobRow = await this.findJobRow(jobId);
      if (!jobRow) {
        logger.sheets.warn('Job not found for status update', { jobId });
        return false;
      }

      const updateData = [];
      
      // Map updates to column positions
      if (updates.enrichedEmail) {
        updateData.push({ range: `N${jobRow}`, values: [[updates.enrichedEmail]] });
      }
      if (updates.enrichedPhone) {
        updateData.push({ range: `O${jobRow}`, values: [[updates.enrichedPhone]] });
      }
      if (updates.apolloStatus) {
        updateData.push({ range: `P${jobRow}`, values: [[updates.apolloStatus]] });
      }
      if (updates.instantlyStatus) {
        updateData.push({ range: `Q${jobRow}`, values: [[updates.instantlyStatus]] });
      }
      if (updates.pipedriveStatus) {
        updateData.push({ range: `R${jobRow}`, values: [[updates.pipedriveStatus]] });
      }
      if (updates.processingStatus) {
        updateData.push({ range: `S${jobRow}`, values: [[updates.processingStatus]] });
      }

      // Always update the "Updated At" column
      updateData.push({ range: `U${jobRow}`, values: [[new Date().toISOString()]] });

      // Batch update
      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          valueInputOption: 'RAW',
          data: updateData
        }
      });

      logger.sheets.info('Job status updated', { jobId, updates });
      return true;
    } catch (error) {
      logger.sheets.error('Failed to update job status', { 
        jobId, 
        updates, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Update job enrichment status in Google Sheets
   * @param {string} jobId - Job ID to update
   * @param {Object} enrichmentData - Enrichment data to update
   */
  async updateJobEnrichmentStatus(jobId, enrichmentData) {
    try {
      const range = 'Sheet1!A:Z';
      const result = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range
      });

      const rows = result.data.values || [];
      if (rows.length === 0) return;

      // Find the row with this job ID
      const jobRowIndex = rows.findIndex(row => row[0] === jobId);
      if (jobRowIndex === -1) return;

      // Update enrichment columns
      const updateRange = `Sheet1!N${jobRowIndex + 1}:P${jobRowIndex + 1}`;
      const values = [[
        enrichmentData.contactEmail || rows[jobRowIndex][13] || '',
        enrichmentData.contactPhone || rows[jobRowIndex][14] || '',
        enrichmentData.apolloStatus || rows[jobRowIndex][15] || ''
      ]];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: updateRange,
        valueInputOption: 'RAW',
        resource: { values }
      });

      logger.info('Job enrichment status updated', { jobId, enrichmentData });
    } catch (error) {
      logger.error('Failed to update job enrichment status', { 
        jobId, 
        error: error.message 
      });
    }
  }

  /**
   * Get jobs with specific processing status
   * @param {string} status - Processing status to filter by
   * @returns {Promise<Array>} Array of jobs
   */
  async getJobsByStatus(status) {
    try {
      await this.initialize();

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A2:U1000' // Adjust range as needed
      });

      if (!response.data.values) {
        return [];
      }

      const jobs = response.data.values
        .filter(row => row[18] === status) // Processing Status column (S)
        .map(row => this.rowToJob(row));

      return jobs;
    } catch (error) {
      logger.sheets.error('Failed to get jobs by status', { 
        status, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Convert job object to spreadsheet row
   * @param {Object} job - Job object
   * @returns {Array} Row data
   */
  jobToRow(job) {
    return [
      job.id || '',
      job.company || '',
      job.title || '',
      job.location || '',
      job.employmentType || '',
      job.description ? job.description.substring(0, 500) : '', // Limit description length
      job.requirements ? job.requirements.substring(0, 500) : '',
      job.externalUrl || '',
      job.contactEmail || '', // Real extracted email
      job.contactPhone || '', // Real extracted phone
      job.salary || '',
      job.publishedDate || '',
      job.applicationDeadline || '',
      job.enrichment?.confidence || '', // Enrichment confidence
      job.enrichment?.hasRealEmail ? 'Yes' : 'No', // Has real email flag
      job.enrichment?.status || 'Pending', // Enrichment Status
      'Pending', // Instantly Status
      'Pending', // Pipedrive Status
      'New', // Processing Status
      new Date().toISOString(), // Created At
      new Date().toISOString()  // Updated At
    ];
  }

  /**
   * Convert spreadsheet row to job object
   * @param {Array} row - Row data
   * @returns {Object} Job object
   */
  rowToJob(row) {
    return {
      id: row[0] || '',
      company: row[1] || '',
      title: row[2] || '',
      location: row[3] || '',
      employmentType: row[4] || '',
      description: row[5] || '',
      requirements: row[6] || '',
      externalUrl: row[7] || '',
      contactEmail: row[8] || '',
      contactPhone: row[9] || '',
      salary: row[10] || '',
      publishedDate: row[11] || '',
      applicationDeadline: row[12] || '',
      enrichedEmail: row[13] || '',
      enrichedPhone: row[14] || '',
      apolloStatus: row[15] || '',
      instantlyStatus: row[16] || '',
      pipedriveStatus: row[17] || '',
      processingStatus: row[18] || '',
      createdAt: row[19] || '',
      updatedAt: row[20] || ''
    };
  }

  /**
   * Find the row number of a job by its ID
   * @param {string} jobId - Job ID
   * @returns {Promise<number|null>} Row number or null if not found
   */
  async findJobRow(jobId) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A2:A1000' // ID column
      });

      if (!response.data.values) {
        return null;
      }

      const rowIndex = response.data.values.findIndex(row => row[0] === jobId);
      return rowIndex !== -1 ? rowIndex + 2 : null; // +2 because array is 0-indexed and we start from row 2
    } catch (error) {
      logger.sheets.error('Failed to find job row', { jobId, error: error.message });
      return null;
    }
  }

  /**
   * Get the next empty row number
   * @returns {Promise<number>} Next empty row number
   */
  async getNextEmptyRow() {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A:A'
      });

      if (!response.data.values) {
        return 2; // Start from row 2 (after headers)
      }

      return response.data.values.length + 1;
    } catch (error) {
      logger.sheets.error('Failed to get next empty row', { error: error.message });
      return 2; // Default to row 2
    }
  }

  /**
   * Get job information by enriched email
   * @param {string} email - Contact email
   * @returns {Promise<Object|null>} Job information
   */
  async getJobByEnrichedEmail(email) {
    try {
      await this.initialize();

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A2:U1000' // Adjust range as needed
      });

      if (!response.data.values) {
        return null;
      }

      // Find job where enriched email (column N, index 13) matches
      const jobRow = response.data.values.find(row => row[13] === email);
      
      if (!jobRow) {
        return null;
      }

      return this.rowToJob(jobRow);
    } catch (error) {
      logger.sheets.error('Failed to get job by enriched email', { 
        email: email.substring(0, 3) + '***',
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Get statistics by companies
   * @returns {Promise<Array>} Top companies
   */
  async getTopCompanies(limit = 5) {
    try {
      await this.initialize();

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A2:U1000'
      });

      if (!response.data.values) {
        return [];
      }

      // Count companies (column B, index 1)
      const companyCount = {};
      response.data.values.forEach(row => {
        const company = row[1]; // Company Name column
        if (company && company !== 'Company Name') {
          companyCount[company] = (companyCount[company] || 0) + 1;
        }
      });

      // Sort and return top companies
      return Object.entries(companyCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit)
        .map(([name, count]) => ({ name, count }));

    } catch (error) {
      logger.sheets.error('Failed to get top companies', { error: error.message });
      return [];
    }
  }

  /**
   * Get statistics by locations
   * @returns {Promise<Array>} Top locations
   */
  async getTopLocations(limit = 5) {
    try {
      await this.initialize();

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A2:U1000'
      });

      if (!response.data.values) {
        return [];
      }

      // Count locations (column D, index 3)
      const locationCount = {};
      response.data.values.forEach(row => {
        const location = row[3]; // Location column
        if (location && location !== 'Location') {
          locationCount[location] = (locationCount[location] || 0) + 1;
        }
      });

      // Sort and return top locations
      return Object.entries(locationCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit)
        .map(([name, count]) => ({ name, count }));

    } catch (error) {
      logger.sheets.error('Failed to get top locations', { error: error.message });
      return [];
    }
  }

  /**
   * Get statistics by date
   * @param {number} days - Number of days to look back
   * @returns {Promise<Array>} Jobs by date
   */
  async getJobsByDate(days = 30) {
    try {
      await this.initialize();

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A2:U1000'
      });

      if (!response.data.values) {
        return [];
      }

      // Group by created date (column T, index 19)
      const dateCount = {};
      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      response.data.values.forEach(row => {
        const createdAt = row[19]; // Created At column
        if (createdAt) {
          const jobDate = new Date(createdAt);
          if (jobDate >= startDate) {
            const dateKey = jobDate.toISOString().split('T')[0]; // YYYY-MM-DD
            dateCount[dateKey] = (dateCount[dateKey] || 0) + 1;
          }
        }
      });

      // Convert to array format expected by frontend
      return Object.entries(dateCount)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({
          date,
          count,
          label: new Date(date).toLocaleDateString('en', { weekday: 'short' })
        }));

    } catch (error) {
      logger.sheets.error('Failed to get jobs by date', { error: error.message });
      return [];
    }
  }
}

module.exports = new GoogleSheetsService(); 