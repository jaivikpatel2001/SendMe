/**
 * Rate Limiting Middleware
 * Implement various rate limiting strategies for different endpoints
 */

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

/**
 * Custom rate limit handler
 */
const rateLimitHandler = (req, res, next) => {
  logger.logSecurityEvent('rate_limit_exceeded', {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id || 'anonymous'
  });

  return next(new AppError('Too many requests from this IP, please try again later.', 429));
};

/**
 * Custom key generator for rate limiting
 */
const generateKey = (req) => {
  // Use user ID if authenticated, otherwise use IP
  return req.user?.id || req.ip;
};

/**
 * General API rate limiter
 */
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: generateKey,
  handler: rateLimitHandler
});

/**
 * Strict rate limiter for authentication endpoints
 */
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS) || 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true // Don't count successful requests
});

/**
 * OTP rate limiter
 */
const otpLimiter = rateLimit({
  windowMs: parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000, // 5 minutes
  max: parseInt(process.env.OTP_RATE_LIMIT_MAX_ATTEMPTS) || 3, // limit each IP to 3 OTP requests per windowMs
  message: {
    success: false,
    message: 'Too many OTP requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use phone number + IP for OTP rate limiting
    return `${req.body.phone || 'unknown'}-${req.ip}`;
  },
  handler: rateLimitHandler
});

/**
 * Password reset rate limiter
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    message: 'Too many password reset attempts from this IP, please try again later.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler
});

/**
 * File upload rate limiter
 */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each user to 20 uploads per 15 minutes
  message: {
    success: false,
    message: 'Too many file uploads, please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler
});

/**
 * Booking creation rate limiter
 */
const bookingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each user to 5 booking attempts per minute
  message: {
    success: false,
    message: 'Too many booking attempts, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler
});

/**
 * Review submission rate limiter
 */
const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each user to 10 reviews per hour
  message: {
    success: false,
    message: 'Too many review submissions, please try again later.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler
});

/**
 * Admin operations rate limiter
 */
const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each admin to 100 operations per minute
  message: {
    success: false,
    message: 'Too many admin operations, please slow down.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler
});

/**
 * Search rate limiter
 */
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each user to 30 searches per minute
  message: {
    success: false,
    message: 'Too many search requests, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler
});

/**
 * Slow down middleware for repeated requests
 */
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes, then...
  delayMs: 500, // begin adding 500ms of delay per request above 50
  maxDelayMs: 20000, // maximum delay of 20 seconds
  keyGenerator: generateKey,
  onLimitReached: (req, res, options) => {
    logger.logSecurityEvent('speed_limit_reached', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method,
      userId: req.user?.id || 'anonymous'
    });
  }
});

/**
 * Dynamic rate limiter based on user role
 */
const dynamicLimiter = (customerMax = 100, driverMax = 200, adminMax = 500) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
      if (req.user) {
        switch (req.user.role) {
          case 'admin':
            return adminMax;
          case 'driver':
            return driverMax;
          case 'customer':
            return customerMax;
          default:
            return customerMax;
        }
      }
      return 50; // Lower limit for unauthenticated users
    },
    message: {
      success: false,
      message: 'Rate limit exceeded for your user type.',
      retryAfter: 900
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: generateKey,
    handler: rateLimitHandler
  });
};

/**
 * Webhook rate limiter
 */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // allow high volume for webhooks
  message: {
    success: false,
    message: 'Webhook rate limit exceeded.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use a combination of IP and webhook source
    return `webhook-${req.ip}-${req.headers['x-webhook-source'] || 'unknown'}`;
  },
  handler: rateLimitHandler
});

/**
 * Location update rate limiter for drivers
 */
const locationUpdateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // allow 1 location update per second
  message: {
    success: false,
    message: 'Too many location updates, please slow down.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler
});

/**
 * Create custom rate limiter
 */
const createCustomLimiter = (options) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    message: {
      success: false,
      message: options.message || 'Rate limit exceeded.',
      retryAfter: Math.ceil((options.windowMs || 15 * 60 * 1000) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || generateKey,
    handler: options.handler || rateLimitHandler,
    ...options
  });
};

module.exports = {
  generalLimiter,
  authLimiter,
  otpLimiter,
  passwordResetLimiter,
  uploadLimiter,
  bookingLimiter,
  reviewLimiter,
  adminLimiter,
  searchLimiter,
  speedLimiter,
  dynamicLimiter,
  webhookLimiter,
  locationUpdateLimiter,
  createCustomLimiter
};
