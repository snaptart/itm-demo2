// backend/src/utils/logger.js
const path = require('path');

/**
 * Log levels with priority ordering
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

/**
 * Color codes for console output
 */
const COLORS = {
  error: '\x1b[31m',   // Red
  warn: '\x1b[33m',    // Yellow
  info: '\x1b[36m',    // Cyan
  debug: '\x1b[90m',   // Gray
  reset: '\x1b[0m'     // Reset
};

/**
 * Enhanced logger class with structured logging
 */
class Logger {
  constructor(options = {}) {
    this.level = options.level || process.env.LOG_LEVEL || 'info';
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile || false;
    this.service = options.service || 'ice-time-management';
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * Check if log level should be logged
   * @param {string} level - Log level to check
   * @returns {boolean} - Whether to log
   */
  shouldLog(level) {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
  }

  /**
   * Format log entry with metadata
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} metadata - Additional metadata
   * @returns {Object} - Formatted log entry
   */
  formatLogEntry(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const caller = this.getCaller();

    return {
      timestamp,
      level: level.toUpperCase(),
      service: this.service,
      environment: this.environment,
      message,
      caller,
      ...metadata,
      // Add request ID if available
      ...(metadata.requestId && { requestId: metadata.requestId })
    };
  }

  /**
   * Get caller information from stack trace
   * @returns {Object} - Caller information
   */
  getCaller() {
    const stack = new Error().stack;
    const stackLines = stack.split('\n');
    
    // Find the first line that's not from this logger
    for (let i = 3; i < stackLines.length; i++) {
      const line = stackLines[i];
      if (!line.includes('logger.js') && !line.includes('Logger.')) {
        const match = line.match(/at (.+) \((.+):(\d+):(\d+)\)/);
        if (match) {
          return {
            function: match[1],
            file: path.basename(match[2]),
            line: parseInt(match[3]),
            column: parseInt(match[4])
          };
        }
      }
    }

    return { function: 'unknown', file: 'unknown', line: 0, column: 0 };
  }

  /**
   * Format message for console output
   * @param {Object} logEntry - Formatted log entry
   * @returns {string} - Console formatted message
   */
  formatConsoleMessage(logEntry) {
    const { timestamp, level, message, caller, service, ...metadata } = logEntry;
    const color = COLORS[level.toLowerCase()] || COLORS.reset;
    const time = new Date(timestamp).toLocaleTimeString();
    
    let consoleMessage = `${color}[${time}] ${level} ${COLORS.reset}`;
    consoleMessage += `${message}`;
    
    if (caller && caller.file !== 'unknown') {
      consoleMessage += ` ${COLORS.debug}(${caller.file}:${caller.line})${COLORS.reset}`;
    }

    // Add metadata if present
    const metadataKeys = Object.keys(metadata).filter(key => 
      key !== 'error' && key !== 'stack' && metadata[key] !== undefined
    );
    
    if (metadataKeys.length > 0) {
      const metadataStr = metadataKeys
        .map(key => `${key}=${JSON.stringify(metadata[key])}`)
        .join(' ');
      consoleMessage += ` ${COLORS.debug}${metadataStr}${COLORS.reset}`;
    }

    // Add error details if present
    if (metadata.error) {
      consoleMessage += `\n${COLORS.error}Error: ${metadata.error}${COLORS.reset}`;
    }
    
    if (metadata.stack && process.env.NODE_ENV === 'development') {
      consoleMessage += `\n${COLORS.debug}${metadata.stack}${COLORS.reset}`;
    }

    return consoleMessage;
  }

  /**
   * Core logging method
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} metadata - Additional metadata
   */
  log(level, message, metadata = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = this.formatLogEntry(level, message, metadata);

    // Console output
    if (this.enableConsole) {
      const consoleMessage = this.formatConsoleMessage(logEntry);
      console.log(consoleMessage);
    }

    // File output (placeholder for future implementation)
    if (this.enableFile) {
      // Could implement file logging here
      // fs.appendFileSync('app.log', JSON.stringify(logEntry) + '\n');
    }

    // Could add external logging service integration here
    // (e.g., Winston, Bunyan, or cloud logging services)
  }

  /**
   * Error level logging
   * @param {string} message - Log message
   * @param {Object} metadata - Additional metadata
   */
  error(message, metadata = {}) {
    this.log('error', message, metadata);
  }

  /**
   * Warning level logging
   * @param {string} message - Log message
   * @param {Object} metadata - Additional metadata
   */
  warn(message, metadata = {}) {
    this.log('warn', message, metadata);
  }

  /**
   * Info level logging
   * @param {string} message - Log message
   * @param {Object} metadata - Additional metadata
   */
  info(message, metadata = {}) {
    this.log('info', message, metadata);
  }

  /**
   * Debug level logging
   * @param {string} message - Log message
   * @param {Object} metadata - Additional metadata
   */
  debug(message, metadata = {}) {
    this.log('debug', message, metadata);
  }

  /**
   * Database query logging
   * @param {string} sql - SQL query
   * @param {number} timing - Query timing in ms
   * @param {Object} metadata - Additional metadata
   */
  query(sql, timing, metadata = {}) {
    this.debug('Database query executed', {
      sql: process.env.NODE_ENV === 'development' ? sql : '[hidden]',
      timing,
      ...metadata
    });
  }

  /**
   * HTTP request logging
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {number} responseTime - Response time in ms
   */
  request(req, res, responseTime) {
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;
    const level = statusCode >= 400 ? 'warn' : 'info';
    
    this.log(level, `${method} ${originalUrl}`, {
      method,
      url: originalUrl,
      statusCode,
      responseTime,
      ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.user_id,
      username: req.user?.username
    });
  }

  /**
   * Authentication logging
   * @param {string} event - Auth event type
   * @param {string} username - Username
   * @param {string} ip - IP address
   * @param {boolean} success - Whether auth was successful
   * @param {Object} metadata - Additional metadata
   */
  auth(event, username, ip, success, metadata = {}) {
    const level = success ? 'info' : 'warn';
    const message = `Authentication ${event}: ${username}`;
    
    this.log(level, message, {
      event,
      username,
      ip,
      success,
      ...metadata
    });
  }

  /**
   * Business logic logging
   * @param {string} operation - Business operation
   * @param {Object} context - Operation context
   * @param {boolean} success - Whether operation was successful
   * @param {Object} metadata - Additional metadata
   */
  business(operation, context, success = true, metadata = {}) {
    const level = success ? 'info' : 'warn';
    const message = `Business operation: ${operation}`;
    
    this.log(level, message, {
      operation,
      context,
      success,
      ...metadata
    });
  }

  /**
   * Performance logging
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in ms
   * @param {Object} metadata - Additional metadata
   */
  performance(operation, duration, metadata = {}) {
    const level = duration > 1000 ? 'warn' : 'debug';
    const message = `Performance: ${operation}`;
    
    this.log(level, message, {
      operation,
      duration,
      ...metadata
    });
  }

  /**
   * Security logging
   * @param {string} event - Security event
   * @param {string} severity - Event severity
   * @param {Object} context - Event context
   * @param {Object} metadata - Additional metadata
   */
  security(event, severity, context, metadata = {}) {
    const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    const message = `Security event: ${event}`;
    
    this.log(level, message, {
      event,
      severity,
      context,
      ...metadata
    });
  }
}

// Create singleton logger instance
const logger = new Logger({
  service: 'ice-time-management',
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info')
});

// Export both the instance and the class for flexibility
module.exports = logger;
module.exports.Logger = Logger;