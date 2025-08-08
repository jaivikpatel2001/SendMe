/**
 * Booking Routes
 * Handle all booking-related endpoints with proper authentication and validation
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getBookings,
  getBookingById,
  createBooking,
  updateBooking,
  patchBooking,
  cancelBooking,
  updateBookingStatus,
  assignDriver,
  updateBookingLocation,
  getBookingTracking,
  addBookingMessage
} = require('../controllers/bookingController');

const { protect, authorize } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

/**
 * @route   GET /api/bookings
 * @desc    Get all bookings with pagination and filtering
 * @access  Admin, Customer (own bookings), Driver (assigned bookings)
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['pending', 'confirmed', 'driver_assigned', 'picked_up', 'in_transit', 'delivered', 'completed', 'cancelled']).withMessage('Invalid status'),
    query('serviceType').optional().isIn(['delivery', 'pickup', 'moving', 'express', 'scheduled']).withMessage('Invalid service type'),
    query('sortBy').optional().isIn(['createdAt', 'scheduledFor', 'status']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
    query('customerId').optional().isMongoId().withMessage('Invalid customer ID'),
    query('driverId').optional().isMongoId().withMessage('Invalid driver ID')
  ],
  getBookings
);

/**
 * @route   GET /api/bookings/:id
 * @desc    Get single booking by ID
 * @access  Admin, Customer (own booking), Driver (assigned booking)
 */
router.get('/:id',
  [
    param('id').isMongoId().withMessage('Invalid booking ID')
  ],
  getBookingById
);

/**
 * @route   GET /api/bookings/:id/tracking
 * @desc    Get booking tracking information
 * @access  Customer (own booking), Driver (assigned booking), Admin
 */
router.get('/:id/tracking',
  [
    param('id').isMongoId().withMessage('Invalid booking ID')
  ],
  getBookingTracking
);

/**
 * @route   POST /api/bookings
 * @desc    Create new booking
 * @access  Customer, Admin
 */
router.post('/',
  authorize('customer', 'admin'),
  [
    body('serviceType')
      .isIn(['delivery', 'pickup', 'moving', 'express', 'scheduled'])
      .withMessage('Invalid service type'),
    body('vehicleType')
      .isMongoId()
      .withMessage('Valid vehicle type ID is required'),
    body('pickupLocation.address')
      .trim()
      .notEmpty()
      .withMessage('Pickup address is required'),
    body('pickupLocation.coordinates')
      .isArray({ min: 2, max: 2 })
      .withMessage('Pickup coordinates must be [longitude, latitude]'),
    body('dropLocation.address')
      .trim()
      .notEmpty()
      .withMessage('Drop address is required'),
    body('dropLocation.coordinates')
      .isArray({ min: 2, max: 2 })
      .withMessage('Drop coordinates must be [longitude, latitude]'),
    body('scheduledFor')
      .optional()
      .isISO8601()
      .withMessage('Invalid scheduled date format'),
    body('packageDetails.weight')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Weight must be a positive number'),
    body('packageDetails.dimensions.length')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Length must be a positive number'),
    body('packageDetails.dimensions.width')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Width must be a positive number'),
    body('packageDetails.dimensions.height')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Height must be a positive number'),
    body('specialInstructions')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Special instructions cannot exceed 500 characters'),
    body('promoCode')
      .optional()
      .trim()
      .isLength({ min: 3, max: 20 })
      .withMessage('Promo code must be between 3 and 20 characters')
  ],
  createBooking
);

/**
 * @route   POST /api/bookings/:id/messages
 * @desc    Add message to booking
 * @access  Customer (own booking), Driver (assigned booking), Admin
 */
router.post('/:id/messages',
  [
    param('id').isMongoId().withMessage('Invalid booking ID'),
    body('message')
      .trim()
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ max: 1000 })
      .withMessage('Message cannot exceed 1000 characters'),
    body('type')
      .optional()
      .isIn(['text', 'image', 'location'])
      .withMessage('Invalid message type')
  ],
  addBookingMessage
);

/**
 * @route   PUT /api/bookings/:id
 * @desc    Update booking (full update)
 * @access  Admin, Customer (before driver assigned)
 */
router.put('/:id',
  [
    param('id').isMongoId().withMessage('Invalid booking ID'),
    body('serviceType')
      .optional()
      .isIn(['delivery', 'pickup', 'moving', 'express', 'scheduled'])
      .withMessage('Invalid service type'),
    body('vehicleType')
      .optional()
      .isMongoId()
      .withMessage('Invalid vehicle type ID'),
    body('scheduledFor')
      .optional()
      .isISO8601()
      .withMessage('Invalid scheduled date format')
  ],
  updateBooking
);

/**
 * @route   PATCH /api/bookings/:id
 * @desc    Partial update booking
 * @access  Admin, Customer (before driver assigned)
 */
router.patch('/:id',
  [
    param('id').isMongoId().withMessage('Invalid booking ID')
  ],
  patchBooking
);

/**
 * @route   PATCH /api/bookings/:id/status
 * @desc    Update booking status
 * @access  Admin, Driver (assigned bookings)
 */
router.patch('/:id/status',
  authorize('admin', 'driver'),
  [
    param('id').isMongoId().withMessage('Invalid booking ID'),
    body('status')
      .isIn(['pending', 'confirmed', 'driver_assigned', 'picked_up', 'in_transit', 'delivered', 'completed', 'cancelled'])
      .withMessage('Invalid status'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Notes cannot exceed 500 characters')
  ],
  updateBookingStatus
);

/**
 * @route   PATCH /api/bookings/:id/assign-driver
 * @desc    Assign driver to booking
 * @access  Admin only
 */
router.patch('/:id/assign-driver',
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid booking ID'),
    body('driverId')
      .isMongoId()
      .withMessage('Valid driver ID is required')
  ],
  assignDriver
);

/**
 * @route   PATCH /api/bookings/:id/location
 * @desc    Update booking location tracking
 * @access  Driver (assigned to booking)
 */
router.patch('/:id/location',
  authorize('driver'),
  [
    param('id').isMongoId().withMessage('Invalid booking ID'),
    body('latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Valid latitude is required'),
    body('longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Valid longitude is required')
  ],
  updateBookingLocation
);

/**
 * @route   DELETE /api/bookings/:id
 * @desc    Cancel booking
 * @access  Admin, Customer, Driver
 */
router.delete('/:id',
  [
    param('id').isMongoId().withMessage('Invalid booking ID'),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason cannot exceed 500 characters')
  ],
  cancelBooking
);

module.exports = router;
