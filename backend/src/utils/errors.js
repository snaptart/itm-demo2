// backend/src/utils/errors.js

/**
 * Base application error class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Validation error - 400 Bad Request
 */
class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * Authentication error - 401 Unauthorized
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details = {}) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

/**
 * Authorization error - 403 Forbidden
 */
class AuthorizationError extends AppError {
  constructor(message = 'Access denied', details = {}) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

/**
 * Not found error - 404 Not Found
 */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = {}) {
    super(message, 404, 'NOT_FOUND_ERROR', details);
  }
}

/**
 * Conflict error - 409 Conflict
 */
class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = {}) {
    super(message, 409, 'CONFLICT_ERROR', details);
  }
}

/**
 * Business rule violation error - 422 Unprocessable Entity
 */
class BusinessRuleError extends AppError {
  constructor(message, violations = [], details = {}) {
    super(message, 422, 'BUSINESS_RULE_ERROR', { violations, ...details });
    this.violations = violations;
  }
}

/**
 * Rate limit error - 429 Too Many Requests
 */
class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', retryAfter = null, details = {}) {
    super(message, 429, 'RATE_LIMIT_ERROR', { retryAfter, ...details });
    this.retryAfter = retryAfter;
  }
}

/**
 * External service error - 502 Bad Gateway
 */
class ExternalServiceError extends AppError {
  constructor(service, message = 'External service unavailable', details = {}) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', { service, ...details });
    this.service = service;
  }
}

/**
 * Database error - 500 Internal Server Error
 */
class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', operation = null, details = {}) {
    super(message, 500, 'DATABASE_ERROR', { operation, ...details });
    this.operation = operation;
  }
}

/**
 * Configuration error - 500 Internal Server Error
 */
class ConfigurationError extends AppError {
  constructor(message = 'Configuration error', missingConfig = null, details = {}) {
    super(message, 500, 'CONFIGURATION_ERROR', { missingConfig, ...details });
    this.missingConfig = missingConfig;
  }
}

/**
 * Episode lock error - 423 Locked
 */
class EpisodeLockError extends AppError {
  constructor(message = 'Episode is locked by another user', lockedBy = null, details = {}) {
    super(message, 423, 'EPISODE_LOCK_ERROR', { lockedBy, ...details });
    this.lockedBy = lockedBy;
  }
}

/**
 * Schedule conflict error - 409 Conflict
 */
class ScheduleConflictError extends ConflictError {
  constructor(message = 'Schedule conflict detected', conflicts = [], details = {}) {
    super(message, { conflicts, ...details });
    this.code = 'SCHEDULE_CONFLICT_ERROR';
    this.conflicts = conflicts;
  }
}

/**
 * Error factory for creating appropriate error types
 */
class ErrorFactory {
  /**
   * Create error from Sequelize error
   * @param {Error} sequelizeError - Sequelize error
   * @returns {AppError} - Appropriate app error
   */
  static fromSequelizeError(sequelizeError) {
    switch (sequelizeError.name) {
      case 'SequelizeValidationError':
        return new ValidationError(
          'Validation failed',
          { 
            fields: sequelizeError.errors.map(e => ({
              field: e.path,
              message: e.message,
              value: e.value
            }))
          }
        );

      case 'SequelizeUniqueConstraintError':
        return new ConflictError(
          'Duplicate entry found',
          { 
            fields: sequelizeError.errors.map(e => e.path),
            constraint: sequelizeError.parent?.constraint
          }
        );

      case 'SequelizeForeignKeyConstraintError':
        return new ConflictError(
          'Referenced record does not exist',
          { 
            table: sequelizeError.table,
            constraint: sequelizeError.parent?.constraint
          }
        );

      case 'SequelizeConnectionError':
      case 'SequelizeDatabaseError':
        return new DatabaseError(
          'Database operation failed',
          sequelizeError.sql ? 'query' : 'connection',
          { original: sequelizeError.message }
        );

      default:
        return new AppError(sequelizeError.message, 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Create validation error with field details
   * @param {Object} fieldErrors - Object with field errors
   * @returns {ValidationError} - Validation error
   */
  static validationError(fieldErrors) {
    const message = 'Validation failed';
    const fields = Object.entries(fieldErrors).map(([field, error]) => ({
      field,
      message: error
    }));

    return new ValidationError(message, { fields });
  }

  /**
   * Create business rule error with violations
   * @param {string} message - Error message
   * @param {Array} violations - Array of business rule violations
   * @returns {BusinessRuleError} - Business rule error
   */
  static businessRuleError(message, violations = []) {
    return new BusinessRuleError(message, violations);
  }

  /**
   * Create schedule conflict error
   * @param {string} message - Error message
   * @param {Array} conflicts - Array of schedule conflicts
   * @returns {ScheduleConflictError} - Schedule conflict error
   */
  static scheduleConflictError(message, conflicts = []) {
    return new ScheduleConflictError(message, conflicts);
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
  ConfigurationError,
  EpisodeLockError,
  ScheduleConflictError,
  ErrorFactory
};