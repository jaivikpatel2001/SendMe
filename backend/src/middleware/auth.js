/**
 * Authentication Middleware
 * Handle JWT token verification and role-based access control
 */

const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/User');
const { AppError, catchAsync } = require('./errorHandler');
const { verifyAccessToken, extractTokenFromHeader } = require('../utils/jwt');
const logger = require('../utils/logger');

/**
 * Protect routes - verify JWT token
 */
const protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    logger.logSecurityEvent('unauthorized_access_attempt', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method
    });
    
    return next(new AppError('You are not logged in! Please log in to get access.', 401));
  }

  try {
    // 2) Verification token
    const decoded = verifyAccessToken(token);

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id).select('+password');
    if (!currentUser) {
      logger.logSecurityEvent('token_user_not_found', {
        userId: decoded.id,
        ip: req.ip
      });
      
      return next(new AppError('The user belonging to this token does no longer exist.', 401));
    }

    // 4) Check if user is active
    if (currentUser.status !== 'active') {
      logger.logSecurityEvent('inactive_user_access_attempt', {
        userId: currentUser._id,
        status: currentUser.status,
        ip: req.ip
      });
      
      return next(new AppError('Your account is not active. Please contact support.', 401));
    }

    // 5) Check if user is locked
    if (currentUser.isLocked) {
      logger.logSecurityEvent('locked_user_access_attempt', {
        userId: currentUser._id,
        lockUntil: currentUser.lockUntil,
        ip: req.ip
      });
      
      return next(new AppError('Your account is temporarily locked due to multiple failed login attempts.', 423));
    }

    // 6) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      logger.logSecurityEvent('password_changed_after_token', {
        userId: currentUser._id,
        tokenIat: decoded.iat,
        passwordChangedAt: currentUser.passwordChangedAt
      });
      
      return next(new AppError('User recently changed password! Please log in again.', 401));
    }

    // 7) Update last login time
    currentUser.lastLogin = new Date();
    await currentUser.save({ validateBeforeSave: false });

    // Grant access to protected route
    req.user = currentUser;
    req.token = token;
    
    logger.logAuthEvent('access_granted', {
      userId: currentUser._id,
      role: currentUser.role,
      ip: req.ip,
      url: req.originalUrl
    });
    
    next();
  } catch (error) {
    logger.logSecurityEvent('token_verification_failed', {
      error: error.message,
      ip: req.ip,
      token: token.substring(0, 20) + '...'
    });
    
    return next(error);
  }
});

/**
 * Restrict access to specific roles
 * @param {...string} roles - Allowed roles
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      logger.logSecurityEvent('unauthorized_role_access', {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRoles: roles,
        ip: req.ip,
        url: req.originalUrl
      });
      
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      const currentUser = await User.findById(decoded.id);
      
      if (currentUser && currentUser.status === 'active' && !currentUser.isLocked) {
        req.user = currentUser;
        req.token = token;
      }
    } catch (error) {
      // Silently fail for optional auth
      logger.debug('Optional auth failed:', error.message);
    }
  }
  
  next();
});

/**
 * Check if user owns the resource or is admin
 * @param {string} resourceUserField - Field name that contains the user ID in the resource
 */
const checkOwnership = (resourceUserField = 'user') => {
  return (req, res, next) => {
    const resourceUserId = req.params.userId || req.body[resourceUserField] || req.resource?.[resourceUserField];
    
    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }
    
    // User can only access their own resources
    if (resourceUserId && resourceUserId.toString() !== req.user._id.toString()) {
      logger.logSecurityEvent('unauthorized_resource_access', {
        userId: req.user._id,
        attemptedResourceUserId: resourceUserId,
        ip: req.ip,
        url: req.originalUrl
      });
      
      return next(new AppError('You can only access your own resources', 403));
    }
    
    next();
  };
};

/**
 * Verify phone number ownership
 */
const verifyPhoneOwnership = catchAsync(async (req, res, next) => {
  const { phone } = req.body;
  
  if (!phone) {
    return next(new AppError('Phone number is required', 400));
  }
  
  // Check if phone belongs to current user (if authenticated)
  if (req.user && req.user.phone !== phone) {
    logger.logSecurityEvent('phone_ownership_violation', {
      userId: req.user._id,
      userPhone: req.user.phone,
      attemptedPhone: phone,
      ip: req.ip
    });
    
    return next(new AppError('You can only verify your own phone number', 403));
  }
  
  next();
});

/**
 * Check if user can access driver-specific routes
 */
const requireDriverAccess = (req, res, next) => {
  if (req.user.role !== 'driver' && req.user.role !== 'admin') {
    logger.logSecurityEvent('unauthorized_driver_access', {
      userId: req.user._id,
      userRole: req.user.role,
      ip: req.ip,
      url: req.originalUrl
    });
    
    return next(new AppError('Driver access required', 403));
  }
  
  // Check if driver is approved
  if (req.user.role === 'driver' && req.user.status !== 'active') {
    return next(new AppError('Your driver account is not approved yet', 403));
  }
  
  next();
};

/**
 * Check if user can access customer-specific routes
 */
const requireCustomerAccess = (req, res, next) => {
  if (req.user.role !== 'customer' && req.user.role !== 'admin') {
    logger.logSecurityEvent('unauthorized_customer_access', {
      userId: req.user._id,
      userRole: req.user.role,
      ip: req.ip,
      url: req.originalUrl
    });
    
    return next(new AppError('Customer access required', 403));
  }
  
  next();
};

/**
 * Check if user can access admin-specific routes
 */
const requireAdminAccess = (req, res, next) => {
  if (req.user.role !== 'admin') {
    logger.logSecurityEvent('unauthorized_admin_access', {
      userId: req.user._id,
      userRole: req.user.role,
      ip: req.ip,
      url: req.originalUrl
    });
    
    return next(new AppError('Admin access required', 403));
  }
  
  next();
};

/**
 * Rate limiting for sensitive operations
 */
const sensitiveOperationLimit = (maxAttempts = 3, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();
  
  return (req, res, next) => {
    const key = `${req.ip}-${req.user?._id || 'anonymous'}`;
    const now = Date.now();
    const userAttempts = attempts.get(key) || { count: 0, resetTime: now + windowMs };
    
    // Reset if window has passed
    if (now > userAttempts.resetTime) {
      userAttempts.count = 0;
      userAttempts.resetTime = now + windowMs;
    }
    
    // Check if limit exceeded
    if (userAttempts.count >= maxAttempts) {
      logger.logSecurityEvent('sensitive_operation_rate_limit', {
        userId: req.user?._id,
        ip: req.ip,
        attempts: userAttempts.count,
        url: req.originalUrl
      });
      
      return next(new AppError('Too many attempts. Please try again later.', 429));
    }
    
    // Increment attempts
    userAttempts.count++;
    attempts.set(key, userAttempts);
    
    next();
  };
};

/**
 * Validate API key for webhook endpoints
 */
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey || apiKey !== process.env.WEBHOOK_API_KEY) {
    logger.logSecurityEvent('invalid_api_key', {
      providedKey: apiKey ? apiKey.substring(0, 8) + '...' : 'none',
      ip: req.ip,
      url: req.originalUrl
    });
    
    return next(new AppError('Invalid API key', 401));
  }
  
  next();
};

// Backward-compatible alias for older route code
const authorize = (...roles) => restrictTo(...roles);

module.exports = {
  protect,
  restrictTo,
  optionalAuth,
  checkOwnership,
  verifyPhoneOwnership,
  requireDriverAccess,
  requireCustomerAccess,
  requireAdminAccess,
  sensitiveOperationLimit,
  validateApiKey,
  authorize
};
