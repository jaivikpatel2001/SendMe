/**
 * Booking Controller
 * Handle all booking-related operations and business logic
 */

const Booking = require('../models/Booking');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const PromoCode = require('../models/PromoCode');
const { catchAsync } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { calculateDistance } = require('../utils/distance');
const { calculatePricing } = require('../utils/pricing');

/**
 * @desc    Get all bookings with pagination, filtering, and sorting
 * @route   GET /api/bookings
 * @access  Admin, Customer (own bookings), Driver (assigned bookings)
 */
const getBookings = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    serviceType,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    startDate,
    endDate,
    customerId,
    driverId
  } = req.query;

  // Build query based on user role
  let query = {};
  
  if (req.user.role === 'customer') {
    query.customer = req.user._id;
  } else if (req.user.role === 'driver') {
    query.driver = req.user._id;
  }

  // Apply filters
  if (status) query.status = status;
  if (serviceType) query.serviceType = serviceType;
  if (customerId && req.user.role === 'admin') query.customer = customerId;
  if (driverId && req.user.role === 'admin') query.driver = driverId;

  // Date range filter (UTC)
  if (startDate || endDate) {
    const { parseDateToUTCStart, parseDateToUTCEnd } = require('../utils/time');
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = parseDateToUTCStart(startDate);
    if (endDate) query.createdAt.$lte = parseDateToUTCEnd(endDate);
  }

  // Search functionality
  if (search) {
    query.$or = [
      { bookingId: { $regex: search, $options: 'i' } },
      { 'pickupLocation.address': { $regex: search, $options: 'i' } },
      { 'dropLocation.address': { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query
  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('customer', 'firstName lastName email phone')
      .populate('driver', 'firstName lastName email phone driverInfo.rating')
      .populate('vehicleType', 'name basePrice')
      .populate('promoCode', 'code discountValue discountType'),
    Booking.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: {
      bookings,
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
 * @desc    Get single booking by ID
 * @route   GET /api/bookings/:id
 * @access  Admin, Customer (own booking), Driver (assigned booking)
 */
const getBookingById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .populate('customer', 'firstName lastName email phone')
    .populate('driver', 'firstName lastName email phone driverInfo.rating driverInfo.vehicleDetails')
    .populate('vehicleType', 'name basePrice features')
    .populate('promoCode', 'code discountValue discountType');

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Check access permissions
  const hasAccess = req.user.role === 'admin' ||
                   booking.customer._id.toString() === req.user._id.toString() ||
                   (booking.driver && booking.driver._id.toString() === req.user._id.toString());

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  res.status(200).json({
    success: true,
    data: { booking }
  });
});

/**
 * @desc    Create new booking
 * @route   POST /api/bookings
 * @access  Customer, Admin
 */
const createBooking = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const {
    serviceType,
    vehicleType,
    pickupLocation,
    dropLocation,
    scheduledFor,
    packageDetails,
    specialInstructions,
    promoCode,
    addOns = []
  } = req.body;

  // Generate unique booking ID
  const bookingId = `BK${Date.now()}${Math.random().toString(36).substr(2, 5)}`.toUpperCase();

  // Calculate distance and pricing
  const distance = await calculateDistance(
    pickupLocation.coordinates,
    dropLocation.coordinates
  );

  const vehicleTypeDoc = await Vehicle.findById(vehicleType);
  if (!vehicleTypeDoc) {
    return res.status(400).json({
      success: false,
      message: 'Invalid vehicle type'
    });
  }

  const pricing = await calculatePricing({
    distance,
    vehicleType: vehicleTypeDoc,
    serviceType,
    addOns,
    scheduledFor
  });

  // Apply promo code if provided
  let finalAmount = pricing.totalAmount;
  let promoCodeDoc = null;
  let discountAmount = 0;

  if (promoCode) {
    promoCodeDoc = await PromoCode.findOne({ code: promoCode.toUpperCase() });
    if (promoCodeDoc) {
      const canUseResult = await promoCodeDoc.canUserUse(req.user._id, pricing.totalAmount);
      if (canUseResult.canUse) {
        discountAmount = promoCodeDoc.calculateDiscount(pricing.totalAmount);
        finalAmount = pricing.totalAmount - discountAmount;
      } else {
        return res.status(400).json({
          success: false,
          message: canUseResult.reason
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid promo code'
      });
    }
  }

  // Create booking
  const booking = await Booking.create({
    bookingId,
    customer: req.user._id,
    serviceType,
    vehicleType,
    pickupLocation,
    dropLocation,
    scheduledFor: scheduledFor ? require('../utils/time').parseDateToUTCStart(scheduledFor) : new Date(),
    packageDetails,
    specialInstructions,
    addOns,
    distance: distance.value,
    estimatedDuration: distance.duration,
    payment: {
      baseAmount: pricing.baseAmount,
      distanceAmount: pricing.distanceAmount,
      addOnAmount: pricing.addOnAmount,
      totalAmount: pricing.totalAmount,
      discountAmount,
      finalAmount,
      currency: 'GBP'
    },
    promoCode: promoCodeDoc ? promoCodeDoc._id : null,
    status: 'pending'
  });

  // Apply promo code usage
  if (promoCodeDoc) {
    await promoCodeDoc.applyToBooking(req.user._id, booking._id, pricing.totalAmount);
  }

  // Populate the created booking
  await booking.populate([
    { path: 'customer', select: 'firstName lastName email phone' },
    { path: 'vehicleType', select: 'name basePrice features' },
    { path: 'promoCode', select: 'code discountValue discountType' }
  ]);

  logger.info(`New booking created: ${bookingId} by ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Booking created successfully',
    data: { booking }
  });
});

/**
 * @desc    Update booking
 * @route   PUT /api/bookings/:id
 * @access  Admin, Customer (before driver assigned)
 */
const updateBooking = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const booking = await Booking.findById(id);

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Check permissions
  const canUpdate = req.user.role === 'admin' ||
                   (booking.customer.toString() === req.user._id.toString() && 
                    !booking.driver && 
                    booking.status === 'pending');

  if (!canUpdate) {
    return res.status(403).json({
      success: false,
      message: 'Cannot update booking at this stage'
    });
  }

  // Remove fields that shouldn't be updated directly
  delete updates.bookingId;
  delete updates.customer;
  delete updates.driver;
  delete updates.status;
  delete updates.payment;

  const updatedBooking = await Booking.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  ).populate([
    { path: 'customer', select: 'firstName lastName email phone' },
    { path: 'driver', select: 'firstName lastName email phone' },
    { path: 'vehicleType', select: 'name basePrice features' }
  ]);

  logger.info(`Booking updated: ${booking.bookingId}`);

  res.status(200).json({
    success: true,
    message: 'Booking updated successfully',
    data: { booking: updatedBooking }
  });
});

/**
 * @desc    Partial update booking
 * @route   PATCH /api/bookings/:id
 * @access  Admin, Customer (before driver assigned)
 */
const patchBooking = catchAsync(async (req, res) => {
  // Use the same logic as updateBooking for PATCH
  await updateBooking(req, res);
});

/**
 * @desc    Cancel booking
 * @route   DELETE /api/bookings/:id
 * @access  Admin, Customer, Driver
 */
const cancelBooking = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const booking = await Booking.findById(id);

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Check permissions
  const canCancel = req.user.role === 'admin' ||
                   booking.customer.toString() === req.user._id.toString() ||
                   (booking.driver && booking.driver.toString() === req.user._id.toString());

  if (!canCancel) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  if (['completed', 'cancelled'].includes(booking.status)) {
    return res.status(400).json({
      success: false,
      message: 'Cannot cancel booking in current status'
    });
  }

  // Calculate cancellation fee if applicable
  let cancellationFee = 0;
  const timeDiff = new Date() - booking.createdAt;
  const hoursDiff = timeDiff / (1000 * 60 * 60);

  if (booking.driver && hoursDiff > 1) {
    cancellationFee = booking.payment.finalAmount * 0.1; // 10% cancellation fee
  }

  booking.status = 'cancelled';
  booking.cancellation = {
    cancelledBy: req.user._id,
    cancelledAt: new Date(),
    reason: reason || 'No reason provided',
    cancellationFee
  };

  await booking.save();

  logger.info(`Booking cancelled: ${booking.bookingId} by ${req.user.email}`);

  res.status(200).json({
    success: true,
    message: 'Booking cancelled successfully',
    data: {
      booking: {
        _id: booking._id,
        status: booking.status,
        cancellationFee
      }
    }
  });
});

/**
 * @desc    Update booking status
 * @route   PATCH /api/bookings/:id/status
 * @access  Admin, Driver (assigned bookings)
 */
const updateBookingStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const booking = await Booking.findById(id);

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Check permissions
  const canUpdate = req.user.role === 'admin' ||
                   (booking.driver && booking.driver.toString() === req.user._id.toString());

  if (!canUpdate) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const validStatuses = ['pending', 'confirmed', 'driver_assigned', 'picked_up', 'in_transit', 'delivered', 'completed', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status value'
    });
  }

  const oldStatus = booking.status;
  booking.status = status;

  // Update status history
  booking.statusHistory = booking.statusHistory || [];
  booking.statusHistory.push({
    status,
    timestamp: new Date(),
    updatedBy: req.user._id,
    notes
  });

  // Update specific timestamps based on status
  switch (status) {
    case 'picked_up':
      booking.tracking.actualArrival.pickup = new Date();
      break;
    case 'delivered':
      booking.tracking.actualArrival.delivery = new Date();
      break;
    case 'completed':
      booking.completedAt = new Date();
      break;
  }

  await booking.save();

  logger.info(`Booking status changed from ${oldStatus} to ${status}: ${booking.bookingId}`);

  res.status(200).json({
    success: true,
    message: `Booking status updated to ${status}`,
    data: { booking: { _id: booking._id, status: booking.status } }
  });
});

/**
 * @desc    Assign driver to booking
 * @route   PATCH /api/bookings/:id/assign-driver
 * @access  Admin only
 */
const assignDriver = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { driverId } = req.body;

  const [booking, driver] = await Promise.all([
    Booking.findById(id),
    User.findById(driverId)
  ]);

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  if (!driver || driver.role !== 'driver') {
    return res.status(400).json({
      success: false,
      message: 'Invalid driver'
    });
  }

  if (driver.status !== 'active' || !driver.driverInfo.isOnline) {
    return res.status(400).json({
      success: false,
      message: 'Driver is not available'
    });
  }

  booking.driver = driverId;
  booking.status = 'driver_assigned';
  booking.assignedAt = new Date();

  await booking.save();

  logger.info(`Driver assigned to booking: ${booking.bookingId} -> ${driver.email}`);

  res.status(200).json({
    success: true,
    message: 'Driver assigned successfully',
    data: {
      booking: {
        _id: booking._id,
        driver: driverId,
        status: booking.status
      }
    }
  });
});

/**
 * @desc    Update booking location tracking
 * @route   PATCH /api/bookings/:id/location
 * @access  Driver (assigned to booking)
 */
const updateBookingLocation = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude } = req.body;

  const booking = await Booking.findById(id);

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Check if user is the assigned driver
  if (!booking.driver || booking.driver.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only assigned driver can update location.'
    });
  }

  booking.tracking.isLive = true;
  booking.tracking.currentLocation = {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    lastUpdated: new Date()
  };

  await booking.save();

  res.status(200).json({
    success: true,
    message: 'Location updated successfully',
    data: {
      location: booking.tracking.currentLocation
    }
  });
});

/**
 * @desc    Get booking tracking information
 * @route   GET /api/bookings/:id/tracking
 * @access  Customer (own booking), Driver (assigned booking), Admin
 */
const getBookingTracking = catchAsync(async (req, res) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .select('tracking status driver customer')
    .populate('driver', 'firstName lastName phone driverInfo.currentLocation');

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Check access permissions
  const hasAccess = req.user.role === 'admin' ||
                   booking.customer.toString() === req.user._id.toString() ||
                   (booking.driver && booking.driver._id.toString() === req.user._id.toString());

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      tracking: booking.tracking,
      status: booking.status,
      driver: booking.driver ? {
        name: `${booking.driver.firstName} ${booking.driver.lastName}`,
        phone: booking.driver.phone,
        currentLocation: booking.driver.driverInfo.currentLocation
      } : null
    }
  });
});

/**
 * @desc    Add message to booking
 * @route   POST /api/bookings/:id/messages
 * @access  Customer (own booking), Driver (assigned booking), Admin
 */
const addBookingMessage = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { message, type = 'text' } = req.body;

  const booking = await Booking.findById(id);

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Check access permissions
  const hasAccess = req.user.role === 'admin' ||
                   booking.customer.toString() === req.user._id.toString() ||
                   (booking.driver && booking.driver.toString() === req.user._id.toString());

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  booking.messages.push({
    sender: req.user._id,
    message,
    type,
    timestamp: new Date()
  });

  await booking.save();

  res.status(201).json({
    success: true,
    message: 'Message added successfully',
    data: {
      message: booking.messages[booking.messages.length - 1]
    }
  });
});

module.exports = {
  getBookings,
  getBookingById,
  createBooking,
  updateBooking,
  patchBooking,
  cancelBooking,
  updateBookingStatus,
  assignDriver,
  updateBookingLocation,
  getBookingTracking,
  addBookingMessage
};
