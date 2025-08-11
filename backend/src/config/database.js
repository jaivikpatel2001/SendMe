/**
 * Database Configuration
 * MongoDB connection setup with Mongoose
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Connect to MongoDB database
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  try {
    const mongoURI = process.env.NODE_ENV === 'test' 
      ? process.env.MONGODB_TEST_URI 
      : process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error('MongoDB URI is not defined in environment variables');
    }

    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      bufferCommands: false, // Disable mongoose buffering
    };

    // Connect to MongoDB
    const conn = await mongoose.connect(mongoURI, options);

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Connection event listeners
    mongoose.connection.on('connected', () => {
      logger.info('Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Mongoose disconnected from MongoDB');
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('Mongoose connection closed due to application termination');
      process.exit(0);
    });

  } catch (error) {
    // Log detailed error and attempt a localhost -> 127.0.0.1 fallback for Windows DNS issues
    const errMsg = error && error.message ? error.message : String(error);
    logger.error(`Database connection failed: ${errMsg}`);

    try {
      const mongoURI = process.env.NODE_ENV === 'test'
        ? process.env.MONGODB_TEST_URI
        : process.env.MONGODB_URI;

      if (mongoURI && mongoURI.includes('localhost')) {
        const fallbackURI = mongoURI.replace('localhost', '127.0.0.1');
        logger.warn(`Retrying MongoDB connection using 127.0.0.1 fallback: ${fallbackURI}`);
        const conn = await mongoose.connect(fallbackURI, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          family: 4,
          bufferCommands: false,
        });
        logger.info(`MongoDB Connected (fallback): ${conn.connection.host}`);
        return;
      }
    } catch (fallbackError) {
      const fbMsg = fallbackError && fallbackError.message ? fallbackError.message : String(fallbackError);
      logger.error(`Fallback MongoDB connection failed: ${fbMsg}`);
    }

    logger.error('Ensure MongoDB is running locally on port 27017, or update MONGODB_URI in backend/.env.');
    process.exit(1);
  }
};

/**
 * Close database connection
 * @returns {Promise<void>}
 */
const closeDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error.message);
  }
};

/**
 * Clear database (for testing purposes)
 * @returns {Promise<void>}
 */
const clearDB = async () => {
  try {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Database clearing is only allowed in test environment');
    }

    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
    
    logger.info('Database cleared successfully');
  } catch (error) {
    logger.error('Error clearing database:', error.message);
    throw error;
  }
};

/**
 * Get database connection status
 * @returns {Object} Connection status information
 */
const getConnectionStatus = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  return {
    state: states[state] || 'unknown',
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name
  };
};

/**
 * Database health check
 * @returns {Promise<Object>} Health check result
 */
const healthCheck = async () => {
  try {
    const status = getConnectionStatus();
    
    if (status.state !== 'connected') {
      throw new Error(`Database is ${status.state}`);
    }

    // Perform a simple query to test connection
    await mongoose.connection.db.admin().ping();

    return {
      status: 'healthy',
      connection: status,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      connection: getConnectionStatus(),
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = {
  connectDB,
  closeDB,
  clearDB,
  getConnectionStatus,
  healthCheck
};
