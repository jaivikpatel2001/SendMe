/**
 * Customer Controller
 * Handle customer-specific operations and bookings
 */

const User = require('../models/User');
const Booking = require('../models/Booking');
const VehicleType = require('../models/Vehicle');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const PromoCode = require('../models/PromoCode');
const SupportTicket = require('../models/SupportTicket');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Get customer dashboard data
 * @route GET /api/customer/dashboard
 * @access Private (Customer)
 */
const getDashboard = catchAsync(async (req, res, next) => {
  const customerId = req.user._id;

  // Get recent bookings
  const recentBookings = await Booking.find({ customer: customerId })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('vehicleType', 'name displayName images')
    .populate('driver', 'firstName lastName driverInfo.rating')
    .select('bookingId status pickupLocation dropLocation pricing createdAt');

  // Get active booking (if any)
  const activeBooking = await Booking.findOne({
    customer: customerId,
    status: { 
      $in: ['pending', 'confirmed', 'driver_assigned', 'driver_en_route', 'arrived_pickup', 'pickup_completed', 'in_transit', 'arrived_delivery'] 
    }
  })
    .populate('vehicleType', 'name displayName images')
    .populate('driver', 'firstName lastName phone driverInfo.rating driverInfo.currentLocation');

  // Get customer stats
  const stats = await Booking.aggregate([
    { $match: { customer: customerId } },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        completedBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        totalSpent: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$pricing.total', 0] }
        },
        averageRating: { $avg: '$rating.customerRating.rating' }
      }
    }
  ]);

  // Get saved addresses
  const customer = await User.findById(customerId).select('addresses');
  const savedAddresses = customer.addresses || [];

  // Get unread notifications count
  const unreadNotifications = await Notification.getUnreadCount(customerId);

  // Get applicable promo codes
  const promoCodes = await PromoCode.findApplicableForUser(customerId, 0);

  // Promotional banners (mock data - would come from CMS)
  const banners = [
    {
      id: 1,
      title: 'Free Delivery',
      description: 'Get free delivery on your first order',
      image: '/images/banners/free-delivery.jpg',
      action: 'book_now',
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  ];

  logger.info('Customer dashboard accessed', {
    customerId,
    totalBookings: stats[0]?.totalBookings || 0
  });

  res.status(200).json({
    success: true,
    data: {
      activeBooking,
      recentBookings,
      stats: stats[0] || {
        totalBookings: 0,
        completedBookings: 0,
        totalSpent: 0,
        averageRating: 0
      },
      savedAddresses,
      unreadNotifications,
      promoCodes: promoCodes.slice(0, 3), // Show top 3 applicable promos
      banners
    }
  });
});

/**
 * Create a new booking
 * @route POST /api/customer/bookings
 * @access Private (Customer)
 */
const createBooking = catchAsync(async (req, res, next) => {
  const customerId = req.user._id;
  const {
    serviceType,
    vehicleType,
    pickupLocation,
    dropLocation,
    goodsDetails,
    scheduledFor,
    paymentMethod,
    promoCode
  } = req.body;

  // Validate vehicle type
  const vehicle = await VehicleType.findById(vehicleType);
  if (!vehicle || vehicle.status !== 'active') {
    return next(new AppError('Invalid or inactive vehicle type', 400));
  }

  // Check if vehicle is available in the pickup area
  const isAvailable = vehicle.isAvailableInArea(
    pickupLocation.coordinates.latitude,
    pickupLocation.coordinates.longitude
  );

  if (!isAvailable) {
    return next(new AppError('Service not available in this area', 400));
  }

  // Calculate distance and pricing
  const distance = calculateDistance(
    pickupLocation.coordinates.latitude,
    pickupLocation.coordinates.longitude,
    dropLocation.coordinates.latitude,
    dropLocation.coordinates.longitude
  );

  // Check distance restrictions
  if (distance < vehicle.restrictions.minDistance || distance > vehicle.restrictions.maxDistance) {
    return next(new AppError(`Distance must be between ${vehicle.restrictions.minDistance} and ${vehicle.restrictions.maxDistance} km`, 400));
  }

  // Calculate fare
  const isPeakHour = vehicle.isPeakHour();
  const baseFare = vehicle.calculateFare(distance, null, isPeakHour);

  let pricing = {
    baseFare: vehicle.pricing.baseFare,
    distanceFare: distance * vehicle.pricing.perKmRate,
    peakHourMultiplier: isPeakHour ? vehicle.peakHourPricing.multiplier : 1,
    subtotal: baseFare,
    total: baseFare,
    currency: vehicle.pricing.currency
  };

  // Apply promo code if provided
  let appliedPromo = null;
  if (promoCode) {
    const promo = await PromoCode.findOne({ code: promoCode.toUpperCase() });
    if (!promo) {
      return next(new AppError('Invalid promo code', 400));
    }

    const canUseResult = await promo.canUserUse(customerId, pricing.subtotal);
    if (!canUseResult.canUse) {
      return next(new AppError(canUseResult.reason, 400));
    }

    const discountAmount = promo.calculateDiscount(pricing.subtotal);
    pricing.discount = {
      amount: discountAmount,
      promoCode: promo.code,
      type: promo.discountType
    };
    pricing.total = pricing.subtotal - discountAmount;
    appliedPromo = promo;
  }

  // Calculate tax (mock - would be based on location)
  const taxRate = 0.08; // 8%
  const taxAmount = pricing.total * taxRate;
  pricing.tax = {
    amount: taxAmount,
    percentage: taxRate * 100
  };
  pricing.total += taxAmount;

  // Create booking
  const booking = new Booking({
    customer: customerId,
    serviceType,
    vehicleType,
    pickupLocation,
    dropLocation,
    goodsDetails,
    scheduledFor: scheduledFor || new Date(),
    isScheduled: !!scheduledFor,
    distance: {
      total: distance,
      estimated: distance
    },
    pricing,
    payment: {
      method: paymentMethod,
      status: 'pending'
    },
    promoCode: appliedPromo?._id,
    platform: 'web'
  });

  await booking.save();

  // Apply promo code usage
  if (appliedPromo) {
    await appliedPromo.applyToBooking(customerId, booking._id, pricing.subtotal);
  }

  // Update customer total bookings
  await User.findByIdAndUpdate(customerId, {
    $inc: { 'customerInfo.totalBookings': 1 }
  });

  // Create notification
  await Notification.create({
    recipient: customerId,
    title: 'Booking Created',
    message: `Your booking ${booking.bookingId} has been created and we're finding a driver for you.`,
    type: 'booking_created',
    category: 'booking',
    relatedData: {
      booking: booking._id
    },
    action: {
      type: 'open_booking',
      data: {
        bookingId: booking._id.toString()
      }
    }
  });

  // Emit real-time event for driver matching
  const io = req.app.get('io');
  io.emit('new-booking', {
    bookingId: booking._id,
    pickupLocation: booking.pickupLocation,
    vehicleType: booking.vehicleType,
    serviceType: booking.serviceType
  });

  logger.logBookingEvent('booking_created', {
    bookingId: booking.bookingId,
    customerId,
    vehicleType: vehicle.name,
    distance,
    total: pricing.total
  });

  res.status(201).json({
    success: true,
    message: 'Booking created successfully',
    data: {
      booking: await booking.populate([
        { path: 'vehicleType', select: 'name displayName images' },
        { path: 'customer', select: 'firstName lastName phone' }
      ])
    }
  });
});

/**
 * Get booking details
 * @route GET /api/customer/bookings/:id
 * @access Private (Customer)
 */
const getBooking = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const customerId = req.user._id;

  const booking = await Booking.findOne({
    _id: id,
    customer: customerId
  })
    .populate('vehicleType', 'name displayName images features')
    .populate('driver', 'firstName lastName phone driverInfo.rating driverInfo.currentLocation')
    .populate('customer', 'firstName lastName phone');

  if (!booking) {
    return next(new AppError('Booking not found', 404));
  }

  res.status(200).json({
    success: true,
    data: {
      booking
    }
  });
});

/**
 * Get booking history with pagination
 * @route GET /api/customer/bookings-history
 * @access Private (Customer)
 */
const getBookingHistory = catchAsync(async (req, res, next) => {
  const customerId = req.user._id;
  const {
    page = 1,
    limit = 10,
    status,
    startDate,
    endDate,
    sort = 'createdAt',
    order = 'desc'
  } = req.query;

  // Build query
  const query = { customer: customerId };

  if (status) {
    query.status = status;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  // Pagination
  const skip = (page - 1) * limit;
  const sortOrder = order === 'desc' ? -1 : 1;

  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .sort({ [sort]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('vehicleType', 'name displayName images')
      .populate('driver', 'firstName lastName driverInfo.rating')
      .select('bookingId status pickupLocation dropLocation pricing createdAt rating'),
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
 * Rebook based on previous booking
 * @route PUT /api/customer/bookings/:id/rebook
 * @access Private (Customer)
 */
const rebookOrder = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const customerId = req.user._id;

  const originalBooking = await Booking.findOne({
    _id: id,
    customer: customerId,
    status: 'completed'
  });

  if (!originalBooking) {
    return next(new AppError('Original booking not found or not completed', 404));
  }

  // Create new booking based on original
  const newBookingData = {
    serviceType: originalBooking.serviceType,
    vehicleType: originalBooking.vehicleType,
    pickupLocation: originalBooking.pickupLocation,
    dropLocation: originalBooking.dropLocation,
    goodsDetails: originalBooking.goodsDetails,
    paymentMethod: originalBooking.payment.method
  };

  // Use the createBooking logic
  req.body = newBookingData;
  return createBooking(req, res, next);
});

/**
 * Get live tracking for a booking
 * @route GET /api/customer/live-tracking/:id
 * @access Private (Customer)
 */
const getLiveTracking = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const customerId = req.user._id;

  const booking = await Booking.findOne({
    _id: id,
    customer: customerId
  })
    .populate('driver', 'firstName lastName phone driverInfo.currentLocation')
    .select('bookingId status tracking pickupLocation dropLocation driver statusHistory');

  if (!booking) {
    return next(new AppError('Booking not found', 404));
  }

  // Check if tracking is available
  const trackableStatuses = ['driver_assigned', 'driver_en_route', 'arrived_pickup', 'pickup_completed', 'in_transit', 'arrived_delivery'];
  
  if (!trackableStatuses.includes(booking.status)) {
    return next(new AppError('Live tracking not available for this booking', 400));
  }

  res.status(200).json({
    success: true,
    data: {
      bookingId: booking.bookingId,
      status: booking.status,
      currentLocation: booking.driver?.driverInfo?.currentLocation,
      estimatedArrival: booking.tracking.estimatedArrival,
      statusHistory: booking.statusHistory,
      driver: booking.driver ? {
        name: `${booking.driver.firstName} ${booking.driver.lastName}`,
        phone: booking.driver.phone,
        rating: booking.driver.driverInfo?.rating
      } : null
    }
  });
});

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Submit review for driver
 * @route POST /api/customer/reviews
 * @access Private (Customer)
 */
const submitReview = catchAsync(async (req, res, next) => {
  const customerId = req.user._id;
  const { bookingId, rating, review, detailedRatings } = req.body;

  // Validate booking
  const booking = await Booking.findOne({
    _id: bookingId,
    customer: customerId,
    status: 'completed'
  });

  if (!booking) {
    return next(new AppError('Booking not found or not completed', 404));
  }

  if (!booking.driver) {
    return next(new AppError('No driver assigned to this booking', 400));
  }

  // Check if review already exists
  const existingReview = await Review.findOne({
    booking: bookingId,
    reviewer: customerId,
    reviewType: 'customer_to_driver'
  });

  if (existingReview) {
    return next(new AppError('You have already reviewed this booking', 400));
  }

  // Create review
  const newReview = await Review.create({
    booking: bookingId,
    reviewer: customerId,
    reviewee: booking.driver,
    reviewType: 'customer_to_driver',
    rating,
    review,
    detailedRatings,
    platform: 'web'
  });

  // Update booking with review
  await Booking.findByIdAndUpdate(bookingId, {
    'rating.customerRating': {
      rating,
      review,
      ratedAt: new Date()
    }
  });

  // Update driver's average rating
  const driverRating = await Review.getAverageRating(booking.driver, 'customer_to_driver');
  await User.findByIdAndUpdate(booking.driver, {
    'driverInfo.rating.average': driverRating.averageRating,
    'driverInfo.rating.count': driverRating.totalReviews
  });

  logger.info('Customer review submitted', {
    customerId,
    bookingId,
    driverId: booking.driver,
    rating
  });

  res.status(201).json({
    success: true,
    message: 'Review submitted successfully',
    data: {
      review: newReview
    }
  });
});

/**
 * Get customer notifications
 * @route GET /api/customer/notifications
 * @access Private (Customer)
 */
const getNotifications = catchAsync(async (req, res, next) => {
  const customerId = req.user._id;
  const {
    page = 1,
    limit = 20,
    category,
    unreadOnly = false
  } = req.query;

  const result = await Notification.getForUser(customerId, {
    page: parseInt(page),
    limit: parseInt(limit),
    category,
    unreadOnly: unreadOnly === 'true'
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * Mark notification as read
 * @route PUT /api/customer/notifications/:id/read
 * @access Private (Customer)
 */
const markNotificationRead = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const customerId = req.user._id;

  const notification = await Notification.findOne({
    _id: id,
    recipient: customerId
  });

  if (!notification) {
    return next(new AppError('Notification not found', 404));
  }

  await notification.markAsRead();

  res.status(200).json({
    success: true,
    message: 'Notification marked as read'
  });
});

/**
 * Update customer profile
 * @route PUT /api/customer/profile
 * @access Private (Customer)
 */
const updateProfile = catchAsync(async (req, res, next) => {
  const customerId = req.user._id;
  const updateData = req.body;

  // Remove sensitive fields that shouldn't be updated via this endpoint
  delete updateData.password;
  delete updateData.email;
  delete updateData.phone;
  delete updateData.role;
  delete updateData.status;

  const updatedUser = await User.findByIdAndUpdate(
    customerId,
    updateData,
    { new: true, runValidators: true }
  ).select('-password');

  logger.info('Customer profile updated', {
    customerId,
    updatedFields: Object.keys(updateData)
  });

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: updatedUser
    }
  });
});

/**
 * Manage payment methods
 * @route PUT /api/customer/payment-methods
 * @access Private (Customer)
 */
const updatePaymentMethods = catchAsync(async (req, res, next) => {
  const customerId = req.user._id;
  const { paymentMethods, preferredMethod } = req.body;

  const updateData = {};

  if (paymentMethods) {
    updateData['customerInfo.savedPaymentMethods'] = paymentMethods;
  }

  if (preferredMethod) {
    updateData['customerInfo.preferredPaymentMethod'] = preferredMethod;
  }

  const updatedUser = await User.findByIdAndUpdate(
    customerId,
    updateData,
    { new: true, runValidators: true }
  ).select('customerInfo.savedPaymentMethods customerInfo.preferredPaymentMethod');

  res.status(200).json({
    success: true,
    message: 'Payment methods updated successfully',
    data: {
      paymentMethods: updatedUser.customerInfo.savedPaymentMethods,
      preferredMethod: updatedUser.customerInfo.preferredPaymentMethod
    }
  });
});

/**
 * Create support ticket
 * @route POST /api/customer/support
 * @access Private (Customer)
 */
const createSupportTicket = catchAsync(async (req, res, next) => {
  const customerId = req.user._id;
  const {
    subject,
    description,
    category,
    subcategory,
    relatedBooking,
    priority = 'normal'
  } = req.body;

  const ticket = await SupportTicket.create({
    user: customerId,
    subject,
    description,
    category,
    subcategory,
    relatedBooking,
    priority,
    source: 'web',
    channel: 'support_form',
    deviceInfo: {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    }
  });

  // Create notification for customer
  await Notification.create({
    recipient: customerId,
    title: 'Support Ticket Created',
    message: `Your support ticket ${ticket.ticketId} has been created. We'll respond within 24 hours.`,
    type: 'account_update',
    category: 'account',
    relatedData: {
      metadata: { ticketId: ticket.ticketId }
    }
  });

  logger.info('Support ticket created', {
    customerId,
    ticketId: ticket.ticketId,
    category,
    priority
  });

  res.status(201).json({
    success: true,
    message: 'Support ticket created successfully',
    data: {
      ticket: {
        ticketId: ticket.ticketId,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.createdAt
      }
    }
  });
});

/**
 * Get customer FAQs
 * @route GET /api/customer/faqs
 * @access Private (Customer)
 */
const getFAQs = catchAsync(async (req, res, next) => {
  // This would typically come from CMS or database
  const faqs = [
    {
      question: 'How do I track my delivery?',
      answer: 'You can track your delivery in real-time through the app or website using your booking ID. You\'ll receive live updates on your driver\'s location and estimated arrival time.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept credit/debit cards, digital wallets, UPI, and cash payments. You can save your preferred payment methods in your profile for faster checkout.'
    },
    {
      question: 'Can I schedule a delivery for later?',
      answer: 'Yes, you can schedule deliveries up to 7 days in advance. Simply select your preferred date and time during the booking process.'
    },
    {
      question: 'What if my package is damaged?',
      answer: 'We provide insurance coverage for all deliveries. If your package is damaged, please contact our support team immediately with photos and details to file a claim.'
    },
    {
      question: 'How do I cancel my booking?',
      answer: 'You can cancel your booking through the app or website before the driver picks up your package. Cancellation fees may apply depending on the timing.'
    },
    {
      question: 'What items are prohibited for delivery?',
      answer: 'We cannot deliver illegal items, hazardous materials, perishable food items, live animals, or items exceeding our size and weight limits. Check our terms for the complete list.'
    },
    {
      question: 'How is the delivery cost calculated?',
      answer: 'Delivery cost is based on distance, vehicle type, time of day, and any additional services. You\'ll see the exact cost before confirming your booking.'
    },
    {
      question: 'Can I add multiple stops to my delivery?',
      answer: 'Yes, you can add multiple delivery stops during the booking process. Additional charges may apply for each extra stop.'
    }
  ];

  res.status(200).json({
    success: true,
    data: {
      faqs
    }
  });
});

module.exports = {
  getDashboard,
  createBooking,
  getBooking,
  getBookingHistory,
  rebookOrder,
  getLiveTracking,
  submitReview,
  getNotifications,
  markNotificationRead,
  updateProfile,
  updatePaymentMethods,
  createSupportTicket,
  getFAQs
};
