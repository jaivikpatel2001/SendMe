/**
 * Notification Controller
 * Handle all notification-related operations and business logic
 */

const Notification = require('../models/Notification');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * @desc    Get all notifications with pagination, filtering, and sorting
 * @route   GET /api/notifications
 * @access  Admin, User (own notifications)
 */
const getNotifications = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    type,
    status,
    isRead,
    priority,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    recipientId
  } = req.query;

  // Build query based on user role
  let query = {};
  
  if (req.user.role !== 'admin') {
    query.recipient = req.user._id;
  } else if (recipientId) {
    query.recipient = recipientId;
  }

  // Apply filters
  if (type) query.type = type;
  if (status) query.status = status;
  if (isRead !== undefined) query.isRead = isRead === 'true';
  if (priority) query.priority = priority;

  // Search functionality
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { message: { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query
  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('recipient', 'firstName lastName email')
      .populate('relatedData.booking', 'bookingId status')
      .populate('relatedData.user', 'firstName lastName email'),
    Notification.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: {
      notifications,
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
 * @desc    Get single notification by ID
 * @route   GET /api/notifications/:id
 * @access  Admin, Recipient
 */
const getNotificationById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findById(id)
    .populate('recipient', 'firstName lastName email')
    .populate('relatedData.booking', 'bookingId status')
    .populate('relatedData.user', 'firstName lastName email');

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  // Check access permissions
  const hasAccess = req.user.role === 'admin' ||
                   notification.recipient._id.toString() === req.user._id.toString();

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  res.status(200).json({
    success: true,
    data: { notification }
  });
});

/**
 * @desc    Create new notification
 * @route   POST /api/notifications
 * @access  Admin only
 */
const createNotification = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const notificationData = req.body;

  // Verify recipient exists
  const recipient = await User.findById(notificationData.recipient);
  if (!recipient) {
    return res.status(404).json({
      success: false,
      message: 'Recipient not found'
    });
  }

  const notification = await Notification.create(notificationData);

  // Populate the created notification
  await notification.populate([
    { path: 'recipient', select: 'firstName lastName email' },
    { path: 'relatedData.booking', select: 'bookingId status' },
    { path: 'relatedData.user', select: 'firstName lastName email' }
  ]);

  logger.info(`New notification created: ${notification._id} for ${recipient.email}`);

  res.status(201).json({
    success: true,
    message: 'Notification created successfully',
    data: { notification }
  });
});

/**
 * @desc    Update notification
 * @route   PUT /api/notifications/:id
 * @access  Admin only
 */
const updateNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const notification = await Notification.findById(id);

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  // Remove fields that shouldn't be updated directly
  delete updates.deliveryStatus;
  delete updates.readAt;
  delete updates.errors;

  const updatedNotification = await Notification.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  ).populate([
    { path: 'recipient', select: 'firstName lastName email' },
    { path: 'relatedData.booking', select: 'bookingId status' }
  ]);

  logger.info(`Notification updated: ${updatedNotification._id}`);

  res.status(200).json({
    success: true,
    message: 'Notification updated successfully',
    data: { notification: updatedNotification }
  });
});

/**
 * @desc    Partial update notification
 * @route   PATCH /api/notifications/:id
 * @access  Admin only
 */
const patchNotification = asyncHandler(async (req, res) => {
  // Use the same logic as updateNotification for PATCH
  await updateNotification(req, res);
});

/**
 * @desc    Delete notification
 * @route   DELETE /api/notifications/:id
 * @access  Admin only
 */
const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findById(id);

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  await Notification.findByIdAndDelete(id);

  logger.info(`Notification deleted: ${id}`);

  res.status(200).json({
    success: true,
    message: 'Notification deleted successfully'
  });
});

/**
 * @desc    Mark notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Recipient only
 */
const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findById(id);

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  // Check if user is the recipient
  if (notification.recipient.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  res.status(200).json({
    success: true,
    message: 'Notification marked as read',
    data: {
      notification: {
        _id: notification._id,
        isRead: notification.isRead,
        readAt: notification.readAt
      }
    }
  });
});

/**
 * @desc    Mark all notifications as read for user
 * @route   PATCH /api/notifications/mark-all-read
 * @access  Authenticated users
 */
const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    {
      recipient: req.user._id,
      isRead: false
    },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} notifications marked as read`,
    data: {
      modifiedCount: result.modifiedCount
    }
  });
});

/**
 * @desc    Get notification statistics for user
 * @route   GET /api/notifications/stats
 * @access  Authenticated users
 */
const getNotificationStats = asyncHandler(async (req, res) => {
  const userId = req.user.role === 'admin' && req.query.userId ? req.query.userId : req.user._id;

  const stats = await Notification.aggregate([
    { $match: { recipient: userId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: {
          $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
        },
        byType: {
          $push: {
            type: '$type',
            isRead: '$isRead'
          }
        },
        byPriority: {
          $push: {
            priority: '$priority',
            isRead: '$isRead'
          }
        }
      }
    }
  ]);

  const result = stats[0] || { total: 0, unread: 0, byType: [], byPriority: [] };

  // Process type and priority statistics
  const typeStats = {};
  const priorityStats = {};

  result.byType.forEach(item => {
    if (!typeStats[item.type]) {
      typeStats[item.type] = { total: 0, unread: 0 };
    }
    typeStats[item.type].total++;
    if (!item.isRead) typeStats[item.type].unread++;
  });

  result.byPriority.forEach(item => {
    if (!priorityStats[item.priority]) {
      priorityStats[item.priority] = { total: 0, unread: 0 };
    }
    priorityStats[item.priority].total++;
    if (!item.isRead) priorityStats[item.priority].unread++;
  });

  res.status(200).json({
    success: true,
    data: {
      total: result.total,
      unread: result.unread,
      read: result.total - result.unread,
      byType: typeStats,
      byPriority: priorityStats
    }
  });
});

module.exports = {
  getNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  patchNotification,
  deleteNotification,
  markAsRead,
  markAllAsRead,
  getNotificationStats
};
