/**
 * SendMe Logistics Backend Server
 * Main entry point for the multi-role logistics and delivery booking platform
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Import configurations and utilities
const { connectDB } = require('./src/config/database');
const logger = require('./src/utils/logger');
const { globalErrorHandler } = require('./src/middleware/errorHandler');

// Import routes
const authRoutes = require('./src/routes/auth');
const publicRoutes = require('./src/routes/public');
const customerRoutes = require('./src/routes/customer');
const driverRoutes = require('./src/routes/driver');
const adminRoutes = require('./src/routes/admin');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO for real-time features
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Make io accessible to routes
app.set('io', io);

// (DB connection is established before starting the server)

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL,
      'http://localhost:3000',
      'http://localhost:3001'
    ].filter(Boolean);
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Compression middleware
app.use(compression());

// HTTP request logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/admin', adminRoutes);

// Serve static files for uploads
app.use('/uploads', express.static('uploads'));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(globalErrorHandler);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.id}`);

  // Join room for real-time tracking
  socket.on('join-tracking', (bookingId) => {
    socket.join(`booking-${bookingId}`);
    logger.info(`Socket ${socket.id} joined tracking room for booking ${bookingId}`);
  });

  // Leave tracking room
  socket.on('leave-tracking', (bookingId) => {
    socket.leave(`booking-${bookingId}`);
    logger.info(`Socket ${socket.id} left tracking room for booking ${bookingId}`);
  });

  // Driver location update
  socket.on('driver-location-update', (data) => {
    const { bookingId, location } = data;
    socket.to(`booking-${bookingId}`).emit('location-update', {
      location,
      timestamp: new Date()
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.id}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
    mongoose.connection.close();
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
    mongoose.connection.close();
  });
});

// Start server after successful DB connection
const PORT = process.env.PORT || 5000;
(async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
})();

module.exports = app;
