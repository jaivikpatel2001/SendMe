/**
 * PromoCode Controller
 * Handle all promo code-related operations and business logic
 */

const PromoCode = require('../models/PromoCode');
const User = require('../models/User');
const { catchAsync } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * @desc    Get all promo codes with pagination, filtering, and sorting
 * @route   GET /api/promocodes
 * @access  Admin only
 */
const getPromoCodes = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    discountType,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    isPublic,
    campaignType
  } = req.query;

  // Build query
  const query = {};
  
  if (status) query.status = status;
  if (discountType) query.discountType = discountType;
  if (isPublic !== undefined) query.isPublic = isPublic === 'true';
  if (campaignType) query['campaign.type'] = campaignType;
  
  if (search) {
    query.$or = [
      { code: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query
  const [promoCodes, total] = await Promise.all([
    PromoCode.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName email'),
    PromoCode.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: {
      promoCodes,
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
 * @desc    Get single promo code by ID
 * @route   GET /api/promocodes/:id
 * @access  Admin only
 */
const getPromoCodeById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const promoCode = await PromoCode.findById(id)
    .populate('createdBy', 'firstName lastName email')
    .populate('lastModifiedBy', 'firstName lastName email')
    .populate('approvedBy', 'firstName lastName email')
    .populate('usageHistory.user', 'firstName lastName email')
    .populate('usageHistory.booking', 'bookingId status');

  if (!promoCode) {
    return res.status(404).json({
      success: false,
      message: 'Promo code not found'
    });
  }

  res.status(200).json({
    success: true,
    data: { promoCode }
  });
});

/**
 * @desc    Create new promo code
 * @route   POST /api/promocodes
 * @access  Admin only
 */
const createPromoCode = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const promoCodeData = {
    ...req.body,
    createdBy: req.user._id
  };

  // Auto-generate code if not provided
  if (!promoCodeData.code) {
    promoCodeData.code = generatePromoCode();
  } else {
    promoCodeData.code = promoCodeData.code.toUpperCase();
  }

  // Check if code already exists
  const existingCode = await PromoCode.findOne({ code: promoCodeData.code });
  if (existingCode) {
    return res.status(400).json({
      success: false,
      message: 'Promo code already exists'
    });
  }

  // Normalize validity dates to UTC day boundaries if provided
  const { parseDateToUTCStart, parseDateToUTCEnd } = require('../utils/time');
  if (promoCodeData.validFrom) promoCodeData.validFrom = parseDateToUTCStart(promoCodeData.validFrom);
  if (promoCodeData.validUntil) promoCodeData.validUntil = parseDateToUTCEnd(promoCodeData.validUntil);

  const promoCode = await PromoCode.create(promoCodeData);

  logger.info(`New promo code created: ${promoCode.code} by ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Promo code created successfully',
    data: { promoCode }
  });
});

/**
 * @desc    Update promo code
 * @route   PUT /api/promocodes/:id
 * @access  Admin only
 */
const updatePromoCode = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updates = {
    ...req.body,
    lastModifiedBy: req.user._id
  };

  const promoCode = await PromoCode.findById(id);

  if (!promoCode) {
    return res.status(404).json({
      success: false,
      message: 'Promo code not found'
    });
  }

  // Don't allow updating code if it has been used
  if (updates.code && promoCode.usageStats.totalUsed > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot update code for promo codes that have been used'
    });
  }

  // Remove fields that shouldn't be updated directly
  delete updates.usageStats;
  delete updates.usageHistory;
  delete updates.createdBy;

  // Normalize validity dates to UTC day boundaries if provided
  const { parseDateToUTCStart, parseDateToUTCEnd } = require('../utils/time');
  if (updates.validFrom) updates.validFrom = parseDateToUTCStart(updates.validFrom);
  if (updates.validUntil) updates.validUntil = parseDateToUTCEnd(updates.validUntil);

  const updatedPromoCode = await PromoCode.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  logger.info(`Promo code updated: ${updatedPromoCode.code}`);

  res.status(200).json({
    success: true,
    message: 'Promo code updated successfully',
    data: { promoCode: updatedPromoCode }
  });
});

/**
 * @desc    Partial update promo code
 * @route   PATCH /api/promocodes/:id
 * @access  Admin only
 */
const patchPromoCode = catchAsync(async (req, res) => {
  // Use the same logic as updatePromoCode for PATCH
  await updatePromoCode(req, res);
});

/**
 * @desc    Delete promo code (soft delete)
 * @route   DELETE /api/promocodes/:id
 * @access  Admin only
 */
const deletePromoCode = catchAsync(async (req, res) => {
  const { id } = req.params;

  const promoCode = await PromoCode.findById(id);

  if (!promoCode) {
    return res.status(404).json({
      success: false,
      message: 'Promo code not found'
    });
  }

  // Soft delete by updating status
  promoCode.status = 'inactive';
  await promoCode.save();

  logger.info(`Promo code deactivated: ${promoCode.code}`);

  res.status(200).json({
    success: true,
    message: 'Promo code deleted successfully'
  });
});

/**
 * @desc    Validate promo code for user
 * @route   POST /api/promocodes/validate
 * @access  Customer, Admin
 */
const validatePromoCode = catchAsync(async (req, res) => {
  const { code, orderValue = 0, serviceType, vehicleType } = req.body;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: 'Promo code is required'
    });
  }

  const promoCode = await PromoCode.findOne({ code: code.toUpperCase() });

  if (!promoCode) {
    return res.status(404).json({
      success: false,
      message: 'Invalid promo code'
    });
  }

  // Check if user can use this promo code
  const canUseResult = await promoCode.canUserUse(req.user._id, orderValue);

  if (!canUseResult.canUse) {
    return res.status(400).json({
      success: false,
      message: canUseResult.reason
    });
  }

  // Check service type restrictions
  if (serviceType && promoCode.applicableServices.length > 0 && 
      !promoCode.applicableServices.includes('all') &&
      !promoCode.applicableServices.includes(serviceType)) {
    return res.status(400).json({
      success: false,
      message: 'Promo code not applicable for this service type'
    });
  }

  // Check vehicle type restrictions
  if (vehicleType && promoCode.applicableVehicleTypes.length > 0 &&
      !promoCode.applicableVehicleTypes.includes(vehicleType)) {
    return res.status(400).json({
      success: false,
      message: 'Promo code not applicable for this vehicle type'
    });
  }

  const discountAmount = promoCode.calculateDiscount(orderValue);

  res.status(200).json({
    success: true,
    message: 'Promo code is valid',
    data: {
      promoCode: {
        _id: promoCode._id,
        code: promoCode.code,
        name: promoCode.name,
        description: promoCode.description,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue
      },
      discountAmount,
      finalAmount: orderValue - discountAmount
    }
  });
});

/**
 * @desc    Get applicable promo codes for user
 * @route   GET /api/promocodes/applicable
 * @access  Customer, Admin
 */
const getApplicablePromoCodes = catchAsync(async (req, res) => {
  const { orderValue = 0, serviceType, vehicleType } = req.query;

  const applicableCodes = await PromoCode.findApplicableForUser(
    req.user._id,
    parseFloat(orderValue),
    serviceType,
    vehicleType
  );

  res.status(200).json({
    success: true,
    data: {
      promoCodes: applicableCodes,
      count: applicableCodes.length
    }
  });
});

/**
 * Helper function to generate random promo code
 */
const generatePromoCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

module.exports = {
  getPromoCodes,
  getPromoCodeById,
  createPromoCode,
  updatePromoCode,
  patchPromoCode,
  deletePromoCode,
  validatePromoCode,
  getApplicablePromoCodes
};
