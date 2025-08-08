/**
 * User Routes
 * Handle all user-related endpoints with proper authentication and validation
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  patchUser,
  deleteUser,
  updateUserStatus,
  updateDriverLocation,
  toggleDriverOnlineStatus,
  getNearbyDrivers
} = require('../controllers/userController');

const { protect, authorize } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination and filtering
 * @access  Admin only
 */
router.get('/',
  authorize('admin'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('role').optional().isIn(['customer', 'driver', 'admin']).withMessage('Invalid role'),
    query('status').optional().isIn(['pending', 'active', 'suspended', 'rejected', 'deleted']).withMessage('Invalid status'),
    query('sortBy').optional().isIn(['createdAt', 'firstName', 'lastName', 'email']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
  ],
  getUsers
);

/**
 * @route   GET /api/users/drivers/nearby
 * @desc    Get nearby drivers
 * @access  Admin, Customer
 */
router.get('/drivers/nearby',
  authorize('admin', 'customer'),
  [
    query('latitude').notEmpty().isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
    query('longitude').notEmpty().isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
    query('radius').optional().isFloat({ min: 1, max: 100 }).withMessage('Radius must be between 1 and 100 km'),
    query('vehicleType').optional().isMongoId().withMessage('Invalid vehicle type ID')
  ],
  getNearbyDrivers
);

/**
 * @route   GET /api/users/:id
 * @desc    Get single user by ID
 * @access  Admin or own profile
 */
router.get('/:id',
  [
    param('id').isMongoId().withMessage('Invalid user ID')
  ],
  getUserById
);

/**
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Admin only
 */
router.post('/',
  authorize('admin'),
  [
    body('firstName')
      .trim()
      .notEmpty()
      .withMessage('First name is required')
      .isLength({ max: 50 })
      .withMessage('First name cannot exceed 50 characters'),
    body('lastName')
      .trim()
      .notEmpty()
      .withMessage('Last name is required')
      .isLength({ max: 50 })
      .withMessage('Last name cannot exceed 50 characters'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('phone')
      .isMobilePhone()
      .withMessage('Valid phone number is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('role')
      .optional()
      .isIn(['customer', 'driver', 'admin'])
      .withMessage('Invalid role'),
    body('status')
      .optional()
      .isIn(['pending', 'active', 'suspended', 'rejected'])
      .withMessage('Invalid status')
  ],
  createUser
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user (full update)
 * @access  Admin or own profile
 */
router.put('/:id',
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('firstName')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('First name cannot be empty')
      .isLength({ max: 50 })
      .withMessage('First name cannot exceed 50 characters'),
    body('lastName')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Last name cannot be empty')
      .isLength({ max: 50 })
      .withMessage('Last name cannot exceed 50 characters'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('phone')
      .optional()
      .isMobilePhone()
      .withMessage('Valid phone number is required')
  ],
  updateUser
);

/**
 * @route   PATCH /api/users/:id
 * @desc    Partial update user
 * @access  Admin or own profile
 */
router.patch('/:id',
  [
    param('id').isMongoId().withMessage('Invalid user ID')
  ],
  patchUser
);

/**
 * @route   PATCH /api/users/:id/status
 * @desc    Update user status
 * @access  Admin only
 */
router.patch('/:id/status',
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('status')
      .isIn(['pending', 'active', 'suspended', 'rejected', 'deleted'])
      .withMessage('Invalid status'),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason cannot exceed 500 characters')
  ],
  updateUserStatus
);

/**
 * @route   PATCH /api/users/:id/location
 * @desc    Update driver location
 * @access  Driver only (own location)
 */
router.patch('/:id/location',
  authorize('driver'),
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Valid latitude is required'),
    body('longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Valid longitude is required')
  ],
  updateDriverLocation
);

/**
 * @route   PATCH /api/users/:id/online-status
 * @desc    Toggle driver online status
 * @access  Driver only (own status)
 */
router.patch('/:id/online-status',
  authorize('driver'),
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('isOnline')
      .isBoolean()
      .withMessage('isOnline must be a boolean value')
  ],
  toggleDriverOnlineStatus
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (soft delete)
 * @access  Admin only
 */
router.delete('/:id',
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid user ID')
  ],
  deleteUser
);

module.exports = router;
