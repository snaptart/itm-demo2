// backend/src/services/RequestService.js
const BaseService = require('./BaseService');
const RequestRepository = require('../repositories/RequestRepository');
const EpisodeRepository = require('../repositories/EpisodeRepository');
const { ValidationError, NotFoundError, ConflictError, AuthorizationError, BusinessRuleError } = require('../utils/errors');
const logger = require('../utils/logger');

class RequestService extends BaseService {
  constructor() {
    super(new RequestRepository());
    this.episodeRepository = new EpisodeRepository();
  }

  /**
   * Get request queue for admin dashboard
   * @param {Object} user - Admin user
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} - Paginated request queue
   */
  async getRequestQueue(user, filters = {}, pagination = {}) {
    return await this.executeOperation(async () => {
      this.validatePermissions(user, 'admin');

      // Get admin's facility IDs
      const facilityIds = await this.getAdminFacilityIds(user.user_id);
      if (facilityIds.length === 0) {
        return this.formatPaginatedResponse([], 0, pagination);
      }

      // Get requests with metadata
      const result = await this.repository.findForAdminQueue({
        ...filters,
        facility_ids: facilityIds
      }, pagination);

      // Add metadata to each request
      const requestsWithMetadata = await this.enrichRequestsWithMetadata(result.data);

      // Get summary statistics
      const summary = await this.repository.getSummaryStats(facilityIds);

      return {
        ...result,
        data: requestsWithMetadata,
        summary,
        facilities: await this.getFacilitiesByIds(facilityIds)
      };
    }, { operation: 'getRequestQueue', user: user.username, filters });
  }

  /**
   * Get detailed request information
   * @param {number} requestId - Request ID
   * @param {Object} user - User context
   * @returns {Promise<Object>} - Detailed request information
   */
  async getRequestDetails(requestId, user) {
    return await this.executeOperation(async () => {
      this.validateRequired({ requestId }, ['requestId']);
      this.validatePermissions(user, 'admin');

      const request = await this.repository.findWithDetails(requestId);
      if (!request) {
        throw new NotFoundError('Request not found');
      }

      // Verify admin has access to this facility
      await this.validateFacilityAccess(user.user_id, request.facility_id);

      // Get additional context
      const [conflictingRequests, relatedRequests] = await Promise.all([
        this.repository.findConflicting(request.episode_id, request.request_id),
        this.getRelatedRequests(request.episode_id, request.request_id)
      ]);

      return {
        request: {
          ...request.toJSON(),
          status_display: this.getStatusDisplay(request),
          hours_until_expiry: this.calculateTimeUntilExpiry(request),
          can_be_modified: this.canBeModified(request),
          can_be_cancelled: this.canBeCancelled(request)
        },
        conflicting_requests: conflictingRequests,
        related_requests: relatedRequests,
        episode_current_status: request.episode.episode_status
      };
    }, { operation: 'getRequestDetails', requestId, user: user.username });
  }

  /**
   * Approve a request
   * @param {number} requestId - Request ID
   * @param {Object} approvalData - Approval data
   * @param {Object} user - Admin user
   * @returns {Promise<Object>} - Approval result
   */
  async approveRequest(requestId, approvalData, user) {
    return await this.executeOperation(async () => {
      const { admin_notes = '', auto_confirm = false } = approvalData;
      
      this.validateRequired({ requestId }, ['requestId']);
      this.validatePermissions(user, 'admin');

      const request = await this.repository.findWithDetails(requestId);
      if (!request) {
        throw new NotFoundError('Request not found');
      }

      await this.validateFacilityAccess(user.user_id, request.facility_id);

      // Validate request can be approved
      if (!this.canBeModified(request)) {
        throw new BusinessRuleError('This request cannot be approved');
      }

      // Check episode availability
      if (!['available', 'assigned', 'pending'].includes(request.episode.episode_status)) {
        throw new BusinessRuleError('Ice time is no longer available');
      }

      // Use transaction for consistency
      const transaction = await this.repository.model.sequelize.transaction();

      try {
        // First-come-first-served: Reject other pending requests
        const conflictingRequests = await this.repository.findPendingByEpisode(request.episode_id);
        const otherRequests = conflictingRequests.filter(r => r.request_id !== requestId);

        if (otherRequests.length > 0) {
          await this.repository.bulkUpdateStatus(
            otherRequests.map(r => r.request_id),
            'rejected',
            {
              reviewed_by_user_id: user.user_id,
              admin_notes: 'Automatically rejected - ice time awarded to earlier request',
              updated_by: user.username
            },
            transaction
          );
        }

        // Approve the request
        const updatedRequest = await this.repository.updateById(requestId, {
          request_status: auto_confirm ? 'confirmed' : 'approved',
          reviewed_at: new Date(),
          reviewed_by_user_id: user.user_id,
          admin_notes,
          updated_by: user.username
        }, { transaction });

        // Update episode status
        await this.episodeRepository.updateById(request.episode_id, {
          episode_status: auto_confirm ? 'booked' : 'pending',
          program_id: auto_confirm ? request.program_id : null,
          updated_by: user.username
        }, { transaction });

        // Create booking if auto-confirming
        let booking = null;
        if (auto_confirm) {
          booking = await this.createBookingFromRequest(request, user, transaction);
        }

        await transaction.commit();

        // Send notifications
        await this.sendApprovalNotifications(request, user, auto_confirm);

        logger.business('Request approved', {
          requestId,
          requestNumber: request.request_number,
          autoConfirm: auto_confirm,
          approvedBy: user.username,
          program: request.program.program_name
        });

        return {
          request: updatedRequest,
          booking,
          rejected_requests: otherRequests.length
        };

      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }, { operation: 'approveRequest', requestId, user: user.username });
  }

  /**
   * Reject a request
   * @param {number} requestId - Request ID
   * @param {Object} rejectionData - Rejection data
   * @param {Object} user - Admin user
   * @returns {Promise<Object>} - Rejection result
   */
  async rejectRequest(requestId, rejectionData, user) {
    return await this.executeOperation(async () => {
      const { admin_notes = '', rejection_reason = 'Not specified' } = rejectionData;
      
      this.validateRequired({ requestId }, ['requestId']);
      this.validatePermissions(user, 'admin');

      const request = await this.repository.findWithDetails(requestId);
      if (!request) {
        throw new NotFoundError('Request not found');
      }

      await this.validateFacilityAccess(user.user_id, request.facility_id);

      if (!this.canBeModified(request)) {
        throw new BusinessRuleError('This request cannot be rejected');
      }

      const transaction = await this.repository.model.sequelize.transaction();

      try {
        // Reject the request
        const updatedRequest = await this.repository.updateById(requestId, {
          request_status: 'rejected',
          reviewed_at: new Date(),
          reviewed_by_user_id: user.user_id,
          admin_notes: `${rejection_reason}. ${admin_notes}`.trim(),
          updated_by: user.username
        }, { transaction });

        // Revert episode status if needed
        await this.revertEpisodeStatusIfNeeded(request, transaction, user.username);

        await transaction.commit();

        // Send notifications
        await this.sendRejectionNotifications(request, user, rejection_reason);

        logger.business('Request rejected', {
          requestId,
          requestNumber: request.request_number,
          rejectionReason: rejection_reason,
          rejectedBy: user.username,
          program: request.program.program_name
        });

        return { request: updatedRequest };

      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }, { operation: 'rejectRequest', requestId, user: user.username });
  }

  /**
   * Submit cart items as requests
   * @param {Object} user - User submitting requests
   * @param {Object} submissionData - Submission data
   * @returns {Promise<Object>} - Submission result
   */
  async submitCartAsRequests(user, submissionData) {
    return await this.executeOperation(async () => {
      const { program_id, batch_notes = '' } = submissionData;
      
      this.validateRequired({ program_id }, ['program_id']);

      // Get cart items (this would interface with ShoppingCart model)
      const cartItems = await this.getCartItems(user.user_id, program_id);
      
      if (cartItems.length === 0) {
        throw new ValidationError('No items in cart for this program');
      }

      // Validate cart items
      const validationResult = await this.validateCartItems(cartItems);
      if (validationResult.invalid.length > 0) {
        throw new BusinessRuleError('Some ice time slots are no longer available', validationResult.invalid);
      }

      const transaction = await this.repository.model.sequelize.transaction();

      try {
        const createdRequests = [];

        for (const item of validationResult.valid) {
          // Check for existing pending requests
          const existingRequests = await this.repository.findPendingByEpisode(item.episode_id);
          if (existingRequests.length > 0) {
            logger.warn('Episode already has pending requests', {
              episodeId: item.episode_id,
              existingCount: existingRequests.length
            });
            continue; // Skip this item
          }

          const request = await this.repository.create({
            user_id: user.user_id,
            program_id,
            episode_id: item.episode_id,
            facility_id: item.facility_id,
            resource_id: item.resource_id,
            requested_start_time: item.episode_start_date_time,
            requested_end_time: item.episode_end_date_time,
            episode_price: item.episode_price,
            request_notes: item.notes || batch_notes,
            priority: item.priority || 'normal',
            created_by: user.username
          }, { transaction });

          createdRequests.push(request);

          // Update episode status to pending
          if (item.episode_status === 'available') {
            await this.episodeRepository.updateById(item.episode_id, {
              episode_status: 'pending'
            }, { transaction });
          }
        }

        // Clear submitted cart items
        await this.clearCartItems(user.user_id, program_id, 
          createdRequests.map(r => r.episode_id), transaction);

        await transaction.commit();

        // Send notifications
        await this.sendSubmissionNotifications(createdRequests, user);

        logger.business('Cart submitted as requests', {
          userId: user.user_id,
          programId: program_id,
          requestCount: createdRequests.length,
          skippedCount: cartItems.length - createdRequests.length
        });

        return {
          requests: createdRequests,
          submitted_count: createdRequests.length,
          skipped_count: cartItems.length - createdRequests.length
        };

      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }, { operation: 'submitCartAsRequests', user: user.username, programId: submissionData.program_id });
  }

  /**
   * Get user's requests
   * @param {Object} user - User context
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} - User's requests
   */
  async getUserRequests(user, filters = {}, pagination = {}) {
    return await this.executeOperation(async () => {
      const result = await this.repository.findForUser(user.user_id, filters, pagination);
      const statusSummary = await this.repository.getUserStatusSummary(user.user_id);

      return {
        ...result,
        status_summary: statusSummary
      };
    }, { operation: 'getUserRequests', user: user.username, filters });
  }

  /**
   * Cancel user's request
   * @param {number} requestId - Request ID
   * @param {Object} user - User context
   * @returns {Promise<Object>} - Cancellation result
   */
  async cancelUserRequest(requestId, user) {
    return await this.executeOperation(async () => {
      this.validateRequired({ requestId }, ['requestId']);

      const request = await this.repository.findOne({
        request_id: requestId,
        user_id: user.user_id
      }, { required: true });

      if (!this.canBeCancelled(request)) {
        throw new BusinessRuleError('This request cannot be cancelled');
      }

      const transaction = await this.repository.model.sequelize.transaction();

      try {
        await this.repository.updateById(requestId, {
          request_status: 'cancelled',
          reviewed_at: new Date(),
          admin_notes: 'Cancelled by user',
          updated_by: user.username
        }, { transaction });

        // Revert episode status if needed
        await this.revertEpisodeStatusIfNeeded(request, transaction, user.username);

        await transaction.commit();

        // Send notifications
        await this.sendCancellationNotifications(request, user);

        logger.business('Request cancelled by user', {
          requestId,
          requestNumber: request.request_number,
          userId: user.user_id,
          program: request.program?.program_name
        });

        return { request };

      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }, { operation: 'cancelUserRequest', requestId, user: user.username });
  }

  /**
   * Get dashboard metrics for admin
   * @param {Object} user - Admin user
   * @param {string} timeframe - Timeframe for metrics
   * @returns {Promise<Object>} - Dashboard metrics
   */
  async getDashboardMetrics(user, timeframe = '7d') {
    return await this.executeOperation(async () => {
      this.validatePermissions(user, 'admin');

      const facilityIds = await this.getAdminFacilityIds(user.user_id);
      if (facilityIds.length === 0) {
        return { facilities: [], metrics: {} };
      }

      const timeframeData = this.calculateTimeframe(timeframe);
      const metrics = await this.repository.getDashboardMetrics(facilityIds, timeframeData);

      return {
        facilities: await this.getFacilitiesByIds(facilityIds),
        metrics,
        timeframe: {
          selected: timeframe,
          start_date: timeframeData.startDate,
          end_date: timeframeData.endDate
        }
      };
    }, { operation: 'getDashboardMetrics', user: user.username, timeframe });
  }

  // Helper methods

  async getAdminFacilityIds(userId) {
    const { Facility } = require('../models');
    const facilities = await Facility.findAll({
      where: { admin_user_id: userId },
      attributes: ['facility_id']
    });
    return facilities.map(f => f.facility_id);
  }

  async validateFacilityAccess(userId, facilityId) {
    const { Facility } = require('../models');
    const facility = await Facility.findOne({
      where: { facility_id: facilityId, admin_user_id: userId }
    });
    
    if (!facility) {
      throw new AuthorizationError('You do not have permission to access this facility');
    }
  }

  async enrichRequestsWithMetadata(requests) {
    return await Promise.all(requests.map(async (request) => {
      const conflictCount = await this.repository.count({
        episode_id: request.episode_id,
        request_status: 'pending',
        request_id: { [require('sequelize').Op.ne]: request.request_id }
      });

      return {
        ...request.toJSON(),
        has_conflicts: conflictCount > 0,
        conflict_count: conflictCount,
        hours_until_expiry: this.calculateTimeUntilExpiry(request),
        is_urgent: this.isUrgent(request),
        status_display: this.getStatusDisplay(request)
      };
    }));
  }

  getStatusDisplay(request) {
    const statusMap = {
      'pending': { label: 'Pending Review', color: '#f6ad55', icon: '⏳' },
      'approved': { label: 'Approved', color: '#48bb78', icon: '✅' },
      'rejected': { label: 'Rejected', color: '#fc8181', icon: '❌' },
      'cancelled': { label: 'Cancelled', color: '#a0aec0', icon: '🚫' },
      'confirmed': { label: 'Confirmed', color: '#4299e1', icon: '📅' },
      'expired': { label: 'Expired', color: '#9e9e9e', icon: '⌛' }
    };
    
    return statusMap[request.request_status] || { 
      label: request.request_status, 
      color: '#a0aec0', 
      icon: '❓' 
    };
  }

  calculateTimeUntilExpiry(request) {
    if (!request.expires_at) return null;
    
    const now = new Date();
    const expiry = new Date(request.expires_at);
    
    if (expiry <= now) return 0;
    
    return Math.round((expiry - now) / (1000 * 60 * 60)); // hours
  }

  isUrgent(request) {
    const hoursUntilExpiry = this.calculateTimeUntilExpiry(request);
    return hoursUntilExpiry && hoursUntilExpiry <= 2;
  }

  canBeModified(request) {
    return ['pending'].includes(request.request_status);
  }

  canBeCancelled(request) {
    return ['pending', 'approved'].includes(request.request_status);
  }

  calculateTimeframe(timeframe) {
    const timeframes = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90
    };
    
    const days = timeframes[timeframe] || 7;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();
    
    return { startDate, endDate };
  }

  // Placeholder methods for external integrations
  async getCartItems(userId, programId) {
    // This would integrate with ShoppingCart model
    return [];
  }

  async validateCartItems(cartItems) {
    // This would validate cart items against current episode status
    return { valid: cartItems, invalid: [] };
  }

  async clearCartItems(userId, programId, episodeIds, transaction) {
    // This would clear cart items after successful submission
  }

  async createBookingFromRequest(request, user, transaction) {
    // This would create a booking when auto-confirming
    return null;
  }

  async sendApprovalNotifications(request, user, autoConfirm) {
    // This would send real-time notifications
  }

  async sendRejectionNotifications(request, user, reason) {
    // This would send real-time notifications
  }

  async sendSubmissionNotifications(requests, user) {
    // This would send real-time notifications
  }

  async sendCancellationNotifications(request, user) {
    // This would send real-time notifications
  }

  async revertEpisodeStatusIfNeeded(request, transaction, updatedBy) {
    // Check if there are other pending requests for this episode
    const otherPendingRequests = await this.repository.count({
      episode_id: request.episode_id,
      request_status: 'pending',
      request_id: { [require('sequelize').Op.ne]: request.request_id }
    });

    if (otherPendingRequests === 0) {
      // No other pending requests, revert to available or assigned
      const newStatus = request.episode.assigned_to_program_id ? 'assigned' : 'available';
      await this.episodeRepository.updateById(request.episode_id, {
        episode_status: newStatus,
        updated_by: updatedBy
      }, { transaction });
    }
  }

  async getRelatedRequests(episodeId, excludeRequestId, limit = 10) {
    return await this.repository.findAll({
      episode_id: episodeId,
      request_id: { [require('sequelize').Op.ne]: excludeRequestId }
    }, {
      include: [
        { model: require('../models').User, as: 'user', attributes: ['user_id', 'username', 'first_name', 'last_name'] },
        { model: require('../models').Program, as: 'program', attributes: ['program_id', 'program_name'] }
      ],
      order: [['submitted_at', 'DESC']],
      limit
    });
  }

  async getFacilitiesByIds(facilityIds) {
    const { Facility } = require('../models');
    return await Facility.findAll({
      where: { facility_id: { [require('sequelize').Op.in]: facilityIds } },
      attributes: ['facility_id', 'facility_name']
    });
  }
}

module.exports = RequestService;