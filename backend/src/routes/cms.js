/**
 * CMS Routes
 * Handle all CMS content-related endpoints with proper authentication and validation
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getCmsContent,
  getCmsContentById,
  createCmsContent,
  updateCmsContent,
  patchCmsContent,
  deleteCmsContent,
  publishContent
} = require('../controllers/cmsController');

const { protect, authorize } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @route   GET /api/cms
 * @desc    Get all CMS content with pagination and filtering
 * @access  Admin (all), Public (published only)
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('type').optional().isIn(['page', 'post', 'template', 'email', 'notification']).withMessage('Invalid content type'),
    query('status').optional().isIn(['draft', 'published', 'archived', 'scheduled']).withMessage('Invalid status'),
    query('category').optional().isIn([
      'legal', 'help', 'marketing', 'system', 'onboarding', 'notification', 'email', 'sms', 'general'
    ]).withMessage('Invalid category'),
    query('visibility').optional().isIn(['public', 'private', 'restricted']).withMessage('Invalid visibility'),
    query('sortBy').optional().isIn(['createdAt', 'title', 'publishAt', 'views']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    query('language').optional().isLength({ min: 2, max: 5 }).withMessage('Invalid language code')
  ],
  getCmsContent
);

/**
 * @route   GET /api/cms/:identifier
 * @desc    Get single CMS content by ID or slug
 * @access  Admin (all), Public (published only)
 */
router.get('/:identifier',
  [
    param('identifier').notEmpty().withMessage('Content identifier is required')
  ],
  getCmsContentById
);

// Apply authentication to routes that require it
router.use(protect);

/**
 * @route   POST /api/cms
 * @desc    Create new CMS content
 * @access  Admin only
 */
router.post('/',
  authorize('admin'),
  [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ max: 200 })
      .withMessage('Title cannot exceed 200 characters'),
    body('type')
      .isIn(['page', 'post', 'template', 'email', 'notification'])
      .withMessage('Invalid content type'),
    body('language')
      .optional()
      .isLength({ min: 2, max: 5 })
      .withMessage('Invalid language code'),
    body('slug')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Slug cannot exceed 200 characters')
      .matches(/^[a-z0-9-]+$/)
      .withMessage('Slug can only contain lowercase letters, numbers, and hyphens'),
    body('content.html')
      .optional()
      .trim()
      .isLength({ max: 50000 })
      .withMessage('HTML content cannot exceed 50,000 characters'),
    body('content.text')
      .optional()
      .trim()
      .isLength({ max: 50000 })
      .withMessage('Text content cannot exceed 50,000 characters'),
    body('content.markdown')
      .optional()
      .trim()
      .isLength({ max: 50000 })
      .withMessage('Markdown content cannot exceed 50,000 characters'),
    body('excerpt')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Excerpt cannot exceed 500 characters'),
    body('metaTitle')
      .optional()
      .trim()
      .isLength({ max: 60 })
      .withMessage('Meta title cannot exceed 60 characters'),
    body('metaDescription')
      .optional()
      .trim()
      .isLength({ max: 160 })
      .withMessage('Meta description cannot exceed 160 characters'),
    body('category')
      .optional()
      .isIn(['legal', 'help', 'marketing', 'system', 'onboarding', 'notification', 'email', 'sms', 'general'])
      .withMessage('Invalid category'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('tags.*')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Each tag must be between 1 and 50 characters'),
    body('status')
      .optional()
      .isIn(['draft', 'published', 'archived', 'scheduled'])
      .withMessage('Invalid status'),
    body('visibility')
      .optional()
      .isIn(['public', 'private', 'restricted'])
      .withMessage('Invalid visibility'),
    body('publishAt')
      .optional()
      .isISO8601()
      .withMessage('Invalid publish date format'),
    body('unpublishAt')
      .optional()
      .isISO8601()
      .withMessage('Invalid unpublish date format'),
    body('featuredImage')
      .optional()
      .isURL()
      .withMessage('Featured image must be a valid URL'),
    body('content.images')
      .optional()
      .isArray()
      .withMessage('Images must be an array'),
    body('content.images.*.url')
      .optional()
      .isURL()
      .withMessage('Image URL must be valid'),
    body('content.videos')
      .optional()
      .isArray()
      .withMessage('Videos must be an array'),
    body('content.videos.*.url')
      .optional()
      .isURL()
      .withMessage('Video URL must be valid')
  ],
  createCmsContent
);

/**
 * @route   PUT /api/cms/:id
 * @desc    Update CMS content (full update)
 * @access  Admin only
 */
router.put('/:id',
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid content ID'),
    body('title')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Title cannot be empty')
      .isLength({ max: 200 })
      .withMessage('Title cannot exceed 200 characters'),
    body('content.html')
      .optional()
      .trim()
      .isLength({ max: 50000 })
      .withMessage('HTML content cannot exceed 50,000 characters'),
    body('content.text')
      .optional()
      .trim()
      .isLength({ max: 50000 })
      .withMessage('Text content cannot exceed 50,000 characters'),
    body('excerpt')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Excerpt cannot exceed 500 characters'),
    body('changeLog')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Change log cannot exceed 500 characters')
  ],
  updateCmsContent
);

/**
 * @route   PATCH /api/cms/:id
 * @desc    Partial update CMS content
 * @access  Admin only
 */
router.patch('/:id',
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid content ID')
  ],
  patchCmsContent
);

/**
 * @route   PATCH /api/cms/:id/publish
 * @desc    Publish/unpublish CMS content
 * @access  Admin only
 */
router.patch('/:id/publish',
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid content ID'),
    body('status')
      .isIn(['draft', 'published', 'archived', 'scheduled'])
      .withMessage('Invalid status'),
    body('publishAt')
      .optional()
      .isISO8601()
      .withMessage('Invalid publish date format'),
    body('unpublishAt')
      .optional()
      .isISO8601()
      .withMessage('Invalid unpublish date format')
  ],
  publishContent
);

/**
 * @route   DELETE /api/cms/:id
 * @desc    Delete CMS content
 * @access  Admin only
 */
router.delete('/:id',
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid content ID')
  ],
  deleteCmsContent
);

module.exports = router;
