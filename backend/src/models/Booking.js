/**
 * Booking Model
 * Handles all booking-related data and operations
 */

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // Booking Identification
  bookingId: {
    type: String,
    unique: true,
    required: true
  },
  
  // Customer and Driver Information
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Customer is required']
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Service Details
  serviceType: {
    type: String,
    enum: ['delivery', 'pickup', 'moving', 'express', 'scheduled'],
    required: [true, 'Service type is required']
  },
  vehicleType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleType',
    required: [true, 'Vehicle type is required']
  },
  
  // Location Information
  pickupLocation: {
    address: {
      type: String,
      required: [true, 'Pickup address is required']
    },
    coordinates: {
      latitude: {
        type: Number,
        required: true
      },
      longitude: {
        type: Number,
        required: true
      }
    },
    contactPerson: {
      name: String,
      phone: String
    },
    instructions: String
  },
  
  dropLocation: {
    address: {
      type: String,
      required: [true, 'Drop address is required']
    },
    coordinates: {
      latitude: {
        type: Number,
        required: true
      },
      longitude: {
        type: Number,
        required: true
      }
    },
    contactPerson: {
      name: String,
      phone: String
    },
    instructions: String
  },
  
  // Additional Stops (for multiple delivery points)
  additionalStops: [{
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    contactPerson: {
      name: String,
      phone: String
    },
    instructions: String,
    sequence: Number
  }],
  
  // Distance and Route Information
  distance: {
    total: {
      type: Number,
      required: true // in kilometers
    },
    estimated: Number,
    actual: Number
  },
  duration: {
    estimated: Number, // in minutes
    actual: Number
  },
  route: {
    polyline: String,
    waypoints: [String]
  },
  
  // Goods Information
  goodsDetails: {
    type: {
      type: String,
      enum: ['documents', 'electronics', 'food', 'clothing', 'furniture', 'fragile', 'other'],
      required: true
    },
    description: String,
    weight: Number, // in kg
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    value: Number,
    quantity: {
      type: Number,
      default: 1
    },
    specialInstructions: String,
    images: [String]
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
  
  // Booking Status and Timeline
  status: {
    type: String,
    enum: [
      'pending',           // Booking created, waiting for driver
      'confirmed',         // Driver assigned
      'driver_assigned',   // Driver accepted the booking
      'driver_en_route',   // Driver is on the way to pickup
      'arrived_pickup',    // Driver arrived at pickup location
      'pickup_completed',  // Goods picked up
      'in_transit',        // On the way to delivery
      'arrived_delivery',  // Driver arrived at delivery location
      'delivered',         // Goods delivered successfully
      'completed',         // Booking completed and payment processed
      'cancelled',         // Booking cancelled
      'failed'            // Delivery failed
    ],
    default: 'pending'
  },
  
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    location: {
      latitude: Number,
      longitude: Number
    },
    notes: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Pricing and Payment
  pricing: {
    baseFare: {
      type: Number,
      required: true
    },
    distanceFare: {
      type: Number,
      required: true
    },
    timeFare: Number,
    waitingCharges: {
      type: Number,
      default: 0
    },
    additionalCharges: [{
      type: String,
      amount: Number,
      description: String
    }],
    peakHourMultiplier: {
      type: Number,
      default: 1
    },
    subtotal: {
      type: Number,
      required: true
    },
    discount: {
      amount: {
        type: Number,
        default: 0
      },
      promoCode: String,
      type: {
        type: String,
        enum: ['percentage', 'fixed']
      }
    },
    tax: {
      amount: {
        type: Number,
        default: 0
      },
      percentage: {
        type: Number,
        default: 0
      }
    },
    total: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: process.env.DEFAULT_CURRENCY || 'USD'
    }
  },
  
  // Payment Information
  payment: {
    method: {
      type: String,
      enum: ['card', 'wallet', 'cash', 'upi', 'bank_transfer'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    transactionId: String,
    paymentIntentId: String, // Stripe payment intent ID
    refundId: String,
    paidAt: Date,
    refundedAt: Date,
    failureReason: String
  },
  
  // Driver Assignment
  driverAssignment: {
    assignedAt: Date,
    acceptedAt: Date,
    rejectedDrivers: [{
      driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      rejectedAt: Date,
      reason: String
    }],
    autoAssigned: {
      type: Boolean,
      default: false
    }
  },
  
  // Tracking Information
  tracking: {
    isLive: {
      type: Boolean,
      default: false
    },
    currentLocation: {
      latitude: Number,
      longitude: Number,
      lastUpdated: Date
    },
    estimatedArrival: {
      pickup: Date,
      delivery: Date
    },
    actualArrival: {
      pickup: Date,
      delivery: Date
    }
  },
  
  // Add-on Services
  addOns: [{
    service: {
      type: String,
      enum: ['insurance', 'express_delivery', 'fragile_handling', 'assembly', 'packaging']
    },
    price: Number,
    selected: {
      type: Boolean,
      default: false
    }
  }],
  
  // Communication
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['text', 'image', 'location'],
      default: 'text'
    }
  }],
  
  // Cancellation Information
  cancellation: {
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    cancelledAt: Date,
    reason: String,
    cancellationFee: {
      type: Number,
      default: 0
    }
  },
  
  // Rating and Review
  rating: {
    customerRating: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      review: String,
      ratedAt: Date
    },
    driverRating: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      review: String,
      ratedAt: Date
    }
  },
  
  // Metadata
  platform: {
    type: String,
    enum: ['web', 'mobile', 'admin'],
    default: 'web'
  },
  promoCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PromoCode'
  },
  
  // Special Flags
  isEmergency: {
    type: Boolean,
    default: false
  },
  isReturn: {
    type: Boolean,
    default: false
  },
  parentBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  
  // Admin Notes
  adminNotes: String,
  internalNotes: String

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
bookingSchema.index({ bookingId: 1 });
bookingSchema.index({ customer: 1, createdAt: -1 });
bookingSchema.index({ driver: 1, createdAt: -1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ scheduledFor: 1 });
bookingSchema.index({ 'pickupLocation.coordinates': '2dsphere' });
bookingSchema.index({ 'dropLocation.coordinates': '2dsphere' });
bookingSchema.index({ createdAt: -1 });

// Virtual for booking duration
bookingSchema.virtual('bookingDuration').get(function() {
  if (this.statusHistory.length >= 2) {
    const startTime = this.statusHistory.find(h => h.status === 'confirmed')?.timestamp || this.createdAt;
    const endTime = this.statusHistory.find(h => h.status === 'completed')?.timestamp;
    
    if (endTime) {
      return Math.round((endTime - startTime) / (1000 * 60)); // in minutes
    }
  }
  return null;
});

// Virtual for estimated delivery time
bookingSchema.virtual('estimatedDeliveryTime').get(function() {
  if (this.tracking.estimatedArrival.delivery) {
    return this.tracking.estimatedArrival.delivery;
  }
  
  // Calculate based on distance and average speed
  const averageSpeed = 30; // km/h
  const estimatedMinutes = (this.distance.total / averageSpeed) * 60;
  return new Date(this.scheduledFor.getTime() + estimatedMinutes * 60000);
});

// Pre-save middleware to generate booking ID
bookingSchema.pre('save', function(next) {
  if (!this.bookingId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.bookingId = `BK${timestamp}${random}`.toUpperCase();
  }
  next();
});

// Pre-save middleware to update status history
bookingSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      updatedBy: this._updatedBy // This should be set by the controller
    });
  }
  next();
});

// Instance method to calculate total price
bookingSchema.methods.calculateTotalPrice = function() {
  let total = this.pricing.baseFare + this.pricing.distanceFare;
  
  if (this.pricing.timeFare) total += this.pricing.timeFare;
  if (this.pricing.waitingCharges) total += this.pricing.waitingCharges;
  
  // Add additional charges
  this.pricing.additionalCharges.forEach(charge => {
    total += charge.amount;
  });
  
  // Apply peak hour multiplier
  total *= this.pricing.peakHourMultiplier;
  
  // Apply discount
  if (this.pricing.discount.amount > 0) {
    if (this.pricing.discount.type === 'percentage') {
      total -= (total * this.pricing.discount.amount / 100);
    } else {
      total -= this.pricing.discount.amount;
    }
  }
  
  // Add tax
  if (this.pricing.tax.amount > 0) {
    total += this.pricing.tax.amount;
  }
  
  this.pricing.subtotal = total - (this.pricing.tax.amount || 0);
  this.pricing.total = total;
  
  return total;
};

// Instance method to check if booking can be cancelled
bookingSchema.methods.canBeCancelled = function() {
  const nonCancellableStatuses = ['pickup_completed', 'in_transit', 'arrived_delivery', 'delivered', 'completed'];
  return !nonCancellableStatuses.includes(this.status);
};

// Instance method to get current status info
bookingSchema.methods.getCurrentStatusInfo = function() {
  const statusInfo = {
    pending: 'Searching for a driver',
    confirmed: 'Driver assigned',
    driver_assigned: 'Driver is on the way',
    driver_en_route: 'Driver is coming to pickup location',
    arrived_pickup: 'Driver has arrived at pickup location',
    pickup_completed: 'Package picked up',
    in_transit: 'Package is on the way',
    arrived_delivery: 'Driver has arrived at delivery location',
    delivered: 'Package delivered',
    completed: 'Booking completed',
    cancelled: 'Booking cancelled',
    failed: 'Delivery failed'
  };
  
  return statusInfo[this.status] || 'Unknown status';
};

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
