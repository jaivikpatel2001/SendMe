/**
 * User Model
 * Handles Customer, Driver, and Admin user types
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    match: [/^\+44[1-9]\d{8,9}$|^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number (UK format preferred: +44...)']
  },
  password: {
    type: String,
    required: function() {
      return !this.socialAuth.google.id && !this.socialAuth.facebook.id;
    },
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false
  },
  
  // User Role and Status
  role: {
    type: String,
    enum: ['customer', 'driver', 'admin'],
    default: 'customer'
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'rejected', 'deleted'],
    default: function() {
      return this.role === 'driver' ? 'pending' : 'active';
    }
  },
  
  // Verification
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  phoneVerificationToken: String,
  
  // Social Authentication
  socialAuth: {
    google: {
      id: String,
      email: String
    },
    facebook: {
      id: String,
      email: String
    }
  },
  
  // Profile Information
  avatar: {
    type: String,
    default: null
  },
  dateOfBirth: Date,
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say']
  },
  
  // Address Information
  addresses: [{
    type: {
      type: String,
      enum: ['home', 'work', 'other'],
      required: true
    },
    label: String,
    address: {
      type: String,
      required: true
    },
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
    postalCode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  
  // Driver-specific Information
  driverInfo: {
    licenseNumber: String,
    licenseExpiry: Date,
    licenseImage: String,
    vehicleType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleType'
    },
    vehicleDetails: {
      make: String,
      model: String,
      year: Number,
      color: String,
      plateNumber: String,
      registrationNumber: String,
      registrationExpiry: Date,
      registrationImage: String,
      insuranceNumber: String,
      insuranceExpiry: Date,
      insuranceImage: String
    },
    bankDetails: {
      accountHolderName: String,
      accountNumber: String,
      bankName: String,
      routingNumber: String,
      accountType: {
        type: String,
        enum: ['checking', 'savings']
      }
    },
    documents: {
      idProof: String,
      addressProof: String,
      backgroundCheck: String,
      medicalCertificate: String
    },
    isOnline: {
      type: Boolean,
      default: false
    },
    currentLocation: {
      latitude: Number,
      longitude: Number,
      lastUpdated: Date
    },
    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
      },
      count: {
        type: Number,
        default: 0
      }
    },
    earnings: {
      total: {
        type: Number,
        default: 0
      },
      pending: {
        type: Number,
        default: 0
      },
      withdrawn: {
        type: Number,
        default: 0
      }
    }
  },
  
  // Customer-specific Information
  customerInfo: {
    preferredPaymentMethod: {
      type: String,
      enum: ['card', 'wallet', 'cash', 'upi'],
      default: 'card'
    },
    savedPaymentMethods: [{
      type: {
        type: String,
        enum: ['card', 'wallet', 'bank']
      },
      provider: String,
      last4: String,
      expiryMonth: Number,
      expiryYear: Number,
      isDefault: Boolean
    }],
    loyaltyPoints: {
      type: Number,
      default: 0
    },
    totalBookings: {
      type: Number,
      default: 0
    }
  },
  
  // Security
  passwordResetToken: String,
  passwordResetExpires: Date,
  passwordChangedAt: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  lastLogin: Date,
  
  // Preferences
  preferences: {
    language: {
      type: String,
      default: process.env.DEFAULT_LANGUAGE || 'en'
    },
    currency: {
      type: String,
      default: process.env.DEFAULT_CURRENCY || 'GBP'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      marketing: {
        type: Boolean,
        default: false
      }
    },
    privacy: {
      shareLocation: {
        type: Boolean,
        default: true
      },
      shareProfile: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Metadata
  registrationSource: {
    type: String,
    enum: ['web', 'mobile', 'admin'],
    default: 'web'
  },
  referralCode: String,
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deviceTokens: [String], // For push notifications
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ 'driverInfo.currentLocation': '2dsphere' });
userSchema.index({ createdAt: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Pre-save middleware to set passwordChangedAt
userSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();
  
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Instance method to check password
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Instance method to check if password changed after JWT was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Instance method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: {
        lockUntil: 1
      },
      $set: {
        loginAttempts: 1
      }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockUntil: 1
    }
  });
};

const User = mongoose.model('User', userSchema);

module.exports = User;
