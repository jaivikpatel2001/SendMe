/**
 * Admin Controller
 * Handle admin-specific operations and platform management
 */

const User = require('../models/User');
const Booking = require('../models/Booking');
const VehicleType = require('../models/Vehicle');
const Review = require('../models/Review');
const PromoCode = require('../models/PromoCode');
const SupportTicket = require('../models/SupportTicket');
const Notification = require('../models/Notification');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { sendDriverApproval } = require('../utils/email');

/**
 * Get admin dashboard statistics
 * @route GET /api/admin/dashboard
 * @access Private (Admin)
 */
const getDashboard = catchAsync(async (req, res, next) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Get overall statistics
  const [
    totalUsers,
    totalDrivers,
    totalCustomers,
    activeDrivers,
    totalBookings,
    completedBookings,
    todayBookings,
    weeklyBookings,
    monthlyBookings,
    pendingDrivers,
    openTickets,
    totalRevenue,
    monthlyRevenue
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'driver' }),
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ role: 'driver', 'driverInfo.isOnline': true }),
    Booking.countDocuments(),
    Booking.countDocuments({ status: 'completed' }),
    Booking.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
    Booking.countDocuments({ createdAt: { $gte: weekStart } }),
    Booking.countDocuments({ createdAt: { $gte: monthStart } }),
    User.countDocuments({ role: 'driver', status: 'pending' }),
    SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    Booking.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]),
    Booking.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ])
  ]);

  // Get recent activities
  const recentBookings = await Booking.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('customer', 'firstName lastName')
    .populate('driver', 'firstName lastName')
    .select('bookingId status pricing.total createdAt customer driver');

  const recentUsers = await User.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .select('firstName lastName email role status createdAt');

  // Get booking status distribution
  const bookingStatusStats = await Booking.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get daily bookings for the last 7 days
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    
    const count = await Booking.countDocuments({
      createdAt: { $gte: date, $lt: nextDate }
    });
    
    last7Days.push({
      date: date.toISOString().split('T')[0],
      bookings: count
    });
  }

  const dashboardData = {
    overview: {
      totalUsers,
      totalDrivers,
      totalCustomers,
      activeDrivers,
      totalBookings,
      completedBookings,
      completionRate: totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(1) : 0
    },
    bookings: {
      today: todayBookings,
      thisWeek: weeklyBookings,
      thisMonth: monthlyBookings,
      statusDistribution: bookingStatusStats
    },
    revenue: {
      total: totalRevenue[0]?.total || 0,
      thisMonth: monthlyRevenue[0]?.total || 0
    },
    pending: {
      driverApplications: pendingDrivers,
      supportTickets: openTickets
    },
    charts: {
      dailyBookings: last7Days
    },
    recentActivity: {
      bookings: recentBookings,
      users: recentUsers
    }
  };

  res.status(200).json({
    success: true,
    data: dashboardData
  });
});

/**
 * Get all users with pagination and filters
 * @route GET /api/admin/users
 * @access Private (Admin)
 */
const getUsers = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 20,
    role,
    status,
    search,
    sort = 'createdAt',
    order = 'desc'
  } = req.query;

  // Build query
  const query = {};
  
  if (role) query.role = role;
  if (status) query.status = status;
  
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;
  const sortOrder = order === 'desc' ? -1 : 1;

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ [sort]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-password')
      .populate('referredBy', 'firstName lastName'),
    User.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: {
      users,
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
 * Update user status
 * @route PUT /api/admin/users/:id/status
 * @access Private (Admin)
 */
const updateUserStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status, reason } = req.body;
  const adminId = req.user._id;

  const user = await User.findById(id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  const oldStatus = user.status;
  user.status = status;
  await user.save();

  // Send notification to user
  let notificationMessage = '';
  switch (status) {
    case 'active':
      if (user.role === 'driver' && oldStatus === 'pending') {
        notificationMessage = 'Congratulations! Your driver application has been approved.';
        // Send approval email
        try {
          await sendDriverApproval(user);
        } catch (error) {
          logger.error('Failed to send driver approval email:', error);
        }
      } else {
        notificationMessage = 'Your account has been activated.';
      }
      break;
    case 'suspended':
      notificationMessage = `Your account has been suspended. ${reason ? `Reason: ${reason}` : ''}`;
      break;
    case 'rejected':
      notificationMessage = `Your application has been rejected. ${reason ? `Reason: ${reason}` : ''}`;
      break;
  }

  if (notificationMessage) {
    await Notification.create({
      recipient: user._id,
      title: 'Account Status Update',
      message: notificationMessage,
      type: 'account_update',
      category: 'account'
    });
  }

  logger.info('User status updated by admin', {
    userId: user._id,
    adminId,
    oldStatus,
    newStatus: status,
    reason
  });

  res.status(200).json({
    success: true,
    message: 'User status updated successfully',
    data: {
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        status: user.status
      }
    }
  });
});

/**
 * Get all bookings with filters
 * @route GET /api/admin/bookings
 * @access Private (Admin)
 */
const getBookings = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 20,
    status,
    startDate,
    endDate,
    customerId,
    driverId,
    sort = 'createdAt',
    order = 'desc'
  } = req.query;

  // Build query
  const query = {};
  
  if (status) query.status = status;
  if (customerId) query.customer = customerId;
  if (driverId) query.driver = driverId;
  
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
      .populate('customer', 'firstName lastName email phone')
      .populate('driver', 'firstName lastName email phone')
      .populate('vehicleType', 'name displayName'),
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
 * Get booking details
 * @route GET /api/admin/bookings/:id
 * @access Private (Admin)
 */
const getBookingDetails = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .populate('customer', 'firstName lastName email phone addresses')
    .populate('driver', 'firstName lastName email phone driverInfo')
    .populate('vehicleType', 'name displayName images features')
    .populate('promoCode', 'code discountType discountValue');

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
 * Create promo code
 * @route POST /api/admin/promo-codes
 * @access Private (Admin)
 */
const createPromoCode = catchAsync(async (req, res, next) => {
  const adminId = req.user._id;
  const promoData = {
    ...req.body,
    createdBy: adminId
  };

  const promoCode = await PromoCode.create(promoData);

  logger.info('Promo code created by admin', {
    adminId,
    promoCode: promoCode.code,
    discountType: promoCode.discountType,
    discountValue: promoCode.discountValue
  });

  res.status(201).json({
    success: true,
    message: 'Promo code created successfully',
    data: {
      promoCode
    }
  });
});

/**
 * Get all promo codes
 * @route GET /api/admin/promo-codes
 * @access Private (Admin)
 */
const getPromoCodes = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 20,
    status,
    search,
    sort = 'createdAt',
    order = 'desc'
  } = req.query;

  // Build query
  const query = {};
  
  if (status) query.status = status;
  
  if (search) {
    query.$or = [
      { code: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;
  const sortOrder = order === 'desc' ? -1 : 1;

  const [promoCodes, total] = await Promise.all([
    PromoCode.find(query)
      .sort({ [sort]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'firstName lastName'),
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
 * Update promo code
 * @route PUT /api/admin/promo-codes/:id
 * @access Private (Admin)
 */
const updatePromoCode = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const adminId = req.user._id;
  const updateData = {
    ...req.body,
    lastModifiedBy: adminId
  };

  const promoCode = await PromoCode.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  );

  if (!promoCode) {
    return next(new AppError('Promo code not found', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Promo code updated successfully',
    data: {
      promoCode
    }
  });
});

/**
 * Get support tickets
 * @route GET /api/admin/support-tickets
 * @access Private (Admin)
 */
const getSupportTickets = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 20,
    status,
    category,
    priority,
    assignedTo,
    sort = 'createdAt',
    order = 'desc'
  } = req.query;

  // Build query
  const query = {};

  if (status) query.status = status;
  if (category) query.category = category;
  if (priority) query.priority = priority;
  if (assignedTo) query.assignedTo = assignedTo;

  // Pagination
  const skip = (page - 1) * limit;
  const sortOrder = order === 'desc' ? -1 : 1;

  const [tickets, total] = await Promise.all([
    SupportTicket.find(query)
      .sort({ [sort]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'firstName lastName email phone')
      .populate('assignedTo', 'firstName lastName')
      .populate('relatedBooking', 'bookingId status'),
    SupportTicket.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: {
      tickets,
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
 * Assign support ticket
 * @route PUT /api/admin/support-tickets/:id/assign
 * @access Private (Admin)
 */
const assignSupportTicket = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { assignedTo } = req.body;
  const adminId = req.user._id;

  const ticket = await SupportTicket.findById(id);
  if (!ticket) {
    return next(new AppError('Support ticket not found', 404));
  }

  await ticket.assignTo(assignedTo, adminId);

  res.status(200).json({
    success: true,
    message: 'Ticket assigned successfully'
  });
});

/**
 * Get analytics data
 * @route GET /api/admin/analytics
 * @access Private (Admin)
 */
const getAnalytics = catchAsync(async (req, res, next) => {
  const { period = 'monthly', startDate, endDate } = req.query;

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

  // Revenue analytics
  const revenueData = await Booking.aggregate([
    {
      $match: {
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
        revenue: { $sum: '$pricing.total' },
        bookings: { $sum: 1 },
        averageOrderValue: { $avg: '$pricing.total' }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ]);

  // User growth analytics
  const userGrowth = await User.aggregate([
    {
      $match: dateFilter
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        newUsers: { $sum: 1 },
        newCustomers: {
          $sum: { $cond: [{ $eq: ['$role', 'customer'] }, 1, 0] }
        },
        newDrivers: {
          $sum: { $cond: [{ $eq: ['$role', 'driver'] }, 1, 0] }
        }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ]);

  // Popular vehicle types
  const vehicleTypeStats = await Booking.aggregate([
    {
      $match: {
        status: 'completed',
        ...dateFilter
      }
    },
    {
      $group: {
        _id: '$vehicleType',
        bookings: { $sum: 1 },
        revenue: { $sum: '$pricing.total' }
      }
    },
    {
      $lookup: {
        from: 'vehicletypes',
        localField: '_id',
        foreignField: '_id',
        as: 'vehicleInfo'
      }
    },
    {
      $unwind: '$vehicleInfo'
    },
    {
      $project: {
        name: '$vehicleInfo.name',
        displayName: '$vehicleInfo.displayName',
        bookings: 1,
        revenue: 1
      }
    },
    {
      $sort: { bookings: -1 }
    }
  ]);

  // Driver performance
  const driverStats = await Booking.aggregate([
    {
      $match: {
        status: 'completed',
        driver: { $exists: true },
        ...dateFilter
      }
    },
    {
      $group: {
        _id: '$driver',
        totalBookings: { $sum: 1 },
        totalEarnings: { $sum: '$pricing.total' },
        averageRating: { $avg: '$rating.driverRating.rating' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'driverInfo'
      }
    },
    {
      $unwind: '$driverInfo'
    },
    {
      $project: {
        name: {
          $concat: ['$driverInfo.firstName', ' ', '$driverInfo.lastName']
        },
        totalBookings: 1,
        totalEarnings: 1,
        averageRating: 1
      }
    },
    {
      $sort: { totalBookings: -1 }
    },
    {
      $limit: 10
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      period,
      revenue: revenueData,
      userGrowth,
      vehicleTypes: vehicleTypeStats,
      topDrivers: driverStats
    }
  });
});

/**
 * Get system health status
 * @route GET /api/admin/system-health
 * @access Private (Admin)
 */
const getSystemHealth = catchAsync(async (req, res, next) => {
  const { healthCheck } = require('../config/database');

  // Database health
  const dbHealth = await healthCheck();

  // Get system metrics
  const systemMetrics = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    version: process.version,
    platform: process.platform
  };

  // Check external services
  const externalServices = {
    database: dbHealth.status === 'healthy',
    email: true, // Would check SMTP connection
    sms: true,   // Would check SMS provider
    maps: true   // Would check Google Maps API
  };

  // Recent error logs (mock data)
  const recentErrors = [
    // This would come from actual error logging system
  ];

  res.status(200).json({
    success: true,
    data: {
      database: dbHealth,
      system: systemMetrics,
      externalServices,
      recentErrors,
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = {
  getDashboard,
  getUsers,
  updateUserStatus,
  getBookings,
  getBookingDetails,
  createPromoCode,
  getPromoCodes,
  updatePromoCode,
  getSupportTickets,
  assignSupportTicket,
  getAnalytics,
  getSystemHealth
};
