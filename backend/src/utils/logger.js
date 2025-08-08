/**
 * Logger Utility
 * Centralized logging configuration using Winston
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'sendme-logistics-api',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: parseInt(process.env.LOG_MAX_SIZE) || 10485760, // 10MB
      maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
      tailable: true
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: parseInt(process.env.LOG_MAX_SIZE) || 10485760, // 10MB
      maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
      tailable: true
    }),
    
    // Application log file
    new winston.transports.File({
      filename: process.env.LOG_FILE_PATH || path.join(logsDir, 'app.log'),
      maxsize: parseInt(process.env.LOG_MAX_SIZE) || 10485760, // 10MB
      maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
      tailable: true
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log')
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Create specialized loggers for different components
const createComponentLogger = (component) => {
  return {
    info: (message, meta = {}) => logger.info(message, { component, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { component, ...meta }),
    error: (message, meta = {}) => logger.error(message, { component, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { component, ...meta })
  };
};

// HTTP request logger
const httpLogger = createComponentLogger('HTTP');

// Database logger
const dbLogger = createComponentLogger('DATABASE');

// Authentication logger
const authLogger = createComponentLogger('AUTH');

// Payment logger
const paymentLogger = createComponentLogger('PAYMENT');

// Booking logger
const bookingLogger = createComponentLogger('BOOKING');

// Notification logger
const notificationLogger = createComponentLogger('NOTIFICATION');

// Security logger for suspicious activities
const securityLogger = createComponentLogger('SECURITY');

/**
 * Log API request details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {number} responseTime - Response time in milliseconds
 */
const logApiRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userId: req.user?.id || 'anonymous'
  };

  if (res.statusCode >= 400) {
    httpLogger.error('API Request Failed', logData);
  } else {
    httpLogger.info('API Request', logData);
  }
};

/**
 * Log authentication events
 * @param {string} event - Authentication event type
 * @param {Object} data - Event data
 */
const logAuthEvent = (event, data) => {
  authLogger.info(`Auth Event: ${event}`, {
    event,
    ...data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log security events
 * @param {string} event - Security event type
 * @param {Object} data - Event data
 */
const logSecurityEvent = (event, data) => {
  securityLogger.warn(`Security Event: ${event}`, {
    event,
    ...data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log payment events
 * @param {string} event - Payment event type
 * @param {Object} data - Event data
 */
const logPaymentEvent = (event, data) => {
  paymentLogger.info(`Payment Event: ${event}`, {
    event,
    ...data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log booking events
 * @param {string} event - Booking event type
 * @param {Object} data - Event data
 */
const logBookingEvent = (event, data) => {
  bookingLogger.info(`Booking Event: ${event}`, {
    event,
    ...data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log database operations
 * @param {string} operation - Database operation type
 * @param {Object} data - Operation data
 */
const logDbOperation = (operation, data) => {
  dbLogger.debug(`DB Operation: ${operation}`, {
    operation,
    ...data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log notification events
 * @param {string} event - Notification event type
 * @param {Object} data - Event data
 */
const logNotificationEvent = (event, data) => {
  notificationLogger.info(`Notification Event: ${event}`, {
    event,
    ...data,
    timestamp: new Date().toISOString()
  });
};

// Export the logger with custom methods
const exportedLogger = Object.assign(logger, {
  // Component loggers
  httpLogger,
  dbLogger,
  authLogger,
  paymentLogger,
  bookingLogger,
  notificationLogger,
  securityLogger,

  // Specialized logging functions
  logApiRequest,
  logAuthEvent,
  logSecurityEvent,
  logPaymentEvent,
  logBookingEvent,
  logDbOperation,
  logNotificationEvent,

  // Create custom component logger
  createComponentLogger
});

module.exports = exportedLogger;
