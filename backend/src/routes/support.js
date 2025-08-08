/**
 * Support Routes
 * Handle all support ticket-related endpoints with proper authentication and validation
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getSupportTickets,
  getSupportTicketById,
  createSupportTicket,
  updateSupportTicket,
  patchSupportTicket,
  deleteSupportTicket,
  assignTicket,
  addTicketMessage,
  escalateTicket,
  resolveTicket,
  reopenTicket,
  getTicketsForAgent,
  getSupportStats
} = require('../controllers/supportController');

const { protect, authorize } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

/**
 * @route   GET /api/support/stats
 * @desc    Get support statistics
 * @access  Admin only
 */
router.get('/stats',
  authorize('admin'),
  [
    query('period').optional().isIn(['7d', '30d', '90d']).withMessage('Invalid period'),
    query('department').optional().isIn(['customer_service', 'technical_support', 'billing', 'safety', 'operations', 'management']).withMessage('Invalid department'),
    query('agentId').optional().isMongoId().withMessage('Invalid agent ID')
  ],
  getSupportStats
);

/**
 * @route   GET /api/support/agent/:agentId
 * @desc    Get tickets for agent
 * @access  Admin, Agent (own tickets)
 */
router.get('/agent/:agentId',
  [
    param('agentId').isMongoId().withMessage('Invalid agent ID'),
    query('status').optional().isIn(['open', 'in_progress', 'waiting_customer', 'waiting_internal', 'resolved', 'closed', 'cancelled']).withMessage('Invalid status'),
    query('priority').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid priority'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  getTicketsForAgent
);

/**
 * @route   GET /api/support
 * @desc    Get all support tickets with pagination and filtering
 * @access  Admin (all), User (own tickets)
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['open', 'in_progress', 'waiting_customer', 'waiting_internal', 'resolved', 'closed', 'cancelled']).withMessage('Invalid status'),
    query('priority').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid priority'),
    query('category').optional().isIn([
      'booking_issue', 'payment_problem', 'driver_complaint', 'customer_complaint',
      'app_bug', 'account_issue', 'refund_request', 'feature_request',
      'technical_support', 'billing_inquiry', 'safety_concern', 'other'
    ]).withMessage('Invalid category'),
    query('department').optional().isIn(['customer_service', 'technical_support', 'billing', 'safety', 'operations', 'management']).withMessage('Invalid department'),
    query('sortBy').optional().isIn(['createdAt', 'priority', 'status', 'assignedAt']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    query('userId').optional().isMongoId().withMessage('Invalid user ID'),
    query('assignedTo').optional().isMongoId().withMessage('Invalid assigned agent ID')
  ],
  getSupportTickets
);

/**
 * @route   GET /api/support/:id
 * @desc    Get single support ticket by ID
 * @access  Admin, Ticket owner, Assigned agent
 */
router.get('/:id',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID')
  ],
  getSupportTicketById
);

/**
 * @route   POST /api/support
 * @desc    Create new support ticket
 * @access  Authenticated users
 */
router.post('/',
  [
    body('subject')
      .trim()
      .notEmpty()
      .withMessage('Subject is required')
      .isLength({ max: 200 })
      .withMessage('Subject cannot exceed 200 characters'),
    body('description')
      .trim()
      .notEmpty()
      .withMessage('Description is required')
      .isLength({ max: 2000 })
      .withMessage('Description cannot exceed 2000 characters'),
    body('category')
      .isIn([
        'booking_issue', 'payment_problem', 'driver_complaint', 'customer_complaint',
        'app_bug', 'account_issue', 'refund_request', 'feature_request',
        'technical_support', 'billing_inquiry', 'safety_concern', 'other'
      ])
      .withMessage('Invalid category'),
    body('subcategory')
      .optional()
      .isIn([
        'booking_not_confirmed', 'driver_not_found', 'wrong_pickup_location', 'delivery_delayed',
        'package_damaged', 'package_lost', 'payment_failed', 'overcharged', 'refund_not_received',
        'promo_code_issue', 'unprofessional_behavior', 'late_arrival', 'poor_communication',
        'vehicle_condition', 'safety_concern', 'rude_customer', 'wrong_address', 'payment_issue',
        'unreasonable_demands', 'app_crash', 'login_problem', 'tracking_issue', 'notification_problem',
        'profile_update', 'verification_problem', 'account_suspension', 'data_correction', 'other'
      ])
      .withMessage('Invalid subcategory'),
    body('priority')
      .optional()
      .isIn(['low', 'normal', 'high', 'urgent'])
      .withMessage('Invalid priority'),
    body('urgency')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid urgency'),
    body('relatedBooking')
      .optional()
      .isMongoId()
      .withMessage('Invalid booking ID'),
    body('relatedUser')
      .optional()
      .isMongoId()
      .withMessage('Invalid user ID'),
    body('contactInfo.name')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Contact name cannot exceed 100 characters'),
    body('contactInfo.email')
      .optional()
      .isEmail()
      .withMessage('Invalid contact email'),
    body('contactInfo.phone')
      .optional()
      .isMobilePhone()
      .withMessage('Invalid contact phone number'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('tags.*')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Each tag must be between 1 and 50 characters')
  ],
  createSupportTicket
);

/**
 * @route   POST /api/support/:id/messages
 * @desc    Add message to ticket
 * @access  Admin, Ticket owner, Assigned agent
 */
router.post('/:id/messages',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('message')
      .trim()
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ max: 2000 })
      .withMessage('Message cannot exceed 2000 characters'),
    body('isInternal')
      .optional()
      .isBoolean()
      .withMessage('isInternal must be a boolean value'),
    body('attachments')
      .optional()
      .isArray()
      .withMessage('Attachments must be an array')
  ],
  addTicketMessage
);

/**
 * @route   PUT /api/support/:id
 * @desc    Update support ticket (full update)
 * @access  Admin, Ticket owner (limited fields)
 */
router.put('/:id',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('subject')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Subject cannot be empty')
      .isLength({ max: 200 })
      .withMessage('Subject cannot exceed 200 characters'),
    body('description')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Description cannot be empty')
      .isLength({ max: 2000 })
      .withMessage('Description cannot exceed 2000 characters'),
    body('priority')
      .optional()
      .isIn(['low', 'normal', 'high', 'urgent'])
      .withMessage('Invalid priority'),
    body('status')
      .optional()
      .isIn(['open', 'in_progress', 'waiting_customer', 'waiting_internal', 'resolved', 'closed', 'cancelled'])
      .withMessage('Invalid status')
  ],
  updateSupportTicket
);

/**
 * @route   PATCH /api/support/:id
 * @desc    Partial update support ticket
 * @access  Admin, Ticket owner (limited fields)
 */
router.patch('/:id',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID')
  ],
  patchSupportTicket
);

/**
 * @route   PATCH /api/support/:id/assign
 * @desc    Assign ticket to agent
 * @access  Admin only
 */
router.patch('/:id/assign',
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('agentId')
      .isMongoId()
      .withMessage('Valid agent ID is required')
  ],
  assignTicket
);

/**
 * @route   PATCH /api/support/:id/escalate
 * @desc    Escalate ticket
 * @access  Admin, Assigned agent
 */
router.patch('/:id/escalate',
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('reason')
      .trim()
      .notEmpty()
      .withMessage('Escalation reason is required')
      .isLength({ max: 500 })
      .withMessage('Reason cannot exceed 500 characters')
  ],
  escalateTicket
);

/**
 * @route   PATCH /api/support/:id/resolve
 * @desc    Resolve ticket
 * @access  Admin, Assigned agent
 */
router.patch('/:id/resolve',
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('summary')
      .trim()
      .notEmpty()
      .withMessage('Resolution summary is required')
      .isLength({ max: 1000 })
      .withMessage('Summary cannot exceed 1000 characters'),
    body('actions')
      .optional()
      .isArray()
      .withMessage('Actions must be an array'),
    body('actions.*')
      .optional()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Each action must be between 1 and 200 characters')
  ],
  resolveTicket
);

/**
 * @route   PATCH /api/support/:id/reopen
 * @desc    Reopen ticket
 * @access  Admin, Ticket owner
 */
router.patch('/:id/reopen',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('reason')
      .trim()
      .notEmpty()
      .withMessage('Reopen reason is required')
      .isLength({ max: 500 })
      .withMessage('Reason cannot exceed 500 characters')
  ],
  reopenTicket
);

/**
 * @route   DELETE /api/support/:id
 * @desc    Delete support ticket
 * @access  Admin only
 */
router.delete('/:id',
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid ticket ID')
  ],
  deleteSupportTicket
);

module.exports = router;
