/**
 * Vehicle Controller
 * Handle all vehicle type-related operations and business logic
 */

const Vehicle = require('../models/Vehicle');
const Booking = require('../models/Booking');
const { catchAsync } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * @desc    Get all vehicle types with pagination, filtering, and sorting
 * @route   GET /api/vehicles
 * @access  Public
 */
const getVehicles = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    search,
    sortBy = 'sortOrder',
    sortOrder = 'asc',
    isActive,
    isFeatured,
    isPopular,
    category
  } = req.query;

  // Build query
  const query = {};
  
  if (status) query.status = status;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';
  if (isPopular !== undefined) query.isPopular = isPopular === 'true';
  if (category) query.category = category;
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query
  const [vehicles, total] = await Promise.all([
    Vehicle.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit)),
    Vehicle.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: {
      vehicles,
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
 * @desc    Get single vehicle type by ID
 * @route   GET /api/vehicles/:id
 * @access  Public
 */
const getVehicleById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const vehicle = await Vehicle.findById(id);

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle type not found'
    });
  }

  // Get usage statistics
  const stats = await getVehicleStats(id);

  res.status(200).json({
    success: true,
    data: {
      vehicle,
      stats
    }
  });
});

/**
 * @desc    Create new vehicle type
 * @route   POST /api/vehicles
 * @access  Admin only
 */
const createVehicle = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const vehicleData = req.body;

  // Generate slug if not provided
  if (!vehicleData.seo?.slug) {
    vehicleData.seo = vehicleData.seo || {};
    vehicleData.seo.slug = vehicleData.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // Check if slug already exists
  const existingVehicle = await Vehicle.findOne({ 'seo.slug': vehicleData.seo.slug });
  if (existingVehicle) {
    vehicleData.seo.slug = `${vehicleData.seo.slug}-${Date.now()}`;
  }

  const vehicle = await Vehicle.create(vehicleData);

  logger.info(`New vehicle type created: ${vehicle.name}`);

  res.status(201).json({
    success: true,
    message: 'Vehicle type created successfully',
    data: { vehicle }
  });
});

/**
 * @desc    Update vehicle type
 * @route   PUT /api/vehicles/:id
 * @access  Admin only
 */
const updateVehicle = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const vehicle = await Vehicle.findById(id);

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle type not found'
    });
  }

  // Update slug if name changed
  if (updates.name && updates.name !== vehicle.name) {
    updates.seo = updates.seo || vehicle.seo || {};
    updates.seo.slug = updates.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if new slug already exists
    const existingVehicle = await Vehicle.findOne({ 
      'seo.slug': updates.seo.slug,
      _id: { $ne: id }
    });
    if (existingVehicle) {
      updates.seo.slug = `${updates.seo.slug}-${Date.now()}`;
    }
  }

  const updatedVehicle = await Vehicle.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  logger.info(`Vehicle type updated: ${updatedVehicle.name}`);

  res.status(200).json({
    success: true,
    message: 'Vehicle type updated successfully',
    data: { vehicle: updatedVehicle }
  });
});

/**
 * @desc    Partial update vehicle type
 * @route   PATCH /api/vehicles/:id
 * @access  Admin only
 */
const patchVehicle = catchAsync(async (req, res) => {
  // Use the same logic as updateVehicle for PATCH
  await updateVehicle(req, res);
});

/**
 * @desc    Delete vehicle type (soft delete)
 * @route   DELETE /api/vehicles/:id
 * @access  Admin only
 */
const deleteVehicle = catchAsync(async (req, res) => {
  const { id } = req.params;

  const vehicle = await Vehicle.findById(id);

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle type not found'
    });
  }

  // Check if vehicle type is being used in active bookings
  const activeBookings = await Booking.countDocuments({
    vehicleType: id,
    status: { $in: ['pending', 'confirmed', 'driver_assigned', 'picked_up', 'in_transit'] }
  });

  if (activeBookings > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete vehicle type with active bookings'
    });
  }

  // Soft delete by updating status
  vehicle.status = 'deprecated';
  vehicle.isActive = false;
  await vehicle.save();

  logger.info(`Vehicle type soft deleted: ${vehicle.name}`);

  res.status(200).json({
    success: true,
    message: 'Vehicle type deleted successfully'
  });
});

/**
 * @desc    Update vehicle availability
 * @route   PATCH /api/vehicles/:id/availability
 * @access  Admin only
 */
const updateVehicleAvailability = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { isActive, availabilityZones, timeSlots } = req.body;

  const vehicle = await Vehicle.findById(id);

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle type not found'
    });
  }

  if (isActive !== undefined) vehicle.isActive = isActive;
  if (availabilityZones) vehicle.availability.zones = availabilityZones;
  if (timeSlots) vehicle.availability.timeSlots = timeSlots;

  await vehicle.save();

  logger.info(`Vehicle availability updated: ${vehicle.name}`);

  res.status(200).json({
    success: true,
    message: 'Vehicle availability updated successfully',
    data: {
      vehicle: {
        _id: vehicle._id,
        isActive: vehicle.isActive,
        availability: vehicle.availability
      }
    }
  });
});

/**
 * @desc    Update vehicle pricing
 * @route   PATCH /api/vehicles/:id/pricing
 * @access  Admin only
 */
const updateVehiclePricing = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { basePrice, pricePerKm, pricePerMinute, minimumFare, surgeMultiplier } = req.body;

  const vehicle = await Vehicle.findById(id);

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle type not found'
    });
  }

  if (basePrice !== undefined) vehicle.pricing.basePrice = basePrice;
  if (pricePerKm !== undefined) vehicle.pricing.pricePerKm = pricePerKm;
  if (pricePerMinute !== undefined) vehicle.pricing.pricePerMinute = pricePerMinute;
  if (minimumFare !== undefined) vehicle.pricing.minimumFare = minimumFare;
  if (surgeMultiplier !== undefined) vehicle.pricing.surgeMultiplier = surgeMultiplier;

  await vehicle.save();

  logger.info(`Vehicle pricing updated: ${vehicle.name}`);

  res.status(200).json({
    success: true,
    message: 'Vehicle pricing updated successfully',
    data: {
      vehicle: {
        _id: vehicle._id,
        pricing: vehicle.pricing
      }
    }
  });
});

/**
 * Helper function to get vehicle statistics
 */
const getVehicleStats = async (vehicleId) => {
  const [bookingStats] = await Promise.all([
    Booking.aggregate([
      { $match: { vehicleType: vehicleId } },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          completedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          totalRevenue: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$payment.finalAmount', 0] }
          },
          averageRating: { $avg: '$rating.customerRating.rating' }
        }
      }
    ])
  ]);

  return bookingStats[0] || {
    totalBookings: 0,
    completedBookings: 0,
    totalRevenue: 0,
    averageRating: 0
  };
};

module.exports = {
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  patchVehicle,
  deleteVehicle,
  updateVehicleAvailability,
  updateVehiclePricing
};
