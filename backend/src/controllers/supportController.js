/**
 * Support Ticket Controller
 * Handle all support ticket-related operations and business logic
 */

const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');
const { catchAsync } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * @desc    Get all support tickets with pagination, filtering, and sorting
 * @route   GET /api/support
 * @access  Admin (all), User (own tickets)
 */
const getSupportTickets = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    priority,
    category,
    department,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    userId,
    assignedTo
  } = req.query;

  // Build query based on user role
  let query = {};
  
  if (req.user.role !== 'admin') {
    query.user = req.user._id;
  } else {
    if (userId) query.user = userId;
    if (assignedTo) query.assignedTo = assignedTo;
  }

  // Apply filters
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (category) query.category = category;
  if (department) query.department = department;

  // Search functionality
  if (search) {
    query.$or = [
      { ticketId: { $regex: search, $options: 'i' } },
      { subject: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query
  const [tickets, total] = await Promise.all([
    SupportTicket.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'firstName lastName email phone')
      .populate('assignedTo', 'firstName lastName email')
      .populate('relatedBooking', 'bookingId status')
      .populate('relatedUser', 'firstName lastName email'),
    SupportTicket.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: {
      tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

/**
 * @desc    Get single support ticket by ID
 * @route   GET /api/support/:id
 * @access  Admin, Ticket owner, Assigned agent
 */
const getSupportTicketById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const ticket = await SupportTicket.findById(id)
    .populate('user', 'firstName lastName email phone')
    .populate('assignedTo', 'firstName lastName email')
    .populate('relatedBooking', 'bookingId status serviceType')
    .populate('relatedUser', 'firstName lastName email')
    .populate('messages.sender', 'firstName lastName email')
    .populate('internalNotes.addedBy', 'firstName lastName email');

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found'
    });
  }

  // Check access permissions
  const hasAccess = req.user.role === 'admin' ||
                   ticket.user._id.toString() === req.user._id.toString() ||
                   (ticket.assignedTo && ticket.assignedTo._id.toString() === req.user._id.toString());

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  res.status(200).json({
    success: true,
    data: { ticket }
  });
});

/**
 * @desc    Create new support ticket
 * @route   POST /api/support
 * @access  Authenticated users
 */
const createSupportTicket = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const ticketData = {
    ...req.body,
    user: req.user._id
  };

  // Set department based on category
  const departmentMapping = {
    'booking_issue': 'operations',
    'payment_problem': 'billing',
    'driver_complaint': 'operations',
    'customer_complaint': 'customer_service',
    'app_bug': 'technical_support',
    'account_issue': 'customer_service',
    'refund_request': 'billing',
    'feature_request': 'technical_support',
    'technical_support': 'technical_support',
    'billing_inquiry': 'billing',
    'safety_concern': 'safety',
    'other': 'customer_service'
  };

  ticketData.department = departmentMapping[ticketData.category] || 'customer_service';

  const ticket = await SupportTicket.create(ticketData);

  // Populate the created ticket
  await ticket.populate([
    { path: 'user', select: 'firstName lastName email phone' },
    { path: 'relatedBooking', select: 'bookingId status serviceType' },
    { path: 'relatedUser', select: 'firstName lastName email' }
  ]);

  logger.info(`New support ticket created: ${ticket.ticketId} by ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Support ticket created successfully',
    data: { ticket }
  });
});

/**
 * @desc    Update support ticket
 * @route   PUT /api/support/:id
 * @access  Admin, Ticket owner (limited fields)
 */
const updateSupportTicket = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const ticket = await SupportTicket.findById(id);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found'
    });
  }

  // Check permissions
  const isOwner = ticket.user.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';
  const isAssigned = ticket.assignedTo && ticket.assignedTo.toString() === req.user._id.toString();

  if (!isOwner && !isAdmin && !isAssigned) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Limit fields that non-admin users can update
  if (!isAdmin) {
    const allowedFields = ['subject', 'description', 'contactInfo'];
    Object.keys(updates).forEach(key => {
      if (!allowedFields.includes(key)) {
        delete updates[key];
      }
    });
  }

  // Remove fields that shouldn't be updated directly
  delete updates.ticketId;
  delete updates.user;
  delete updates.messages;
  delete updates.metrics;

  const updatedTicket = await SupportTicket.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  ).populate([
    { path: 'user', select: 'firstName lastName email phone' },
    { path: 'assignedTo', select: 'firstName lastName email' },
    { path: 'relatedBooking', select: 'bookingId status serviceType' }
  ]);

  logger.info(`Support ticket updated: ${updatedTicket.ticketId}`);

  res.status(200).json({
    success: true,
    message: 'Support ticket updated successfully',
    data: { ticket: updatedTicket }
  });
});

/**
 * @desc    Partial update support ticket
 * @route   PATCH /api/support/:id
 * @access  Admin, Ticket owner (limited fields)
 */
const patchSupportTicket = catchAsync(async (req, res) => {
  // Use the same logic as updateSupportTicket for PATCH
  await updateSupportTicket(req, res);
});

/**
 * @desc    Delete support ticket
 * @route   DELETE /api/support/:id
 * @access  Admin only
 */
const deleteSupportTicket = catchAsync(async (req, res) => {
  const { id } = req.params;

  const ticket = await SupportTicket.findById(id);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found'
    });
  }

  await SupportTicket.findByIdAndDelete(id);

  logger.info(`Support ticket deleted: ${ticket.ticketId}`);

  res.status(200).json({
    success: true,
    message: 'Support ticket deleted successfully'
  });
});

/**
 * @desc    Assign ticket to agent
 * @route   PATCH /api/support/:id/assign
 * @access  Admin only
 */
const assignTicket = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { agentId } = req.body;

  const [ticket, agent] = await Promise.all([
    SupportTicket.findById(id),
    User.findById(agentId)
  ]);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found'
    });
  }

  if (!agent || agent.role !== 'admin') {
    return res.status(400).json({
      success: false,
      message: 'Invalid agent'
    });
  }

  await ticket.assignTo(agentId, req.user._id);

  logger.info(`Ticket assigned: ${ticket.ticketId} -> ${agent.email}`);

  res.status(200).json({
    success: true,
    message: 'Ticket assigned successfully',
    data: {
      ticket: {
        _id: ticket._id,
        assignedTo: agentId,
        assignedAt: ticket.assignedAt
      }
    }
  });
});

/**
 * @desc    Add message to ticket
 * @route   POST /api/support/:id/messages
 * @access  Admin, Ticket owner, Assigned agent
 */
const addTicketMessage = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { message, isInternal = false, attachments = [] } = req.body;

  const ticket = await SupportTicket.findById(id);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found'
    });
  }

  // Check access permissions
  const hasAccess = req.user.role === 'admin' ||
                   ticket.user.toString() === req.user._id.toString() ||
                   (ticket.assignedTo && ticket.assignedTo.toString() === req.user._id.toString());

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Determine sender type
  let senderType = 'admin';
  if (ticket.user.toString() === req.user._id.toString()) {
    senderType = req.user.role === 'driver' ? 'driver' : 'customer';
  }

  await ticket.addMessage(req.user._id, senderType, message, isInternal, attachments);

  res.status(201).json({
    success: true,
    message: 'Message added successfully',
    data: {
      message: ticket.messages[ticket.messages.length - 1]
    }
  });
});

/**
 * @desc    Escalate ticket
 * @route   PATCH /api/support/:id/escalate
 * @access  Admin, Assigned agent
 */
const escalateTicket = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const ticket = await SupportTicket.findById(id);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found'
    });
  }

  // Check permissions
  const canEscalate = req.user.role === 'admin' ||
                     (ticket.assignedTo && ticket.assignedTo.toString() === req.user._id.toString());

  if (!canEscalate) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  await ticket.escalate(req.user._id, reason);

  logger.info(`Ticket escalated: ${ticket.ticketId} - ${reason}`);

  res.status(200).json({
    success: true,
    message: 'Ticket escalated successfully',
    data: {
      ticket: {
        _id: ticket._id,
        escalation: ticket.escalation,
        priority: ticket.priority
      }
    }
  });
});

/**
 * @desc    Resolve ticket
 * @route   PATCH /api/support/:id/resolve
 * @access  Admin, Assigned agent
 */
const resolveTicket = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { summary, actions = [] } = req.body;

  const ticket = await SupportTicket.findById(id);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found'
    });
  }

  // Check permissions
  const canResolve = req.user.role === 'admin' ||
                    (ticket.assignedTo && ticket.assignedTo.toString() === req.user._id.toString());

  if (!canResolve) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  await ticket.resolve(req.user._id, summary, actions);

  logger.info(`Ticket resolved: ${ticket.ticketId}`);

  res.status(200).json({
    success: true,
    message: 'Ticket resolved successfully',
    data: {
      ticket: {
        _id: ticket._id,
        status: ticket.status,
        resolution: ticket.resolution,
        resolutionDetails: ticket.resolutionDetails
      }
    }
  });
});

/**
 * @desc    Reopen ticket
 * @route   PATCH /api/support/:id/reopen
 * @access  Admin, Ticket owner
 */
const reopenTicket = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const ticket = await SupportTicket.findById(id);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found'
    });
  }

  // Check permissions
  const canReopen = req.user.role === 'admin' ||
                   ticket.user.toString() === req.user._id.toString();

  if (!canReopen) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  if (ticket.status !== 'resolved') {
    return res.status(400).json({
      success: false,
      message: 'Only resolved tickets can be reopened'
    });
  }

  await ticket.reopen(req.user._id, reason);

  logger.info(`Ticket reopened: ${ticket.ticketId} - ${reason}`);

  res.status(200).json({
    success: true,
    message: 'Ticket reopened successfully',
    data: {
      ticket: {
        _id: ticket._id,
        status: ticket.status,
        metrics: ticket.metrics
      }
    }
  });
});

/**
 * @desc    Get tickets for agent
 * @route   GET /api/support/agent/:agentId
 * @access  Admin, Agent (own tickets)
 */
const getTicketsForAgent = catchAsync(async (req, res) => {
  const { agentId } = req.params;
  const { status, priority, page = 1, limit = 20 } = req.query;

  // Check permissions
  if (req.user.role !== 'admin' && req.user._id.toString() !== agentId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const result = await SupportTicket.getForAgent(agentId, {
    status,
    priority,
    page: parseInt(page),
    limit: parseInt(limit)
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get support statistics
 * @route   GET /api/support/stats
 * @access  Admin only
 */
const getSupportStats = catchAsync(async (req, res) => {
  const { period = '30d', department, agentId } = req.query;

  // Calculate date range
  const now = new Date();
  let startDate;

  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const matchQuery = {
    createdAt: { $gte: startDate }
  };

  if (department) matchQuery.department = department;
  if (agentId) matchQuery.assignedTo = agentId;

  const stats = await SupportTicket.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalTickets: { $sum: 1 },
        openTickets: {
          $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
        },
        resolvedTickets: {
          $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
        },
        closedTickets: {
          $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
        },
        avgResolutionTime: {
          $avg: '$resolutionDetails.resolutionTime'
        },
        avgFirstResponseTime: {
          $avg: '$metrics.firstResponseTime'
        },
        byPriority: {
          $push: '$priority'
        },
        byCategory: {
          $push: '$category'
        },
        byDepartment: {
          $push: '$department'
        }
      }
    }
  ]);

  const result = stats[0] || {
    totalTickets: 0,
    openTickets: 0,
    resolvedTickets: 0,
    closedTickets: 0,
    avgResolutionTime: 0,
    avgFirstResponseTime: 0,
    byPriority: [],
    byCategory: [],
    byDepartment: []
  };

  // Process priority, category, and department statistics
  const priorityStats = {};
  const categoryStats = {};
  const departmentStats = {};

  result.byPriority.forEach(priority => {
    priorityStats[priority] = (priorityStats[priority] || 0) + 1;
  });

  result.byCategory.forEach(category => {
    categoryStats[category] = (categoryStats[category] || 0) + 1;
  });

  result.byDepartment.forEach(dept => {
    departmentStats[dept] = (departmentStats[dept] || 0) + 1;
  });

  res.status(200).json({
    success: true,
    data: {
      period,
      summary: {
        total: result.totalTickets,
        open: result.openTickets,
        resolved: result.resolvedTickets,
        closed: result.closedTickets,
        avgResolutionTime: Math.round(result.avgResolutionTime || 0),
        avgFirstResponseTime: Math.round(result.avgFirstResponseTime || 0)
      },
      breakdown: {
        byPriority: priorityStats,
        byCategory: categoryStats,
        byDepartment: departmentStats
      }
    }
  });
});

module.exports = {
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
};
