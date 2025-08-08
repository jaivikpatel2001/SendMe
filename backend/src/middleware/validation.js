/**
 * Validation Middleware
 * Input validation using Joi for request validation
 */

const Joi = require('joi');
const { AppError } = require('./errorHandler');

/**
 * Validate request data against Joi schema
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Request property to validate (body, params, query)
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      return next(new AppError(`Validation Error: ${errorMessage}`, 400));
    }

    // Replace the original data with validated data
    req[property] = value;
    next();
  };
};

// Common validation schemas
const schemas = {
  // Authentication schemas
  register: Joi.object({
    firstName: Joi.string()
      .trim()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.min': 'First name must be at least 2 characters long',
        'string.max': 'First name cannot exceed 50 characters',
        'any.required': 'First name is required'
      }),
    
    lastName: Joi.string()
      .trim()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.min': 'Last name must be at least 2 characters long',
        'string.max': 'Last name cannot exceed 50 characters',
        'any.required': 'Last name is required'
      }),
    
    email: Joi.string()
      .email()
      .lowercase()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    
    phone: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .required()
      .messages({
        'string.pattern.base': 'Please provide a valid phone number',
        'any.required': 'Phone number is required'
      }),
    
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password cannot exceed 128 characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
      }),
    
    role: Joi.string()
      .valid('customer', 'driver')
      .default('customer'),
    
    referralCode: Joi.string()
      .optional()
  }),

  login: Joi.object({
    email: Joi.string()
      .email()
      .lowercase()
      .required(),
    
    password: Joi.string()
      .required()
  }),

  otpRequest: Joi.object({
    phone: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .required()
  }),

  otpVerify: Joi.object({
    phone: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .required(),
    
    otp: Joi.string()
      .length(6)
      .pattern(/^\d+$/)
      .required()
      .messages({
        'string.length': 'OTP must be 6 digits',
        'string.pattern.base': 'OTP must contain only numbers'
      })
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string()
      .required()
  }),

  // Booking schemas
  createBooking: Joi.object({
    serviceType: Joi.string()
      .valid('delivery', 'pickup', 'moving', 'express', 'scheduled')
      .required(),
    
    vehicleType: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid vehicle type ID'
      }),
    
    pickupLocation: Joi.object({
      address: Joi.string().required(),
      coordinates: Joi.object({
        latitude: Joi.number().min(-90).max(90).required(),
        longitude: Joi.number().min(-180).max(180).required()
      }).required(),
      contactPerson: Joi.object({
        name: Joi.string().optional(),
        phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional()
      }).optional(),
      instructions: Joi.string().max(500).optional()
    }).required(),
    
    dropLocation: Joi.object({
      address: Joi.string().required(),
      coordinates: Joi.object({
        latitude: Joi.number().min(-90).max(90).required(),
        longitude: Joi.number().min(-180).max(180).required()
      }).required(),
      contactPerson: Joi.object({
        name: Joi.string().optional(),
        phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional()
      }).optional(),
      instructions: Joi.string().max(500).optional()
    }).required(),
    
    goodsDetails: Joi.object({
      type: Joi.string()
        .valid('documents', 'electronics', 'food', 'clothing', 'furniture', 'fragile', 'other')
        .required(),
      description: Joi.string().max(1000).optional(),
      weight: Joi.number().min(0).max(10000).optional(),
      dimensions: Joi.object({
        length: Joi.number().min(0).optional(),
        width: Joi.number().min(0).optional(),
        height: Joi.number().min(0).optional()
      }).optional(),
      value: Joi.number().min(0).optional(),
      quantity: Joi.number().integer().min(1).default(1),
      specialInstructions: Joi.string().max(500).optional()
    }).required(),
    
    scheduledFor: Joi.date()
      .min('now')
      .optional(),
    
    paymentMethod: Joi.string()
      .valid('card', 'wallet', 'cash', 'upi', 'bank_transfer')
      .required(),
    
    promoCode: Joi.string()
      .optional()
  }),

  updateBookingStatus: Joi.object({
    status: Joi.string()
      .valid(
        'confirmed', 'driver_assigned', 'driver_en_route', 
        'arrived_pickup', 'pickup_completed', 'in_transit', 
        'arrived_delivery', 'delivered', 'completed', 'cancelled', 'failed'
      )
      .required(),
    
    location: Joi.object({
      latitude: Joi.number().min(-90).max(90).optional(),
      longitude: Joi.number().min(-180).max(180).optional()
    }).optional(),
    
    notes: Joi.string()
      .max(500)
      .optional()
  }),

  // User profile schemas
  updateProfile: Joi.object({
    firstName: Joi.string().trim().min(2).max(50).optional(),
    lastName: Joi.string().trim().min(2).max(50).optional(),
    dateOfBirth: Joi.date().max('now').optional(),
    gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').optional(),
    
    addresses: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('home', 'work', 'other').required(),
        label: Joi.string().optional(),
        address: Joi.string().required(),
        city: Joi.string().required(),
        state: Joi.string().required(),
        country: Joi.string().default(process.env.DEFAULT_COUNTRY || 'US'),
        postalCode: Joi.string().optional(),
        coordinates: Joi.object({
          latitude: Joi.number().min(-90).max(90).optional(),
          longitude: Joi.number().min(-180).max(180).optional()
        }).optional(),
        isDefault: Joi.boolean().default(false)
      })
    ).optional(),
    
    preferences: Joi.object({
      language: Joi.string().default(process.env.DEFAULT_LANGUAGE || 'en'),
      currency: Joi.string().default(process.env.DEFAULT_CURRENCY || 'USD'),
      notifications: Joi.object({
        email: Joi.boolean().default(true),
        sms: Joi.boolean().default(true),
        push: Joi.boolean().default(true),
        marketing: Joi.boolean().default(false)
      }).optional()
    }).optional()
  }),

  // Driver registration schema
  driverRegistration: Joi.object({
    firstName: Joi.string().trim().min(2).max(50).required(),
    lastName: Joi.string().trim().min(2).max(50).required(),
    email: Joi.string().email().lowercase().required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    password: Joi.string().min(8).max(128).required(),
    
    licenseNumber: Joi.string().required(),
    licenseExpiry: Joi.date().min('now').required(),
    
    vehicleDetails: Joi.object({
      make: Joi.string().required(),
      model: Joi.string().required(),
      year: Joi.number().integer().min(1990).max(new Date().getFullYear() + 1).required(),
      color: Joi.string().required(),
      plateNumber: Joi.string().required(),
      registrationNumber: Joi.string().required(),
      registrationExpiry: Joi.date().min('now').required(),
      insuranceNumber: Joi.string().required(),
      insuranceExpiry: Joi.date().min('now').required()
    }).required(),
    
    bankDetails: Joi.object({
      accountHolderName: Joi.string().required(),
      accountNumber: Joi.string().required(),
      bankName: Joi.string().required(),
      routingNumber: Joi.string().required(),
      accountType: Joi.string().valid('checking', 'savings').required()
    }).required()
  }),

  // Review schema
  submitReview: Joi.object({
    bookingId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    review: Joi.string().max(1000).optional()
  }),

  // Pagination schema
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().optional(),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }),

  // MongoDB ObjectId schema
  objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
    'string.pattern.base': 'Invalid ID format'
  }),

  // Coordinates schema
  coordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
  }),

  // Date range schema
  dateRange: Joi.object({
    startDate: Joi.date().optional(),
    endDate: Joi.date().min(Joi.ref('startDate')).optional()
  }),

  // Admin schemas
  updateUserStatus: Joi.object({
    status: Joi.string().valid('pending', 'active', 'suspended', 'rejected', 'deleted').required(),
    reason: Joi.string().max(500).optional()
  }),

  createPromoCode: Joi.object({
    code: Joi.string().uppercase().min(3).max(20).required(),
    description: Joi.string().max(500).required(),
    type: Joi.string().valid('percentage', 'fixed').required(),
    value: Joi.number().min(0).required(),
    minimumOrderValue: Joi.number().min(0).optional(),
    maximumDiscount: Joi.number().min(0).optional(),
    usageLimit: Joi.number().integer().min(1).optional(),
    userLimit: Joi.number().integer().min(1).optional(),
    validFrom: Joi.date().required(),
    validUntil: Joi.date().min(Joi.ref('validFrom')).required(),
    isActive: Joi.boolean().default(true)
  })
};

// Validation middleware functions
const validateRegister = validate(schemas.register);
const validateLogin = validate(schemas.login);
const validateOTPRequest = validate(schemas.otpRequest);
const validateOTPVerify = validate(schemas.otpVerify);
const validateRefreshToken = validate(schemas.refreshToken);
const validateCreateBooking = validate(schemas.createBooking);
const validateUpdateBookingStatus = validate(schemas.updateBookingStatus);
const validateUpdateProfile = validate(schemas.updateProfile);
const validateDriverRegistration = validate(schemas.driverRegistration);
const validateSubmitReview = validate(schemas.submitReview);
const validatePagination = validate(schemas.pagination, 'query');
const validateObjectId = (field = 'id') => validate(Joi.object({ [field]: schemas.objectId }), 'params');
const validateCoordinates = validate(schemas.coordinates);
const validateDateRange = validate(schemas.dateRange, 'query');
const validateUpdateUserStatus = validate(schemas.updateUserStatus);
const validateCreatePromoCode = validate(schemas.createPromoCode);

module.exports = {
  validate,
  schemas,
  validateRegister,
  validateLogin,
  validateOTPRequest,
  validateOTPVerify,
  validateRefreshToken,
  validateCreateBooking,
  validateUpdateBookingStatus,
  validateUpdateProfile,
  validateDriverRegistration,
  validateSubmitReview,
  validatePagination,
  validateObjectId,
  validateCoordinates,
  validateDateRange,
  validateUpdateUserStatus,
  validateCreatePromoCode
};
