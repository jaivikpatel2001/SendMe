/**
 * User Controller
 * Handle all user-related operations and business logic
 */

const User = require('../models/User');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const { catchAsync } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * @desc    Get all users with pagination, filtering, and sorting
 * @route   GET /api/users
 * @access  Admin only
 */
const getUsers = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    role,
    status,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    isEmailVerified,
    isPhoneVerified
  } = req.query;

  // Build query
  const query = {};
  
  if (role) query.role = role;
  if (status) query.status = status;
  if (isEmailVerified !== undefined) query.isEmailVerified = isEmailVerified === 'true';
  if (isPhoneVerified !== undefined) query.isPhoneVerified = isPhoneVerified === 'true';
  
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
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query
  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password -refreshTokens -socialAuth.google.accessToken -socialAuth.facebook.accessToken')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('referredBy', 'firstName lastName email'),
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
 * @desc    Get single user by ID
 * @route   GET /api/users/:id
 * @access  Admin or own profile
 */
const getUserById = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Check if user can access this profile
  if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only view your own profile.'
    });
  }

  const user = await User.findById(id)
    .select('-password -refreshTokens -socialAuth.google.accessToken -socialAuth.facebook.accessToken')
    .populate('referredBy', 'firstName lastName email');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Get additional stats for the user
  const stats = await getUserStats(id);

  res.status(200).json({
    success: true,
    data: {
      user,
      stats
    }
  });
});

/**
 * @desc    Create new user
 * @route   POST /api/users
 * @access  Admin only
 */
const createUser = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    password,
    role = 'customer',
    status = 'active'
  } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { phone }]
  });

  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User with this email or phone already exists'
    });
  }

  // Hash password
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user
  const user = await User.create({
    firstName,
    lastName,
    email,
    phone,
    password: hashedPassword,
    role,
    status,
    isEmailVerified: true, // Admin created users are auto-verified
    isPhoneVerified: true
  });

  // Remove password from response
  user.password = undefined;

  logger.info(`New user created by admin: ${user.email}`);

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: { user }
  });
});

/**
 * @desc    Update user
 * @route   PUT /api/users/:id
 * @access  Admin or own profile
 */
const updateUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Check if user can update this profile
  if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only update your own profile.'
    });
  }

  // Remove sensitive fields that shouldn't be updated directly
  delete updates.password;
  delete updates.refreshTokens;
  delete updates.socialAuth;
  delete updates.loginAttempts;
  delete updates.lockUntil;

  // Only admin can update role and status
  if (req.user.role !== 'admin') {
    delete updates.role;
    delete updates.status;
    delete updates.isEmailVerified;
    delete updates.isPhoneVerified;
  }

  const user = await User.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  ).select('-password -refreshTokens -socialAuth.google.accessToken -socialAuth.facebook.accessToken');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  logger.info(`User updated: ${user.email}`);

  res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: { user }
  });
});

/**
 * @desc    Partial update user
 * @route   PATCH /api/users/:id
 * @access  Admin or own profile
 */
const patchUser = catchAsync(async (req, res) => {
  // Use the same logic as updateUser for PATCH
  await updateUser(req, res);
});

/**
 * @desc    Delete user (soft delete)
 * @route   DELETE /api/users/:id
 * @access  Admin only
 */
const deleteUser = catchAsync(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Soft delete by updating status
  user.status = 'deleted';
  user.deletedAt = new Date();
  await user.save();

  logger.info(`User soft deleted: ${user.email}`);

  res.status(200).json({
    success: true,
    message: 'User deleted successfully'
  });
});

/**
 * Helper function to get user statistics
 */
const getUserStats = async (userId) => {
  const [bookingStats, reviewStats] = await Promise.all([
    Booking.aggregate([
      { $match: { $or: [{ customer: userId }, { driver: userId }] } },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          completedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          cancelledBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          totalEarnings: {
            $sum: { $cond: [{ $eq: ['$driver', userId] }, '$payment.finalAmount', 0] }
          }
        }
      }
    ]),
    Review.aggregate([
      { $match: { reviewee: userId } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ])
  ]);

  return {
    bookings: bookingStats[0] || {
      totalBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      totalEarnings: 0
    },
    reviews: reviewStats[0] || {
      averageRating: 0,
      totalReviews: 0
    }
  };
};

/**
 * @desc    Update user status (activate/deactivate/suspend)
 * @route   PATCH /api/users/:id/status
 * @access  Admin only
 */
const updateUserStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  const validStatuses = ['pending', 'active', 'suspended', 'rejected', 'deleted'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status value'
    });
  }

  const user = await User.findById(id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const oldStatus = user.status;
  user.status = status;

  if (reason) {
    user.statusHistory = user.statusHistory || [];
    user.statusHistory.push({
      status,
      reason,
      changedBy: req.user._id,
      changedAt: new Date()
    });
  }

  await user.save();

  logger.info(`User status changed from ${oldStatus} to ${status}: ${user.email}`);

  res.status(200).json({
    success: true,
    message: `User status updated to ${status}`,
    data: { user: { _id: user._id, status: user.status } }
  });
});

/**
 * @desc    Update driver location
 * @route   PATCH /api/users/:id/location
 * @access  Driver only (own location)
 */
const updateDriverLocation = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude } = req.body;

  // Check if user can update this location
  if (req.user._id.toString() !== id || req.user.role !== 'driver') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Drivers can only update their own location.'
    });
  }

  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      message: 'Latitude and longitude are required'
    });
  }

  const user = await User.findById(id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  user.driverInfo.currentLocation = {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    lastUpdated: new Date()
  };

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Location updated successfully',
    data: {
      location: user.driverInfo.currentLocation
    }
  });
});

/**
 * @desc    Toggle driver online status
 * @route   PATCH /api/users/:id/online-status
 * @access  Driver only (own status)
 */
const toggleDriverOnlineStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { isOnline } = req.body;

  // Check if user can update this status
  if (req.user._id.toString() !== id || req.user.role !== 'driver') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Drivers can only update their own online status.'
    });
  }

  const user = await User.findById(id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  if (user.status !== 'active') {
    return res.status(400).json({
      success: false,
      message: 'Driver must be active to go online'
    });
  }

  user.driverInfo.isOnline = isOnline;
  await user.save();

  logger.info(`Driver ${isOnline ? 'went online' : 'went offline'}: ${user.email}`);

  res.status(200).json({
    success: true,
    message: `Driver is now ${isOnline ? 'online' : 'offline'}`,
    data: {
      isOnline: user.driverInfo.isOnline
    }
  });
});

/**
 * @desc    Get nearby drivers
 * @route   GET /api/users/drivers/nearby
 * @access  Admin, Customer
 */
const getNearbyDrivers = catchAsync(async (req, res) => {
  const { latitude, longitude, radius = 10, vehicleType } = req.query;

  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      message: 'Latitude and longitude are required'
    });
  }

  const query = {
    role: 'driver',
    status: 'active',
    'driverInfo.isOnline': true,
    'driverInfo.currentLocation.latitude': { $exists: true },
    'driverInfo.currentLocation.longitude': { $exists: true }
  };

  if (vehicleType) {
    query['driverInfo.vehicleType'] = vehicleType;
  }

  const drivers = await User.aggregate([
    { $match: query },
    {
      $addFields: {
        distance: {
          $sqrt: {
            $add: [
              {
                $pow: [
                  {
                    $multiply: [
                      { $subtract: ['$driverInfo.currentLocation.latitude', parseFloat(latitude)] },
                      111.32
                    ]
                  },
                  2
                ]
              },
              {
                $pow: [
                  {
                    $multiply: [
                      { $subtract: ['$driverInfo.currentLocation.longitude', parseFloat(longitude)] },
                      { $cos: { $multiply: [parseFloat(latitude), Math.PI / 180] } },
                      111.32
                    ]
                  },
                  2
                ]
              }
            ]
          }
        }
      }
    },
    { $match: { distance: { $lte: parseFloat(radius) } } },
    { $sort: { distance: 1 } },
    {
      $project: {
        firstName: 1,
        lastName: 1,
        phone: 1,
        'driverInfo.currentLocation': 1,
        'driverInfo.vehicleType': 1,
        'driverInfo.vehicleDetails': 1,
        'driverInfo.rating': 1,
        distance: 1
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      drivers,
      count: drivers.length
    }
  });
});

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  patchUser,
  deleteUser,
  updateUserStatus,
  updateDriverLocation,
  toggleDriverOnlineStatus,
  getNearbyDrivers
};
