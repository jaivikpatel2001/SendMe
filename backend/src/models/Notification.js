/**
 * Notification Model
 * Handle all types of notifications (push, email, SMS, in-app)
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Recipient Information
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Recipient is required']
  },
  
  // Notification Content
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  
  // Notification Type and Category
  type: {
    type: String,
    enum: [
      'booking_created',
      'booking_confirmed',
      'driver_assigned',
      'driver_arrived',
      'pickup_completed',
      'in_transit',
      'delivered',
      'booking_cancelled',
      'payment_completed',
      'payment_failed',
      'review_request',
      'promo_code',
      'account_update',
      'system_maintenance',
      'marketing',
      'security_alert',
      'driver_application',
      'payout_processed',
      'other'
    ],
    required: [true, 'Notification type is required']
  },
  
  category: {
    type: String,
    enum: ['booking', 'payment', 'account', 'marketing', 'system', 'security'],
    required: [true, 'Notification category is required']
  },
  
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Delivery Channels
  channels: {
    push: {
      enabled: {
        type: Boolean,
        default: true
      },
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: Date,
      messageId: String,
      error: String
    },
    email: {
      enabled: {
        type: Boolean,
        default: false
      },
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: Date,
      messageId: String,
      error: String,
      subject: String,
      template: String
    },
    sms: {
      enabled: {
        type: Boolean,
        default: false
      },
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: Date,
      messageId: String,
      error: String
    },
    inApp: {
      enabled: {
        type: Boolean,
        default: true
      },
      read: {
        type: Boolean,
        default: false
      },
      readAt: Date
    }
  },
  
  // Related Data
  relatedData: {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    promoCode: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PromoCode'
    },
    amount: Number,
    metadata: mongoose.Schema.Types.Mixed
  },
  
  // Action and Deep Linking
  action: {
    type: {
      type: String,
      enum: ['none', 'open_booking', 'open_profile', 'open_payment', 'open_url', 'call_support']
    },
    data: {
      url: String,
      bookingId: String,
      screen: String,
      params: mongoose.Schema.Types.Mixed
    }
  },
  
  // Scheduling
  scheduledFor: {
    type: Date,
    default: Date.now
  },
  
  isScheduled: {
    type: Boolean,
    default: false
  },
  
  // Status and Tracking
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'cancelled'],
    default: 'pending'
  },
  
  deliveryAttempts: {
    type: Number,
    default: 0
  },
  
  maxRetries: {
    type: Number,
    default: 3
  },
  
  // Personalization
  personalization: {
    userName: String,
    customData: mongoose.Schema.Types.Mixed
  },
  
  // Localization
  language: {
    type: String,
    default: 'en'
  },
  
  // Campaign and Analytics
  campaign: {
    id: String,
    name: String,
    type: String,
    source: String
  },
  
  // Interaction Tracking
  interactions: {
    opened: {
      type: Boolean,
      default: false
    },
    openedAt: Date,
    clicked: {
      type: Boolean,
      default: false
    },
    clickedAt: Date,
    dismissed: {
      type: Boolean,
      default: false
    },
    dismissedAt: Date
  },
  
  // Device and Platform Info
  deviceInfo: {
    platform: {
      type: String,
      enum: ['web', 'ios', 'android']
    },
    deviceToken: String,
    userAgent: String
  },
  
  // Batch Information
  batchId: String,
  
  // Error Handling
  errors: [{
    channel: {
      type: String,
      enum: ['push', 'email', 'sms']
    },
    error: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    retryCount: {
      type: Number,
      default: 0
    }
  }],
  
  // Expiration
  expiresAt: Date

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ type: 1, status: 1 });
notificationSchema.index({ scheduledFor: 1, status: 1 });
notificationSchema.index({ 'channels.inApp.read': 1, recipient: 1 });
notificationSchema.index({ batchId: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for overall delivery status
notificationSchema.virtual('deliveryStatus').get(function() {
  const channels = this.channels;
  let totalEnabled = 0;
  let totalSent = 0;
  
  Object.keys(channels).forEach(channel => {
    if (channels[channel].enabled) {
      totalEnabled++;
      if (channels[channel].sent || channels[channel].read) {
        totalSent++;
      }
    }
  });
  
  if (totalEnabled === 0) return 'no_channels';
  if (totalSent === 0) return 'pending';
  if (totalSent === totalEnabled) return 'delivered';
  return 'partial';
});

// Virtual for is read (for in-app notifications)
notificationSchema.virtual('isRead').get(function() {
  return this.channels.inApp.read;
});

// Virtual for is expired
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

// Pre-save middleware to set expiration
notificationSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    // Set default expiration based on type
    const expirationDays = {
      'marketing': 30,
      'promo_code': 7,
      'system_maintenance': 1,
      'default': 90
    };
    
    const days = expirationDays[this.category] || expirationDays.default;
    this.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
  next();
});

// Instance method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.channels.inApp.read = true;
  this.channels.inApp.readAt = new Date();
  this.interactions.opened = true;
  this.interactions.openedAt = new Date();
  return this.save();
};

// Instance method to mark as clicked
notificationSchema.methods.markAsClicked = function() {
  this.interactions.clicked = true;
  this.interactions.clickedAt = new Date();
  if (!this.interactions.opened) {
    this.interactions.opened = true;
    this.interactions.openedAt = new Date();
  }
  return this.save();
};

// Instance method to mark as dismissed
notificationSchema.methods.markAsDismissed = function() {
  this.interactions.dismissed = true;
  this.interactions.dismissedAt = new Date();
  return this.save();
};

// Instance method to update channel status
notificationSchema.methods.updateChannelStatus = function(channel, status, messageId = null, error = null) {
  if (!this.channels[channel]) {
    throw new Error(`Invalid channel: ${channel}`);
  }
  
  this.channels[channel].sent = status === 'sent';
  this.channels[channel].sentAt = status === 'sent' ? new Date() : null;
  this.channels[channel].messageId = messageId;
  this.channels[channel].error = error;
  
  if (error) {
    this.errors.push({
      channel,
      error,
      timestamp: new Date(),
      retryCount: this.deliveryAttempts
    });
  }
  
  return this.save();
};

// Static method to get unread count for user
notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({
    recipient: userId,
    'channels.inApp.enabled': true,
    'channels.inApp.read': false,
    status: { $in: ['sent', 'delivered'] }
  });
};

// Static method to mark all as read for user
notificationSchema.statics.markAllAsRead = async function(userId) {
  return await this.updateMany(
    {
      recipient: userId,
      'channels.inApp.enabled': true,
      'channels.inApp.read': false
    },
    {
      $set: {
        'channels.inApp.read': true,
        'channels.inApp.readAt': new Date(),
        'interactions.opened': true,
        'interactions.openedAt': new Date()
      }
    }
  );
};

// Static method to get notifications for user with pagination
notificationSchema.statics.getForUser = async function(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    category = null,
    unreadOnly = false,
    includeRead = true
  } = options;
  
  const query = {
    recipient: userId,
    'channels.inApp.enabled': true,
    status: { $in: ['sent', 'delivered'] }
  };
  
  if (category) {
    query.category = category;
  }
  
  if (unreadOnly) {
    query['channels.inApp.read'] = false;
  } else if (!includeRead) {
    query['channels.inApp.read'] = true;
  }
  
  const skip = (page - 1) * limit;
  
  const [notifications, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('relatedData.booking', 'bookingId status')
      .populate('relatedData.user', 'firstName lastName'),
    this.countDocuments(query)
  ]);
  
  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to create and send notification
notificationSchema.statics.createAndSend = async function(notificationData) {
  const notification = new this(notificationData);
  await notification.save();
  
  // Here you would trigger the actual sending logic
  // This could be done via a queue system or immediate sending
  
  return notification;
};

// Static method to cleanup expired notifications
notificationSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  
  return result.deletedCount;
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
