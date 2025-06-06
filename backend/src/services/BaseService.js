// backend/src/services/BaseService.js
const { ValidationError, NotFoundError, ConflictError, AuthorizationError } = require('../utils/errors');
const logger = require('../utils/logger');

class BaseService {
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * Execute a service operation with standardized error handling
   * @param {Function} operation - The operation to execute
   * @param {Object} context - Context information for logging
   * @returns {Promise<any>} - Operation result
   */
  async executeOperation(operation, context = {}) {
    const startTime = Date.now();
    
    try {
      logger.debug('Service operation started', {
        service: this.constructor.name,
        operation: operation.name,
        context
      });

      const result = await operation();
      
      const duration = Date.now() - startTime;
      logger.debug('Service operation completed', {
        service: this.constructor.name,
        operation: operation.name,
        duration,
        context
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Service operation failed', {
        service: this.constructor.name,
        operation: operation.name,
        duration,
        error: error.message,
        stack: error.stack,
        context
      });

      // Re-throw known errors as-is
      if (error instanceof ValidationError || 
          error instanceof NotFoundError || 
          error instanceof ConflictError || 
          error instanceof AuthorizationError) {
        throw error;
      }

      // Wrap unknown errors
      throw new Error(`Service operation failed: ${error.message}`);
    }
  }

  /**
   * Validate required fields
   * @param {Object} data - Data to validate
   * @param {Array<string>} requiredFields - Array of required field names
   * @throws {ValidationError} - If validation fails
   */
  validateRequired(data, requiredFields) {
    const missing = requiredFields.filter(field => {
      const value = data[field];
      return value === null || value === undefined || value === '';
    });

    if (missing.length > 0) {
      throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Validate user permissions
   * @param {Object} user - User object
   * @param {string|Array<string>} requiredRoles - Required user roles
   * @param {Object} resource - Resource being accessed (optional)
   * @throws {AuthorizationError} - If authorization fails
   */
  validatePermissions(user, requiredRoles, resource = null) {
    if (!user || !user.user_type) {
      throw new AuthorizationError('User authentication required');
    }

    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    if (!roles.includes(user.user_type)) {
      throw new AuthorizationError(`Access denied. Required roles: ${roles.join(', ')}`);
    }

    // Additional resource-specific permission checks can be added here
    if (resource && resource.admin_user_id && user.user_type === 'admin') {
      if (resource.admin_user_id !== user.user_id) {
        throw new AuthorizationError('Access denied to this resource');
      }
    }
  }

  /**
   * Paginate query results
   * @param {Object} options - Pagination options
   * @returns {Object} - Pagination parameters
   */
  getPaginationParams(options = {}) {
    const page = Math.max(1, parseInt(options.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 20));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * Format pagination response
   * @param {Array} data - Data array
   * @param {number} total - Total count
   * @param {Object} params - Pagination parameters
   * @returns {Object} - Formatted response
   */
  formatPaginatedResponse(data, total, params) {
    const { page, limit } = params;
    const pages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Validate date range
   * @param {string|Date} startDate - Start date
   * @param {string|Date} endDate - End date
   * @throws {ValidationError} - If date range is invalid
   */
  validateDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ValidationError('Invalid date format');
    }

    if (start >= end) {
      throw new ValidationError('Start date must be before end date');
    }

    // Don't allow dates too far in the past or future
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());

    if (start < oneYearAgo || end > twoYearsFromNow) {
      throw new ValidationError('Date range must be within reasonable bounds');
    }
  }

  /**
   * Check for business hours constraints
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @param {Object} facility - Facility object with business hours
   * @throws {ValidationError} - If outside business hours
   */
  validateBusinessHours(startTime, endTime, facility) {
    if (!facility) return;

    const start = new Date(startTime);
    const end = new Date(endTime);
    
    const startHour = start.getHours();
    const endHour = end.getHours();
    
    // Default business hours if not specified
    const dailyStart = facility.facility_daily_start_time || '06:00:00';
    const dailyEnd = facility.facility_daily_end_time || '23:00:00';
    
    const [facilityStartHour] = dailyStart.split(':').map(Number);
    const [facilityEndHour] = dailyEnd.split(':').map(Number);

    if (startHour < facilityStartHour || endHour > facilityEndHour) {
      throw new ValidationError(
        `Time must be within facility hours: ${dailyStart.slice(0, 5)} - ${dailyEnd.slice(0, 5)}`
      );
    }
  }

  /**
   * Format response with metadata
   * @param {any} data - Response data
   * @param {Object} metadata - Additional metadata
   * @returns {Object} - Formatted response
   */
  formatResponse(data, metadata = {}) {
    return {
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        service: this.constructor.name,
        ...metadata
      }
    };
  }
}

module.exports = BaseService;