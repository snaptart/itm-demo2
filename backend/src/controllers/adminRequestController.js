// backend/src/controllers/adminRequestController.js
const { 
  IceTimeRequest, 
  Episode, 
  Program, 
  User, 
  Facility, 
  Resource, 
  Event,
  RealtimeNotification,
  Booking 
} = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

const adminRequestController = {
  // =============================================
  // REQUEST QUEUE MANAGEMENT
  // =============================================

  // Get all requests for admin's facilities
  async getRequestQueue(req, res) {
    try {
      const { user_id } = req.user;
      const { 
        status = 'pending',
        facility_id,
        priority,
        program_id,
        page = 1,
        limit = 50,
        sort_by = 'submitted_at',
        sort_order = 'ASC'
      } = req.query;

      // Get facilities the admin manages
      const adminFacilities = await Facility.findAll({
        where: { admin_user_id: user_id },
        attributes: ['facility_id']
      });

      const facilityIds = adminFacilities.map(f => f.facility_id);

      if (facilityIds.length === 0) {
        return res.json({
          requests: [],
          pagination: { total: 0, page: 1, limit: 50, pages: 0 },
          summary: {}
        });
      }

      // Build where clause
      const whereClause = {
        facility_id: { [Op.in]: facilityIds }
      };

      if (status) {
        whereClause.request_status = status;
      }
      if (facility_id && facilityIds.includes(parseInt(facility_id))) {
        whereClause.facility_id = facility_id;
      }
      if (priority) {
        whereClause.priority = priority;
      }
      if (program_id) {
        whereClause.program_id = program_id;
      }

      const offset = (page - 1) * limit;
      const validSortFields = ['submitted_at', 'priority', 'requested_start_time', 'request_status'];
      const sortBy = validSortFields.includes(sort_by) ? sort_by : 'submitted_at';
      const sortOrder = ['ASC', 'DESC'].includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'ASC';

      // Get requests with pagination
      const { count, rows } = await IceTimeRequest.findAndCountAll({
        where: whereClause,
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
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Get summary statistics
      const summary = await getRequestSummary(facilityIds);

      // Check for conflicts and expiring requests
      const requestsWithMetadata = await Promise.all(rows.map(async (request) => {
        const requestData = request.toJSON();
        
        // Check for conflicts with other pending requests
        const conflictingRequests = await IceTimeRequest.count({
          where: {
            episode_id: request.episode_id,
            request_status: 'pending',
            request_id: { [Op.ne]: request.request_id }
          }
        });

        // Calculate time until expiry
        const hoursUntilExpiry = request.calculateTimeUntilExpiry();

        return {
          ...requestData,
          has_conflicts: conflictingRequests > 0,
          conflict_count: conflictingRequests,
          hours_until_expiry: hoursUntilExpiry,
          is_urgent: hoursUntilExpiry && hoursUntilExpiry <= 2,
          status_display: request.getStatusDisplay()
        };
      }));

      res.json({
        requests: requestsWithMetadata,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        },
        summary,
        facilities: adminFacilities
      });

    } catch (error) {
      console.error('Get request queue error:', error);
      res.status(500).json({ 
        message: 'Error fetching request queue',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Get detailed request information
  async getRequestDetails(req, res) {
    try {
      const { user_id } = req.user;
      const { request_id } = req.params;

      // Get request with full details
      const request = await IceTimeRequest.findByPk(request_id, {
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
                model: Booking,
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

      if (!request) {
        return res.status(404).json({ message: 'Request not found' });
      }

      // Verify admin has access to this facility
      if (request.facility.admin_user_id !== user_id) {
        return res.status(403).json({ 
          message: 'You do not have permission to view this request' 
        });
      }

      // Get conflicting requests
      const conflictingRequests = await IceTimeRequest.findAll({
        where: {
          episode_id: request.episode_id,
          request_status: 'pending',
          request_id: { [Op.ne]: request.request_id }
        },
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

      // Get request history for this episode
      const relatedRequests = await IceTimeRequest.findAll({
        where: {
          episode_id: request.episode_id,
          request_id: { [Op.ne]: request.request_id }
        },
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
        order: [['submitted_at', 'DESC']],
        limit: 10
      });

      const requestData = request.toJSON();

      res.json({
        request: {
          ...requestData,
          status_display: request.getStatusDisplay(),
          hours_until_expiry: request.calculateTimeUntilExpiry(),
          can_be_modified: request.canBeModified(),
          can_be_cancelled: request.canBeCancelled()
        },
        conflicting_requests: conflictingRequests,
        related_requests: relatedRequests,
        episode_current_status: request.episode.episode_status
      });

    } catch (error) {
      console.error('Get request details error:', error);
      res.status(500).json({ 
        message: 'Error fetching request details',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // =============================================
  // REQUEST APPROVAL/REJECTION
  // =============================================

  // Approve a single request
  async approveRequest(req, res) {
    let transaction = null;
    
    try {
      const { user_id } = req.user;
      const { request_id } = req.params;
      const { admin_notes = '', auto_confirm = false } = req.body;

      transaction = await sequelize.transaction();

      // Get request with episode details
      const request = await IceTimeRequest.findByPk(request_id, {
        include: [
          {
            model: Episode,
            as: 'episode',
            include: [{
              model: Event,
              as: 'event',
              include: [{
                model: Resource,
                as: 'resource'
              }]
            }]
          },
          {
            model: Facility,
            as: 'facility'
          },
          {
            model: User,
            as: 'user'
          },
          {
            model: Program,
            as: 'program'
          }
        ],
        transaction
      });

      if (!request) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Request not found' });
      }

      // Verify admin has access
      if (request.facility.admin_user_id !== user_id) {
        await transaction.rollback();
        return res.status(403).json({ 
          message: 'You do not have permission to approve this request' 
        });
      }

      // Verify request can be approved
      if (!request.canBeModified()) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'This request cannot be approved' 
        });
      }

      // Check if episode is still available
      if (!['available', 'assigned', 'pending'].includes(request.episode.episode_status)) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Ice time is no longer available' 
        });
      }

      // First-come-first-served: Reject other pending requests for same episode
      await IceTimeRequest.update(
        {
          request_status: 'rejected',
          reviewed_at: new Date(),
          reviewed_by_user_id: user_id,
          admin_notes: 'Automatically rejected - ice time awarded to earlier request',
          updated_by: req.user.username
        },
        {
          where: {
            episode_id: request.episode_id,
            request_status: 'pending',
            request_id: { [Op.ne]: request.request_id }
          },
          transaction
        }
      );

      // Approve the request
      await request.update({
        request_status: auto_confirm ? 'confirmed' : 'approved',
        reviewed_at: new Date(),
        reviewed_by_user_id: user_id,
        admin_notes,
        updated_by: req.user.username
      }, { transaction });

      // Update episode status
      await request.episode.update({
        episode_status: auto_confirm ? 'booked' : 'pending',
        program_id: auto_confirm ? request.program_id : null,
        updated_by: req.user.username
      }, { transaction });

      // Create booking if auto-confirming
      let booking = null;
      if (auto_confirm) {
        booking = await Booking.create({
          episode_id: request.episode_id,
          program_id: request.program_id,
          user_id: request.user_id,
          booking_status: 'approved',
          booking_notes: `Auto-confirmed from request ${request.request_number}`,
          approved_by_user_id: user_id,
          approved_ts: new Date(),
          created_by: req.user.username
        }, { transaction });
      }

      await transaction.commit();

      // Send real-time notifications
      await Promise.all([
        // Notify the requester
        RealtimeNotification.createForUser(request.user_id, 'request:approved', {
          title: auto_confirm ? 'Ice Time Confirmed!' : 'Ice Time Request Approved',
          message: `Your request for ${request.episode.episode_title} has been ${auto_confirm ? 'confirmed' : 'approved'}`,
          request_id: request.request_id,
          request_number: request.request_number,
          episode_id: request.episode_id,
          created_by_user_id: user_id
        }),

        // Notify facility staff
        RealtimeNotification.createForFacility(request.facility_id, 'request:processed', {
          title: 'Request Approved',
          message: `${req.user.first_name} ${req.user.last_name} approved request ${request.request_number}`,
          request_id: request.request_id,
          request_number: request.request_number,
          action: 'approved',
          created_by_user_id: user_id
        })
      ]);

      // Reload request with updated data
      const updatedRequest = await IceTimeRequest.findByPk(request_id, {
        include: ['user', 'program', 'facility', 'episode']
      });

      res.json({
        message: `Request ${auto_confirm ? 'approved and confirmed' : 'approved'} successfully`,
        request: updatedRequest,
        booking: booking
      });

    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      console.error('Approve request error:', error);
      res.status(500).json({ 
        message: 'Error approving request',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Reject a single request
  async rejectRequest(req, res) {
    let transaction = null;
    
    try {
      const { user_id } = req.user;
      const { request_id } = req.params;
      const { admin_notes = '', rejection_reason = 'Not specified' } = req.body;

      transaction = await sequelize.transaction();

      const request = await IceTimeRequest.findByPk(request_id, {
        include: ['facility', 'user', 'program', 'episode'],
        transaction
      });

      if (!request) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Request not found' });
      }

      // Verify admin has access
      if (request.facility.admin_user_id !== user_id) {
        await transaction.rollback();
        return res.status(403).json({ 
          message: 'You do not have permission to reject this request' 
        });
      }

      // Verify request can be rejected
      if (!request.canBeModified()) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'This request cannot be rejected' 
        });
      }

      // Reject the request
      await request.update({
        request_status: 'rejected',
        reviewed_at: new Date(),
        reviewed_by_user_id: user_id,
        admin_notes: `${rejection_reason}. ${admin_notes}`.trim(),
        updated_by: req.user.username
      }, { transaction });

      // Revert episode status if it was pending due to this request
      if (request.episode.episode_status === 'pending') {
        // Check if there are other pending requests for this episode
        const otherPendingRequests = await IceTimeRequest.count({
          where: {
            episode_id: request.episode_id,
            request_status: 'pending',
            request_id: { [Op.ne]: request.request_id }
          },
          transaction
        });

        if (otherPendingRequests === 0) {
          // No other pending requests, revert to available
          const newStatus = request.episode.assigned_to_program_id ? 'assigned' : 'available';
          await request.episode.update({
            episode_status: newStatus,
            updated_by: req.user.username
          }, { transaction });
        }
      }

      await transaction.commit();

      // Send real-time notifications
      await Promise.all([
        // Notify the requester
        RealtimeNotification.createForUser(request.user_id, 'request:rejected', {
          title: 'Ice Time Request Rejected',
          message: `Your request for ${request.episode.episode_title} was not approved`,
          request_id: request.request_id,
          request_number: request.request_number,
          rejection_reason: rejection_reason,
          created_by_user_id: user_id
        }),

        // Notify facility staff
        RealtimeNotification.createForFacility(request.facility_id, 'request:processed', {
          title: 'Request Rejected',
          message: `${req.user.first_name} ${req.user.last_name} rejected request ${request.request_number}`,
          request_id: request.request_id,
          request_number: request.request_number,
          action: 'rejected',
          created_by_user_id: user_id
        })
      ]);

      res.json({
        message: 'Request rejected successfully',
        request: request
      });

    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      console.error('Reject request error:', error);
      res.status(500).json({ 
        message: 'Error rejecting request',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Batch approve/reject requests
  async batchProcessRequests(req, res) {
    let transaction = null;
    
    try {
      const { user_id } = req.user;
      const { 
        request_ids,
        action, // 'approve' or 'reject'
        admin_notes = '',
        rejection_reason = 'Batch rejection',
        auto_confirm = false
      } = req.body;

      if (!request_ids || !Array.isArray(request_ids) || request_ids.length === 0) {
        return res.status(400).json({ message: 'Request IDs are required' });
      }

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ message: 'Invalid action' });
      }

      transaction = await sequelize.transaction();

      // Get all requests with facility verification
      const requests = await IceTimeRequest.findAll({
        where: { 
          request_id: { [Op.in]: request_ids },
          request_status: 'pending'
        },
        include: [
          {
            model: Facility,
            as: 'facility',
            where: { admin_user_id: user_id }
          },
          {
            model: Episode,
            as: 'episode'
          },
          {
            model: User,
            as: 'user'
          },
          {
            model: Program,
            as: 'program'
          }
        ],
        transaction
      });

      if (requests.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ message: 'No valid requests found' });
      }

      const results = {
        processed: [],
        errors: [],
        notifications: []
      };

      if (action === 'approve') {
        // Group requests by episode to handle conflicts
        const requestsByEpisode = requests.reduce((acc, request) => {
          const episodeId = request.episode_id;
          if (!acc[episodeId]) acc[episodeId] = [];
          acc[episodeId].push(request);
          return acc;
        }, {});

        // Process each episode group (first-come-first-served)
        for (const [episodeId, episodeRequests] of Object.entries(requestsByEpisode)) {
          // Sort by submission time
          episodeRequests.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
          
          const winningRequest = episodeRequests[0];
          const losingRequests = episodeRequests.slice(1);

          try {
            // Approve the first request
            await winningRequest.update({
              request_status: auto_confirm ? 'confirmed' : 'approved',
              reviewed_at: new Date(),
              reviewed_by_user_id: user_id,
              admin_notes: `${admin_notes} (Batch processed)`.trim(),
              updated_by: req.user.username
            }, { transaction });

            // Update episode
            await winningRequest.episode.update({
              episode_status: auto_confirm ? 'booked' : 'pending',
              program_id: auto_confirm ? winningRequest.program_id : null,
              updated_by: req.user.username
            }, { transaction });

            // Create booking if auto-confirming
            if (auto_confirm) {
              await Booking.create({
                episode_id: winningRequest.episode_id,
                program_id: winningRequest.program_id,
                user_id: winningRequest.user_id,
                booking_status: 'approved',
                booking_notes: `Auto-confirmed from batch request processing`,
                approved_by_user_id: user_id,
                approved_ts: new Date(),
                created_by: req.user.username
              }, { transaction });
            }

            results.processed.push({
              request_id: winningRequest.request_id,
              action: 'approved',
              reason: 'First submitted request for this ice time'
            });

            // Reject conflicting requests
            for (const losingRequest of losingRequests) {
              await losingRequest.update({
                request_status: 'rejected',
                reviewed_at: new Date(),
                reviewed_by_user_id: user_id,
                admin_notes: 'Automatically rejected - ice time awarded to earlier request (batch processing)',
                updated_by: req.user.username
              }, { transaction });

              results.processed.push({
                request_id: losingRequest.request_id,
                action: 'rejected',
                reason: 'Conflicting request - ice time awarded to earlier submission'
              });
            }

          } catch (error) {
            console.error(`Error processing episode ${episodeId}:`, error);
            episodeRequests.forEach(req => {
              results.errors.push({
                request_id: req.request_id,
                error: 'Processing error'
              });
            });
          }
        }

      } else if (action === 'reject') {
        // Batch reject all requests
        for (const request of requests) {
          try {
            await request.update({
              request_status: 'rejected',
              reviewed_at: new Date(),
              reviewed_by_user_id: user_id,
              admin_notes: `${rejection_reason}. ${admin_notes} (Batch processed)`.trim(),
              updated_by: req.user.username
            }, { transaction });

            // Revert episode status if needed
            if (request.episode.episode_status === 'pending') {
              const otherPendingRequests = await IceTimeRequest.count({
                where: {
                  episode_id: request.episode_id,
                  request_status: 'pending',
                  request_id: { [Op.ne]: request.request_id }
                },
                transaction
              });

              if (otherPendingRequests === 0) {
                const newStatus = request.episode.assigned_to_program_id ? 'assigned' : 'available';
                await request.episode.update({
                  episode_status: newStatus,
                  updated_by: req.user.username
                }, { transaction });
              }
            }

            results.processed.push({
              request_id: request.request_id,
              action: 'rejected',
              reason: rejection_reason
            });

          } catch (error) {
            console.error(`Error rejecting request ${request.request_id}:`, error);
            results.errors.push({
              request_id: request.request_id,
              error: 'Rejection error'
            });
          }
        }
      }

      await transaction.commit();

      // Send batch notifications
      const facilityIds = [...new Set(requests.map(r => r.facility_id))];
      for (const facilityId of facilityIds) {
        await RealtimeNotification.createForFacility(facilityId, 'requests:batch_processed', {
          title: 'Batch Request Processing Complete',
          message: `${req.user.first_name} ${req.user.last_name} processed ${results.processed.length} requests`,
          processed_count: results.processed.length,
          error_count: results.errors.length,
          action,
          created_by_user_id: user_id
        });
      }

      res.json({
        message: `Batch ${action} completed`,
        results
      });

    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      console.error('Batch process requests error:', error);
      res.status(500).json({ 
        message: 'Error processing batch requests',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // =============================================
  // DASHBOARD & ANALYTICS
  // =============================================

  // Get admin dashboard metrics
  async getDashboardMetrics(req, res) {
    try {
      const { user_id } = req.user;
      const { timeframe = '7d' } = req.query;

      // Get admin's facilities
      const facilities = await Facility.findAll({
        where: { admin_user_id: user_id },
        attributes: ['facility_id', 'facility_name']
      });

      const facilityIds = facilities.map(f => f.facility_id);

      if (facilityIds.length === 0) {
        return res.json({ facilities: [], metrics: {} });
      }

      // Calculate date range
      const timeframes = {
        '24h': 1,
        '7d': 7,
        '30d': 30,
        '90d': 90
      };
      const days = timeframes[timeframe] || 7;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get various metrics
      const [
        pendingRequests,
        totalRequests,
        approvalRate,
        responseTime,
        popularPrograms,
        peakTimes,
        recentActivity
      ] = await Promise.all([
        // Pending requests count
        IceTimeRequest.count({
          where: {
            facility_id: { [Op.in]: facilityIds },
            request_status: 'pending'
          }
        }),

        // Total requests in timeframe
        IceTimeRequest.count({
          where: {
            facility_id: { [Op.in]: facilityIds },
            submitted_at: { [Op.gte]: startDate }
          }
        }),

        // Approval rate
        getApprovalRate(facilityIds, startDate),

        // Average response time
        getAverageResponseTime(facilityIds, startDate),

        // Popular programs
        getPopularPrograms(facilityIds, startDate),

        // Peak request times
        getPeakRequestTimes(facilityIds, startDate),

        // Recent activity
        getRecentActivity(facilityIds, 10)
      ]);

      res.json({
        facilities,
        metrics: {
          pending_requests: pendingRequests,
          total_requests: totalRequests,
          approval_rate: approvalRate,
          avg_response_time_hours: responseTime,
          popular_programs: popularPrograms,
          peak_times: peakTimes,
          recent_activity: recentActivity
        },
        timeframe: {
          selected: timeframe,
          start_date: startDate,
          end_date: new Date()
        }
      });

    } catch (error) {
      console.error('Get dashboard metrics error:', error);
      res.status(500).json({ 
        message: 'Error fetching dashboard metrics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
};

// =============================================
// HELPER FUNCTIONS
// =============================================

async function getRequestSummary(facilityIds) {
  const summary = await IceTimeRequest.findAll({
    where: { facility_id: { [Op.in]: facilityIds } },
    attributes: [
      'request_status',
      'priority',
      [sequelize.fn('COUNT', sequelize.col('request_id')), 'count']
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

async function getApprovalRate(facilityIds, startDate) {
  const results = await IceTimeRequest.findAll({
    where: {
      facility_id: { [Op.in]: facilityIds },
      submitted_at: { [Op.gte]: startDate },
      request_status: { [Op.in]: ['approved', 'rejected', 'confirmed'] }
    },
    attributes: [
      'request_status',
      [sequelize.fn('COUNT', sequelize.col('request_id')), 'count']
    ],
    group: ['request_status'],
    raw: true
  });

  const approved = results
    .filter(r => ['approved', 'confirmed'].includes(r.request_status))
    .reduce((sum, r) => sum + parseInt(r.count), 0);
  
  const total = results.reduce((sum, r) => sum + parseInt(r.count), 0);
  
  return total > 0 ? Math.round((approved / total) * 100) : 0;
}

async function getAverageResponseTime(facilityIds, startDate) {
  const results = await IceTimeRequest.findAll({
    where: {
      facility_id: { [Op.in]: facilityIds },
      submitted_at: { [Op.gte]: startDate },
      reviewed_at: { [Op.ne]: null }
    },
    attributes: [
      [sequelize.fn('AVG', 
        sequelize.fn('EXTRACT', 
          sequelize.literal('EPOCH FROM (reviewed_at - submitted_at)')
        )
      ), 'avg_seconds']
    ],
    raw: true
  });

  const avgSeconds = results[0]?.avg_seconds || 0;
  return Math.round(avgSeconds / 3600 * 100) / 100; // Convert to hours with 2 decimals
}

async function getPopularPrograms(facilityIds, startDate) {
  return await IceTimeRequest.findAll({
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
      [sequelize.fn('COUNT', sequelize.col('request_id')), 'request_count']
    ],
    group: ['program_id', 'program.program_id', 'program.program_name'],
    order: [[sequelize.fn('COUNT', sequelize.col('request_id')), 'DESC']],
    limit: 5,
    raw: false
  });
}

async function getPeakRequestTimes(facilityIds, startDate) {
  return await IceTimeRequest.findAll({
    where: {
      facility_id: { [Op.in]: facilityIds },
      submitted_at: { [Op.gte]: startDate }
    },
    attributes: [
      [sequelize.fn('EXTRACT', sequelize.literal('HOUR FROM submitted_at')), 'hour'],
      [sequelize.fn('COUNT', sequelize.col('request_id')), 'count']
    ],
    group: [sequelize.fn('EXTRACT', sequelize.literal('HOUR FROM submitted_at'))],
    order: [[sequelize.fn('COUNT', sequelize.col('request_id')), 'DESC']],
    limit: 5,
    raw: true
  });
}

async function getRecentActivity(facilityIds, limit = 10) {
  return await IceTimeRequest.findAll({
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

module.exports = adminRequestController;