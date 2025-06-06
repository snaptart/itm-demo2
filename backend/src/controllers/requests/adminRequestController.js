// backend/src/controllers/requests/adminRequestController.js (Refactored)
const RequestService = require('../../services/RequestService');
const ResponseFormatter = require('../../utils/responseFormatter');
const { asyncErrorHandler } = require('../../middleware/errorHandler');
const logger = require('../../utils/logger');

class AdminRequestController {
  constructor() {
    this.requestService = new RequestService();
  }

  /**
   * Get request queue for admin dashboard
   */
  getRequestQueue = asyncErrorHandler(async (req, res) => {
    const startTime = Date.now();
    
    const filters = {
      status: req.query.status,
      priority: req.query.priority,
      program_id: req.query.program_id,
      sort_by: req.query.sort_by,
      sort_order: req.query.sort_order
    };

    const pagination = this.requestService.getPaginationParams({
      page: req.query.page,
      limit: req.query.limit
    });

    const result = await this.requestService.getRequestQueue(req.user, filters, pagination);

    const duration = Date.now() - startTime;
    logger.performance('getRequestQueue', duration, { 
      requestCount: result.data.length,
      filters,
      user: req.user.username 
    });

    return ResponseFormatter.paginated(
      res,
      result.data,
      result.pagination,
      'Request queue retrieved successfully',
      {
        summary: result.summary,
        facilities: result.facilities
      }
    );
  });

  /**
   * Get detailed request information
   */
  getRequestDetails = asyncErrorHandler(async (req, res) => {
    const { request_id } = req.params;
    const result = await this.requestService.getRequestDetails(request_id, req.user);

    return ResponseFormatter.success(res, result, 'Request details retrieved successfully');
  });

  /**
   * Approve a request
   */
  approveRequest = asyncErrorHandler(async (req, res) => {
    const { request_id } = req.params;
    const result = await this.requestService.approveRequest(request_id, req.body, req.user);

    logger.business('Request approved via API', {
      requestId: request_id,
      autoConfirm: req.body.auto_confirm,
      approvedBy: req.user.username
    });

    return ResponseFormatter.success(
      res, 
      result, 
      `Request ${req.body.auto_confirm ? 'approved and confirmed' : 'approved'} successfully`,
      200,
      { 
        operation: 'approve',
        autoConfirmed: req.body.auto_confirm,
        rejectedConflicts: result.rejected_requests
      }
    );
  });

  /**
   * Reject a request
   */
  rejectRequest = asyncErrorHandler(async (req, res) => {
    const { request_id } = req.params;
    const result = await this.requestService.rejectRequest(request_id, req.body, req.user);

    logger.business('Request rejected via API', {
      requestId: request_id,
      rejectionReason: req.body.rejection_reason,
      rejectedBy: req.user.username
    });

    return ResponseFormatter.success(
      res, 
      result, 
      'Request rejected successfully',
      200,
      { 
        operation: 'reject',
        reason: req.body.rejection_reason
      }
    );
  });

  /**
   * Batch process requests (approve/reject multiple)
   */
  batchProcessRequests = asyncErrorHandler(async (req, res) => {
    const { request_ids, action } = req.body;

    if (!request_ids || !Array.isArray(request_ids) || request_ids.length === 0) {
      return ResponseFormatter.validationError(res, 'Request IDs are required');
    }

    if (!['approve', 'reject'].includes(action)) {
      return ResponseFormatter.validationError(res, 'Invalid action. Must be approve or reject');
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each request individually for better error handling
    for (const requestId of request_ids) {
      try {
        let result;
        if (action === 'approve') {
          result = await this.requestService.approveRequest(requestId, req.body, req.user);
        } else {
          result = await this.requestService.rejectRequest(requestId, req.body, req.user);
        }

        results.push({
          request_id: requestId,
          success: true,
          action,
          result
        });
        successCount++;

      } catch (error) {
        results.push({
          request_id: requestId,
          success: false,
          action,
          error: error.message
        });
        errorCount++;
        
        logger.error('Batch process request failed', {
          requestId,
          action,
          error: error.message,
          user: req.user.username
        });
      }
    }

    logger.business('Batch request processing completed', {
      action,
      totalRequests: request_ids.length,
      successCount,
      errorCount,
      user: req.user.username
    });

    return ResponseFormatter.bulkOperation(
      res,
      results,
      action,
      {
        total_requested: request_ids.length,
        successful: successCount,
        failed: errorCount
      }
    );
  });

  /**
   * Get admin dashboard metrics
   */
  getDashboardMetrics = asyncErrorHandler(async (req, res) => {
    const { timeframe = '7d' } = req.query;
    const result = await this.requestService.getDashboardMetrics(req.user, timeframe);

    return ResponseFormatter.success(
      res, 
      result, 
      'Dashboard metrics retrieved successfully',
      200,
      { timeframe }
    );
  });

  /**
   * Get request statistics for facility
   */
  getRequestStatistics = asyncErrorHandler(async (req, res) => {
    const { facility_id } = req.params;
    const { start_date, end_date } = req.query;

    // This would be implemented in the service layer
    return ResponseFormatter.success(res, {}, 'Request statistics not yet implemented', 501);
  });

  /**
   * Export requests to CSV
   */
  exportRequests = asyncErrorHandler(async (req, res) => {
    const filters = {
      status: req.query.status,
      facility_id: req.query.facility_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };

    // This would be implemented in the service layer
    return ResponseFormatter.success(res, {}, 'Export functionality not yet implemented', 501);
  });

  /**
   * Get request analytics
   */
  getRequestAnalytics = asyncErrorHandler(async (req, res) => {
    const { timeframe = '30d', facility_id } = req.query;

    // This would be implemented in the service layer for advanced analytics
    return ResponseFormatter.success(res, {}, 'Analytics not yet implemented', 501);
  });

  /**
   * Bulk assign requests to different facility
   */
  bulkReassignRequests = asyncErrorHandler(async (req, res) => {
    const { request_ids, target_facility_id, reason } = req.body;

    // This would be implemented in the service layer
    return ResponseFormatter.success(res, {}, 'Bulk reassignment not yet implemented', 501);
  });

  /**
   * Set request priority
   */
  setRequestPriority = asyncErrorHandler(async (req, res) => {
    const { request_id } = req.params;
    const { priority, reason } = req.body;

    // This would be implemented in the service layer
    return ResponseFormatter.success(res, {}, 'Priority setting not yet implemented', 501);
  });

  /**
   * Add admin notes to request
   */
  addAdminNotes = asyncErrorHandler(async (req, res) => {
    const { request_id } = req.params;
    const { notes } = req.body;

    // This would be implemented in the service layer
    return ResponseFormatter.success(res, {}, 'Admin notes not yet implemented', 501);
  });

  /**
   * Get request audit trail
   */
  getRequestAuditTrail = asyncErrorHandler(async (req, res) => {
    const { request_id } = req.params;

    // This would be implemented in the service layer with audit logging
    return ResponseFormatter.success(res, {}, 'Audit trail not yet implemented', 501);
  });
}

module.exports = new AdminRequestController();