// backend/src/middleware/errorHandler.js
const { 
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
  EpisodeLockError,
  ScheduleConflictError,
  ErrorFactory
} = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Development error response - includes stack trace and full details
 * @param {AppError} err - Application error
 * @param {Response} res - Express response object
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    error: {
      name: err.name,
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      details: err.details,
      stack: err.stack,
      timestamp: new Date().toISOString()
    }
  });
};

/**
 * Production error response - limited details for security
 * @param {AppError} err - Application error
 * @param {Response} res - Express response object
 */
const sendErrorProd = (err, res) => {
  // Only send error details for operational errors
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
        details: err.statusCode < 500 ? err.details : undefined,
        timestamp: new Date().toISOString()
      }
    });
  } else {
    // Programming errors - don't leak details
    logger.error('Programming error', { 
      error: err,
      stack: err.stack 
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Something went wrong',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Handle JWT authentication errors
 * @param {Error} err - JWT error
 * @returns {AuthenticationError} - Authentication error
 */
const handleJWTError = (err) => {
  if (err.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid authentication token');
  }
  if (err.name === 'TokenExpiredError') {
    return new AuthenticationError('Authentication token has expired');
  }
  return new AuthenticationError('Authentication failed');
};

/**
 * Handle Sequelize errors
 * @param {Error} err - Sequelize error
 * @returns {AppError} - Application error
 */
const handleSequelizeError = (err) => {
  return ErrorFactory.fromSequelizeError(err);
};

/**
 * Handle Validation errors
 * @param {Error} err - Validation error
 * @returns {ValidationError} - Validation error
 */
const handleValidationError = (err) => {
  if (err.name === 'ValidationError' && err.errors) {
    // Mongoose-style validation error
    const fieldErrors = {};
    Object.values(err.errors).forEach(error => {
      fieldErrors[error.path] = error.message;
    });
    return ErrorFactory.validationError(fieldErrors);
  }
  
  return new ValidationError(err.message);
};

/**
 * Handle Cast errors (e.g., invalid ObjectId)
 * @param {Error} err - Cast error
 * @returns {ValidationError} - Validation error
 */
const handleCastError = (err) => {
  return new ValidationError(`Invalid ${err.path}: ${err.value}`);
};

/**
 * Enhanced error logging with context
 * @param {Error} err - Error to log
 * @param {Request} req - Express request object
 */
const logError = (err, req) => {
  const context = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.user_id,
    username: req.user?.username,
    body: req.method !== 'GET' ? req.body : undefined,
    params: req.params,
    query: req.query
  };

  if (err.statusCode >= 500) {
    logger.error('Server error', {
      error: err.message,
      code: err.code,
      stack: err.stack,
      context
    });
  } else if (err.statusCode >= 400) {
    logger.warn('Client error', {
      error: err.message,
      code: err.code,
      context
    });
  } else {
    logger.info('Request error', {
      error: err.message,
      code: err.code,
      context
    });
  }
};

/**
 * Main error handling middleware
 * @param {Error} err - Error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  // Skip if response already sent
  if (res.headersSent) {
    return next(err);
  }

  let error = err;

  // Convert known error types to AppError instances
  if (!(error instanceof AppError)) {
    if (error.name?.includes('Sequelize')) {
      error = handleSequelizeError(error);
    } else if (error.name?.includes('JWT') || error.name?.includes('Token')) {
      error = handleJWTError(error);
    } else if (error.name === 'ValidationError') {
      error = handleValidationError(error);
    } else if (error.name === 'CastError') {
      error = handleCastError(error);
    } else if (error.code === 'ECONNREFUSED') {
      error = new ExternalServiceError('database', 'Database connection failed');
    } else if (error.code === 'ENOTFOUND') {
      error = new ExternalServiceError('unknown', 'External service not found');
    } else {
      // Generic error wrapper
      error = new AppError(
        error.message || 'Something went wrong',
        error.statusCode || 500,
        error.code || 'UNKNOWN_ERROR'
      );
    }
  }

  // Log the error with context
  logError(error, req);

  // Send appropriate response based on environment
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

/**
 * Async error wrapper for route handlers
 * @param {Function} fn - Async route handler function
 * @returns {Function} - Express middleware function
 */
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 handler for undefined routes
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next function
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
  next(error);
};

/**
 * Validation middleware factory
 * @param {Object} schema - Validation schema
 * @param {string} property - Request property to validate ('body', 'params', 'query')
 * @returns {Function} - Express middleware function
 */
const validateRequest = (schema, property = 'body') => {
  return asyncErrorHandler(async (req, res, next) => {
    const { error, value } = schema.validate(req[property], { 
      abortEarly: false,
      stripUnknown: true 
    });

    if (error) {
      const fieldErrors = {};
      error.details.forEach(detail => {
        fieldErrors[detail.path.join('.')] = detail.message;
      });
      
      throw ErrorFactory.validationError(fieldErrors);
    }

    // Replace request property with validated value
    req[property] = value;
    next();
  });
};

/**
 * Rate limiting error handler
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next function
 */
const rateLimitHandler = (req, res, next) => {
  const error = new RateLimitError(
    'Too many requests from this IP, please try again later.',
    res.get('Retry-After')
  );
  next(error);
};

/**
 * Business rule validation wrapper
 * @param {Function} validationFn - Business rule validation function
 * @returns {Function} - Express middleware function
 */
const validateBusinessRules = (validationFn) => {
  return asyncErrorHandler(async (req, res, next) => {
    const violations = await validationFn(req);
    
    if (violations && violations.length > 0) {
      throw ErrorFactory.businessRuleError(
        'Business rule violations detected',
        violations
      );
    }
    
    next();
  });
};

module.exports = {
  errorHandler,
  asyncErrorHandler,
  notFoundHandler,
  validateRequest,
  rateLimitHandler,
  validateBusinessRules,
  logError
};