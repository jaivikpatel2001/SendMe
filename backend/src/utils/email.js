/**
 * Email Utility
 * Handle email sending via SMTP with Nodemailer
 */

const nodemailer = require('nodemailer');
const logger = require('./logger');
const { AppError } = require('../middleware/errorHandler');

// Create transporter
let transporter = null;

const createTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify connection configuration
    transporter.verify((error, success) => {
      if (error) {
        logger.error('SMTP connection error:', error);
      } else {
        logger.info('SMTP server is ready to take our messages');
      }
    });
  }
  
  return transporter;
};

/**
 * Send email
 * @param {Object} options - Email options
 * @returns {Promise<Object>} Email result
 */
const sendEmail = async (options) => {
  try {
    const {
      to,
      subject,
      text,
      html,
      attachments = [],
      template = null,
      templateData = {}
    } = options;

    if (!to || !subject) {
      throw new AppError('Email recipient and subject are required', 400);
    }

    const transporter = createTransporter();

    // Prepare email content
    let emailContent = {
      from: `${process.env.FROM_NAME || 'SendMe Logistics'} <${process.env.FROM_EMAIL}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      attachments
    };

    // Use template if provided
    if (template) {
      const templateContent = await renderTemplate(template, templateData);
      emailContent.html = templateContent.html;
      emailContent.text = templateContent.text;
    } else {
      if (html) emailContent.html = html;
      if (text) emailContent.text = text;
    }

    // Send email
    const result = await transporter.sendMail(emailContent);

    logger.info('Email sent successfully', {
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      messageId: result.messageId
    });

    return {
      success: true,
      messageId: result.messageId,
      response: result.response
    };

  } catch (error) {
    logger.error('Email sending failed:', {
      error: error.message,
      to: options.to,
      subject: options.subject
    });

    throw new AppError(`Failed to send email: ${error.message}`, 500);
  }
};

/**
 * Render email template
 * @param {string} templateName - Template name
 * @param {Object} data - Template data
 * @returns {Object} Rendered template
 */
const renderTemplate = async (templateName, data) => {
  // Email templates
  const templates = {
    welcome: {
      subject: 'Welcome to SendMe Logistics!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2c3e50;">Welcome to SendMe, ${data.firstName}!</h1>
          <p>Thank you for joining SendMe Logistics. We're excited to have you on board!</p>
          <p>Your account has been created successfully. You can now start booking deliveries or apply to become a driver.</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Getting Started:</h3>
            <ul>
              <li>Complete your profile setup</li>
              <li>Add your delivery addresses</li>
              <li>Set up payment methods</li>
              <li>Book your first delivery</li>
            </ul>
          </div>
          <p>If you have any questions, feel free to contact our support team.</p>
          <p>Best regards,<br>The SendMe Team</p>
        </div>
      `,
      text: `Welcome to SendMe Logistics, ${data.firstName}! Thank you for joining us. Your account has been created successfully.`
    },

    booking_confirmation: {
      subject: `Booking Confirmed - ${data.bookingId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2c3e50;">Booking Confirmed</h1>
          <p>Hi ${data.customerName},</p>
          <p>Your booking has been confirmed and we're finding a driver for you.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Booking Details:</h3>
            <p><strong>Booking ID:</strong> ${data.bookingId}</p>
            <p><strong>Pickup:</strong> ${data.pickupAddress}</p>
            <p><strong>Delivery:</strong> ${data.deliveryAddress}</p>
            <p><strong>Total Amount:</strong> $${data.totalAmount}</p>
            <p><strong>Scheduled For:</strong> ${data.scheduledFor}</p>
          </div>
          
          <p>You'll receive updates as your booking progresses. Track your delivery in real-time using the app or website.</p>
          <p>Thank you for choosing SendMe!</p>
        </div>
      `,
      text: `Booking Confirmed - ${data.bookingId}. Pickup: ${data.pickupAddress}, Delivery: ${data.deliveryAddress}, Total: $${data.totalAmount}`
    },

    driver_approved: {
      subject: 'Driver Application Approved - Welcome to SendMe!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #27ae60;">Congratulations! Your Driver Application is Approved</h1>
          <p>Hi ${data.firstName},</p>
          <p>Great news! Your driver application has been approved. You can now start accepting delivery requests and earning money with SendMe.</p>
          
          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Next Steps:</h3>
            <ol>
              <li>Download the SendMe Driver app</li>
              <li>Complete your profile setup</li>
              <li>Go online to start receiving delivery requests</li>
              <li>Start earning money!</li>
            </ol>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Earning Potential:</h3>
            <p>• Base rate: $2.50 per delivery</p>
            <p>• Distance rate: $1.25 per mile</p>
            <p>• Peak hour bonuses up to 2x</p>
            <p>• Keep 100% of tips</p>
          </div>
          
          <p>Welcome to the SendMe driver community!</p>
        </div>
      `,
      text: `Congratulations! Your driver application has been approved. You can now start accepting delivery requests with SendMe.`
    },

    password_reset: {
      subject: 'Reset Your SendMe Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2c3e50;">Reset Your Password</h1>
          <p>Hi ${data.firstName},</p>
          <p>You requested to reset your password for your SendMe account.</p>
          
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p><strong>Reset Code:</strong> ${data.resetCode}</p>
            <p>This code will expire in 1 hour.</p>
          </div>
          
          <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
          <p>For security reasons, never share this code with anyone.</p>
        </div>
      `,
      text: `Password reset code: ${data.resetCode}. This code expires in 1 hour.`
    },

    delivery_completed: {
      subject: `Package Delivered - ${data.bookingId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #27ae60;">Package Delivered Successfully!</h1>
          <p>Hi ${data.customerName},</p>
          <p>Your package has been delivered successfully.</p>
          
          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Delivery Details:</h3>
            <p><strong>Booking ID:</strong> ${data.bookingId}</p>
            <p><strong>Delivered To:</strong> ${data.deliveryAddress}</p>
            <p><strong>Delivered At:</strong> ${data.deliveredAt}</p>
            <p><strong>Driver:</strong> ${data.driverName}</p>
          </div>
          
          <p>We hope you're satisfied with our service. Please consider rating your driver and sharing your experience.</p>
          <p>Thank you for choosing SendMe!</p>
        </div>
      `,
      text: `Package delivered successfully! Booking ID: ${data.bookingId}, Delivered to: ${data.deliveryAddress}`
    },

    support_ticket_created: {
      subject: `Support Ticket Created - ${data.ticketId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2c3e50;">Support Ticket Created</h1>
          <p>Hi ${data.customerName},</p>
          <p>Your support ticket has been created successfully. Our team will review it and respond within 24 hours.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Ticket Details:</h3>
            <p><strong>Ticket ID:</strong> ${data.ticketId}</p>
            <p><strong>Subject:</strong> ${data.subject}</p>
            <p><strong>Category:</strong> ${data.category}</p>
            <p><strong>Priority:</strong> ${data.priority}</p>
          </div>
          
          <p>You can track the status of your ticket in your account dashboard.</p>
          <p>Thank you for contacting SendMe support.</p>
        </div>
      `,
      text: `Support ticket created: ${data.ticketId}. Subject: ${data.subject}. We'll respond within 24 hours.`
    }
  };

  const template = templates[templateName];
  if (!template) {
    throw new AppError(`Email template '${templateName}' not found`, 404);
  }

  return {
    subject: template.subject,
    html: template.html,
    text: template.text
  };
};

/**
 * Send welcome email
 * @param {Object} user - User object
 * @returns {Promise<Object>} Email result
 */
const sendWelcomeEmail = async (user) => {
  return await sendEmail({
    to: user.email,
    template: 'welcome',
    templateData: {
      firstName: user.firstName,
      email: user.email
    }
  });
};

/**
 * Send booking confirmation email
 * @param {Object} booking - Booking object
 * @param {Object} customer - Customer object
 * @returns {Promise<Object>} Email result
 */
const sendBookingConfirmation = async (booking, customer) => {
  return await sendEmail({
    to: customer.email,
    template: 'booking_confirmation',
    templateData: {
      customerName: customer.firstName,
      bookingId: booking.bookingId,
      pickupAddress: booking.pickupLocation.address,
      deliveryAddress: booking.dropLocation.address,
      totalAmount: booking.pricing.total,
      scheduledFor: booking.scheduledFor.toLocaleString()
    }
  });
};

/**
 * Send driver approval email
 * @param {Object} driver - Driver object
 * @returns {Promise<Object>} Email result
 */
const sendDriverApproval = async (driver) => {
  return await sendEmail({
    to: driver.email,
    template: 'driver_approved',
    templateData: {
      firstName: driver.firstName
    }
  });
};

/**
 * Send password reset email
 * @param {Object} user - User object
 * @param {string} resetCode - Reset code
 * @returns {Promise<Object>} Email result
 */
const sendPasswordReset = async (user, resetCode) => {
  return await sendEmail({
    to: user.email,
    template: 'password_reset',
    templateData: {
      firstName: user.firstName,
      resetCode
    }
  });
};

/**
 * Send delivery completion email
 * @param {Object} booking - Booking object
 * @param {Object} customer - Customer object
 * @param {Object} driver - Driver object
 * @returns {Promise<Object>} Email result
 */
const sendDeliveryCompletion = async (booking, customer, driver) => {
  return await sendEmail({
    to: customer.email,
    template: 'delivery_completed',
    templateData: {
      customerName: customer.firstName,
      bookingId: booking.bookingId,
      deliveryAddress: booking.dropLocation.address,
      deliveredAt: new Date().toLocaleString(),
      driverName: `${driver.firstName} ${driver.lastName}`
    }
  });
};

/**
 * Send support ticket creation email
 * @param {Object} ticket - Support ticket object
 * @param {Object} user - User object
 * @returns {Promise<Object>} Email result
 */
const sendSupportTicketCreated = async (ticket, user) => {
  return await sendEmail({
    to: user.email,
    template: 'support_ticket_created',
    templateData: {
      customerName: user.firstName,
      ticketId: ticket.ticketId,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority
    }
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendBookingConfirmation,
  sendDriverApproval,
  sendPasswordReset,
  sendDeliveryCompletion,
  sendSupportTicketCreated
};
