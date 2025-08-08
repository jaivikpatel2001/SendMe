/**
 * Admin Routes
 * Handle all admin-specific endpoints
 */

const express = require('express');
const {
  getDashboard,
  getUsers,
  updateUserStatus,
  getBookings,
  getBookingDetails,
  createPromoCode,
  getPromoCodes,
  updatePromoCode,
  getSupportTickets,
  assignSupportTicket,
  getAnalytics,
  getSystemHealth
} = require('../controllers/adminController');

const {
  validateUpdateUserStatus,
  validateCreatePromoCode,
  validatePagination,
  validateObjectId,
  validateDateRange
} = require('../middleware/validation');

const { 
  protect, 
  requireAdminAccess 
} = require('../middleware/auth');

const { 
  adminLimiter,
  generalLimiter,
  searchLimiter 
} = require('../middleware/rateLimiter');

const router = express.Router();

// Apply authentication and admin access to all routes
router.use(protect);
router.use(requireAdminAccess);

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get admin dashboard with platform statistics
 * @access  Private (Admin)
 */
router.get('/dashboard', generalLimiter, getDashboard);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with pagination and filters
 * @access  Private (Admin)
 */
router.get('/users', searchLimiter, validatePagination, getUsers);

/**
 * @route   PUT /api/admin/users/:id/status
 * @desc    Update user status (approve/reject/suspend)
 * @access  Private (Admin)
 */
router.put('/users/:id/status', adminLimiter, validateObjectId('id'), validateUpdateUserStatus, updateUserStatus);

/**
 * @route   GET /api/admin/bookings
 * @desc    Get all bookings with filters and pagination
 * @access  Private (Admin)
 */
router.get('/bookings', searchLimiter, validatePagination, validateDateRange, getBookings);

/**
 * @route   GET /api/admin/bookings/:id
 * @desc    Get detailed booking information
 * @access  Private (Admin)
 */
router.get('/bookings/:id', generalLimiter, validateObjectId('id'), getBookingDetails);

/**
 * @route   POST /api/admin/promo-codes
 * @desc    Create new promo code
 * @access  Private (Admin)
 */
router.post('/promo-codes', adminLimiter, validateCreatePromoCode, createPromoCode);

/**
 * @route   GET /api/admin/promo-codes
 * @desc    Get all promo codes with pagination
 * @access  Private (Admin)
 */
router.get('/promo-codes', searchLimiter, validatePagination, getPromoCodes);

/**
 * @route   PUT /api/admin/promo-codes/:id
 * @desc    Update promo code
 * @access  Private (Admin)
 */
router.put('/promo-codes/:id', adminLimiter, validateObjectId('id'), updatePromoCode);

/**
 * @route   GET /api/admin/support-tickets
 * @desc    Get all support tickets with filters
 * @access  Private (Admin)
 */
router.get('/support-tickets', searchLimiter, validatePagination, getSupportTickets);

/**
 * @route   PUT /api/admin/support-tickets/:id/assign
 * @desc    Assign support ticket to agent
 * @access  Private (Admin)
 */
router.put('/support-tickets/:id/assign', adminLimiter, validateObjectId('id'), assignSupportTicket);

/**
 * @route   GET /api/admin/analytics
 * @desc    Get platform analytics and reports
 * @access  Private (Admin)
 */
router.get('/analytics', generalLimiter, validateDateRange, getAnalytics);

/**
 * @route   GET /api/admin/system-health
 * @desc    Get system health and monitoring data
 * @access  Private (Admin)
 */
router.get('/system-health', generalLimiter, getSystemHealth);

module.exports = router;
