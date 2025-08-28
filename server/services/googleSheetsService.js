const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const duplicateDetectionService = require('./duplicateDetectionService');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    this.credentialsPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;
    this.initialized = false;
    this.isDisabled = false; // Graceful-disable flag when not configured
    this.sheetTitle = process.env.GOOGLE_SHEETS_SHEET_TITLE || null; // Resolved sheet title
  }

  /**
   * Initialize Google Sheets API
   */
  async initialize() {
    try {
      if (this.initialized) return;

      logger.sheets.info('Initializing Google Sheets service');

      // Graceful disable when not configured
      if (!this.spreadsheetId) {
        this.isDisabled = true;
        this.initialized = true;
        logger.sheets.warn('Google Sheets disabled: GOOGLE_SHEETS_SPREADSHEET_ID is not set');
        return;
      }
      if (!this.credentialsPath) {
        this.isDisabled = true;
        this.initialized = true;
        logger.sheets.warn('Google Sheets disabled: GOOGLE_SHEETS_CREDENTIALS_PATH is not set');
        return;
      }

      // Check if credentials file exists
      if (!fs.existsSync(this.credentialsPath)) {
        this.isDisabled = true;
        this.initialized = true;
        logger.sheets.warn('Google Sheets disabled: credentials file not found', { credentialsPath: this.credentialsPath });
        return;
      }

      // Load credentials
      const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
      
      // Create JWT auth
      const auth = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive'
        ]
      );

      // Initialize Sheets API
      this.sheets = google.sheets({ version: 'v4', auth });
      this.initialized = true;

      // Resolve first sheet title for A1 ranges (unless overridden by env)
      if (!this.sheetTitle) {
        try {
          const meta = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
          this.sheetTitle = meta?.data?.sheets?.[0]?.properties?.title || 'Sheet1';
          logger.sheets.info('Resolved sheet title', { sheetTitle: this.sheetTitle });
        } catch (e) {
          this.sheetTitle = 'Sheet1';
          logger.sheets.warn('Failed to resolve sheet title, defaulting to Sheet1');
        }
      } else {
        logger.sheets.info('Using sheet title from env', { sheetTitle: this.sheetTitle });
      }

      logger.sheets.info('Google Sheets service initialized successfully');
    } catch (error) {
      logger.sheets.error('Failed to initialize Google Sheets service', { error: error.message });
      // Do not throw; disable instead to avoid breaking the app
      this.isDisabled = true;
      this.initialized = true;
    }
  }

  /**
   * Ensure the spreadsheet has the correct headers
   */
  async ensureHeaders() {
    try {
      await this.initialize();
      if (this.isDisabled) {
        return; // Skip when disabled
      }

      const getDesiredHeaders = () => ([
        'ID',
        'Company Name',
        'Job Title',
        'Location',
        'Employment Type',
        'Description',
        'Requirements',
        'Job URL',
        'Contact Email',
        'Contact Phone',
        'Anrede',
        'Contact Person',
        'Company Address',
        'Company PlzOrt',
        'Company Website',
        'Extracted Company Name',
        'Salary',
        'Published Date',
        'Application Deadline',
        'Enrichment Confidence',
        'Has Real Email',
        'Enrichment Status',
        'Instantly Status',
        'Pipedrive Status',
        'Processing Status',
        'Duplicate Status',
        'Created At',
        'Updated At'
      ]);

      const headers = getDesiredHeaders();
      const a1 = (r) => `${this.sheetTitle || 'Sheet1'}!${r}`;

      // Read current headers (extended to AB)
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: a1('A1:AB1')
      });

      const current = (response.data.values && response.data.values[0]) || [];
      const needsUpdate = current.length !== headers.length || headers.some((h, i) => (current[i] || '') !== h);

      if (needsUpdate) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: a1('A1:AB1'),
          valueInputOption: 'RAW',
          resource: { values: [headers] }
        });
        logger.sheets.info('Headers synchronized with desired schema', { updated: true });
      }
    } catch (error) {
      logger.sheets.error('Failed to ensure headers', { error: error.message });
      if (!this.isDisabled) {
        throw error;
      }
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

      if (this.isDisabled) {
        const skipped = Array.isArray(jobs) ? jobs.length : 0;
        logger.sheets.info('Google Sheets disabled: skipping save', { skipped });
        return { saved: 0, skipped, errors: 0 };
      }

      if (!jobs || jobs.length === 0) {
        return { saved: 0, skipped: 0, errors: 0 };
      }

      logger.sheets.info('Saving jobs to Google Sheets', { count: jobs.length });

      // Шаг 1: Получаем существующие вакансии для проверки дубликатов
      const existingJobs = await this.getExistingJobs();
      logger.sheets.info('Retrieved existing jobs for duplicate check', { 
        existingCount: existingJobs.length 
      });

      // Шаг 2: Проверяем дубликаты
      const duplicateCheckResult = duplicateDetectionService.filterDuplicates(jobs);
      duplicateDetectionService.logDuplicateInfo(duplicateCheckResult);

      // Шаг 3: Сохраняем только уникальные вакансии
      const uniqueJobs = duplicateCheckResult.uniqueJobs;
      const duplicates = duplicateCheckResult.duplicates;

      if (duplicates.length > 0) {
        logger.sheets.info('Duplicates filtered out', {
          originalCount: jobs.length,
          uniqueCount: uniqueJobs.length,
          duplicateCount: duplicates.length,
          examples: duplicates.slice(0, 3).map(d => ({
            newJob: { id: d.newJob.id, title: d.newJob.title, company: d.newJob.company },
            existingJob: { id: d.existingJob.id, title: d.existingJob.title, company: d.existingJob.company },
            similarity: d.duplicateInfo.similarity,
            reason: d.duplicateInfo.reason
          }))
        });

        // Отмечаем существующие вакансии как дубликаты
        try {
          const markedCount = await this.markExistingJobsAsDuplicates(duplicates);
          logger.sheets.info('Existing duplicates marked in spreadsheet', { markedCount });
        } catch (markError) {
          logger.sheets.warn('Failed to mark existing duplicates', { error: markError.message });
        }
      }

      if (uniqueJobs.length === 0) {
        logger.sheets.info('No unique jobs to save after duplicate filtering');
        return { 
          saved: 0, 
          skipped: jobs.length, 
          errors: 0,
          duplicates: duplicates.length
        };
      }

      const a1 = (r) => `${this.sheetTitle || 'Sheet1'}!${r}`;

      // For large datasets, process in batches to avoid API limits
      const BATCH_SIZE = 200;
      let totalSaved = 0;

      if (uniqueJobs.length > BATCH_SIZE) {
        logger.sheets.info('Processing large dataset in batches', { 
          totalJobs: uniqueJobs.length, 
          batchSize: BATCH_SIZE 
        });

        for (let i = 0; i < uniqueJobs.length; i += BATCH_SIZE) {
          const batch = uniqueJobs.slice(i, i + BATCH_SIZE);
          const rows = batch.map(job => this.jobToRow(job));
          
          const nextRow = await this.getNextEmptyRow();
          const range = a1(`A${nextRow}:AB${nextRow + rows.length - 1}`);

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
          if (i + BATCH_SIZE < uniqueJobs.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } else {
        // Process normally for smaller datasets
        const rows = uniqueJobs.map(job => this.jobToRow(job));
        
        const nextRow = await this.getNextEmptyRow();
        const range = a1(`A${nextRow}:AB${nextRow + rows.length - 1}`);

        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: range,
          valueInputOption: 'RAW',
          resource: {
            values: rows
          }
        });

        totalSaved = uniqueJobs.length;
      }

      logger.sheets.info('Jobs saved successfully', { 
        count: totalSaved,
        duplicatesFiltered: duplicates.length
      });

      return { 
        saved: totalSaved, 
        skipped: duplicates.length, 
        errors: 0,
        duplicates: duplicates.length
      };
    } catch (error) {
      logger.sheets.error('Failed to save jobs', { 
        error: error.message, 
        jobCount: jobs?.length 
      });
      if (this.isDisabled) {
        const skipped = Array.isArray(jobs) ? jobs.length : 0;
        return { saved: 0, skipped, errors: 0 };
      }
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
      if (this.isDisabled) return false;

      const a1 = (r) => `${this.sheetTitle || 'Sheet1'}!${r}`;

      // Find the job row by ID
      const jobRow = await this.findJobRow(jobId);
      if (!jobRow) {
        logger.sheets.warn('Job not found for status update', { jobId });
        return false;
      }

      const updateData = [];
      
      // Map updates to column positions
      if (updates.enrichedEmail) {
        updateData.push({ range: a1(`N${jobRow}`), values: [[updates.enrichedEmail]] });
      }
      if (updates.enrichedPhone) {
        updateData.push({ range: a1(`O${jobRow}`), values: [[updates.enrichedPhone]] });
      }
      if (updates.apolloStatus) {
        updateData.push({ range: a1(`P${jobRow}`), values: [[updates.apolloStatus]] });
      }
      if (updates.instantlyStatus) {
        updateData.push({ range: a1(`Q${jobRow}`), values: [[updates.instantlyStatus]] });
      }
      if (updates.pipedriveStatus) {
        updateData.push({ range: a1(`R${jobRow}`), values: [[updates.pipedriveStatus]] });
      }
      if (updates.processingStatus) {
        updateData.push({ range: a1(`S${jobRow}`), values: [[updates.processingStatus]] });
      }

      // Always update the "Updated At" column
      updateData.push({ range: a1(`U${jobRow}`), values: [[new Date().toISOString()]] });

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
      const range = `${this.sheetTitle || 'Sheet1'}!A:Z`;
      if (this.isDisabled) return; // Skip when disabled
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
      const updateRange = `${this.sheetTitle || 'Sheet1'}!N${jobRowIndex + 1}:P${jobRowIndex + 1}`;
      const values = [[
        enrichmentData.contactEmail || rows[jobRowIndex][13] || '',
        enrichmentData.contactPhone || rows[jobRowIndex][14] || '',
        enrichmentData.apolloStatus || rows[jobRowIndex][15] || ''
      ]];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: updateRange,
        valueInputOption: 'RAW',
        resource: {
          values: values
        }
      });

      logger.sheets.info('Job enrichment status updated', { jobId });
    } catch (error) {
      logger.sheets.error('Failed to update job enrichment status', { 
        jobId, 
        error: error.message 
      });
    }
  }

  /**
   * Mark existing jobs as duplicates based on duplicate detection results
   * @param {Array} duplicates - Array of duplicate information
   * @returns {Promise<number>} Number of jobs marked as duplicates
   */
  async markExistingJobsAsDuplicates(duplicates) {
    try {
      if (this.isDisabled || !duplicates || duplicates.length === 0) {
        return 0;
      }

      const a1 = (r) => `${this.sheetTitle || 'Sheet1'}!${r}`;
      let markedCount = 0;

      for (const duplicate of duplicates) {
        try {
          // Находим строку существующей вакансии
          const existingJobRow = await this.findJobRow(duplicate.existingJob.id);
          if (existingJobRow) {
            // Обновляем статус дубликата
            await this.sheets.spreadsheets.values.update({
              spreadsheetId: this.spreadsheetId,
              range: a1(`W${existingJobRow}`), // Колонка W = Duplicate Status
              valueInputOption: 'RAW',
              resource: {
                values: [['Duplicate']]
              }
            });

            // Также обновляем время обновления
            await this.sheets.spreadsheets.values.update({
              spreadsheetId: this.spreadsheetId,
              range: a1(`Z${existingJobRow}`), // Колонка Z = Updated At
              valueInputOption: 'RAW',
              resource: {
                values: [[new Date().toISOString()]]
              }
            });

            markedCount++;
            logger.sheets.info('Marked existing job as duplicate', {
              jobId: duplicate.existingJob.id,
              duplicateWith: duplicate.newJob.id,
              similarity: duplicate.duplicateInfo.similarity
            });
          }
        } catch (jobError) {
          logger.sheets.warn('Failed to mark job as duplicate', {
            jobId: duplicate.existingJob.id,
            error: jobError.message
          });
        }
      }

      if (markedCount > 0) {
        logger.sheets.info('Duplicate marking completed', { markedCount });
      }

      return markedCount;
    } catch (error) {
      logger.sheets.error('Failed to mark existing jobs as duplicates', { 
        error: error.message,
        duplicateCount: duplicates?.length 
      });
      return 0;
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
      if (this.isDisabled) return [];

      const a1 = (r) => `${this.sheetTitle || 'Sheet1'}!${r}`;

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: a1('A2:U1000') // Adjust range as needed
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
      return [];
    }
  }

  /**
   * Convert job object to spreadsheet row
   * @param {Object} job - Job object
   * @returns {Array} Row data
   */
  jobToRow(job) {
    const normalizePhone = (raw) => {
      if (!raw) return '';
      let p = String(raw).replace(/\s+/g, ' ').replace(/["']/g, '').trim();
      p = p.replace(/[^+\d]/g, '');
      p = p.replace(/(?!^)[+]/g, '');
      const digits = p.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 20) return '';
      return p;
    };

    const parseSalutation = (person) => {
      if (!person) return '';
      const m = String(person).match(/\b(Herr|Frau)\b/i);
      return m ? (m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()) : '';
    };

    const stripSalutation = (person) => {
      if (!person) return '';
      return String(person)
        .replace(/\r?\n.+$/s, '') // keep only first line
        .replace(/\b(Herr|Frau)\b\s*/i, '')
        .replace(/\b(Strasse|Straße|Str\.|Weg|Platz|Allee)\b.*$/i, '') // if street leaked in, cut it
        .replace(/["']/g, '')
        .trim();
    };

    const splitAddress = (addr) => {
      if (!addr) return { street: '', plzOrt: '' };
      let cleaned = String(addr)
        .replace(/\r?\n/g, ' ')
        .replace(/["']/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\b(Telefon|Phone|Tel\.?):?.*$/i, '')
        .trim();

      // remove leading company or contact name if present
      if (job.company) {
        const comp = String(job.company).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cleaned = cleaned.replace(new RegExp('^' + comp + '\\s*,?\\s*', 'i'), '');
      }
      if (contactPerson) {
        const nameOnly = stripSalutation(contactPerson);
        if (nameOnly) {
          const nameEsc = nameOnly.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          cleaned = cleaned.replace(new RegExp('^' + nameEsc + '\\s*,?\\s*', 'i'), '');
        }
      }

      const m = cleaned.match(/(.+?)\s*(?:,\s*)?(\b\d{5}\b\s+[A-Za-zÄÖÜäöüß \-\/]+)$/);
      if (m) {
        return { street: m[1].trim(), plzOrt: m[2].trim() };
      }
      return { street: cleaned, plzOrt: '' };
    };

    const contactPerson = job.contactPerson || '';
    const anrede = parseSalutation(contactPerson);
    const contactName = stripSalutation(contactPerson);
    const { street, plzOrt } = splitAddress(job.companyAddress || '');

    return [
      job.id || '',
      job.company || '',
      job.title || '',
      job.location || '',
      job.employmentType || '',
      job.description ? job.description.substring(0, 500) : '',
      job.requirements ? job.requirements.substring(0, 500) : '',
      job.externalUrl || '',
      job.contactEmail || '',
      normalizePhone(job.contactPhone),
      anrede,
      contactName,
      street,
      plzOrt,
      job.companyWebsite || '',
      job.extractedCompanyName || '',
      job.salary || '',
      job.publishedDate || '',
      job.applicationDeadline || '',
      job.enrichment?.confidence || '',
      job.enrichment?.hasRealEmail ? 'Yes' : 'No',
      job.enrichment?.status || 'Pending',
      'Pending',
      'Pending',
      'New',
      'New',
      new Date().toISOString(),
      new Date().toISOString()
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
      contactSalutation: row[10] || '',
      contactPerson: row[11] || '',
      companyAddress: row[12] || '',
      companyPlzOrt: row[13] || '',
      companyWebsite: row[14] || '',
      extractedCompanyName: row[15] || '',
      salary: row[16] || '',
      publishedDate: row[17] || '',
      applicationDeadline: row[18] || '',
      enrichmentConfidence: row[19] || '',
      hasRealEmail: row[20] || '',
      enrichmentStatus: row[21] || '',
      instantlyStatus: row[22] || '',
      pipedriveStatus: row[23] || '',
      processingStatus: row[24] || '',
      duplicateStatus: row[25] || '',
      createdAt: row[26] || '',
      updatedAt: row[27] || ''
    };
  }

  /**
   * Find the row number of a job by its ID
   * @param {string} jobId - Job ID
   * @returns {Promise<number|null>} Row number or null if not found
   */
  async findJobRow(jobId) {
    try {
      if (this.isDisabled) return null;
      const a1 = (r) => `${this.sheetTitle || 'Sheet1'}!${r}`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: a1('A2:A1000') // ID column
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
      if (this.isDisabled) return 2; // Start from row 2 (after headers)
      const a1 = (r) => `${this.sheetTitle || 'Sheet1'}!${r}`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: a1('A:A')
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
   * Get all existing jobs from the spreadsheet for duplicate checking
   * @returns {Promise<Array>} Array of existing job objects
   */
  async getExistingJobs() {
    try {
      if (this.isDisabled) return [];
      
      const a1 = (r) => `${this.sheetTitle || 'Sheet1'}!${r}`;
      
      // Получаем все строки с данными (начиная со строки 2, пропуская заголовки)
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: a1('A2:AB')
      });

      if (!response.data.values || response.data.values.length === 0) {
        return [];
      }

      // Конвертируем строки в объекты вакансий
      const existingJobs = response.data.values
        .filter(row => row[0] && row[0].trim() !== '')
        .map(row => this.rowToJob(row));

      logger.sheets.info('Retrieved existing jobs for duplicate check', { 
        count: existingJobs.length 
      });

      return existingJobs;
    } catch (error) {
      logger.sheets.error('Failed to get existing jobs', { error: error.message });
      return [];
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
      if (this.isDisabled) return null;

      const a1 = (r) => `${this.sheetTitle || 'Sheet1'}!${r}`;

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: a1('A2:AB1000')
      });

      if (!response.data.values) {
        return null;
      }

      // Find job where contact email (column I, index 8) matches
      const jobRow = response.data.values.find(row => row[8] === email);
      
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
      if (this.isDisabled) return [];

      const a1 = (r) => `${this.sheetTitle || 'Sheet1'}!${r}`;

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: a1('A2:AB1000')
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
      if (this.isDisabled) return [];

      const a1 = (r) => `${this.sheetTitle || 'Sheet1'}!${r}`;

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: a1('A2:U1000')
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
      if (this.isDisabled) return [];

      const a1 = (r) => `${this.sheetTitle || 'Sheet1'}!${r}`;

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: a1('A2:U1000')
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