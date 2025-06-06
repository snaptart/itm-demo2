// backend/src/repositories/RequestRepository.js
const BaseRepository = require('./BaseRepository');
const { IceTimeRequest, Episode, Event, Resource, Facility, Program, User } = require('../models');
const { Op } = require('sequelize');

class RequestRepository extends BaseRepository {
  constructor() {
    super(IceTimeRequest);
  }

  /**
   * Find requests for admin queue with filtering and pagination
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Paginated requests with metadata
   */
  async findForAdminQueue(filters = {}, options = {}) {
    const {
      status,
      facility_ids,
      priority,
      program_id,
      sort_by = 'submitted_at',
      sort_order = 'ASC'
    } = filters;

    const whereClause = {};
    
    // Facility filter for admin permissions
    if (facility_ids && facility_ids.length > 0) {
      whereClause.facility_id = { [Op.in]: facility_ids };
    }

    // Status filter
    if (status) {
      whereClause.request_status = Array.isArray(status) ? { [Op.in]: status } : status;
    }

    // Priority filter
    if (priority) {
      whereClause.priority = priority;
    }

    // Program filter
    if (program_id) {
      whereClause.program_id = program_id;
    }

    const validSortFields = ['submitted_at', 'priority', 'requested_start_time', 'request_status'];
    const sortBy = validSortFields.includes(sort_by) ? sort_by : 'submitted_at';
    const sortOrder = ['ASC', 'DESC'].includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'ASC';

    return await this.findWithPagination(whereClause, {
      ...options,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'username', 'first_name', 'last_name', 'email']
        },
        {
          model: Program,
          as: 'program',
          attributes: ['program_id', 'program_name', 'program_color']
        },
        {
          model: Facility,
          as: 'facility',
          attributes: ['facility_id', 'facility_name', 'facility_time_zone']
        },
        {
          model: Resource,
          as: 'resource',
          attributes: ['resource_id', 'resource_name']
        },
        {
          model: Episode,
          as: 'episode',
          attributes: ['episode_id', 'episode_status', 'episode_title'],
          include: [{
            model: Event,
            as: 'event',
            attributes: ['event_id']
          }]
        },
        {
          model: User,
          as: 'reviewedBy',
          attributes: ['user_id', 'username', 'first_name', 'last_name'],
          required: false
        }
      ],
      order: [[sortBy, sortOrder]]
    });
  }

  /**
   * Find requests for user dashboard
   * @param {number} userId - User ID
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - User's requests with pagination
   */
  async findForUser(userId, filters = {}, options = {}) {
    const { status, program_id, facility_id } = filters;

    const whereClause = { user_id: userId };

    if (status) {
      whereClause.request_status = status;
    }
    if (program_id) {
      whereClause.program_id = program_id;
    }
    if (facility_id) {
      whereClause.facility_id = facility_id;
    }

    return await this.findWithPagination(whereClause, {
      ...options,
      include: [
        {
          model: Program,
          as: 'program',
          attributes: ['program_id', 'program_name']
        },
        {
          model: Facility,
          as: 'facility',
          attributes: ['facility_id', 'facility_name', 'facility_time_zone']
        },
        {
          model: Resource,
          as: 'resource',
          attributes: ['resource_id', 'resource_name']
        },
        {
          model: User,
          as: 'reviewedBy',
          attributes: ['user_id', 'first_name', 'last_name'],
          required: false
        }
      ],
      order: [['submitted_at', 'DESC']]
    });
  }

  /**
   * Find request with full details
   * @param {number} requestId - Request ID
   * @returns {Promise<Object|null>} - Request with all associations
   */
  async findWithDetails(requestId) {
    return await this.findById(requestId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'username', 'first_name', 'last_name', 'email', 'phone']
        },
        {
          model: Program,
          as: 'program',
          include: [{
            model: User,
            as: 'scheduler',
            attributes: ['user_id', 'username', 'first_name', 'last_name', 'email']
          }]
        },
        {
          model: Facility,
          as: 'facility'
        },
        {
          model: Resource,
          as: 'resource'
        },
        {
          model: Episode,
          as: 'episode',
          include: [
            {
              model: Event,
              as: 'event'
            },
            {
              model: require('../models').Booking,
              as: 'bookings',
              include: [{
                model: User,
                as: 'user',
                attributes: ['user_id', 'username', 'first_name', 'last_name']
              }]
            }
          ]
        },
        {
          model: User,
          as: 'reviewedBy',
          attributes: ['user_id', 'username', 'first_name', 'last_name'],
          required: false
        }
      ]
    });
  }

  /**
   * Find conflicting requests for same episode
   * @param {number} episodeId - Episode ID
   * @param {number} excludeRequestId - Request ID to exclude
   * @returns {Promise<Array>} - Conflicting requests
   */
  async findConflicting(episodeId, excludeRequestId = null) {
    const whereClause = {
      episode_id: episodeId,
      request_status: 'pending'
    };

    if (excludeRequestId) {
      whereClause.request_id = { [Op.ne]: excludeRequestId };
    }

    return await this.findAll(whereClause, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'username', 'first_name', 'last_name']
        },
        {
          model: Program,
          as: 'program',
          attributes: ['program_id', 'program_name']
        }
      ],
      order: [['submitted_at', 'ASC']]
    });
  }

  /**
   * Get request summary statistics
   * @param {Array<number>} facilityIds - Facility IDs to include
   * @returns {Promise<Object>} - Summary statistics
   */
  async getSummaryStats(facilityIds) {
    const summary = await this.model.findAll({
      where: { facility_id: { [Op.in]: facilityIds } },
      attributes: [
        'request_status',
        'priority',
        [require('sequelize').fn('COUNT', require('sequelize').col('request_id')), 'count']
      ],
      group: ['request_status', 'priority'],
      raw: true
    });

    const result = {
      by_status: {},
      by_priority: {},
      total: 0
    };

    summary.forEach(item => {
      const count = parseInt(item.count);
      result.total += count;
      
      if (!result.by_status[item.request_status]) {
        result.by_status[item.request_status] = 0;
      }
      result.by_status[item.request_status] += count;
      
      if (!result.by_priority[item.priority]) {
        result.by_priority[item.priority] = 0;
      }
      result.by_priority[item.priority] += count;
    });

    return result;
  }

  /**
   * Get user's request status summary
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Status summary for user
   */
  async getUserStatusSummary(userId) {
    const summary = await this.model.findAll({
      where: { user_id: userId },
      attributes: [
        'request_status',
        [require('sequelize').fn('COUNT', require('sequelize').col('request_id')), 'count']
      ],
      group: ['request_status'],
      raw: true
    });
    
    return summary.reduce((acc, item) => {
      acc[item.request_status] = parseInt(item.count);
      return acc;
    }, {});
  }

  /**
   * Bulk update request status
   * @param {Array<number>} requestIds - Request IDs to update
   * @param {string} status - New status
   * @param {Object} updateData - Additional update data
   * @param {Object} transaction - Database transaction
   * @returns {Promise<number>} - Number of updated requests
   */
  async bulkUpdateStatus(requestIds, status, updateData = {}, transaction) {
    const [affectedCount] = await this.model.update(
      {
        request_status: status,
        reviewed_at: new Date(),
        ...updateData
      },
      {
        where: { request_id: { [Op.in]: requestIds } },
        transaction,
        logging: this.getQueryLogger('bulkUpdateStatus', { requestIds, status })
      }
    );

    return affectedCount;
  }

  /**
   * Find pending requests by episode
   * @param {number} episodeId - Episode ID
   * @returns {Promise<Array>} - Pending requests for episode
   */
  async findPendingByEpisode(episodeId) {
    return await this.findAll({
      episode_id: episodeId,
      request_status: 'pending'
    }, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'username', 'first_name', 'last_name']
        },
        {
          model: Program,
          as: 'program',
          attributes: ['program_id', 'program_name']
        }
      ],
      order: [['submitted_at', 'ASC']]
    });
  }

  /**
   * Get approval rate statistics
   * @param {Array<number>} facilityIds - Facility IDs
   * @param {Date} startDate - Start date for statistics
   * @returns {Promise<Object>} - Approval rate data
   */
  async getApprovalRate(facilityIds, startDate) {
    const results = await this.model.findAll({
      where: {
        facility_id: { [Op.in]: facilityIds },
        submitted_at: { [Op.gte]: startDate },
        request_status: { [Op.in]: ['approved', 'rejected', 'confirmed'] }
      },
      attributes: [
        'request_status',
        [require('sequelize').fn('COUNT', require('sequelize').col('request_id')), 'count']
      ],
      group: ['request_status'],
      raw: true
    });

    const approved = results
      .filter(r => ['approved', 'confirmed'].includes(r.request_status))
      .reduce((sum, r) => sum + parseInt(r.count), 0);
    
    const total = results.reduce((sum, r) => sum + parseInt(r.count), 0);
    
    return {
      approved,
      total,
      rate: total > 0 ? Math.round((approved / total) * 100) : 0
    };
  }

  /**
   * Get average response time
   * @param {Array<number>} facilityIds - Facility IDs
   * @param {Date} startDate - Start date for statistics
   * @returns {Promise<number>} - Average response time in hours
   */
  async getAverageResponseTime(facilityIds, startDate) {
    const result = await this.model.findOne({
      where: {
        facility_id: { [Op.in]: facilityIds },
        submitted_at: { [Op.gte]: startDate },
        reviewed_at: { [Op.ne]: null }
      },
      attributes: [
        [require('sequelize').fn('AVG', 
          require('sequelize').fn('EXTRACT', 
            require('sequelize').literal('EPOCH FROM (reviewed_at - submitted_at)')
          )
        ), 'avg_seconds']
      ],
      raw: true
    });

    const avgSeconds = result?.avg_seconds || 0;
    return Math.round(avgSeconds / 3600 * 100) / 100; // Convert to hours with 2 decimals
  }

  /**
   * Get popular programs from requests
   * @param {Array<number>} facilityIds - Facility IDs
   * @param {Date} startDate - Start date for statistics
   * @param {number} limit - Number of programs to return
   * @returns {Promise<Array>} - Popular programs with request counts
   */
  async getPopularPrograms(facilityIds, startDate, limit = 5) {
    return await this.model.findAll({
      where: {
        facility_id: { [Op.in]: facilityIds },
        submitted_at: { [Op.gte]: startDate }
      },
      include: [{
        model: Program,
        as: 'program',
        attributes: ['program_id', 'program_name']
      }],
      attributes: [
        'program_id',
        [require('sequelize').fn('COUNT', require('sequelize').col('request_id')), 'request_count']
      ],
      group: ['program_id', 'program.program_id', 'program.program_name'],
      order: [[require('sequelize').fn('COUNT', require('sequelize').col('request_id')), 'DESC']],
      limit,
      raw: false
    });
  }

  /**
   * Get peak request times
   * @param {Array<number>} facilityIds - Facility IDs
   * @param {Date} startDate - Start date for statistics
   * @param {number} limit - Number of hours to return
   * @returns {Promise<Array>} - Peak request hours
   */
  async getPeakRequestTimes(facilityIds, startDate, limit = 5) {
    return await this.model.findAll({
      where: {
        facility_id: { [Op.in]: facilityIds },
        submitted_at: { [Op.gte]: startDate }
      },
      attributes: [
        [require('sequelize').fn('EXTRACT', require('sequelize').literal('HOUR FROM submitted_at')), 'hour'],
        [require('sequelize').fn('COUNT', require('sequelize').col('request_id')), 'count']
      ],
      group: [require('sequelize').fn('EXTRACT', require('sequelize').literal('HOUR FROM submitted_at'))],
      order: [[require('sequelize').fn('COUNT', require('sequelize').col('request_id')), 'DESC']],
      limit,
      raw: true
    });
  }

  /**
   * Get recent activity
   * @param {Array<number>} facilityIds - Facility IDs
   * @param {number} limit - Number of activities to return
   * @returns {Promise<Array>} - Recent request activities
   */
  async getRecentActivity(facilityIds, limit = 10) {
    return await this.model.findAll({
      where: {
        facility_id: { [Op.in]: facilityIds },
        request_status: { [Op.in]: ['approved', 'rejected', 'confirmed'] }
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'first_name', 'last_name']
        },
        {
          model: Program,
          as: 'program',
          attributes: ['program_id', 'program_name']
        },
        {
          model: User,
          as: 'reviewedBy',
          attributes: ['user_id', 'first_name', 'last_name']
        }
      ],
      order: [['reviewed_at', 'DESC']],
      limit,
      raw: false
    });
  }

  /**
   * Find expiring requests
   * @param {number} hoursFromNow - Hours from now to check expiration
   * @returns {Promise<Array>} - Requests expiring soon
   */
  async findExpiringSoon(hoursFromNow = 24) {
    const expirationTime = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    
    return await this.findAll({
      request_status: 'pending',
      expires_at: {
        [Op.lte]: expirationTime,
        [Op.ne]: null
      }
    }, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'username', 'email', 'first_name', 'last_name']
        },
        {
          model: Program,
          as: 'program',
          attributes: ['program_id', 'program_name']
        },
        {
          model: Episode,
          as: 'episode',
          attributes: ['episode_id', 'episode_title', 'episode_start_date_time']
        }
      ],
      order: [['expires_at', 'ASC']]
    });
  }

  /**
   * Cancel expired requests
   * @param {Object} transaction - Database transaction
   * @returns {Promise<number>} - Number of expired requests
   */
  async cancelExpiredRequests(transaction) {
    const [affectedCount] = await this.model.update(
      {
        request_status: 'expired',
        reviewed_at: new Date(),
        admin_notes: 'Automatically expired due to timeout'
      },
      {
        where: {
          request_status: 'pending',
          expires_at: { [Op.lt]: new Date() }
        },
        transaction,
        logging: this.getQueryLogger('cancelExpiredRequests', {})
      }
    );

    return affectedCount;
  }

  /**
   * Get dashboard metrics for admin
   * @param {Array<number>} facilityIds - Facility IDs
   * @param {Object} timeframe - Timeframe for metrics
   * @returns {Promise<Object>} - Dashboard metrics
   */
  async getDashboardMetrics(facilityIds, timeframe) {
    const { startDate, endDate } = timeframe;

    const [
      pendingCount,
      totalCount,
      approvalData,
      averageResponseTime,
      popularPrograms,
      peakTimes
    ] = await Promise.all([
      this.count({
        facility_id: { [Op.in]: facilityIds },
        request_status: 'pending'
      }),
      this.count({
        facility_id: { [Op.in]: facilityIds },
        submitted_at: { [Op.gte]: startDate }
      }),
      this.getApprovalRate(facilityIds, startDate),
      this.getAverageResponseTime(facilityIds, startDate),
      this.getPopularPrograms(facilityIds, startDate),
      this.getPeakRequestTimes(facilityIds, startDate)
    ]);

    return {
      pending_requests: pendingCount,
      total_requests: totalCount,
      approval_rate: approvalData.rate,
      avg_response_time_hours: averageResponseTime,
      popular_programs: popularPrograms,
      peak_times: peakTimes
    };
  }
}

module.exports = RequestRepository;