/**
 * Authentication Controller
 * Handle user authentication, registration, and OTP verification
 */

const crypto = require('crypto');
const User = require('../models/User');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { generateTokenPair, generateOTPToken, verifyOTPToken, refreshAccessToken, blacklistToken } = require('../utils/jwt');
const { generateOTP, sendOTP, validatePhoneNumber, formatPhoneNumber } = require('../utils/sms');
const logger = require('../utils/logger');
const { verifyIdToken } = require('../utils/firebaseAdmin');

/**
 * Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
const register = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, phone, password, role, referralCode } = req.body;

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

  // Format phone number
  const formattedPhone = formatPhoneNumber(phone);
  if (!validatePhoneNumber(formattedPhone)) {
    return next(new AppError('Invalid phone number format', 400));
  }

  // Handle referral code
  let referredBy = null;
  if (referralCode) {
    const referrer = await User.findOne({ referralCode });
    if (referrer) {
      referredBy = referrer._id;
    }
  }

  // Create new user
  const newUser = await User.create({
    firstName,
    lastName,
    email,
    phone: formattedPhone,
    password,
    role: role || 'customer',
    referredBy,
    registrationSource: 'web'
  });

  // Generate referral code for new user
  newUser.referralCode = `REF${newUser._id.toString().slice(-8).toUpperCase()}`;
  await newUser.save({ validateBeforeSave: false });

  // Generate tokens
  const tokens = generateTokenPair(newUser._id, newUser.role);

  // Remove password from output
  newUser.password = undefined;

  logger.logAuthEvent('user_registered', {
    userId: newUser._id,
    email: newUser.email,
    role: newUser.role,
    registrationSource: 'web'
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: newUser,
      tokens
    }
  });
});

/**
 * Login user with email and password
 * @route POST /api/auth/login
 * @access Public
 */
const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Check if user exists and password is correct
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    // Increment login attempts if user exists
    if (user) {
      await user.incLoginAttempts();
    }

    logger.logSecurityEvent('failed_login_attempt', {
      email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return next(new AppError('Incorrect email or password', 401));
  }

  // Check if account is locked
  if (user.isLocked) {
    logger.logSecurityEvent('locked_account_login_attempt', {
      userId: user._id,
      email,
      ip: req.ip
    });

    return next(new AppError('Account is temporarily locked due to too many failed login attempts', 423));
  }

  // Check if account is active
  if (user.status !== 'active') {
    logger.logSecurityEvent('inactive_account_login_attempt', {
      userId: user._id,
      email,
      status: user.status,
      ip: req.ip
    });

    return next(new AppError('Your account is not active. Please contact support.', 401));
  }

  // Reset login attempts on successful login
  await user.resetLoginAttempts();

  // Generate tokens
  const tokens = generateTokenPair(user._id, user.role);

  // Update last login
  user.lastLogin = require('../utils/time').nowUTC();
  await user.save({ validateBeforeSave: false });

  // Remove password from output
  user.password = undefined;

  logger.logAuthEvent('user_logged_in', {
    userId: user._id,
    email: user.email,
    role: user.role,
    ip: req.ip
  });

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user,
      tokens
    }
  });
});

/**
 * Request OTP for phone verification
 * @route POST /api/auth/otp-request
 * @access Public
 */
const requestOTP = catchAsync(async (req, res, next) => {
  const { phone } = req.body;

  // Format and validate phone number
  const formattedPhone = formatPhoneNumber(phone);
  if (!validatePhoneNumber(formattedPhone)) {
    return next(new AppError('Invalid phone number format', 400));
  }

  // Generate OTP
  const otp = generateOTP();

  // Generate OTP token for verification
  const otpToken = generateOTPToken(formattedPhone, otp);

  // Send OTP via SMS
  try {
    await sendOTP(formattedPhone, otp);

    logger.logAuthEvent('otp_requested', {
      phone: formattedPhone.replace(/\d(?=\d{4})/g, '*'),
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        otpToken,
        expiresIn: '10m'
      }
    });
  } catch (error) {
    logger.error('Failed to send OTP:', {
      phone: formattedPhone.replace(/\d(?=\d{4})/g, '*'),
      error: error.message
    });

    return next(new AppError('Failed to send OTP. Please try again.', 500));
  }
});

/**
 * Verify OTP and login/register user
 * @route POST /api/auth/otp-verify
 * @access Public
 */
const verifyOTP = catchAsync(async (req, res, next) => {
  const { phone, otp, otpToken } = req.body;

  // Verify OTP token
  let decoded;
  try {
    decoded = verifyOTPToken(otpToken);
  } catch (error) {
    return next(error);
  }

  // Verify phone number matches
  const formattedPhone = formatPhoneNumber(phone);
  if (decoded.phone !== formattedPhone) {
    return next(new AppError('Phone number mismatch', 400));
  }

  // Verify OTP code
  if (decoded.otp !== otp) {
    logger.logSecurityEvent('invalid_otp_attempt', {
      phone: formattedPhone.replace(/\d(?=\d{4})/g, '*'),
      ip: req.ip
    });

    return next(new AppError('Invalid OTP code', 400));
  }

  // Find or create user
  let user = await User.findOne({ phone: formattedPhone });

  if (!user) {
    // Create new user with phone verification
    user = await User.create({
      firstName: 'User',
      lastName: formattedPhone.slice(-4),
      email: `${Date.now()}@temp.sendme.com`, // Temporary email
      phone: formattedPhone,
      isPhoneVerified: true,
      role: 'customer',
      registrationSource: 'mobile'
    });

    // Generate referral code
    user.referralCode = `REF${user._id.toString().slice(-8).toUpperCase()}`;
    await user.save({ validateBeforeSave: false });

    logger.logAuthEvent('user_registered_via_otp', {
      userId: user._id,
      phone: formattedPhone.replace(/\d(?=\d{4})/g, '*')
    });
  } else {
    // Update phone verification status
    user.isPhoneVerified = true;
    user.lastLogin = require('../utils/time').nowUTC();
    await user.save({ validateBeforeSave: false });

    logger.logAuthEvent('user_logged_in_via_otp', {
      userId: user._id,
      phone: formattedPhone.replace(/\d(?=\d{4})/g, '*')
    });
  }

  // Generate tokens
  const tokens = generateTokenPair(user._id, user.role);

  res.status(200).json({
    success: true,
    message: 'OTP verified successfully',
    data: {
      user,
      tokens,
      isNewUser: !user.email.includes('@temp.sendme.com')
    }
  });
});

/**
 * Refresh access token
 * @route POST /api/auth/refresh-token
 * @access Public
 */
const refreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError('Refresh token is required', 400));
  }

  try {
    // Find user to get current role
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    if (user.status !== 'active') {
      return next(new AppError('User account is not active', 401));
    }

    // Generate new tokens
    const tokens = refreshAccessToken(refreshToken, user.role);

    logger.logAuthEvent('token_refreshed', {
      userId: user._id,
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        tokens
      }
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Logout user
 * @route POST /api/auth/logout
 * @access Private
 */
const logout = catchAsync(async (req, res, next) => {
  // Blacklist the current token
  blacklistToken(req.token);

  logger.logAuthEvent('user_logged_out', {
    userId: req.user._id,
    ip: req.ip
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * Social authentication (Google/Facebook)
 * @route POST /api/auth/social-login
 * @access Public
 */
const socialLogin = catchAsync(async (req, res, next) => {
  // Accept either { provider, token } or { idToken }
  const idToken = req.body.idToken || req.body.token;
  if (!idToken) {
    return next(new AppError('Firebase ID token is required', 400));
  }

  const decoded = await verifyIdToken(idToken);
  if (!decoded) {
    return next(new AppError('Invalid Firebase ID token', 401));
  }

  const signInProvider = decoded.firebase?.sign_in_provider; // 'google.com' | 'facebook.com' | ...
  const provider = req.body.provider || (signInProvider === 'google.com' ? 'google' : signInProvider === 'facebook.com' ? 'facebook' : 'google');

  const email = decoded.email;
  const firebaseUid = decoded.uid;
  const name = decoded.name || '';
  const names = name.split(' ');
  const firstName = names[0] || 'User';
  const lastName = names.slice(1).join(' ') || 'Firebase';

  // Find or create user
  let user = await User.findOne({
    $or: [
      { email },
      { [`socialAuth.${provider}.id`]: firebaseUid }
    ]
  });

  if (!user) {
    // Create new user
    user = await User.create({
      firstName,
      lastName,
      email: email || `user_${firebaseUid}@example.com`,
      phone: decoded.phone_number || `+${Date.now()}`,
      socialAuth: {
        [provider]: {
          id: firebaseUid,
          email
        }
      },
      isEmailVerified: !!decoded.email_verified,
      role: 'customer',
      registrationSource: 'web'
    });

    // Generate referral code
    user.referralCode = `REF${user._id.toString().slice(-8).toUpperCase()}`;
    await user.save({ validateBeforeSave: false });

    logger.logAuthEvent('user_registered_via_social', {
      userId: user._id,
      email: user.email,
      provider,
      ip: req.ip
    });
  } else {
    // Update social auth info if needed
    if (!user.socialAuth[provider]) {
      user.socialAuth[provider] = {
        id: firebaseUid,
        email
      };
      await user.save({ validateBeforeSave: false });
    }

    user.lastLogin = require('../utils/time').nowUTC();
    await user.save({ validateBeforeSave: false });

    logger.logAuthEvent('user_logged_in_via_social', {
      userId: user._id,
      email: user.email,
      provider,
      ip: req.ip
    });
  }

  // Generate tokens
  const tokens = generateTokenPair(user._id, user.role);

  res.status(200).json({
    success: true,
    message: 'Social login successful',
    data: {
      user,
      tokens
    }
  });
});

// Firebase-specific login endpoint (alias)
const firebaseLogin = socialLogin;

/**
 * Get current user profile
 * @route GET /api/auth/me
 * @access Private
 */
const getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate('referredBy', 'firstName lastName');

  res.status(200).json({
    success: true,
    data: {
      user
    }
  });
});

module.exports = {
  register,
  login,
  requestOTP,
  verifyOTP,
  refreshToken,
  logout,
  socialLogin,
  firebaseLogin,
  getMe
};
