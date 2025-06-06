// backend/src/utils/responseFormatter.js

/**
 * Standard API response formatter utility
 */
class ResponseFormatter {
  
  /**
   * Format successful response
   * @param {Object} res - Express response object
   * @param {any} data - Response data
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code
   * @param {Object} metadata - Additional metadata
   * @returns {Object} - Express response
   */
  static success(res, data = null, message = 'Success', statusCode = 200, metadata = {}) {
    const response = {
      success: true,
      message,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Format paginated response
   * @param {Object} res - Express response object
   * @param {Array} data - Response data array
   * @param {Object} pagination - Pagination information
   * @param {string} message - Success message
   * @param {Object} metadata - Additional metadata
   * @returns {Object} - Express response
   */
  static paginated(res, data, pagination, message = 'Success', metadata = {}) {
    const response = {
      success: true,
      message,
      data,
      pagination: {
        total: pagination.total,
        page: pagination.page,
        limit: pagination.limit,
        pages: pagination.pages,
        hasNext: pagination.hasNext,
        hasPrev: pagination.hasPrev
      },
      metadata: {
        timestamp: new Date().toISOString(),
        count: data.length,
        ...metadata
      }
    };

    return res.status(200).json(response);
  }

  /**
   * Format created resource response
   * @param {Object} res - Express response object
   * @param {any} data - Created resource data
   * @param {string} message - Success message
   * @param {Object} metadata - Additional metadata
   * @returns {Object} - Express response
   */
  static created(res, data, message = 'Resource created successfully', metadata = {}) {
    return ResponseFormatter.success(res, data, message, 201, {
      operation: 'create',
      ...metadata
    });
  }

  /**
   * Format updated resource response
   * @param {Object} res - Express response object
   * @param {any} data - Updated resource data
   * @param {string} message - Success message
   * @param {Object} metadata - Additional metadata
   * @returns {Object} - Express response
   */
  static updated(res, data, message = 'Resource updated successfully', metadata = {}) {
    return ResponseFormatter.success(res, data, message, 200, {
      operation: 'update',
      ...metadata
    });
  }

  /**
   * Format deleted resource response
   * @param {Object} res - Express response object
   * @param {string} message - Success message
   * @param {Object} metadata - Additional metadata
   * @returns {Object} - Express response
   */
  static deleted(res, message = 'Resource deleted successfully', metadata = {}) {
    return ResponseFormatter.success(res, null, message, 200, {
      operation: 'delete',
      ...metadata
    });
  }

  /**
   * Format no content response
   * @param {Object} res - Express response object
   * @returns {Object} - Express response
   */
  static noContent(res) {
    return res.status(204).send();
  }

  /**
   * Format validation error response
   * @param {Object} res - Express response object
   * @param {Array|Object} errors - Validation errors
   * @param {string} message - Error message
   * @returns {Object} - Express response
   */
  static validationError(res, errors, message = 'Validation failed') {
    const response = {
      success: false,
      message,
      errors: Array.isArray(errors) ? errors : [errors],
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'validation_error'
      }
    };

    return res.status(400).json(response);
  }

  /**
   * Format not found response
   * @param {Object} res - Express response object
   * @param {string} resource - Resource type
   * @param {string|number} id - Resource identifier
   * @returns {Object} - Express response
   */
  static notFound(res, resource = 'Resource', id = null) {
    const message = id 
      ? `${resource} with ID ${id} not found`
      : `${resource} not found`;

    const response = {
      success: false,
      message,
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'not_found_error',
        resource,
        id
      }
    };

    return res.status(404).json(response);
  }

  /**
   * Format conflict response
   * @param {Object} res - Express response object
   * @param {string} message - Conflict message
   * @param {Object} conflicts - Conflict details
   * @returns {Object} - Express response
   */
  static conflict(res, message = 'Resource conflict', conflicts = {}) {
    const response = {
      success: false,
      message,
      conflicts,
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'conflict_error'
      }
    };

    return res.status(409).json(response);
  }

  /**
   * Format business rule violation response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {Array} violations - Business rule violations
   * @returns {Object} - Express response
   */
  static businessRuleViolation(res, message = 'Business rule violation', violations = []) {
    const response = {
      success: false,
      message,
      violations,
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'business_rule_error'
      }
    };

    return res.status(422).json(response);
  }

  /**
   * Format unauthorized response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @returns {Object} - Express response
   */
  static unauthorized(res, message = 'Authentication required') {
    const response = {
      success: false,
      message,
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'authentication_error'
      }
    };

    return res.status(401).json(response);
  }

  /**
   * Format forbidden response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @returns {Object} - Express response
   */
  static forbidden(res, message = 'Access denied') {
    const response = {
      success: false,
      message,
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'authorization_error'
      }
    };

    return res.status(403).json(response);
  }

  /**
   * Format episode lock error response
   * @param {Object} res - Express response object
   * @param {string} lockedBy - User who has the lock
   * @param {Date} lockTime - When the lock was acquired
   * @returns {Object} - Express response
   */
  static episodeLocked(res, lockedBy, lockTime = null) {
    const response = {
      success: false,
      message: `Episode is currently being edited by ${lockedBy}`,
      lock: {
        lockedBy,
        lockTime,
        canRetry: true
      },
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'episode_lock_error'
      }
    };

    return res.status(423).json(response);
  }

  /**
   * Format rate limit response
   * @param {Object} res - Express response object
   * @param {string} retryAfter - Retry after time
   * @returns {Object} - Express response
   */
  static rateLimited(res, retryAfter = null) {
    const response = {
      success: false,
      message: 'Rate limit exceeded',
      retryAfter,
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'rate_limit_error'
      }
    };

    if (retryAfter) {
      res.set('Retry-After', retryAfter);
    }

    return res.status(429).json(response);
  }

  /**
   * Format server error response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {string} errorId - Error tracking ID
   * @returns {Object} - Express response
   */
  static serverError(res, message = 'Internal server error', errorId = null) {
    const response = {
      success: false,
      message,
      errorId,
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'server_error'
      }
    };

    return res.status(500).json(response);
  }

  /**
   * Format health check response
   * @param {Object} res - Express response object
   * @param {Object} healthData - Health check data
   * @returns {Object} - Express response
   */
  static health(res, healthData = {}) {
    const response = {
      success: true,
      message: 'Service is healthy',
      health: {
        status: 'up',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        ...healthData
      }
    };

    return res.status(200).json(response);
  }

  /**
   * Format bulk operation response
   * @param {Object} res - Express response object
   * @param {Array} results - Array of operation results
   * @param {string} operation - Operation type
   * @param {Object} summary - Operation summary
   * @returns {Object} - Express response
   */
  static bulkOperation(res, results, operation, summary = {}) {
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    const response = {
      success: failed === 0,
      message: `Bulk ${operation} completed`,
      results,
      summary: {
        total: results.length,
        successful,
        failed,
        ...summary
      },
      metadata: {
        timestamp: new Date().toISOString(),
        operation: `bulk_${operation}`
      }
    };

    // Return 207 Multi-Status if there are partial failures
    const statusCode = failed > 0 && successful > 0 ? 207 : (failed === 0 ? 200 : 400);
    
    return res.status(statusCode).json(response);
  }

  /**
   * Format async operation response
   * @param {Object} res - Express response object
   * @param {string} operationId - Operation tracking ID
   * @param {string} message - Status message
   * @param {Object} status - Operation status details
   * @returns {Object} - Express response
   */
  static asyncOperation(res, operationId, message = 'Operation started', status = {}) {
    const response = {
      success: true,
      message,
      operationId,
      status: {
        state: 'pending',
        progress: 0,
        ...status
      },
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'async_operation'
      }
    };

    return res.status(202).json(response);
  }
}

module.exports = ResponseFormatter;