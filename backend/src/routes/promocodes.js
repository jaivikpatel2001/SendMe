/**
 * PromoCode Routes
 * Handle all promo code-related endpoints with proper authentication and validation
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getPromoCodes,
  getPromoCodeById,
  createPromoCode,
  updatePromoCode,
  patchPromoCode,
  deletePromoCode,
  validatePromoCode,
  getApplicablePromoCodes
} = require('../controllers/promoCodeController');

const { protect, restrictTo } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

/**
 * @route   GET /api/promocodes/applicable
 * @desc    Get applicable promo codes for user
 * @access  Customer, Admin
 */
router.get('/applicable',
  restrictTo('customer', 'admin'),
  [
    query('orderValue').optional().isFloat({ min: 0 }).withMessage('Order value must be a positive number'),
    query('serviceType').optional().isIn(['delivery', 'pickup', 'moving', 'express', 'scheduled']).withMessage('Invalid service type'),
    query('vehicleType').optional().isMongoId().withMessage('Invalid vehicle type ID')
  ],
  getApplicablePromoCodes
);

/**
 * @route   POST /api/promocodes/validate
 * @desc    Validate promo code for user
 * @access  Customer, Admin
 */
router.post('/validate',
  restrictTo('customer', 'admin'),
  [
    body('code')
      .trim()
      .notEmpty()
      .withMessage('Promo code is required')
      .isLength({ min: 3, max: 20 })
      .withMessage('Promo code must be between 3 and 20 characters'),
    body('orderValue')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Order value must be a positive number'),
    body('serviceType')
      .optional()
      .isIn(['delivery', 'pickup', 'moving', 'express', 'scheduled'])
      .withMessage('Invalid service type'),
    body('vehicleType')
      .optional()
      .isMongoId()
      .withMessage('Invalid vehicle type ID')
  ],
  validatePromoCode
);

/**
 * @route   GET /api/promocodes
 * @desc    Get all promo codes with pagination and filtering
 * @access  Admin only
 */
router.get('/',
  restrictTo('admin'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['active', 'inactive', 'expired', 'exhausted']).withMessage('Invalid status'),
    query('discountType').optional().isIn(['percentage', 'fixed']).withMessage('Invalid discount type'),
    query('sortBy').optional().isIn(['createdAt', 'code', 'name', 'validFrom', 'validUntil']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    query('campaignType').optional().isIn(['acquisition', 'retention', 'reactivation', 'seasonal', 'referral', 'loyalty']).withMessage('Invalid campaign type')
  ],
  getPromoCodes
);

/**
 * @route   GET /api/promocodes/:id
 * @desc    Get single promo code by ID
 * @access  Admin only
 */
router.get('/:id',
  restrictTo('admin'),
  [
    param('id').isMongoId().withMessage('Invalid promo code ID')
  ],
  getPromoCodeById
);

/**
 * @route   POST /api/promocodes
 * @desc    Create new promo code
 * @access  Admin only
 */
router.post('/',
  restrictTo('admin'),
  [
    body('code')
      .optional()
      .trim()
      .isLength({ min: 3, max: 20 })
      .withMessage('Promo code must be between 3 and 20 characters')
      .matches(/^[A-Z0-9]+$/)
      .withMessage('Promo code can only contain uppercase letters and numbers'),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Promo name is required')
      .isLength({ max: 100 })
      .withMessage('Promo name cannot exceed 100 characters'),
    body('description')
      .trim()
      .notEmpty()
      .withMessage('Description is required')
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),
    body('discountType')
      .isIn(['percentage', 'fixed'])
      .withMessage('Discount type must be percentage or fixed'),
    body('discountValue')
      .isFloat({ min: 0 })
      .withMessage('Discount value must be a positive number'),
    body('minimumOrderValue')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum order value must be a positive number'),
    body('maximumDiscount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum discount must be a positive number'),
    body('validFrom')
      .isISO8601()
      .withMessage('Valid from date is required and must be in ISO format'),
    body('validUntil')
      .isISO8601()
      .withMessage('Valid until date is required and must be in ISO format'),
    body('usageLimit.total')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Total usage limit must be at least 1'),
    body('usageLimit.perUser')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Per user limit must be at least 1'),
    body('targetAudience.userTypes')
      .optional()
      .isArray()
      .withMessage('User types must be an array'),
    body('targetAudience.userTypes.*')
      .optional()
      .isIn(['customer', 'driver', 'all'])
      .withMessage('Invalid user type'),
    body('applicableServices')
      .optional()
      .isArray()
      .withMessage('Applicable services must be an array'),
    body('applicableServices.*')
      .optional()
      .isIn(['delivery', 'pickup', 'moving', 'express', 'scheduled', 'all'])
      .withMessage('Invalid service type')
  ],
  createPromoCode
);

/**
 * @route   PUT /api/promocodes/:id
 * @desc    Update promo code (full update)
 * @access  Admin only
 */
router.put('/:id',
  restrictTo('admin'),
  [
    param('id').isMongoId().withMessage('Invalid promo code ID'),
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Promo name cannot be empty')
      .isLength({ max: 100 })
      .withMessage('Promo name cannot exceed 100 characters'),
    body('description')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Description cannot be empty')
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),
    body('discountValue')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Discount value must be a positive number'),
    body('validFrom')
      .optional()
      .isISO8601()
      .withMessage('Valid from date must be in ISO format'),
    body('validUntil')
      .optional()
      .isISO8601()
      .withMessage('Valid until date must be in ISO format')
  ],
  updatePromoCode
);

/**
 * @route   PATCH /api/promocodes/:id
 * @desc    Partial update promo code
 * @access  Admin only
 */
router.patch('/:id',
  restrictTo('admin'),
  [
    param('id').isMongoId().withMessage('Invalid promo code ID')
  ],
  patchPromoCode
);

/**
 * @route   DELETE /api/promocodes/:id
 * @desc    Delete promo code (soft delete)
 * @access  Admin only
 */
router.delete('/:id',
  restrictTo('admin'),
  [
    param('id').isMongoId().withMessage('Invalid promo code ID')
  ],
  deletePromoCode
);

module.exports = router;
