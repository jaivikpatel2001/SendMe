/**
 * Customer Routes
 * Handle all customer-specific endpoints
 */

const express = require('express');
const {
  getDashboard,
  createBooking,
  getBooking,
  getBookingHistory,
  rebookOrder,
  getLiveTracking,
  submitReview,
  getNotifications,
  markNotificationRead,
  updateProfile,
  updatePaymentMethods,
  createSupportTicket,
  getFAQs
} = require('../controllers/customerController');

const {
  validateCreateBooking,
  validateUpdateBookingStatus,
  validateSubmitReview,
  validateUpdateProfile,
  validatePagination,
  validateObjectId
} = require('../middleware/validation');

const { 
  protect, 
  requireCustomerAccess,
  checkOwnership 
} = require('../middleware/auth');

const { 
  generalLimiter,
  bookingLimiter,
  reviewLimiter,
  searchLimiter 
} = require('../middleware/rateLimiter');

const router = express.Router();

// Apply authentication and customer access to all routes
router.use(protect);
router.use(requireCustomerAccess);

/**
 * @route   GET /api/customer/dashboard
 * @desc    Get customer dashboard data
 * @access  Private (Customer)
 */
router.get('/dashboard', generalLimiter, getDashboard);

/**
 * @route   POST /api/customer/bookings
 * @desc    Create a new booking
 * @access  Private (Customer)
 */
router.post('/bookings', bookingLimiter, validateCreateBooking, createBooking);

/**
 * @route   GET /api/customer/bookings/:id
 * @desc    Get specific booking details
 * @access  Private (Customer)
 */
router.get('/bookings/:id', generalLimiter, validateObjectId('id'), getBooking);

/**
 * @route   GET /api/customer/bookings-history
 * @desc    Get booking history with pagination and filters
 * @access  Private (Customer)
 */
router.get('/bookings-history', searchLimiter, validatePagination, getBookingHistory);

/**
 * @route   PUT /api/customer/bookings/:id/rebook
 * @desc    Create new booking based on previous booking
 * @access  Private (Customer)
 */
router.put('/bookings/:id/rebook', bookingLimiter, validateObjectId('id'), rebookOrder);

/**
 * @route   GET /api/customer/live-tracking/:id
 * @desc    Get real-time tracking for active booking
 * @access  Private (Customer)
 */
router.get('/live-tracking/:id', generalLimiter, validateObjectId('id'), getLiveTracking);

/**
 * @route   POST /api/customer/reviews
 * @desc    Submit review for completed booking
 * @access  Private (Customer)
 */
router.post('/reviews', reviewLimiter, validateSubmitReview, submitReview);

/**
 * @route   GET /api/customer/notifications
 * @desc    Get customer notifications with pagination
 * @access  Private (Customer)
 */
router.get('/notifications', generalLimiter, validatePagination, getNotifications);

/**
 * @route   PUT /api/customer/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private (Customer)
 */
router.put('/notifications/:id/read', generalLimiter, validateObjectId('id'), markNotificationRead);

/**
 * @route   PUT /api/customer/profile
 * @desc    Update customer profile information
 * @access  Private (Customer)
 */
router.put('/profile', generalLimiter, validateUpdateProfile, updateProfile);

/**
 * @route   PUT /api/customer/payment-methods
 * @desc    Update saved payment methods and preferences
 * @access  Private (Customer)
 */
router.put('/payment-methods', generalLimiter, updatePaymentMethods);

/**
 * @route   POST /api/customer/support
 * @desc    Create support ticket
 * @access  Private (Customer)
 */
router.post('/support', generalLimiter, createSupportTicket);

/**
 * @route   GET /api/customer/faqs
 * @desc    Get customer-specific FAQs
 * @access  Private (Customer)
 */
router.get('/faqs', generalLimiter, getFAQs);

module.exports = router;
