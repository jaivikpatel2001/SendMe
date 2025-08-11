/**
 * Review Routes
 * Handle all review-related endpoints with proper authentication and validation
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getReviews,
  getReviewById,
  createReview,
  updateReview,
  patchReview,
  deleteReview,
  moderateReview,
  voteOnReview,
  addReviewResponse,
  getUserRatingSummary
} = require('../controllers/reviewController');

const { protect, restrictTo } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @route   GET /api/reviews/user/:userId/summary
 * @desc    Get user's rating summary
 * @access  Public
 */
router.get('/user/:userId/summary',
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    query('reviewType').optional().isIn(['customer_to_driver', 'driver_to_customer']).withMessage('Invalid review type')
  ],
  getUserRatingSummary
);

// Apply authentication to all other routes
router.use(protect);

/**
 * @route   GET /api/reviews
 * @desc    Get all reviews with pagination and filtering
 * @access  Admin, Customer (own reviews), Driver (own reviews)
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('reviewType').optional().isIn(['customer_to_driver', 'driver_to_customer']).withMessage('Invalid review type'),
    query('status').optional().isIn(['pending', 'approved', 'rejected', 'hidden']).withMessage('Invalid status'),
    query('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    query('sortBy').optional().isIn(['createdAt', 'rating', 'helpfulVotes']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    query('reviewerId').optional().isMongoId().withMessage('Invalid reviewer ID'),
    query('revieweeId').optional().isMongoId().withMessage('Invalid reviewee ID')
  ],
  getReviews
);

/**
 * @route   GET /api/reviews/:id
 * @desc    Get single review by ID
 * @access  Admin, Reviewer, Reviewee
 */
router.get('/:id',
  [
    param('id').isMongoId().withMessage('Invalid review ID')
  ],
  getReviewById
);

/**
 * @route   POST /api/reviews
 * @desc    Create new review
 * @access  Customer, Driver
 */
router.post('/',
  restrictTo('customer', 'driver'),
  [
    body('bookingId')
      .isMongoId()
      .withMessage('Valid booking ID is required'),
    body('revieweeId')
      .isMongoId()
      .withMessage('Valid reviewee ID is required'),
    body('reviewType')
      .isIn(['customer_to_driver', 'driver_to_customer'])
      .withMessage('Invalid review type'),
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('review')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Review cannot exceed 1000 characters'),
    body('detailedRatings.punctuality')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Punctuality rating must be between 1 and 5'),
    body('detailedRatings.communication')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Communication rating must be between 1 and 5'),
    body('detailedRatings.professionalism')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Professionalism rating must be between 1 and 5'),
    body('detailedRatings.carHandling')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Car handling rating must be between 1 and 5'),
    body('detailedRatings.packageCondition')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Package condition rating must be between 1 and 5'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('tags.*')
      .optional()
      .isIn([
        'excellent_service', 'on_time', 'professional', 'friendly', 'careful_handling',
        'clean_vehicle', 'good_communication', 'fast_delivery', 'helpful', 'courteous',
        'late', 'unprofessional', 'poor_communication', 'damaged_package', 'rude_behavior',
        'dirty_vehicle', 'careless_handling'
      ])
      .withMessage('Invalid tag')
  ],
  createReview
);

/**
 * @route   POST /api/reviews/:id/vote
 * @desc    Vote on review helpfulness
 * @access  Authenticated users
 */
router.post('/:id/vote',
  [
    param('id').isMongoId().withMessage('Invalid review ID'),
    body('voteType')
      .isIn(['helpful', 'unhelpful'])
      .withMessage('Vote type must be helpful or unhelpful')
  ],
  voteOnReview
);

/**
 * @route   POST /api/reviews/:id/response
 * @desc    Add response to review
 * @access  Reviewee only
 */
router.post('/:id/response',
  [
    param('id').isMongoId().withMessage('Invalid review ID'),
    body('content')
      .trim()
      .notEmpty()
      .withMessage('Response content is required')
      .isLength({ max: 500 })
      .withMessage('Response cannot exceed 500 characters')
  ],
  addReviewResponse
);

/**
 * @route   PUT /api/reviews/:id
 * @desc    Update review (full update)
 * @access  Reviewer (own review), Admin
 */
router.put('/:id',
  [
    param('id').isMongoId().withMessage('Invalid review ID'),
    body('rating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('review')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Review cannot exceed 1000 characters'),
    body('detailedRatings.punctuality')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Punctuality rating must be between 1 and 5'),
    body('detailedRatings.communication')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Communication rating must be between 1 and 5'),
    body('detailedRatings.professionalism')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Professionalism rating must be between 1 and 5')
  ],
  updateReview
);

/**
 * @route   PATCH /api/reviews/:id
 * @desc    Partial update review
 * @access  Reviewer (own review), Admin
 */
router.patch('/:id',
  [
    param('id').isMongoId().withMessage('Invalid review ID')
  ],
  patchReview
);

/**
 * @route   PATCH /api/reviews/:id/moderate
 * @desc    Moderate review (approve/reject/hide)
 * @access  Admin only
 */
router.patch('/:id/moderate',
  restrictTo('admin'),
  [
    param('id').isMongoId().withMessage('Invalid review ID'),
    body('status')
      .isIn(['pending', 'approved', 'rejected', 'hidden'])
      .withMessage('Invalid status'),
    body('moderationNotes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Moderation notes cannot exceed 500 characters')
  ],
  moderateReview
);

/**
 * @route   DELETE /api/reviews/:id
 * @desc    Delete review
 * @access  Admin only
 */
router.delete('/:id',
  restrictTo('admin'),
  [
    param('id').isMongoId().withMessage('Invalid review ID')
  ],
  deleteReview
);

module.exports = router;
