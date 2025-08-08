/**
 * Notification Routes
 * Handle all notification-related endpoints with proper authentication and validation
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  patchNotification,
  deleteNotification,
  markAsRead,
  markAllAsRead,
  getNotificationStats
} = require('../controllers/notificationController');

const { protect, authorize } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

/**
 * @route   GET /api/notifications/stats
 * @desc    Get notification statistics for user
 * @access  Authenticated users
 */
router.get('/stats',
  [
    query('userId').optional().isMongoId().withMessage('Invalid user ID')
  ],
  getNotificationStats
);

/**
 * @route   PATCH /api/notifications/mark-all-read
 * @desc    Mark all notifications as read for user
 * @access  Authenticated users
 */
router.patch('/mark-all-read', markAllAsRead);

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications with pagination and filtering
 * @access  Admin, User (own notifications)
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('type').optional().isIn([
      'booking_update', 'payment_update', 'driver_assigned', 'delivery_update',
      'promotion', 'system_update', 'reminder', 'alert', 'welcome', 'verification'
    ]).withMessage('Invalid notification type'),
    query('status').optional().isIn(['pending', 'sent', 'failed', 'cancelled']).withMessage('Invalid status'),
    query('priority').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid priority'),
    query('sortBy').optional().isIn(['createdAt', 'scheduledFor', 'priority']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    query('recipientId').optional().isMongoId().withMessage('Invalid recipient ID')
  ],
  getNotifications
);

/**
 * @route   GET /api/notifications/:id
 * @desc    Get single notification by ID
 * @access  Admin, Recipient
 */
router.get('/:id',
  [
    param('id').isMongoId().withMessage('Invalid notification ID')
  ],
  getNotificationById
);

/**
 * @route   POST /api/notifications
 * @desc    Create new notification
 * @access  Admin only
 */
router.post('/',
  authorize('admin'),
  [
    body('recipient')
      .isMongoId()
      .withMessage('Valid recipient ID is required'),
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ max: 100 })
      .withMessage('Title cannot exceed 100 characters'),
    body('message')
      .trim()
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ max: 500 })
      .withMessage('Message cannot exceed 500 characters'),
    body('type')
      .isIn([
        'booking_update', 'payment_update', 'driver_assigned', 'delivery_update',
        'promotion', 'system_update', 'reminder', 'alert', 'welcome', 'verification'
      ])
      .withMessage('Invalid notification type'),
    body('priority')
      .optional()
      .isIn(['low', 'normal', 'high', 'urgent'])
      .withMessage('Invalid priority'),
    body('channels')
      .optional()
      .isArray()
      .withMessage('Channels must be an array'),
    body('channels.*')
      .optional()
      .isIn(['push', 'email', 'sms'])
      .withMessage('Invalid channel'),
    body('scheduledFor')
      .optional()
      .isISO8601()
      .withMessage('Invalid scheduled date format'),
    body('relatedData.booking')
      .optional()
      .isMongoId()
      .withMessage('Invalid booking ID'),
    body('relatedData.user')
      .optional()
      .isMongoId()
      .withMessage('Invalid user ID'),
    body('relatedData.amount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Amount must be a positive number'),
    body('action.type')
      .optional()
      .isIn(['none', 'open_booking', 'open_profile', 'open_payment', 'open_url', 'call_support'])
      .withMessage('Invalid action type'),
    body('action.data.url')
      .optional()
      .isURL()
      .withMessage('Invalid URL format')
  ],
  createNotification
);

/**
 * @route   PUT /api/notifications/:id
 * @desc    Update notification (full update)
 * @access  Admin only
 */
router.put('/:id',
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid notification ID'),
    body('title')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Title cannot be empty')
      .isLength({ max: 100 })
      .withMessage('Title cannot exceed 100 characters'),
    body('message')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Message cannot be empty')
      .isLength({ max: 500 })
      .withMessage('Message cannot exceed 500 characters'),
    body('priority')
      .optional()
      .isIn(['low', 'normal', 'high', 'urgent'])
      .withMessage('Invalid priority'),
    body('scheduledFor')
      .optional()
      .isISO8601()
      .withMessage('Invalid scheduled date format')
  ],
  updateNotification
);

/**
 * @route   PATCH /api/notifications/:id
 * @desc    Partial update notification
 * @access  Admin only
 */
router.patch('/:id',
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid notification ID')
  ],
  patchNotification
);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Recipient only
 */
router.patch('/:id/read',
  [
    param('id').isMongoId().withMessage('Invalid notification ID')
  ],
  markAsRead
);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Admin only
 */
router.delete('/:id',
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid notification ID')
  ],
  deleteNotification
);

module.exports = router;
