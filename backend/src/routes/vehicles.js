/**
 * Vehicle Routes
 * Handle all vehicle type-related endpoints with proper authentication and validation
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  patchVehicle,
  deleteVehicle,
  updateVehicleAvailability,
  updateVehiclePricing
} = require('../controllers/vehicleController');

const { protect, restrictTo } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @route   GET /api/vehicles
 * @desc    Get all vehicle types with pagination and filtering
 * @access  Public
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['active', 'inactive', 'maintenance', 'deprecated']).withMessage('Invalid status'),
    query('sortBy').optional().isIn(['sortOrder', 'name', 'basePrice', 'createdAt']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    query('category').optional().trim().isLength({ min: 1 }).withMessage('Category cannot be empty')
  ],
  getVehicles
);

/**
 * @route   GET /api/vehicles/:id
 * @desc    Get single vehicle type by ID
 * @access  Public
 */
router.get('/:id',
  [
    param('id').isMongoId().withMessage('Invalid vehicle ID')
  ],
  getVehicleById
);

// Apply authentication to routes that require it
router.use(protect);

/**
 * @route   POST /api/vehicles
 * @desc    Create new vehicle type
 * @access  Admin only
 */
router.post('/',
  restrictTo('admin'),
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Vehicle name is required')
      .isLength({ max: 100 })
      .withMessage('Vehicle name cannot exceed 100 characters'),
    body('description')
      .trim()
      .notEmpty()
      .withMessage('Description is required')
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),
    body('category')
      .trim()
      .notEmpty()
      .withMessage('Category is required'),
    body('pricing.basePrice')
      .isFloat({ min: 0 })
      .withMessage('Base price must be a positive number'),
    body('pricing.pricePerKm')
      .isFloat({ min: 0 })
      .withMessage('Price per km must be a positive number'),
    body('pricing.minimumFare')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum fare must be a positive number'),
    body('capacity.maxWeight')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Max weight must be a positive number'),
    body('capacity.maxVolume')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Max volume must be a positive number'),
    body('dimensions.length')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Length must be a positive number'),
    body('dimensions.width')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Width must be a positive number'),
    body('dimensions.height')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Height must be a positive number'),
    body('sortOrder')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Sort order must be a non-negative integer')
  ],
  createVehicle
);

/**
 * @route   PUT /api/vehicles/:id
 * @desc    Update vehicle type (full update)
 * @access  Admin only
 */
router.put('/:id',
  restrictTo('admin'),
  [
    param('id').isMongoId().withMessage('Invalid vehicle ID'),
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Vehicle name cannot be empty')
      .isLength({ max: 100 })
      .withMessage('Vehicle name cannot exceed 100 characters'),
    body('description')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Description cannot be empty')
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),
    body('pricing.basePrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Base price must be a positive number'),
    body('pricing.pricePerKm')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Price per km must be a positive number')
  ],
  updateVehicle
);

/**
 * @route   PATCH /api/vehicles/:id
 * @desc    Partial update vehicle type
 * @access  Admin only
 */
router.patch('/:id',
  restrictTo('admin'),
  [
    param('id').isMongoId().withMessage('Invalid vehicle ID')
  ],
  patchVehicle
);

/**
 * @route   PATCH /api/vehicles/:id/availability
 * @desc    Update vehicle availability
 * @access  Admin only
 */
router.patch('/:id/availability',
  restrictTo('admin'),
  [
    param('id').isMongoId().withMessage('Invalid vehicle ID'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean value'),
    body('availabilityZones')
      .optional()
      .isArray()
      .withMessage('Availability zones must be an array'),
    body('timeSlots')
      .optional()
      .isArray()
      .withMessage('Time slots must be an array')
  ],
  updateVehicleAvailability
);

/**
 * @route   PATCH /api/vehicles/:id/pricing
 * @desc    Update vehicle pricing
 * @access  Admin only
 */
router.patch('/:id/pricing',
  restrictTo('admin'),
  [
    param('id').isMongoId().withMessage('Invalid vehicle ID'),
    body('basePrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Base price must be a positive number'),
    body('pricePerKm')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Price per km must be a positive number'),
    body('pricePerMinute')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Price per minute must be a positive number'),
    body('minimumFare')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum fare must be a positive number'),
    body('surgeMultiplier')
      .optional()
      .isFloat({ min: 1 })
      .withMessage('Surge multiplier must be at least 1')
  ],
  updateVehiclePricing
);

/**
 * @route   DELETE /api/vehicles/:id
 * @desc    Delete vehicle type (soft delete)
 * @access  Admin only
 */
router.delete('/:id',
  restrictTo('admin'),
  [
    param('id').isMongoId().withMessage('Invalid vehicle ID')
  ],
  deleteVehicle
);

module.exports = router;
