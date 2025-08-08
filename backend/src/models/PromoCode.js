/**
 * PromoCode Model
 * Handle promotional codes and discount management
 */

const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  // Basic Information
  code: {
    type: String,
    required: [true, 'Promo code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    minlength: [3, 'Promo code must be at least 3 characters'],
    maxlength: [20, 'Promo code cannot exceed 20 characters'],
    match: [/^[A-Z0-9]+$/, 'Promo code can only contain uppercase letters and numbers']
  },
  
  name: {
    type: String,
    required: [true, 'Promo name is required'],
    trim: true,
    maxlength: [100, 'Promo name cannot exceed 100 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Discount Configuration
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: [true, 'Discount type is required']
  },
  
  discountValue: {
    type: Number,
    required: [true, 'Discount value is required'],
    min: [0, 'Discount value cannot be negative'],
    validate: {
      validator: function(value) {
        if (this.discountType === 'percentage') {
          return value <= 100;
        }
        return true;
      },
      message: 'Percentage discount cannot exceed 100%'
    }
  },
  
  // Usage Restrictions
  minimumOrderValue: {
    type: Number,
    default: 0,
    min: [0, 'Minimum order value cannot be negative']
  },
  
  maximumDiscount: {
    type: Number,
    min: [0, 'Maximum discount cannot be negative'],
    validate: {
      validator: function(value) {
        return this.discountType === 'fixed' ? true : value !== undefined;
      },
      message: 'Maximum discount is required for percentage discounts'
    }
  },
  
  // Usage Limits
  usageLimit: {
    total: {
      type: Number,
      min: [1, 'Total usage limit must be at least 1']
    },
    perUser: {
      type: Number,
      default: 1,
      min: [1, 'Per user limit must be at least 1']
    }
  },
  
  // Validity Period
  validFrom: {
    type: Date,
    required: [true, 'Valid from date is required']
  },
  
  validUntil: {
    type: Date,
    required: [true, 'Valid until date is required'],
    validate: {
      validator: function(value) {
        return value > this.validFrom;
      },
      message: 'Valid until date must be after valid from date'
    }
  },
  
  // Target Audience
  targetAudience: {
    userTypes: [{
      type: String,
      enum: ['customer', 'driver', 'all'],
      default: 'customer'
    }],
    newUsersOnly: {
      type: Boolean,
      default: false
    },
    specificUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    excludedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  
  // Service Restrictions
  applicableServices: [{
    type: String,
    enum: ['delivery', 'pickup', 'moving', 'express', 'scheduled', 'all'],
    default: 'all'
  }],
  
  applicableVehicleTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleType'
  }],
  
  // Geographic Restrictions
  applicableAreas: [{
    city: String,
    state: String,
    country: {
      type: String,
      default: process.env.DEFAULT_COUNTRY || 'GB'
    },
    postalCodes: [String]
  }],
  
  // Time Restrictions
  timeRestrictions: {
    daysOfWeek: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    timeSlots: [{
      startTime: {
        type: String,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
      },
      endTime: {
        type: String,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
      }
    }]
  },
  
  // Status and Visibility
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired', 'exhausted'],
    default: 'active'
  },
  
  isPublic: {
    type: Boolean,
    default: true
  },
  
  // Usage Tracking
  usageStats: {
    totalUsed: {
      type: Number,
      default: 0
    },
    totalSavings: {
      type: Number,
      default: 0
    },
    uniqueUsers: {
      type: Number,
      default: 0
    },
    lastUsed: Date
  },
  
  // Usage History
  usageHistory: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true
    },
    discountAmount: {
      type: Number,
      required: true
    },
    orderValue: {
      type: Number,
      required: true
    },
    usedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Marketing and Analytics
  campaign: {
    name: String,
    type: {
      type: String,
      enum: ['acquisition', 'retention', 'reactivation', 'seasonal', 'referral', 'loyalty']
    },
    source: {
      type: String,
      enum: ['email', 'sms', 'push', 'social', 'website', 'app', 'referral']
    }
  },
  
  // Auto-generation Rules
  autoGeneration: {
    isAutoGenerated: {
      type: Boolean,
      default: false
    },
    template: String,
    generationRules: {
      prefix: String,
      suffix: String,
      length: Number,
      includeNumbers: Boolean,
      includeLetters: Boolean
    }
  },
  
  // Stacking Rules
  stackingRules: {
    canStackWithOthers: {
      type: Boolean,
      default: false
    },
    stackableWith: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PromoCode'
    }],
    priority: {
      type: Number,
      default: 0
    }
  },
  
  // Admin Information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  approvedAt: Date,
  
  // Notes and Comments
  internalNotes: String,
  publicTerms: String

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
promoCodeSchema.index({ code: 1 });
promoCodeSchema.index({ status: 1, validFrom: 1, validUntil: 1 });
promoCodeSchema.index({ 'targetAudience.userTypes': 1 });
promoCodeSchema.index({ validFrom: 1, validUntil: 1 });
promoCodeSchema.index({ createdAt: -1 });

// Virtual for remaining usage
promoCodeSchema.virtual('remainingUsage').get(function() {
  if (!this.usageLimit.total) return null;
  return Math.max(0, this.usageLimit.total - this.usageStats.totalUsed);
});

// Virtual for usage percentage
promoCodeSchema.virtual('usagePercentage').get(function() {
  if (!this.usageLimit.total) return 0;
  return Math.round((this.usageStats.totalUsed / this.usageLimit.total) * 100);
});

// Virtual for is expired
promoCodeSchema.virtual('isExpired').get(function() {
  return new Date() > this.validUntil;
});

// Virtual for is active
promoCodeSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         now >= this.validFrom && 
         now <= this.validUntil &&
         (!this.usageLimit.total || this.usageStats.totalUsed < this.usageLimit.total);
});

// Pre-save middleware to update status
promoCodeSchema.pre('save', function(next) {
  const now = new Date();
  
  // Check if expired
  if (now > this.validUntil) {
    this.status = 'expired';
  }
  
  // Check if exhausted
  if (this.usageLimit.total && this.usageStats.totalUsed >= this.usageLimit.total) {
    this.status = 'exhausted';
  }
  
  next();
});

// Instance method to check if user can use this promo code
promoCodeSchema.methods.canUserUse = async function(userId, orderValue = 0) {
  const now = new Date();
  
  // Check if promo is active
  if (!this.isActive) {
    return { canUse: false, reason: 'Promo code is not active' };
  }
  
  // Check minimum order value
  if (orderValue < this.minimumOrderValue) {
    return { 
      canUse: false, 
      reason: `Minimum order value of $${this.minimumOrderValue} required` 
    };
  }
  
  // Check user type restrictions
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  
  if (!user) {
    return { canUse: false, reason: 'User not found' };
  }
  
  // Check if user type is allowed
  if (!this.targetAudience.userTypes.includes('all') && 
      !this.targetAudience.userTypes.includes(user.role)) {
    return { canUse: false, reason: 'Not applicable for your user type' };
  }
  
  // Check if new users only
  if (this.targetAudience.newUsersOnly) {
    const userBookingCount = await mongoose.model('Booking').countDocuments({
      customer: userId,
      status: 'completed'
    });
    
    if (userBookingCount > 0) {
      return { canUse: false, reason: 'Only available for new users' };
    }
  }
  
  // Check specific user restrictions
  if (this.targetAudience.specificUsers.length > 0 && 
      !this.targetAudience.specificUsers.includes(userId)) {
    return { canUse: false, reason: 'Not applicable for your account' };
  }
  
  // Check excluded users
  if (this.targetAudience.excludedUsers.includes(userId)) {
    return { canUse: false, reason: 'Not applicable for your account' };
  }
  
  // Check per-user usage limit
  const userUsageCount = this.usageHistory.filter(
    usage => usage.user.toString() === userId.toString()
  ).length;
  
  if (userUsageCount >= this.usageLimit.perUser) {
    return { canUse: false, reason: 'Usage limit exceeded for your account' };
  }
  
  // Check time restrictions
  if (this.timeRestrictions.daysOfWeek.length > 0) {
    const currentDay = now.toLocaleLowerCase().substring(0, 3) + 'day';
    if (!this.timeRestrictions.daysOfWeek.includes(currentDay)) {
      return { canUse: false, reason: 'Not available on this day' };
    }
  }
  
  return { canUse: true };
};

// Instance method to calculate discount amount
promoCodeSchema.methods.calculateDiscount = function(orderValue) {
  if (orderValue < this.minimumOrderValue) {
    return 0;
  }
  
  let discount = 0;
  
  if (this.discountType === 'percentage') {
    discount = (orderValue * this.discountValue) / 100;
    if (this.maximumDiscount) {
      discount = Math.min(discount, this.maximumDiscount);
    }
  } else {
    discount = this.discountValue;
  }
  
  return Math.min(discount, orderValue);
};

// Instance method to apply promo code
promoCodeSchema.methods.applyToBooking = async function(userId, bookingId, orderValue) {
  const canUseResult = await this.canUserUse(userId, orderValue);
  
  if (!canUseResult.canUse) {
    throw new Error(canUseResult.reason);
  }
  
  const discountAmount = this.calculateDiscount(orderValue);
  
  // Add to usage history
  this.usageHistory.push({
    user: userId,
    booking: bookingId,
    discountAmount,
    orderValue,
    usedAt: new Date()
  });
  
  // Update usage stats
  this.usageStats.totalUsed += 1;
  this.usageStats.totalSavings += discountAmount;
  this.usageStats.lastUsed = new Date();
  
  // Update unique users count
  const uniqueUsers = new Set(this.usageHistory.map(h => h.user.toString()));
  this.usageStats.uniqueUsers = uniqueUsers.size;
  
  await this.save();
  
  return {
    discountAmount,
    finalAmount: orderValue - discountAmount
  };
};

// Static method to find applicable promo codes for user
promoCodeSchema.statics.findApplicableForUser = async function(userId, orderValue = 0, serviceType = null, vehicleType = null) {
  const now = new Date();
  
  const query = {
    status: 'active',
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    minimumOrderValue: { $lte: orderValue },
    isPublic: true
  };
  
  // Add service type filter if provided
  if (serviceType) {
    query.$or = [
      { applicableServices: 'all' },
      { applicableServices: serviceType }
    ];
  }
  
  // Add vehicle type filter if provided
  if (vehicleType) {
    query.$or = [
      { applicableVehicleTypes: { $size: 0 } },
      { applicableVehicleTypes: vehicleType }
    ];
  }
  
  const promoCodes = await this.find(query).sort({ discountValue: -1 });
  
  // Filter by user-specific criteria
  const applicableCodes = [];
  
  for (const promo of promoCodes) {
    const canUseResult = await promo.canUserUse(userId, orderValue);
    if (canUseResult.canUse) {
      applicableCodes.push({
        ...promo.toObject(),
        estimatedDiscount: promo.calculateDiscount(orderValue)
      });
    }
  }
  
  return applicableCodes;
};

const PromoCode = mongoose.model('PromoCode', promoCodeSchema);

module.exports = PromoCode;
