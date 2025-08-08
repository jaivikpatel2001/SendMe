/**
 * Driver Routes
 * Handle all driver-specific endpoints
 */

const express = require('express');
const {
  registerDriver,
  getDashboard,
  toggleOnlineStatus,
  getJobRequests,
  acceptJobRequest,
  rejectJobRequest,
  updateTripStatus,
  getEarnings,
  getPayouts,
  requestPayout
} = require('../controllers/driverController');

const {
  validateDriverRegistration,
  validateUpdateBookingStatus,
  validatePagination,
  validateObjectId,
  validateDateRange
} = require('../middleware/validation');

const {
  protect,
  requireDriverAccess
} = require('../middleware/auth');

const {
  generalLimiter,
  searchLimiter,
  locationUpdateLimiter,
  authLimiter
} = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @route   POST /api/driver/register
 * @desc    Register as a driver
 * @access  Public
 */
router.post('/register', authLimiter, validateDriverRegistration, registerDriver);

// Apply authentication and driver access to protected routes
router.use(protect);
router.use(requireDriverAccess);

/**
 * @route   GET /api/driver/dashboard
 * @desc    Get driver dashboard with stats and active trips
 * @access  Private (Driver)
 */
router.get('/dashboard', generalLimiter, getDashboard);

/**
 * @route   PUT /api/driver/status
 * @desc    Toggle driver online/offline status
 * @access  Private (Driver)
 */
router.put('/status', locationUpdateLimiter, toggleOnlineStatus);

/**
 * @route   GET /api/driver/job-requests
 * @desc    Get available job requests near driver location
 * @access  Private (Driver)
 */
router.get('/job-requests', searchLimiter, validatePagination, getJobRequests);

/**
 * @route   PUT /api/driver/job-requests/:id/accept
 * @desc    Accept a job request
 * @access  Private (Driver)
 */
router.put('/job-requests/:id/accept', generalLimiter, validateObjectId('id'), acceptJobRequest);

/**
 * @route   PUT /api/driver/job-requests/:id/reject
 * @desc    Reject a job request
 * @access  Private (Driver)
 */
router.put('/job-requests/:id/reject', generalLimiter, validateObjectId('id'), rejectJobRequest);

/**
 * @route   PUT /api/driver/trips/:id/status
 * @desc    Update trip status (pickup, delivery, etc.)
 * @access  Private (Driver)
 */
router.put('/trips/:id/status', generalLimiter, validateObjectId('id'), validateUpdateBookingStatus, updateTripStatus);

/**
 * @route   GET /api/driver/earnings
 * @desc    Get driver earnings with date range and breakdown
 * @access  Private (Driver)
 */
router.get('/earnings', generalLimiter, validateDateRange, getEarnings);

/**
 * @route   GET /api/driver/payouts
 * @desc    Get payout history and available balance
 * @access  Private (Driver)
 */
router.get('/payouts', generalLimiter, getPayouts);

/**
 * @route   POST /api/driver/payouts
 * @desc    Request payout to bank account
 * @access  Private (Driver)
 */
router.post('/payouts', generalLimiter, requestPayout);

module.exports = router;
