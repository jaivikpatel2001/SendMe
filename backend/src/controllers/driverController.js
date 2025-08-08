/**
 * Driver Controller
 * Handle driver-specific operations and job management
 */

const User = require('../models/User');
const Booking = require('../models/Booking');
const VehicleType = require('../models/Vehicle');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const SupportTicket = require('../models/SupportTicket');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Register as a driver
 * @route POST /api/driver/register
 * @access Public
 */
const registerDriver = catchAsync(async (req, res, next) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    password,
    licenseNumber,
    licenseExpiry,
    vehicleDetails,
    bankDetails
  } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { phone }]
  });

  if (existingUser) {
    if (existingUser.email === email) {
      return next(new AppError('User with this email already exists', 400));
    }
    if (existingUser.phone === phone) {
      return next(new AppError('User with this phone number already exists', 400));
    }
  }

  // Create driver user
  const driver = await User.create({
    firstName,
    lastName,
    email,
    phone,
    password,
    role: 'driver',
    status: 'pending', // Pending approval
    driverInfo: {
      licenseNumber,
      licenseExpiry: new Date(licenseExpiry),
      vehicleDetails: {
        ...vehicleDetails,
        registrationExpiry: new Date(vehicleDetails.registrationExpiry),
        insuranceExpiry: new Date(vehicleDetails.insuranceExpiry)
      },
      bankDetails,
      isOnline: false,
      rating: {
        average: 0,
        count: 0
      },
      earnings: {
        total: 0,
        pending: 0,
        withdrawn: 0
      }
    },
    registrationSource: 'web'
  });

  // Generate referral code
  driver.referralCode = `DRV${driver._id.toString().slice(-8).toUpperCase()}`;
  await driver.save({ validateBeforeSave: false });

  // Create notification for admin
  await Notification.create({
    recipient: driver._id, // This would be admin in real implementation
    title: 'Driver Application Submitted',
    message: `New driver application from ${firstName} ${lastName} is pending review.`,
    type: 'driver_application',
    category: 'system',
    relatedData: {
      user: driver._id
    }
  });

  logger.logAuthEvent('driver_registered', {
    driverId: driver._id,
    email: driver.email,
    licenseNumber
  });

  // Remove password from response
  driver.password = undefined;

  res.status(201).json({
    success: true,
    message: 'Driver application submitted successfully. You will be notified once approved.',
    data: {
      driver: {
        id: driver._id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        email: driver.email,
        phone: driver.phone,
        status: driver.status
      }
    }
  });
});

/**
 * Get driver dashboard
 * @route GET /api/driver/dashboard
 * @access Private (Driver)
 */
const getDashboard = catchAsync(async (req, res, next) => {
  const driverId = req.user._id;

  // Get driver's current status and stats
  const driver = await User.findById(driverId).select('driverInfo firstName lastName');

  // Get today's earnings
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayEarnings = await Booking.aggregate([
    {
      $match: {
        driver: driverId,
        status: 'completed',
        createdAt: { $gte: today, $lt: tomorrow }
      }
    },
    {
      $group: {
        _id: null,
        totalEarnings: { $sum: '$pricing.total' },
        totalTrips: { $sum: 1 }
      }
    }
  ]);

  // Get weekly earnings
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  
  const weeklyEarnings = await Booking.aggregate([
    {
      $match: {
        driver: driverId,
        status: 'completed',
        createdAt: { $gte: weekStart }
      }
    },
    {
      $group: {
        _id: null,
        totalEarnings: { $sum: '$pricing.total' },
        totalTrips: { $sum: 1 }
      }
    }
  ]);

  // Get active trip
  const activeTrip = await Booking.findOne({
    driver: driverId,
    status: {
      $in: ['driver_assigned', 'driver_en_route', 'arrived_pickup', 'pickup_completed', 'in_transit', 'arrived_delivery']
    }
  })
    .populate('customer', 'firstName lastName phone')
    .populate('vehicleType', 'name displayName');

  // Get pending job requests
  const pendingJobs = await Booking.find({
    status: 'pending',
    // Add location-based filtering here
  })
    .limit(5)
    .populate('customer', 'firstName lastName')
    .populate('vehicleType', 'name displayName')
    .select('bookingId pickupLocation dropLocation pricing goodsDetails createdAt');

  const dashboardData = {
    driverStatus: {
      isOnline: driver.driverInfo.isOnline,
      rating: driver.driverInfo.rating,
      totalEarnings: driver.driverInfo.earnings.total
    },
    todayStats: {
      earnings: todayEarnings[0]?.totalEarnings || 0,
      trips: todayEarnings[0]?.totalTrips || 0
    },
    weeklyStats: {
      earnings: weeklyEarnings[0]?.totalEarnings || 0,
      trips: weeklyEarnings[0]?.totalTrips || 0
    },
    activeTrip,
    pendingJobs
  };

  res.status(200).json({
    success: true,
    data: dashboardData
  });
});

/**
 * Toggle driver online/offline status
 * @route PUT /api/driver/status
 * @access Private (Driver)
 */
const toggleOnlineStatus = catchAsync(async (req, res, next) => {
  const driverId = req.user._id;
  const { isOnline, location } = req.body;

  const updateData = {
    'driverInfo.isOnline': isOnline
  };

  if (location) {
    updateData['driverInfo.currentLocation'] = {
      latitude: location.latitude,
      longitude: location.longitude,
      lastUpdated: new Date()
    };
  }

  const driver = await User.findByIdAndUpdate(
    driverId,
    updateData,
    { new: true }
  ).select('driverInfo.isOnline driverInfo.currentLocation');

  logger.info('Driver status updated', {
    driverId,
    isOnline,
    location: location ? `${location.latitude},${location.longitude}` : null
  });

  res.status(200).json({
    success: true,
    message: `Driver is now ${isOnline ? 'online' : 'offline'}`,
    data: {
      isOnline: driver.driverInfo.isOnline,
      currentLocation: driver.driverInfo.currentLocation
    }
  });
});

/**
 * Get available job requests
 * @route GET /api/driver/job-requests
 * @access Private (Driver)
 */
const getJobRequests = catchAsync(async (req, res, next) => {
  const driverId = req.user._id;
  const { page = 1, limit = 10 } = req.query;

  // Get driver's current location and vehicle type
  const driver = await User.findById(driverId).select('driverInfo.currentLocation driverInfo.vehicleType');

  if (!driver.driverInfo.isOnline) {
    return next(new AppError('You must be online to view job requests', 400));
  }

  // Build query for nearby jobs
  const query = {
    status: 'pending',
    // Add vehicle type matching if needed
    // vehicleType: driver.driverInfo.vehicleType
  };

  // Add location-based filtering (within 10km radius)
  if (driver.driverInfo.currentLocation) {
    query['pickupLocation.coordinates'] = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [
            driver.driverInfo.currentLocation.longitude,
            driver.driverInfo.currentLocation.latitude
          ]
        },
        $maxDistance: 10000 // 10km in meters
      }
    };
  }

  const skip = (page - 1) * limit;

  const [jobs, total] = await Promise.all([
    Booking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('customer', 'firstName lastName phone')
      .populate('vehicleType', 'name displayName images')
      .select('bookingId pickupLocation dropLocation pricing goodsDetails distance createdAt'),
    Booking.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: {
      jobs,
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
 * Accept job request
 * @route PUT /api/driver/job-requests/:id/accept
 * @access Private (Driver)
 */
const acceptJobRequest = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const driverId = req.user._id;

  // Check if driver is online
  const driver = await User.findById(driverId).select('driverInfo.isOnline firstName lastName phone');
  if (!driver.driverInfo.isOnline) {
    return next(new AppError('You must be online to accept jobs', 400));
  }

  // Check if driver has any active bookings
  const activeBooking = await Booking.findOne({
    driver: driverId,
    status: {
      $in: ['driver_assigned', 'driver_en_route', 'arrived_pickup', 'pickup_completed', 'in_transit', 'arrived_delivery']
    }
  });

  if (activeBooking) {
    return next(new AppError('You already have an active booking', 400));
  }

  // Find and update the booking
  const booking = await Booking.findOneAndUpdate(
    {
      _id: id,
      status: 'pending'
    },
    {
      driver: driverId,
      status: 'driver_assigned',
      'driverAssignment.assignedAt': new Date(),
      'driverAssignment.acceptedAt': new Date(),
      $push: {
        statusHistory: {
          status: 'driver_assigned',
          timestamp: new Date(),
          updatedBy: driverId
        }
      }
    },
    { new: true }
  ).populate('customer', 'firstName lastName phone');

  if (!booking) {
    return next(new AppError('Job request not found or already assigned', 404));
  }

  // Create notifications
  await Notification.create({
    recipient: booking.customer,
    title: 'Driver Assigned',
    message: `${driver.firstName} ${driver.lastName} has been assigned to your booking ${booking.bookingId}`,
    type: 'driver_assigned',
    category: 'booking',
    relatedData: {
      booking: booking._id,
      user: driverId
    }
  });

  // Emit real-time event
  const io = req.app.get('io');
  io.to(`booking-${booking._id}`).emit('booking-update', {
    bookingId: booking._id,
    status: 'driver_assigned',
    driver: {
      name: `${driver.firstName} ${driver.lastName}`,
      phone: driver.phone
    }
  });

  logger.logBookingEvent('job_accepted', {
    bookingId: booking.bookingId,
    driverId,
    customerId: booking.customer
  });

  res.status(200).json({
    success: true,
    message: 'Job request accepted successfully',
    data: {
      booking
    }
  });
});

/**
 * Reject job request
 * @route PUT /api/driver/job-requests/:id/reject
 * @access Private (Driver)
 */
const rejectJobRequest = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const driverId = req.user._id;
  const { reason } = req.body;

  const booking = await Booking.findById(id);

  if (!booking || booking.status !== 'pending') {
    return next(new AppError('Job request not found or already assigned', 404));
  }

  // Add driver to rejected list
  await Booking.findByIdAndUpdate(id, {
    $push: {
      'driverAssignment.rejectedDrivers': {
        driver: driverId,
        rejectedAt: new Date(),
        reason: reason || 'No reason provided'
      }
    }
  });

  logger.info('Job request rejected', {
    bookingId: booking.bookingId,
    driverId,
    reason
  });

  res.status(200).json({
    success: true,
    message: 'Job request rejected'
  });
});

/**
 * Update trip status
 * @route PUT /api/driver/trips/:id/status
 * @access Private (Driver)
 */
const updateTripStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const driverId = req.user._id;
  const { status, location, notes } = req.body;

  // Validate status transition
  const validTransitions = {
    'driver_assigned': ['driver_en_route'],
    'driver_en_route': ['arrived_pickup'],
    'arrived_pickup': ['pickup_completed'],
    'pickup_completed': ['in_transit'],
    'in_transit': ['arrived_delivery'],
    'arrived_delivery': ['delivered']
  };

  const booking = await Booking.findOne({
    _id: id,
    driver: driverId
  }).populate('customer', 'firstName lastName phone');

  if (!booking) {
    return next(new AppError('Booking not found or not assigned to you', 404));
  }

  // Check if status transition is valid
  if (!validTransitions[booking.status]?.includes(status)) {
    return next(new AppError(`Cannot change status from ${booking.status} to ${status}`, 400));
  }

  // Update booking status
  const updateData = {
    status,
    $push: {
      statusHistory: {
        status,
        timestamp: new Date(),
        location,
        notes,
        updatedBy: driverId
      }
    }
  };

  // Update specific timestamps based on status
  switch (status) {
    case 'arrived_pickup':
      updateData['tracking.actualArrival.pickup'] = new Date();
      break;
    case 'delivered':
      updateData['tracking.actualArrival.delivery'] = new Date();
      updateData.status = 'completed'; // Auto-complete after delivery
      break;
  }

  const updatedBooking = await Booking.findByIdAndUpdate(
    id,
    updateData,
    { new: true }
  );

  // Create notification for customer
  const statusMessages = {
    'driver_en_route': 'Your driver is on the way to pickup location',
    'arrived_pickup': 'Your driver has arrived at pickup location',
    'pickup_completed': 'Your package has been picked up',
    'in_transit': 'Your package is on the way to delivery location',
    'arrived_delivery': 'Your driver has arrived at delivery location',
    'delivered': 'Your package has been delivered successfully'
  };

  await Notification.create({
    recipient: booking.customer._id,
    title: 'Booking Update',
    message: statusMessages[status] || `Booking status updated to ${status}`,
    type: 'booking_update',
    category: 'booking',
    relatedData: {
      booking: booking._id
    }
  });

  // Emit real-time event
  const io = req.app.get('io');
  io.to(`booking-${booking._id}`).emit('status-update', {
    bookingId: booking._id,
    status,
    location,
    timestamp: new Date()
  });

  logger.logBookingEvent('status_updated', {
    bookingId: booking.bookingId,
    driverId,
    oldStatus: booking.status,
    newStatus: status
  });

  res.status(200).json({
    success: true,
    message: 'Trip status updated successfully',
    data: {
      booking: updatedBooking
    }
  });
});

/**
 * Get driver earnings
 * @route GET /api/driver/earnings
 * @access Private (Driver)
 */
const getEarnings = catchAsync(async (req, res, next) => {
  const driverId = req.user._id;
  const { period = 'weekly', startDate, endDate } = req.query;

  let dateFilter = {};
  const now = new Date();

  switch (period) {
    case 'daily':
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateFilter = { createdAt: { $gte: today, $lt: tomorrow } };
      break;

    case 'weekly':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: weekStart } };
      break;

    case 'monthly':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { $gte: monthStart } };
      break;

    case 'custom':
      if (startDate && endDate) {
        dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        };
      }
      break;
  }

  const earnings = await Booking.aggregate([
    {
      $match: {
        driver: driverId,
        status: 'completed',
        ...dateFilter
      }
    },
    {
      $group: {
        _id: null,
        totalEarnings: { $sum: '$pricing.total' },
        totalTrips: { $sum: 1 },
        averageEarningsPerTrip: { $avg: '$pricing.total' },
        totalDistance: { $sum: '$distance.total' }
      }
    }
  ]);

  // Get earnings breakdown by day for charts
  const dailyEarnings = await Booking.aggregate([
    {
      $match: {
        driver: driverId,
        status: 'completed',
        ...dateFilter
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        earnings: { $sum: '$pricing.total' },
        trips: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      summary: earnings[0] || {
        totalEarnings: 0,
        totalTrips: 0,
        averageEarningsPerTrip: 0,
        totalDistance: 0
      },
      dailyBreakdown: dailyEarnings,
      period
    }
  });
});

/**
 * Get payout history
 * @route GET /api/driver/payouts
 * @access Private (Driver)
 */
const getPayouts = catchAsync(async (req, res, next) => {
  const driverId = req.user._id;

  // This would typically come from a separate Payout model
  // For now, returning mock data
  const payouts = [
    {
      id: '1',
      amount: 250.00,
      status: 'completed',
      requestedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      processedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      method: 'bank_transfer'
    },
    {
      id: '2',
      amount: 180.50,
      status: 'pending',
      requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      processedAt: null,
      method: 'bank_transfer'
    }
  ];

  res.status(200).json({
    success: true,
    data: {
      payouts,
      availableBalance: req.user.driverInfo.earnings.pending
    }
  });
});

/**
 * Request payout
 * @route POST /api/driver/payouts
 * @access Private (Driver)
 */
const requestPayout = catchAsync(async (req, res, next) => {
  const driverId = req.user._id;
  const { amount } = req.body;

  const driver = await User.findById(driverId).select('driverInfo.earnings driverInfo.bankDetails');

  if (amount > driver.driverInfo.earnings.pending) {
    return next(new AppError('Insufficient balance for payout', 400));
  }

  if (amount < 10) {
    return next(new AppError('Minimum payout amount is $10', 400));
  }

  if (!driver.driverInfo.bankDetails.accountNumber) {
    return next(new AppError('Please add bank details to request payout', 400));
  }

  // Update driver earnings
  await User.findByIdAndUpdate(driverId, {
    $inc: {
      'driverInfo.earnings.pending': -amount,
      'driverInfo.earnings.withdrawn': amount
    }
  });

  // Here you would create a payout record and process with payment provider

  logger.info('Payout requested', {
    driverId,
    amount,
    bankAccount: driver.driverInfo.bankDetails.accountNumber.slice(-4)
  });

  res.status(201).json({
    success: true,
    message: 'Payout request submitted successfully',
    data: {
      amount,
      estimatedProcessingTime: '2-3 business days'
    }
  });
});

module.exports = {
  registerDriver,
  getDashboard,
  toggleOnlineStatus,
  getJobRequests,
  acceptJobRequest,
  rejectJobRequest,
  updateTripStatus,
  getEarnings,
  getPayouts,
  requestPayout
};
