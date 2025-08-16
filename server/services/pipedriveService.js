const axios = require('axios');
const logger = require('../utils/logger');

class PipedriveService {
  constructor() {
    this.baseURL = `https://${process.env.PIPEDRIVE_COMPANY_DOMAIN || 'api'}.pipedrive.com/v1`;
    this.apiToken = process.env.PIPEDRIVE_API_TOKEN;
  }

  /**
   * Create a new person in Pipedrive
   * @param {Object} contact - Contact information
   * @returns {Promise<Object>} Created person data
   */
  async createPerson(contact) {
    try {
      if (!this.apiToken) {
        throw new Error('Pipedrive API token not configured');
      }

      logger.pipedrive.info('Creating person in Pipedrive', { 
        name: contact.fullName,
        email: contact.email?.substring(0, 3) + '***'
      });

      const personData = {
        name: contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        email: contact.email,
        phone: contact.phone,
        org_name: contact.company,
        visible_to: 3, // Visible to entire company
        custom_fields: {}
      };

      // Add custom fields if available
      if (contact.title) {
        personData.custom_fields.job_title = contact.title;
      }
      if (contact.linkedinUrl) {
        personData.custom_fields.linkedin_url = contact.linkedinUrl;
      }
      if (contact.location) {
        personData.custom_fields.location = contact.location;
      }

      const config = {
        method: 'POST',
        url: `${this.baseURL}/persons`,
        params: {
          api_token: this.apiToken
        },
        data: personData
      };

      const response = await axios(config);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create person');
      }

      const person = response.data.data;

      logger.pipedrive.info('Person created successfully', { 
        personId: person.id,
        name: person.name 
      });

      return {
        id: person.id,
        name: person.name,
        email: person.email?.[0]?.value,
        phone: person.phone?.[0]?.value,
        company: person.org_name,
        createdAt: person.add_time
      };
    } catch (error) {
      logger.pipedrive.error('Failed to create person', {
        contact: contact.fullName,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Create a new organization in Pipedrive
   * @param {Object} orgData - Organization information
   * @returns {Promise<Object>} Created organization data
   */
  async createOrganization(orgData) {
    try {
      if (!this.apiToken) {
        throw new Error('Pipedrive API token not configured');
      }

      logger.pipedrive.info('Creating organization in Pipedrive', { name: orgData.name });

      const organizationData = {
        name: orgData.name,
        visible_to: 3, // Visible to entire company
        custom_fields: {}
      };

      if (orgData.domain) {
        organizationData.custom_fields.website = orgData.domain;
      }
      if (orgData.industry) {
        organizationData.custom_fields.industry = orgData.industry;
      }
      if (orgData.employeeCount) {
        organizationData.custom_fields.employee_count = orgData.employeeCount;
      }
      if (orgData.location) {
        organizationData.custom_fields.location = orgData.location;
      }

      const config = {
        method: 'POST',
        url: `${this.baseURL}/organizations`,
        params: {
          api_token: this.apiToken
        },
        data: organizationData
      };

      const response = await axios(config);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create organization');
      }

      const organization = response.data.data;

      logger.pipedrive.info('Organization created successfully', { 
        orgId: organization.id,
        name: organization.name 
      });

      return {
        id: organization.id,
        name: organization.name,
        createdAt: organization.add_time
      };
    } catch (error) {
      logger.pipedrive.error('Failed to create organization', {
        orgName: orgData.name,
        error: error.message,
        status: error.response?.status
      });
      throw error;
    }
  }

  /**
   * Create a new deal in Pipedrive
   * @param {Object} dealData - Deal information
   * @returns {Promise<Object>} Created deal data
   */
  async createDeal(dealData) {
    try {
      if (!this.apiToken) {
        throw new Error('Pipedrive API token not configured');
      }

      logger.pipedrive.info('Creating deal in Pipedrive', { title: dealData.title });

      const deal = {
        title: dealData.title,
        person_id: dealData.personId,
        org_id: dealData.organizationId,
        value: dealData.value || 0,
        currency: dealData.currency || 'EUR',
        status: 'open',
        visible_to: 3, // Visible to entire company
        custom_fields: {}
      };

      // Add custom fields
      if (dealData.source) {
        deal.custom_fields.source = dealData.source;
      }
      if (dealData.jobUrl) {
        deal.custom_fields.job_url = dealData.jobUrl;
      }
      if (dealData.jobTitle) {
        deal.custom_fields.job_title = dealData.jobTitle;
      }
      if (dealData.applicationDeadline) {
        deal.custom_fields.application_deadline = dealData.applicationDeadline;
      }

      const config = {
        method: 'POST',
        url: `${this.baseURL}/deals`,
        params: {
          api_token: this.apiToken
        },
        data: deal
      };

      const response = await axios(config);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create deal');
      }

      const createdDeal = response.data.data;

      logger.pipedrive.info('Deal created successfully', { 
        dealId: createdDeal.id,
        title: createdDeal.title 
      });

      return {
        id: createdDeal.id,
        title: createdDeal.title,
        value: createdDeal.value,
        currency: createdDeal.currency,
        status: createdDeal.status,
        stage: createdDeal.stage_id,
        personId: createdDeal.person_id,
        organizationId: createdDeal.org_id,
        createdAt: createdDeal.add_time
      };
    } catch (error) {
      logger.pipedrive.error('Failed to create deal', {
        title: dealData.title,
        error: error.message,
        status: error.response?.status
      });
      throw error;
    }
  }

  /**
   * Search for existing person by email
   * @param {string} email - Email to search for
   * @returns {Promise<Object|null>} Found person or null
   */
  async findPersonByEmail(email) {
    try {
      if (!this.apiToken) {
        throw new Error('Pipedrive API token not configured');
      }

      logger.pipedrive.info('Searching person by email', { 
        email: email.substring(0, 3) + '***' 
      });

      const config = {
        method: 'GET',
        url: `${this.baseURL}/persons/search`,
        params: {
          api_token: this.apiToken,
          term: email,
          field: 'email',
          exact_match: true
        }
      };

      const response = await axios(config);

      if (!response.data.success || !response.data.data?.items?.length) {
        return null;
      }

      const person = response.data.data.items[0].item;

      logger.pipedrive.info('Person found by email', { 
        personId: person.id,
        name: person.name 
      });

      return {
        id: person.id,
        name: person.name,
        email: person.emails?.[0],
        phone: person.phones?.[0],
        company: person.organization?.name,
        organizationId: person.organization?.id
      };
    } catch (error) {
      logger.pipedrive.error('Failed to search person by email', {
        email: email.substring(0, 3) + '***',
        error: error.message,
        status: error.response?.status
      });
      return null;
    }
  }

  /**
   * Search for existing organization by name
   * @param {string} name - Organization name to search for
   * @returns {Promise<Object|null>} Found organization or null
   */
  async findOrganizationByName(name) {
    try {
      if (!this.apiToken) {
        throw new Error('Pipedrive API token not configured');
      }

      logger.pipedrive.info('Searching organization by name', { name });

      const config = {
        method: 'GET',
        url: `${this.baseURL}/organizations/search`,
        params: {
          api_token: this.apiToken,
          term: name,
          exact_match: false
        }
      };

      const response = await axios(config);

      if (!response.data.success || !response.data.data?.items?.length) {
        return null;
      }

      const organization = response.data.data.items[0].item;

      logger.pipedrive.info('Organization found by name', { 
        orgId: organization.id,
        name: organization.name 
      });

      return {
        id: organization.id,
        name: organization.name
      };
    } catch (error) {
      logger.pipedrive.error('Failed to search organization by name', {
        name,
        error: error.message,
        status: error.response?.status
      });
      return null;
    }
  }

  /**
   * Create lead from positive email response
   * @param {Object} responseData - Response data including contact and job info
   * @returns {Promise<Object>} Created lead information
   */
  async createLeadFromResponse(responseData) {
    try {
      logger.pipedrive.info('Creating lead from positive response', {
        email: responseData.contact?.email?.substring(0, 3) + '***',
        company: responseData.contact?.company
      });

      const result = {
        success: false,
        personId: null,
        organizationId: null,
        dealId: null,
        created: {
          person: false,
          organization: false,
          deal: false
        }
      };

      // Step 1: Find or create organization
      if (responseData.contact?.company) {
        let organization = await this.findOrganizationByName(responseData.contact.company);
        
        if (!organization) {
          organization = await this.createOrganization({
            name: responseData.contact.company,
            domain: responseData.contact?.companyDomain,
            industry: responseData.contact?.industry,
            employeeCount: responseData.contact?.employeeCount,
            location: responseData.contact?.location
          });
          result.created.organization = true;
        }
        
        result.organizationId = organization.id;
      }

      // Step 2: Find or create person
      let person = null;
      if (responseData.contact?.email) {
        person = await this.findPersonByEmail(responseData.contact.email);
      }

      if (!person) {
        person = await this.createPerson({
          ...responseData.contact,
          company: responseData.contact?.company
        });
        result.created.person = true;
      }

      result.personId = person.id;

      // Step 3: Create deal
      const dealTitle = `Job Application: ${responseData.jobTitle || 'Unknown Position'} at ${responseData.contact?.company || 'Unknown Company'}`;
      
      const deal = await this.createDeal({
        title: dealTitle,
        personId: person.id,
        organizationId: result.organizationId,
        value: 0, // Can be updated later
        currency: 'EUR',
        source: 'Email Campaign',
        jobUrl: responseData.jobUrl,
        jobTitle: responseData.jobTitle,
        applicationDeadline: responseData.applicationDeadline
      });

      result.dealId = deal.id;
      result.created.deal = true;
      result.success = true;

      logger.pipedrive.info('Lead created successfully from response', {
        dealId: deal.id,
        personId: person.id,
        organizationId: result.organizationId,
        created: result.created
      });

      return result;
    } catch (error) {
      logger.pipedrive.error('Failed to create lead from response', {
        email: responseData.contact?.email?.substring(0, 3) + '***',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Add note to deal
   * @param {number} dealId - Deal ID
   * @param {string} content - Note content
   * @returns {Promise<boolean>} Success status
   */
  async addNoteToDeal(dealId, content) {
    try {
      if (!this.apiToken) {
        throw new Error('Pipedrive API token not configured');
      }

      logger.pipedrive.info('Adding note to deal', { dealId });

      const config = {
        method: 'POST',
        url: `${this.baseURL}/notes`,
        params: {
          api_token: this.apiToken
        },
        data: {
          content: content,
          deal_id: dealId
        }
      };

      const response = await axios(config);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to add note');
      }

      logger.pipedrive.info('Note added successfully', { 
        dealId,
        noteId: response.data.data.id 
      });

      return true;
    } catch (error) {
      logger.pipedrive.error('Failed to add note to deal', {
        dealId,
        error: error.message,
        status: error.response?.status
      });
      return false;
    }
  }

  /**
   * Update deal stage
   * @param {number} dealId - Deal ID
   * @param {number} stageId - New stage ID
   * @returns {Promise<boolean>} Success status
   */
  async updateDealStage(dealId, stageId) {
    try {
      if (!this.apiToken) {
        throw new Error('Pipedrive API token not configured');
      }

      logger.pipedrive.info('Updating deal stage', { dealId, stageId });

      const config = {
        method: 'PUT',
        url: `${this.baseURL}/deals/${dealId}`,
        params: {
          api_token: this.apiToken
        },
        data: {
          stage_id: stageId
        }
      };

      const response = await axios(config);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to update deal stage');
      }

      logger.pipedrive.info('Deal stage updated successfully', { dealId, stageId });

      return true;
    } catch (error) {
      logger.pipedrive.error('Failed to update deal stage', {
        dealId,
        stageId,
        error: error.message,
        status: error.response?.status
      });
      return false;
    }
  }

  /**
   * Get pipeline stages
   * @returns {Promise<Array>} Array of pipeline stages
   */
  async getPipelineStages() {
    try {
      if (!this.apiToken) {
        throw new Error('Pipedrive API token not configured');
      }

      logger.pipedrive.info('Fetching pipeline stages');

      const config = {
        method: 'GET',
        url: `${this.baseURL}/stages`,
        params: {
          api_token: this.apiToken
        }
      };

      const response = await axios(config);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch stages');
      }

      const stages = response.data.data.map(stage => ({
        id: stage.id,
        name: stage.name,
        pipelineId: stage.pipeline_id,
        orderNr: stage.order_nr,
        rottenFlag: stage.rotten_flag
      }));

      logger.pipedrive.info('Pipeline stages fetched successfully', { count: stages.length });

      return stages;
    } catch (error) {
      logger.pipedrive.error('Failed to fetch pipeline stages', {
        error: error.message,
        status: error.response?.status
      });
      return [];
    }
  }
}

module.exports = new PipedriveService(); 