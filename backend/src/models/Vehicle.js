/**
 * Vehicle Type Model
 * Defines different vehicle categories and their specifications
 */

const mongoose = require('mongoose');

const vehicleTypeSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Vehicle type name is required'],
    unique: true,
    trim: true
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Vehicle Specifications
  specifications: {
    maxWeight: {
      type: Number,
      required: [true, 'Maximum weight capacity is required'],
      min: [0, 'Weight cannot be negative']
    },
    maxDimensions: {
      length: {
        type: Number,
        required: true,
        min: [0, 'Length cannot be negative']
      },
      width: {
        type: Number,
        required: true,
        min: [0, 'Width cannot be negative']
      },
      height: {
        type: Number,
        required: true,
        min: [0, 'Height cannot be negative']
      }
    },
    loadCapacity: {
      type: String,
      required: true
    },
    fuelType: {
      type: String,
      enum: ['petrol', 'diesel', 'electric', 'hybrid', 'cng'],
      required: true
    }
  },
  
  // Pricing Configuration
  pricing: {
    baseFare: {
      type: Number,
      required: [true, 'Base fare is required'],
      min: [0, 'Base fare cannot be negative']
    },
    perKmRate: {
      type: Number,
      required: [true, 'Per kilometer rate is required'],
      min: [0, 'Per km rate cannot be negative']
    },
    perMinuteRate: {
      type: Number,
      default: 0,
      min: [0, 'Per minute rate cannot be negative']
    },
    waitingChargePerMinute: {
      type: Number,
      default: 0,
      min: [0, 'Waiting charge cannot be negative']
    },
    minimumFare: {
      type: Number,
      required: [true, 'Minimum fare is required'],
      min: [0, 'Minimum fare cannot be negative']
    },
    cancellationFee: {
      type: Number,
      default: 0,
      min: [0, 'Cancellation fee cannot be negative']
    },
    currency: {
      type: String,
      default: process.env.DEFAULT_CURRENCY || 'GBP'
    }
  },
  
  // Peak Hour Pricing
  peakHourPricing: {
    enabled: {
      type: Boolean,
      default: false
    },
    multiplier: {
      type: Number,
      default: 1.5,
      min: [1, 'Peak hour multiplier must be at least 1']
    },
    timeSlots: [{
      startTime: {
        type: String,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
      },
      endTime: {
        type: String,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
      },
      days: [{
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      }]
    }]
  },
  
  // Visual Assets
  images: {
    icon: {
      type: String,
      required: [true, 'Vehicle icon is required']
    },
    thumbnail: String,
    gallery: [String]
  },
  
  // Availability and Service Areas
  availability: {
    isActive: {
      type: Boolean,
      default: true
    },
    serviceAreas: [{
      city: {
        type: String,
        required: true
      },
      state: {
        type: String,
        required: true
      },
      country: {
        type: String,
        required: true,
        default: process.env.DEFAULT_COUNTRY || 'GB'
      },
      postalCodes: [String],
      coordinates: {
        center: {
          latitude: Number,
          longitude: Number
        },
        radius: {
          type: Number,
          default: 50 // in kilometers
        }
      }
    }],
    operatingHours: {
      enabled: {
        type: Boolean,
        default: false
      },
      schedule: [{
        day: {
          type: String,
          enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          required: true
        },
        startTime: {
          type: String,
          match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
        },
        endTime: {
          type: String,
          match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
        },
        isAvailable: {
          type: Boolean,
          default: true
        }
      }]
    }
  },
  
  // Service Features
  features: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    icon: String,
    isHighlight: {
      type: Boolean,
      default: false
    }
  }],
  
  // Restrictions and Requirements
  restrictions: {
    minDistance: {
      type: Number,
      default: 0,
      min: [0, 'Minimum distance cannot be negative']
    },
    maxDistance: {
      type: Number,
      default: 100,
      min: [0, 'Maximum distance cannot be negative']
    },
    prohibitedItems: [String],
    specialRequirements: [String],
    ageRestriction: {
      type: Number,
      min: [18, 'Minimum age must be 18']
    },
    licenseRequirements: [String]
  },
  
  // Driver Requirements
  driverRequirements: {
    minimumRating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be negative'],
      max: [5, 'Rating cannot exceed 5']
    },
    minimumExperience: {
      type: Number,
      default: 0,
      min: [0, 'Experience cannot be negative']
    },
    requiredDocuments: [String],
    backgroundCheckRequired: {
      type: Boolean,
      default: false
    }
  },
  
  // Insurance and Safety
  insurance: {
    required: {
      type: Boolean,
      default: true
    },
    minimumCoverage: {
      type: Number,
      default: 100000
    },
    coverageTypes: [String]
  },
  
  // Commission and Earnings
  commission: {
    platformPercentage: {
      type: Number,
      required: [true, 'Platform commission percentage is required'],
      min: [0, 'Commission cannot be negative'],
      max: [100, 'Commission cannot exceed 100%']
    },
    driverPercentage: {
      type: Number,
      required: [true, 'Driver commission percentage is required'],
      min: [0, 'Commission cannot be negative'],
      max: [100, 'Commission cannot exceed 100%']
    }
  },
  
  // Analytics and Metrics
  metrics: {
    totalBookings: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be negative'],
      max: [5, 'Rating cannot exceed 5']
    },
    popularityScore: {
      type: Number,
      default: 0
    }
  },
  
  // SEO and Marketing
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String],
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true
    }
  },
  
  // Sorting and Display
  sortOrder: {
    type: Number,
    default: 0
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  
  // Status and Lifecycle
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'deprecated'],
    default: 'active'
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  version: {
    type: Number,
    default: 1
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
vehicleTypeSchema.index({ name: 1 });
vehicleTypeSchema.index({ status: 1, isActive: 1 });
vehicleTypeSchema.index({ sortOrder: 1 });
vehicleTypeSchema.index({ 'seo.slug': 1 });
vehicleTypeSchema.index({ 'availability.serviceAreas.city': 1 });

// Virtual for volume capacity
vehicleTypeSchema.virtual('volumeCapacity').get(function() {
  const { length, width, height } = this.specifications.maxDimensions;
  return length * width * height;
});

// Virtual for display price
vehicleTypeSchema.virtual('displayPrice').get(function() {
  return `${this.pricing.currency} ${this.pricing.baseFare} + ${this.pricing.currency} ${this.pricing.perKmRate}/km`;
});

// Pre-save middleware to generate slug
vehicleTypeSchema.pre('save', function(next) {
  if (this.isModified('name') || !this.seo.slug) {
    this.seo.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  next();
});

// Pre-save middleware to validate commission percentages
vehicleTypeSchema.pre('save', function(next) {
  const total = this.commission.platformPercentage + this.commission.driverPercentage;
  if (Math.abs(total - 100) > 0.01) {
    return next(new Error('Platform and driver commission percentages must sum to 100%'));
  }
  next();
});

// Instance method to check if vehicle is available in area
vehicleTypeSchema.methods.isAvailableInArea = function(latitude, longitude) {
  if (!this.availability.isActive || this.status !== 'active') {
    return false;
  }
  
  // Check if coordinates fall within any service area
  return this.availability.serviceAreas.some(area => {
    if (!area.coordinates.center.latitude || !area.coordinates.center.longitude) {
      return false;
    }
    
    const distance = this.calculateDistance(
      latitude,
      longitude,
      area.coordinates.center.latitude,
      area.coordinates.center.longitude
    );
    
    return distance <= area.coordinates.radius;
  });
};

// Instance method to calculate distance between two points
vehicleTypeSchema.methods.calculateDistance = function(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Instance method to calculate fare for a booking
vehicleTypeSchema.methods.calculateFare = function(distance, duration, isPeakHour = false) {
  let fare = this.pricing.baseFare;
  fare += distance * this.pricing.perKmRate;
  
  if (this.pricing.perMinuteRate > 0 && duration) {
    fare += duration * this.pricing.perMinuteRate;
  }
  
  if (isPeakHour && this.peakHourPricing.enabled) {
    fare *= this.peakHourPricing.multiplier;
  }
  
  return Math.max(fare, this.pricing.minimumFare);
};

// Instance method to check if current time is peak hour
vehicleTypeSchema.methods.isPeakHour = function() {
  if (!this.peakHourPricing.enabled) {
    return false;
  }
  
  const now = new Date();
  const currentDay = now.toLocaleLowerCase().substring(0, 3) + 'day';
  const currentTime = now.toTimeString().substring(0, 5);
  
  return this.peakHourPricing.timeSlots.some(slot => {
    return slot.days.includes(currentDay) &&
           currentTime >= slot.startTime &&
           currentTime <= slot.endTime;
  });
};

const VehicleType = mongoose.model('VehicleType', vehicleTypeSchema);

module.exports = VehicleType;
