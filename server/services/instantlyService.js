const axios = require('axios');
const logger = require('../utils/logger');

class InstantlyService {
  constructor() {
    this.baseURL = process.env.INSTANTLY_API_URL || 'https://api.instantly.ai/api/v1';
    this.apiKey = process.env.INSTANTLY_API_KEY;
  }

  /**
   * Add lead to campaign
   * @param {string} campaignId - Campaign ID
   * @param {Object} contact - Contact information
   * @returns {Promise<Object>} Result of adding lead
   */
  async addLeadToCampaign(campaignId, contact) {
    try {
      if (!this.apiKey) {
        throw new Error('Instantly API key not configured');
      }

      logger.instantly.info('Adding lead to campaign', { 
        campaignId, 
        email: contact.email?.substring(0, 3) + '***' 
      });

      const leadData = {
        campaign_id: campaignId,
        email: contact.email,
        first_name: contact.firstName || contact.fullName?.split(' ')[0] || '',
        last_name: contact.lastName || contact.fullName?.split(' ').slice(1).join(' ') || '',
        company_name: contact.company || '',
        personalization: {
          job_title: contact.title || '',
          phone: contact.phone || '',
          linkedin_url: contact.linkedinUrl || '',
          company_website: contact.companyWebsite || '',
          industry: contact.industry || '',
          location: contact.location || '',
          custom_variables: {
            job_url: contact.jobUrl || '',
            job_title: contact.jobTitle || '',
            application_deadline: contact.applicationDeadline || ''
          }
        }
      };

      const config = {
        method: 'POST',
        url: `${this.baseURL}/lead/add`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        data: leadData
      };

      const response = await axios(config);
      
      logger.instantly.info('Lead added successfully', { 
        campaignId, 
        email: contact.email?.substring(0, 3) + '***',
        leadId: response.data.id 
      });

      return {
        success: true,
        leadId: response.data.id,
        campaignId: campaignId,
        status: 'added',
        addedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.instantly.error('Failed to add lead to campaign', {
        campaignId,
        email: contact.email?.substring(0, 3) + '***',
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      return {
        success: false,
        error: error.message,
        status: 'failed',
        failedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Get campaigns list
   * @returns {Promise<Array>} Array of campaigns
   */
  async getCampaigns() {
    try {
      if (!this.apiKey) {
        throw new Error('Instantly API key not configured');
      }

      logger.instantly.info('Fetching campaigns list');

      const config = {
        method: 'GET',
        url: `${this.baseURL}/campaign/list`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      };

      const response = await axios(config);
      
      const campaigns = response.data || [];
      
      logger.instantly.info('Campaigns fetched successfully', { count: campaigns.length });

      return campaigns.map(campaign => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        createdAt: campaign.created_at,
        leadsCount: campaign.leads_count || 0,
        isActive: campaign.status === 'active'
      }));
    } catch (error) {
      logger.instantly.error('Failed to fetch campaigns', {
        error: error.message,
        status: error.response?.status
      });
      
      return [];
    }
  }

  /**
   * Get lead statistics from campaign
   * @param {string} campaignId - Campaign ID
   * @param {string} email - Lead email (optional)
   * @returns {Promise<Object>} Lead statistics
   */
  async getLeadStats(campaignId, email = null) {
    try {
      if (!this.apiKey) {
        throw new Error('Instantly API key not configured');
      }

      logger.instantly.info('Fetching lead statistics', { campaignId, email: email?.substring(0, 3) + '***' });

      const params = {
        campaign_id: campaignId
      };

      if (email) {
        params.email = email;
      }

      const config = {
        method: 'GET',
        url: `${this.baseURL}/analytics/campaign`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        params: params
      };

      const response = await axios(config);
      
      const stats = response.data;
      
      logger.instantly.info('Lead statistics fetched', { 
        campaignId, 
        email: email?.substring(0, 3) + '***' 
      });

      return {
        campaignId: campaignId,
        totalLeads: stats.total_leads || 0,
        emailsSent: stats.emails_sent || 0,
        emailsOpened: stats.emails_opened || 0,
        emailsClicked: stats.emails_clicked || 0,
        emailsReplied: stats.emails_replied || 0,
        emailsBounced: stats.emails_bounced || 0,
        leadsOptedOut: stats.leads_opted_out || 0,
        openRate: stats.open_rate || 0,
        clickRate: stats.click_rate || 0,
        replyRate: stats.reply_rate || 0,
        bounceRate: stats.bounce_rate || 0
      };
    } catch (error) {
      logger.instantly.error('Failed to fetch lead statistics', {
        campaignId,
        email: email?.substring(0, 3) + '***',
        error: error.message,
        status: error.response?.status
      });
      
      return null;
    }
  }

  /**
   * Get replies from campaign
   * @param {string} campaignId - Campaign ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of replies
   */
  async getCampaignReplies(campaignId, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('Instantly API key not configured');
      }

      logger.instantly.info('Fetching campaign replies', { campaignId, options });

      const params = {
        campaign_id: campaignId,
        limit: options.limit || 100,
        offset: options.offset || 0
      };

      if (options.since) {
        params.since = options.since;
      }

      const config = {
        method: 'GET',
        url: `${this.baseURL}/analytics/replies`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        params: params
      };

      const response = await axios(config);
      
      const replies = response.data.replies || [];
      
      logger.instantly.info('Campaign replies fetched', { 
        campaignId, 
        count: replies.length 
      });

      return replies.map(reply => ({
        id: reply.id,
        email: reply.email,
        leadId: reply.lead_id,
        campaignId: campaignId,
        subject: reply.subject,
        message: reply.message,
        sentiment: this.analyzeSentiment(reply.message),
        isPositive: this.isPositiveReply(reply.message),
        receivedAt: reply.received_at,
        threadId: reply.thread_id
      }));
    } catch (error) {
      logger.instantly.error('Failed to fetch campaign replies', {
        campaignId,
        error: error.message,
        status: error.response?.status
      });
      
      return [];
    }
  }

  /**
   * Update lead status in campaign
   * @param {string} campaignId - Campaign ID
   * @param {string} email - Lead email
   * @param {string} status - New status
   * @returns {Promise<boolean>} Success status
   */
  async updateLeadStatus(campaignId, email, status) {
    try {
      if (!this.apiKey) {
        throw new Error('Instantly API key not configured');
      }

      logger.instantly.info('Updating lead status', { 
        campaignId, 
        email: email.substring(0, 3) + '***',
        status 
      });

      const config = {
        method: 'PUT',
        url: `${this.baseURL}/lead/update`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        data: {
          campaign_id: campaignId,
          email: email,
          status: status
        }
      };

      await axios(config);
      
      logger.instantly.info('Lead status updated successfully', { 
        campaignId, 
        email: email.substring(0, 3) + '***',
        status 
      });

      return true;
    } catch (error) {
      logger.instantly.error('Failed to update lead status', {
        campaignId,
        email: email.substring(0, 3) + '***',
        status,
        error: error.message,
        status: error.response?.status
      });
      
      return false;
    }
  }

  /**
   * Analyze sentiment of reply message
   * @param {string} message - Reply message
   * @returns {string} Sentiment (positive, negative, neutral)
   */
  analyzeSentiment(message) {
    if (!message) return 'neutral';

    const lowerMessage = message.toLowerCase();
    
    const positiveWords = [
      'interested', 'yes', 'sure', 'absolutely', 'definitely', 'sounds good',
      'let\'s talk', 'schedule', 'meeting', 'call', 'discuss', 'thank you',
      'appreciate', 'great', 'excellent', 'perfect', 'love to', 'would like'
    ];

    const negativeWords = [
      'not interested', 'no thanks', 'remove', 'unsubscribe', 'stop',
      'don\'t contact', 'not relevant', 'wrong person', 'busy', 'no time',
      'not looking', 'already have', 'not now', 'maybe later'
    ];

    const positiveScore = positiveWords.filter(word => lowerMessage.includes(word)).length;
    const negativeScore = negativeWords.filter(word => lowerMessage.includes(word)).length;

    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }

  /**
   * Check if reply is positive
   * @param {string} message - Reply message
   * @returns {boolean} True if positive
   */
  isPositiveReply(message) {
    return this.analyzeSentiment(message) === 'positive';
  }

  /**
   * Bulk add leads to campaign
   * @param {string} campaignId - Campaign ID
   * @param {Array} contacts - Array of contacts
   * @returns {Promise<Object>} Bulk operation results
   */
  async bulkAddLeads(campaignId, contacts) {
    try {
      if (!this.apiKey) {
        throw new Error('Instantly API key not configured');
      }

      logger.instantly.info('Bulk adding leads to campaign', { 
        campaignId, 
        count: contacts.length 
      });

      const results = {
        total: contacts.length,
        successful: 0,
        failed: 0,
        errors: []
      };

      // Process in batches to avoid overwhelming the API
      const batchSize = 10;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (contact) => {
          try {
            const result = await this.addLeadToCampaign(campaignId, contact);
            if (result.success) {
              results.successful++;
            } else {
              results.failed++;
              results.errors.push({
                email: contact.email,
                error: result.error
              });
            }
          } catch (error) {
            results.failed++;
            results.errors.push({
              email: contact.email,
              error: error.message
            });
          }
        });

        await Promise.all(batchPromises);
        
        // Add delay between batches to respect rate limits
        if (i + batchSize < contacts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.instantly.info('Bulk add leads completed', {
        campaignId,
        total: results.total,
        successful: results.successful,
        failed: results.failed
      });

      return results;
    } catch (error) {
      logger.instantly.error('Failed to bulk add leads', {
        campaignId,
        count: contacts.length,
        error: error.message
      });
      
      throw error;
    }
  }
}

module.exports = new InstantlyService(); 