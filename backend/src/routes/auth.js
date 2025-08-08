/**
 * Authentication Routes
 * Handle all authentication-related endpoints
 */

const express = require('express');
const {
  register,
  login,
  requestOTP,
  verifyOTP,
  refreshToken,
  logout,
  socialLogin,
  getMe
} = require('../controllers/authController');

const {
  validateRegister,
  validateLogin,
  validateOTPRequest,
  validateOTPVerify,
  validateRefreshToken
} = require('../middleware/validation');

const { protect } = require('../middleware/auth');
const { authLimiter, otpLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', authLimiter, validateRegister, register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user with email and password
 * @access  Public
 */
router.post('/login', authLimiter, validateLogin, login);

/**
 * @route   POST /api/auth/otp-request
 * @desc    Request OTP for phone verification
 * @access  Public
 */
router.post('/otp-request', otpLimiter, validateOTPRequest, requestOTP);

/**
 * @route   POST /api/auth/otp-verify
 * @desc    Verify OTP and login/register user
 * @access  Public
 */
router.post('/otp-verify', authLimiter, validateOTPVerify, verifyOTP);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh-token', validateRefreshToken, refreshToken);

/**
 * @route   POST /api/auth/social-login
 * @desc    Social authentication (Google/Facebook)
 * @access  Public
 */
router.post('/social-login', authLimiter, socialLogin);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and blacklist token
 * @access  Private
 */
router.post('/logout', protect, logout);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', protect, getMe);

module.exports = router;
