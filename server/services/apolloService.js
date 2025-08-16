const axios = require('axios');
const logger = require('../utils/logger');

class ApolloService {
  constructor() {
    this.baseURL = process.env.APOLLO_API_URL || 'https://api.apollo.io/v1';
    this.apiKey = process.env.APOLLO_API_KEY;
    this.rateLimit = {
      requests: 0,
      resetTime: Date.now() + 60000 // Reset every minute
    };
  }

  /**
   * Check rate limiting
   */
  checkRateLimit() {
    const now = Date.now();
    if (now > this.rateLimit.resetTime) {
      this.rateLimit.requests = 0;
      this.rateLimit.resetTime = now + 60000;
    }

    if (this.rateLimit.requests >= 60) { // Apollo typically has 60 requests per minute limit
      throw new Error('Apollo API rate limit exceeded. Please wait.');
    }

    this.rateLimit.requests++;
  }

  /**
   * Search for people by company name
   * @param {string} companyName - Company name to search for
   * @param {Object} options - Additional search options
   * @returns {Promise<Array>} Array of found contacts
   */
  async searchPeopleByCompany(companyName, options = {}) {
    try {
      this.checkRateLimit();

      if (!this.apiKey) {
        throw new Error('Apollo API key not configured');
      }

      logger.apollo.info('Searching people by company', { companyName, options });

      const requestData = {
        q_keywords: companyName,
        page: options.page || 1,
        per_page: Math.min(options.perPage || 10, 25), // Apollo max is typically 25
        person_titles: options.titles || ['HR', 'Recruiter', 'Hiring Manager', 'CEO', 'Manager'],
        q_organization_domains: options.domain ? [options.domain] : undefined
      };

      // Remove undefined values
      Object.keys(requestData).forEach(key => {
        if (requestData[key] === undefined) {
          delete requestData[key];
        }
      });

      const config = {
        method: 'POST',
        url: `${this.baseURL}/mixed_people/search`,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': this.apiKey
        },
        data: requestData
      };

      const response = await axios(config);
      
      const contacts = this.parseContactResults(response.data);
      
      logger.apollo.info('People search completed', { 
        companyName, 
        found: contacts.length 
      });

      return contacts;
    } catch (error) {
      logger.apollo.error('Failed to search people by company', {
        companyName,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      // Return empty array instead of throwing for non-critical errors
      if (error.response?.status === 429) {
        throw error; // Re-throw rate limit errors
      }
      
      return [];
    }
  }

  /**
   * Enrich contact by email
   * @param {string} email - Email to enrich
   * @returns {Promise<Object|null>} Enriched contact data
   */
  async enrichContactByEmail(email) {
    try {
      this.checkRateLimit();

      if (!this.apiKey) {
        throw new Error('Apollo API key not configured');
      }

      logger.apollo.info('Enriching contact by email', { email: email.substring(0, 3) + '***' });

      const config = {
        method: 'POST',
        url: `${this.baseURL}/people/match`,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': this.apiKey
        },
        data: {
          email: email
        }
      };

      const response = await axios(config);
      
      if (!response.data || !response.data.person) {
        return null;
      }

      const enrichedContact = this.parseContactData(response.data.person);
      
      logger.apollo.info('Contact enrichment completed', { 
        email: email.substring(0, 3) + '***',
        found: !!enrichedContact
      });

      return enrichedContact;
    } catch (error) {
      logger.apollo.error('Failed to enrich contact by email', {
        email: email.substring(0, 3) + '***',
        error: error.message,
        status: error.response?.status
      });
      
      return null;
    }
  }

  /**
   * Search organizations by domain or name
   * @param {string} query - Domain or company name
   * @returns {Promise<Array>} Array of organizations
   */
  async searchOrganizations(query) {
    try {
      this.checkRateLimit();

      if (!this.apiKey) {
        throw new Error('Apollo API key not configured');
      }

      logger.apollo.info('Searching organizations', { query });

      const config = {
        method: 'POST',
        url: `${this.baseURL}/organizations/search`,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': this.apiKey
        },
        data: {
          q_keywords: query,
          page: 1,
          per_page: 10
        }
      };

      const response = await axios(config);
      
      const organizations = response.data.organizations || [];
      
      logger.apollo.info('Organization search completed', { 
        query, 
        found: organizations.length 
      });

      return organizations.map(org => ({
        id: org.id,
        name: org.name,
        domain: org.primary_domain,
        website: org.website_url,
        industry: org.industry,
        employeeCount: org.estimated_num_employees,
        location: org.primary_city,
        country: org.primary_country,
        founded: org.founded_year
      }));
    } catch (error) {
      logger.apollo.error('Failed to search organizations', {
        query,
        error: error.message,
        status: error.response?.status
      });
      
      return [];
    }
  }

  /**
   * Parse contact results from Apollo API response
   * @param {Object} data - Raw API response
   * @returns {Array} Parsed contacts
   */
  parseContactResults(data) {
    if (!data || !data.people) {
      return [];
    }

    return data.people.map(person => this.parseContactData(person));
  }

  /**
   * Parse individual contact data
   * @param {Object} person - Person data from Apollo
   * @returns {Object} Parsed contact
   */
  parseContactData(person) {
    return {
      id: person.id,
      firstName: person.first_name,
      lastName: person.last_name,
      fullName: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
      email: person.email,
      phone: person.phone_numbers?.[0]?.raw_number || null,
      title: person.title,
      company: person.organization?.name,
      companyDomain: person.organization?.primary_domain,
      companyWebsite: person.organization?.website_url,
      linkedinUrl: person.linkedin_url,
      location: person.city,
      country: person.country,
      industry: person.organization?.industry,
      employeeCount: person.organization?.estimated_num_employees,
      confidence: person.email_status === 'verified' ? 'high' : 
                  person.email_status === 'likely' ? 'medium' : 'low',
      source: 'apollo'
    };
  }

  /**
   * Enrich job with contact information
   * @param {Object} job - Job object to enrich
   * @returns {Promise<Object>} Enriched job with contact data
   */
  async enrichJob(job) {
    try {
      logger.apollo.info('Enriching job with contacts', { 
        jobId: job.id, 
        company: job.company 
      });

      const enrichmentResult = {
        jobId: job.id,
        originalJob: job,
        contacts: [],
        organizations: [],
        status: 'pending',
        enrichedAt: new Date().toISOString()
      };

      // First, try to find the organization
      if (job.company) {
        const organizations = await this.searchOrganizations(job.company);
        enrichmentResult.organizations = organizations;

        // If we found organizations, try to find people
        if (organizations.length > 0) {
          const primaryOrg = organizations[0];
          const contacts = await this.searchPeopleByCompany(job.company, {
            domain: primaryOrg.domain,
            titles: ['HR', 'Recruiter', 'Hiring Manager', 'People', 'Talent']
          });
          enrichmentResult.contacts = contacts;
        } else {
          // Fallback: search without domain
          const contacts = await this.searchPeopleByCompany(job.company);
          enrichmentResult.contacts = contacts;
        }
      }

      // If we have existing contact email, try to enrich it
      if (job.contactEmail && !enrichmentResult.contacts.length) {
        const enrichedContact = await this.enrichContactByEmail(job.contactEmail);
        if (enrichedContact) {
          enrichmentResult.contacts = [enrichedContact];
        }
      }

      enrichmentResult.status = enrichmentResult.contacts.length > 0 ? 'completed' : 'no_contacts_found';
      
      logger.apollo.info('Job enrichment completed', {
        jobId: job.id,
        contactsFound: enrichmentResult.contacts.length,
        organizationsFound: enrichmentResult.organizations.length
      });

      return enrichmentResult;
    } catch (error) {
      logger.apollo.error('Failed to enrich job', {
        jobId: job.id,
        error: error.message
      });

      return {
        jobId: job.id,
        originalJob: job,
        contacts: [],
        organizations: [],
        status: 'error',
        error: error.message,
        enrichedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Get the best contact from enrichment results
   * @param {Array} contacts - Array of contacts
   * @returns {Object|null} Best contact or null
   */
  getBestContact(contacts) {
    if (!contacts || contacts.length === 0) {
      return null;
    }

    // Sort by confidence and relevance
    const sorted = contacts.sort((a, b) => {
      // Prefer verified emails
      if (a.confidence === 'high' && b.confidence !== 'high') return -1;
      if (b.confidence === 'high' && a.confidence !== 'high') return 1;

      // Prefer contacts with both email and phone
      const aComplete = (a.email ? 1 : 0) + (a.phone ? 1 : 0);
      const bComplete = (b.email ? 1 : 0) + (b.phone ? 1 : 0);
      if (aComplete !== bComplete) return bComplete - aComplete;

      // Prefer HR/Recruiting titles
      const relevantTitles = ['hr', 'recruit', 'hiring', 'talent', 'people'];
      const aRelevant = relevantTitles.some(title => 
        a.title?.toLowerCase().includes(title)
      );
      const bRelevant = relevantTitles.some(title => 
        b.title?.toLowerCase().includes(title)
      );
      
      if (aRelevant && !bRelevant) return -1;
      if (bRelevant && !aRelevant) return 1;

      return 0;
    });

    return sorted[0];
  }
}

module.exports = new ApolloService(); 