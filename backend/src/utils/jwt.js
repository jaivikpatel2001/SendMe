/**
 * JWT Utility Functions
 * Handle JWT token generation, verification, and refresh token management
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { AppError } = require('../middleware/errorHandler');
const logger = require('./logger');

// In-memory blacklist for revoked tokens (in production, use Redis)
const tokenBlacklist = new Set();

/**
 * Generate JWT access token
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {string} JWT token
 */
const generateAccessToken = (userId, role) => {
  const payload = {
    id: userId,
    role: role,
    type: 'access',
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m',
    issuer: 'sendme-logistics',
    audience: 'sendme-users'
  });
};

/**
 * Generate JWT refresh token
 * @param {string} userId - User ID
 * @returns {string} Refresh token
 */
const generateRefreshToken = (userId) => {
  const payload = {
    id: userId,
    type: 'refresh',
    tokenId: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
    issuer: 'sendme-logistics',
    audience: 'sendme-users'
  });
};

/**
 * Generate both access and refresh tokens
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Object} Token pair
 */
const generateTokenPair = (userId, role) => {
  const accessToken = generateAccessToken(userId, role);
  const refreshToken = generateRefreshToken(userId);

  logger.logAuthEvent('tokens_generated', {
    userId,
    role,
    tokenType: 'access_refresh_pair'
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRE || '15m'
  };
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @param {string} secret - JWT secret
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token, secret) => {
  try {
    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      throw new AppError('Token has been revoked', 401);
    }

    const decoded = jwt.verify(token, secret, {
      issuer: 'sendme-logistics',
      audience: 'sendme-users'
    });

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Token has expired', 401);
    }
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid token', 401);
    }
    if (error.name === 'NotBeforeError') {
      throw new AppError('Token not active yet', 401);
    }
    throw error;
  }
};

/**
 * Verify access token
 * @param {string} token - Access token
 * @returns {Object} Decoded token payload
 */
const verifyAccessToken = (token) => {
  return verifyToken(token, process.env.JWT_SECRET);
};

/**
 * Verify refresh token
 * @param {string} token - Refresh token
 * @returns {Object} Decoded token payload
 */
const verifyRefreshToken = (token) => {
  return verifyToken(token, process.env.JWT_REFRESH_SECRET);
};

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @param {string} userRole - User role from database
 * @returns {Object} New token pair
 */
const refreshAccessToken = (refreshToken, userRole) => {
  try {
    const decoded = verifyRefreshToken(refreshToken);
    
    if (decoded.type !== 'refresh') {
      throw new AppError('Invalid token type', 401);
    }

    // Blacklist the old refresh token
    tokenBlacklist.add(refreshToken);

    // Generate new token pair
    const newTokens = generateTokenPair(decoded.id, userRole);

    logger.logAuthEvent('token_refreshed', {
      userId: decoded.id,
      oldTokenId: decoded.tokenId
    });

    return newTokens;
  } catch (error) {
    logger.logSecurityEvent('token_refresh_failed', {
      error: error.message,
      refreshToken: refreshToken.substring(0, 20) + '...'
    });
    throw error;
  }
};

/**
 * Blacklist a token (logout)
 * @param {string} token - Token to blacklist
 */
const blacklistToken = (token) => {
  tokenBlacklist.add(token);
  
  logger.logAuthEvent('token_blacklisted', {
    tokenPrefix: token.substring(0, 20) + '...'
  });
};

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Extracted token
 */
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

/**
 * Generate OTP token for verification
 * @param {string} phone - Phone number
 * @param {string} otp - OTP code
 * @returns {string} OTP token
 */
const generateOTPToken = (phone, otp) => {
  const payload = {
    phone,
    otp,
    type: 'otp_verification',
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '10m', // OTP valid for 10 minutes
    issuer: 'sendme-logistics',
    audience: 'sendme-otp'
  });
};

/**
 * Verify OTP token
 * @param {string} token - OTP token
 * @returns {Object} Decoded OTP payload
 */
const verifyOTPToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'sendme-logistics',
      audience: 'sendme-otp'
    });

    if (decoded.type !== 'otp_verification') {
      throw new AppError('Invalid OTP token type', 401);
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('OTP has expired. Please request a new one.', 401);
    }
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid OTP token', 401);
    }
    throw error;
  }
};

/**
 * Generate password reset token
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {string} Password reset token
 */
const generatePasswordResetToken = (userId, email) => {
  const payload = {
    id: userId,
    email,
    type: 'password_reset',
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '1h', // Password reset valid for 1 hour
    issuer: 'sendme-logistics',
    audience: 'sendme-reset'
  });
};

/**
 * Verify password reset token
 * @param {string} token - Password reset token
 * @returns {Object} Decoded reset payload
 */
const verifyPasswordResetToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'sendme-logistics',
      audience: 'sendme-reset'
    });

    if (decoded.type !== 'password_reset') {
      throw new AppError('Invalid reset token type', 401);
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Password reset token has expired', 401);
    }
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid password reset token', 401);
    }
    throw error;
  }
};

/**
 * Clean up expired tokens from blacklist
 * This should be called periodically (e.g., via cron job)
 */
const cleanupBlacklist = () => {
  // In a real application, this would clean up expired tokens from Redis
  // For now, we'll just log the cleanup
  logger.info('Token blacklist cleanup performed', {
    blacklistedTokens: tokenBlacklist.size
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  refreshAccessToken,
  blacklistToken,
  extractTokenFromHeader,
  generateOTPToken,
  verifyOTPToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  cleanupBlacklist
};
