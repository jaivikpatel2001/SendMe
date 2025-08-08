/**
 * Support Ticket Model
 * Handle customer and driver support requests
 */

const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  // Ticket Identification
  ticketId: {
    type: String,
    unique: true,
    required: true
  },
  
  // User Information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  
  // Contact Information (for guests or additional contacts)
  contactInfo: {
    name: String,
    email: String,
    phone: String
  },
  
  // Ticket Details
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  
  // Categorization
  category: {
    type: String,
    enum: [
      'booking_issue',
      'payment_problem',
      'driver_complaint',
      'customer_complaint',
      'app_bug',
      'account_issue',
      'refund_request',
      'feature_request',
      'technical_support',
      'billing_inquiry',
      'safety_concern',
      'other'
    ],
    required: [true, 'Category is required']
  },
  
  subcategory: {
    type: String,
    enum: [
      // Booking issues
      'booking_not_confirmed',
      'driver_not_found',
      'wrong_pickup_location',
      'delivery_delayed',
      'package_damaged',
      'package_lost',
      
      // Payment problems
      'payment_failed',
      'overcharged',
      'refund_not_received',
      'promo_code_issue',
      
      // Driver complaints
      'unprofessional_behavior',
      'late_arrival',
      'poor_communication',
      'vehicle_condition',
      'safety_concern',
      
      // Customer complaints
      'rude_customer',
      'wrong_address',
      'payment_issue',
      'unreasonable_demands',
      
      // Technical issues
      'app_crash',
      'login_problem',
      'tracking_issue',
      'notification_problem',
      
      // Account issues
      'profile_update',
      'verification_problem',
      'account_suspension',
      'data_correction',
      
      'other'
    ]
  },
  
  // Priority and Urgency
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Status Tracking
  status: {
    type: String,
    enum: ['open', 'in_progress', 'waiting_customer', 'waiting_internal', 'resolved', 'closed', 'cancelled'],
    default: 'open'
  },
  
  resolution: {
    type: String,
    enum: ['resolved', 'duplicate', 'not_reproducible', 'wont_fix', 'invalid', 'escalated'],
    default: null
  },
  
  // Related Information
  relatedBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  
  relatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  assignedAt: Date,
  
  department: {
    type: String,
    enum: ['customer_service', 'technical_support', 'billing', 'safety', 'operations', 'management'],
    default: 'customer_service'
  },
  
  // Communication History
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    senderType: {
      type: String,
      enum: ['customer', 'driver', 'admin', 'system'],
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters']
    },
    messageType: {
      type: String,
      enum: ['text', 'internal_note', 'status_update', 'resolution'],
      default: 'text'
    },
    attachments: [{
      filename: String,
      url: String,
      size: Number,
      mimeType: String
    }],
    isInternal: {
      type: Boolean,
      default: false
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Attachments
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: String,
    url: {
      type: String,
      required: true
    },
    size: Number,
    mimeType: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // SLA and Timing
  sla: {
    responseTime: {
      target: Number, // in minutes
      actual: Number
    },
    resolutionTime: {
      target: Number, // in minutes
      actual: Number
    }
  },
  
  // Escalation
  escalation: {
    isEscalated: {
      type: Boolean,
      default: false
    },
    escalatedAt: Date,
    escalatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    escalationReason: String,
    escalationLevel: {
      type: Number,
      default: 0
    }
  },
  
  // Customer Satisfaction
  satisfaction: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    ratedAt: Date
  },
  
  // Resolution Details
  resolutionDetails: {
    summary: String,
    actions: [String],
    followUpRequired: {
      type: Boolean,
      default: false
    },
    followUpDate: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    resolutionTime: Number // in minutes
  },
  
  // Tags and Labels
  tags: [String],
  
  // Internal Information
  internalNotes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Source and Channel
  source: {
    type: String,
    enum: ['web', 'mobile', 'email', 'phone', 'chat', 'social_media', 'admin'],
    default: 'web'
  },
  
  channel: {
    type: String,
    enum: ['support_form', 'in_app_chat', 'email', 'phone_call', 'social_media'],
    default: 'support_form'
  },
  
  // Device and Browser Information
  deviceInfo: {
    platform: String,
    browser: String,
    version: String,
    userAgent: String,
    ipAddress: String
  },
  
  // Auto-close Settings
  autoClose: {
    enabled: {
      type: Boolean,
      default: true
    },
    daysAfterResolution: {
      type: Number,
      default: 7
    },
    scheduledCloseDate: Date
  },
  
  // Metrics
  metrics: {
    firstResponseTime: Number, // in minutes
    totalResponseTime: Number, // in minutes
    customerResponseCount: Number,
    agentResponseCount: Number,
    reopenCount: {
      type: Number,
      default: 0
    }
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
supportTicketSchema.index({ ticketId: 1 });
supportTicketSchema.index({ user: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1 });
supportTicketSchema.index({ assignedTo: 1, status: 1 });
supportTicketSchema.index({ category: 1, subcategory: 1 });
supportTicketSchema.index({ createdAt: -1 });
supportTicketSchema.index({ 'autoClose.scheduledCloseDate': 1 });

// Virtual for age in hours
supportTicketSchema.virtual('ageInHours').get(function() {
  return Math.round((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60));
});

// Virtual for is overdue
supportTicketSchema.virtual('isOverdue').get(function() {
  if (!this.sla.responseTime.target) return false;
  
  const ageInMinutes = (Date.now() - this.createdAt.getTime()) / (1000 * 60);
  return ageInMinutes > this.sla.responseTime.target && this.status === 'open';
});

// Virtual for last message
supportTicketSchema.virtual('lastMessage').get(function() {
  if (this.messages.length === 0) return null;
  return this.messages[this.messages.length - 1];
});

// Pre-save middleware to generate ticket ID
supportTicketSchema.pre('save', function(next) {
  if (!this.ticketId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.ticketId = `TK${timestamp}${random}`.toUpperCase();
  }
  next();
});

// Pre-save middleware to set SLA targets
supportTicketSchema.pre('save', function(next) {
  if (this.isNew && !this.sla.responseTime.target) {
    // Set SLA targets based on priority
    const slaTargets = {
      urgent: { response: 30, resolution: 240 }, // 30 min, 4 hours
      high: { response: 60, resolution: 480 },   // 1 hour, 8 hours
      normal: { response: 240, resolution: 1440 }, // 4 hours, 24 hours
      low: { response: 480, resolution: 2880 }   // 8 hours, 48 hours
    };
    
    const targets = slaTargets[this.priority] || slaTargets.normal;
    this.sla.responseTime.target = targets.response;
    this.sla.resolutionTime.target = targets.resolution;
  }
  next();
});

// Pre-save middleware to update metrics
supportTicketSchema.pre('save', function(next) {
  if (this.isModified('messages')) {
    const customerMessages = this.messages.filter(m => ['customer', 'driver'].includes(m.senderType));
    const agentMessages = this.messages.filter(m => m.senderType === 'admin');
    
    this.metrics.customerResponseCount = customerMessages.length;
    this.metrics.agentResponseCount = agentMessages.length;
    
    // Calculate first response time
    if (agentMessages.length > 0 && !this.metrics.firstResponseTime) {
      const firstAgentMessage = agentMessages[0];
      this.metrics.firstResponseTime = Math.round(
        (firstAgentMessage.timestamp.getTime() - this.createdAt.getTime()) / (1000 * 60)
      );
    }
  }
  next();
});

// Instance method to add message
supportTicketSchema.methods.addMessage = function(senderId, senderType, message, isInternal = false, attachments = []) {
  this.messages.push({
    sender: senderId,
    senderType,
    message,
    isInternal,
    attachments,
    timestamp: new Date()
  });
  
  return this.save();
};

// Instance method to assign ticket
supportTicketSchema.methods.assignTo = function(agentId, assignedBy) {
  this.assignedTo = agentId;
  this.assignedAt = new Date();
  
  this.addMessage(assignedBy, 'admin', `Ticket assigned to agent`, true);
  
  return this.save();
};

// Instance method to escalate ticket
supportTicketSchema.methods.escalate = function(escalatedBy, reason) {
  this.escalation.isEscalated = true;
  this.escalation.escalatedAt = new Date();
  this.escalation.escalatedBy = escalatedBy;
  this.escalation.escalationReason = reason;
  this.escalation.escalationLevel += 1;
  this.priority = this.priority === 'urgent' ? 'urgent' : 
                  this.priority === 'high' ? 'urgent' : 'high';
  
  this.addMessage(escalatedBy, 'admin', `Ticket escalated: ${reason}`, true);
  
  return this.save();
};

// Instance method to resolve ticket
supportTicketSchema.methods.resolve = function(resolvedBy, summary, actions = []) {
  this.status = 'resolved';
  this.resolution = 'resolved';
  this.resolutionDetails.summary = summary;
  this.resolutionDetails.actions = actions;
  this.resolutionDetails.resolvedBy = resolvedBy;
  this.resolutionDetails.resolvedAt = new Date();
  
  // Calculate resolution time
  this.resolutionDetails.resolutionTime = Math.round(
    (Date.now() - this.createdAt.getTime()) / (1000 * 60)
  );
  
  // Set auto-close date
  if (this.autoClose.enabled) {
    this.autoClose.scheduledCloseDate = new Date(
      Date.now() + this.autoClose.daysAfterResolution * 24 * 60 * 60 * 1000
    );
  }
  
  this.addMessage(resolvedBy, 'admin', `Ticket resolved: ${summary}`, false);
  
  return this.save();
};

// Instance method to reopen ticket
supportTicketSchema.methods.reopen = function(reopenedBy, reason) {
  this.status = 'open';
  this.resolution = null;
  this.metrics.reopenCount += 1;
  this.autoClose.scheduledCloseDate = null;
  
  this.addMessage(reopenedBy, 'admin', `Ticket reopened: ${reason}`, false);
  
  return this.save();
};

// Static method to get tickets for agent
supportTicketSchema.statics.getForAgent = async function(agentId, options = {}) {
  const {
    status = null,
    priority = null,
    page = 1,
    limit = 20
  } = options;
  
  const query = { assignedTo: agentId };
  
  if (status) query.status = status;
  if (priority) query.priority = priority;
  
  const skip = (page - 1) * limit;
  
  const [tickets, total] = await Promise.all([
    this.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName email phone')
      .populate('relatedBooking', 'bookingId status'),
    this.countDocuments(query)
  ]);
  
  return {
    tickets,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to auto-close resolved tickets
supportTicketSchema.statics.autoCloseResolved = async function() {
  const result = await this.updateMany(
    {
      status: 'resolved',
      'autoClose.enabled': true,
      'autoClose.scheduledCloseDate': { $lte: new Date() }
    },
    {
      $set: {
        status: 'closed',
        'resolutionDetails.closedAt': new Date()
      }
    }
  );
  
  return result.modifiedCount;
};

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

module.exports = SupportTicket;
