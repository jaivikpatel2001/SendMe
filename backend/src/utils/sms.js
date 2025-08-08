/**
 * SMS Utility
 * Handle SMS sending via Twilio or local SMS providers
 */

const twilio = require('twilio');
const axios = require('axios');
const logger = require('./logger');
const { AppError } = require('../middleware/errorHandler');

// Initialize Twilio client
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  // Only initialize Twilio client if we have valid credentials (not test/mock)
  if (process.env.TWILIO_ACCOUNT_SID.startsWith('AC') && process.env.MOCK_SMS_ENABLED !== 'true') {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
}

/**
 * Generate OTP code
 * @param {number} length - OTP length (default: 6)
 * @returns {string} Generated OTP
 */
const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  
  return otp;
};

/**
 * Send SMS via Twilio
 * @param {string} to - Recipient phone number
 * @param {string} message - SMS message
 * @returns {Promise<Object>} SMS result
 */
const sendViaTwilio = async (to, message) => {
  try {
    if (!twilioClient) {
      throw new Error('Twilio client not initialized. Check your credentials.');
    }

    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

    logger.info('SMS sent via Twilio', {
      to: to.replace(/\d(?=\d{4})/g, '*'), // Mask phone number
      sid: result.sid,
      status: result.status
    });

    return {
      success: true,
      messageId: result.sid,
      status: result.status,
      provider: 'twilio'
    };
  } catch (error) {
    logger.error('Twilio SMS error:', {
      error: error.message,
      code: error.code,
      to: to.replace(/\d(?=\d{4})/g, '*')
    });

    throw new AppError(`Failed to send SMS: ${error.message}`, 500);
  }
};

/**
 * Send SMS via local provider
 * @param {string} to - Recipient phone number
 * @param {string} message - SMS message
 * @returns {Promise<Object>} SMS result
 */
const sendViaLocalProvider = async (to, message) => {
  try {
    const response = await axios.post(process.env.LOCAL_SMS_API_URL, {
      to: to,
      message: message,
      username: process.env.LOCAL_SMS_USERNAME,
      api_key: process.env.LOCAL_SMS_API_KEY
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LOCAL_SMS_API_KEY}`
      },
      timeout: 10000
    });

    logger.info('SMS sent via local provider', {
      to: to.replace(/\d(?=\d{4})/g, '*'),
      status: response.data.status,
      messageId: response.data.message_id
    });

    return {
      success: true,
      messageId: response.data.message_id,
      status: response.data.status,
      provider: 'local'
    };
  } catch (error) {
    logger.error('Local SMS provider error:', {
      error: error.message,
      response: error.response?.data,
      to: to.replace(/\d(?=\d{4})/g, '*')
    });

    throw new AppError(`Failed to send SMS via local provider: ${error.message}`, 500);
  }
};

/**
 * Send SMS using configured provider
 * @param {string} to - Recipient phone number
 * @param {string} message - SMS message
 * @returns {Promise<Object>} SMS result
 */
const sendSMS = async (to, message) => {
  try {
    // Validate phone number format
    if (!to || !to.match(/^\+?[1-9]\d{1,14}$/)) {
      throw new AppError('Invalid phone number format', 400);
    }

    // Ensure phone number has country code
    const formattedPhone = to.startsWith('+') ? to : `+${to}`;

    // Check if SMS is mocked for development
    if (process.env.MOCK_SMS_ENABLED === 'true') {
      logger.info('Mock SMS sent', {
        to: formattedPhone.replace(/\d(?=\d{4})/g, '*'),
        message: message
      });

      return {
        success: true,
        messageId: `mock_${Date.now()}`,
        status: 'sent',
        provider: 'mock'
      };
    }

    // Choose provider based on configuration
    const provider = process.env.SMS_PROVIDER || 'twilio';

    switch (provider.toLowerCase()) {
      case 'twilio':
        return await sendViaTwilio(formattedPhone, message);
      
      case 'local':
        return await sendViaLocalProvider(formattedPhone, message);
      
      default:
        throw new AppError(`Unsupported SMS provider: ${provider}`, 500);
    }
  } catch (error) {
    logger.error('SMS sending failed:', {
      error: error.message,
      to: to.replace(/\d(?=\d{4})/g, '*'),
      provider: process.env.SMS_PROVIDER
    });

    throw error;
  }
};

/**
 * Send OTP SMS
 * @param {string} phone - Recipient phone number
 * @param {string} otp - OTP code
 * @returns {Promise<Object>} SMS result
 */
const sendOTP = async (phone, otp) => {
  const message = `Your SendMe verification code is: ${otp}. This code will expire in 10 minutes. Do not share this code with anyone.`;
  
  const result = await sendSMS(phone, message);
  
  logger.logAuthEvent('otp_sent', {
    phone: phone.replace(/\d(?=\d{4})/g, '*'),
    provider: result.provider,
    messageId: result.messageId
  });

  return result;
};

/**
 * Send booking confirmation SMS
 * @param {string} phone - Recipient phone number
 * @param {Object} booking - Booking details
 * @returns {Promise<Object>} SMS result
 */
const sendBookingConfirmation = async (phone, booking) => {
  const message = `Your SendMe booking ${booking.bookingId} has been confirmed. Driver will arrive at ${booking.pickupLocation.address} shortly. Track your booking in the app.`;
  
  const result = await sendSMS(phone, message);
  
  logger.logNotificationEvent('booking_confirmation_sent', {
    phone: phone.replace(/\d(?=\d{4})/g, '*'),
    bookingId: booking.bookingId,
    provider: result.provider
  });

  return result;
};

/**
 * Send booking status update SMS
 * @param {string} phone - Recipient phone number
 * @param {Object} booking - Booking details
 * @param {string} status - New status
 * @returns {Promise<Object>} SMS result
 */
const sendBookingStatusUpdate = async (phone, booking, status) => {
  const statusMessages = {
    'driver_assigned': `Driver assigned for booking ${booking.bookingId}. Driver is on the way to pickup location.`,
    'arrived_pickup': `Driver has arrived at pickup location for booking ${booking.bookingId}.`,
    'pickup_completed': `Your package has been picked up for booking ${booking.bookingId}. Track delivery in the app.`,
    'delivered': `Your package has been delivered successfully for booking ${booking.bookingId}. Thank you for using SendMe!`,
    'cancelled': `Your booking ${booking.bookingId} has been cancelled. If you have any questions, please contact support.`
  };

  const message = statusMessages[status] || `Your booking ${booking.bookingId} status has been updated to: ${status}`;
  
  const result = await sendSMS(phone, message);
  
  logger.logNotificationEvent('booking_status_update_sent', {
    phone: phone.replace(/\d(?=\d{4})/g, '*'),
    bookingId: booking.bookingId,
    status: status,
    provider: result.provider
  });

  return result;
};

/**
 * Send driver assignment notification SMS
 * @param {string} phone - Driver phone number
 * @param {Object} booking - Booking details
 * @returns {Promise<Object>} SMS result
 */
const sendDriverAssignment = async (phone, booking) => {
  const message = `New booking assigned: ${booking.bookingId}. Pickup: ${booking.pickupLocation.address}. Please accept or reject in the app within 5 minutes.`;
  
  const result = await sendSMS(phone, message);
  
  logger.logNotificationEvent('driver_assignment_sent', {
    phone: phone.replace(/\d(?=\d{4})/g, '*'),
    bookingId: booking.bookingId,
    provider: result.provider
  });

  return result;
};

/**
 * Send password reset SMS
 * @param {string} phone - Recipient phone number
 * @param {string} resetCode - Password reset code
 * @returns {Promise<Object>} SMS result
 */
const sendPasswordReset = async (phone, resetCode) => {
  const message = `Your SendMe password reset code is: ${resetCode}. This code will expire in 1 hour. If you didn't request this, please ignore this message.`;
  
  const result = await sendSMS(phone, message);
  
  logger.logAuthEvent('password_reset_sent', {
    phone: phone.replace(/\d(?=\d{4})/g, '*'),
    provider: result.provider
  });

  return result;
};

/**
 * Send promotional SMS
 * @param {string} phone - Recipient phone number
 * @param {string} message - Promotional message
 * @returns {Promise<Object>} SMS result
 */
const sendPromotionalSMS = async (phone, message) => {
  const result = await sendSMS(phone, message);
  
  logger.logNotificationEvent('promotional_sms_sent', {
    phone: phone.replace(/\d(?=\d{4})/g, '*'),
    provider: result.provider
  });

  return result;
};

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Is valid
 */
const validatePhoneNumber = (phone) => {
  return phone && phone.match(/^\+?[1-9]\d{1,14}$/);
};

/**
 * Format phone number
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Add + if not present
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
};

/**
 * Get SMS delivery status
 * @param {string} messageId - Message ID from provider
 * @param {string} provider - SMS provider
 * @returns {Promise<Object>} Delivery status
 */
const getSMSStatus = async (messageId, provider = 'twilio') => {
  try {
    if (provider === 'twilio' && twilioClient) {
      const message = await twilioClient.messages(messageId).fetch();
      return {
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateUpdated: message.dateUpdated
      };
    }
    
    // For local providers, implement status check API call
    return { status: 'unknown' };
  } catch (error) {
    logger.error('Failed to get SMS status:', {
      messageId,
      provider,
      error: error.message
    });
    
    return { status: 'error', error: error.message };
  }
};

module.exports = {
  generateOTP,
  sendSMS,
  sendOTP,
  sendBookingConfirmation,
  sendBookingStatusUpdate,
  sendDriverAssignment,
  sendPasswordReset,
  sendPromotionalSMS,
  validatePhoneNumber,
  formatPhoneNumber,
  getSMSStatus
};
