/**
 * Database Seeder
 * Main seeder file to populate the database with initial data
 */

const { connectDB } = require('../config/database');
const { seedVehicleTypes } = require('./vehicleTypes');
const { seedAdminUser, seedAdditionalAdmins } = require('./adminUser');
const logger = require('../utils/logger');

/**
 * Run all seeders
 */
const runSeeders = async () => {
  try {
    logger.info('Starting database seeding...');

    // Connect to database
    await connectDB();
    logger.info('Connected to database');

    // Seed vehicle types
    logger.info('Seeding vehicle types...');
    await seedVehicleTypes();
    logger.info('Vehicle types seeded successfully');

    // Seed admin users
    logger.info('Seeding admin users...');
    await seedAdminUser();
    await seedAdditionalAdmins();
    logger.info('Admin users seeded successfully');

    logger.info('Database seeding completed successfully');
    process.exit(0);

  } catch (error) {
    logger.error('Database seeding failed:', error);
    process.exit(1);
  }
};

/**
 * Clear all data from database
 */
const clearDatabase = async () => {
  try {
    logger.info('Clearing database...');

    // Connect to database
    await connectDB();

    const User = require('../models/User');
    const Booking = require('../models/Booking');
    const VehicleType = require('../models/Vehicle');
    const Review = require('../models/Review');
    const PromoCode = require('../models/PromoCode');
    const Notification = require('../models/Notification');
    const SupportTicket = require('../models/SupportTicket');
    const CmsContent = require('../models/CmsContent');

    // Clear all collections
    await Promise.all([
      User.deleteMany({}),
      Booking.deleteMany({}),
      VehicleType.deleteMany({}),
      Review.deleteMany({}),
      PromoCode.deleteMany({}),
      Notification.deleteMany({}),
      SupportTicket.deleteMany({}),
      CmsContent.deleteMany({})
    ]);

    logger.info('Database cleared successfully');
    process.exit(0);

  } catch (error) {
    logger.error('Database clearing failed:', error);
    process.exit(1);
  }
};

/**
 * Seed development data
 */
const seedDevelopmentData = async () => {
  try {
    logger.info('Seeding development data...');

    // Connect to database
    await connectDB();

    // Run basic seeders
    await seedVehicleTypes();
    await seedAdminUser();
    await seedAdditionalAdmins();

    // Create sample customers and drivers
    await seedSampleUsers();

    // Create sample bookings
    await seedSampleBookings();

    // Create sample promo codes
    await seedSamplePromoCodes();

    logger.info('Development data seeded successfully');
    process.exit(0);

  } catch (error) {
    logger.error('Development data seeding failed:', error);
    process.exit(1);
  }
};

/**
 * Seed sample users for development
 */
const seedSampleUsers = async () => {
  const User = require('../models/User');

  const sampleUsers = [
    // Sample customers
    {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567893',
      password: 'Customer@123',
      role: 'customer',
      status: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
      registrationSource: 'seeder'
    },
    {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phone: '+1234567894',
      password: 'Customer@123',
      role: 'customer',
      status: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
      registrationSource: 'seeder'
    },
    // Sample drivers
    {
      firstName: 'Mike',
      lastName: 'Johnson',
      email: 'mike.johnson@example.com',
      phone: '+1234567895',
      password: 'Driver@123',
      role: 'driver',
      status: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
      registrationSource: 'seeder',
      driverInfo: {
        licenseNumber: 'DL123456789',
        licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        isOnline: false,
        rating: {
          average: 4.8,
          count: 150
        },
        earnings: {
          total: 5000,
          pending: 250,
          withdrawn: 4750
        },
        vehicleDetails: {
          make: 'Honda',
          model: 'Civic',
          year: 2020,
          color: 'Blue',
          plateNumber: 'ABC123',
          registrationNumber: 'REG123456',
          registrationExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          insuranceNumber: 'INS123456',
          insuranceExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        },
        bankDetails: {
          accountHolderName: 'Mike Johnson',
          accountNumber: '1234567890',
          bankName: 'Chase Bank',
          routingNumber: '021000021',
          accountType: 'checking'
        }
      }
    },
    {
      firstName: 'Sarah',
      lastName: 'Wilson',
      email: 'sarah.wilson@example.com',
      phone: '+1234567896',
      password: 'Driver@123',
      role: 'driver',
      status: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
      registrationSource: 'seeder',
      driverInfo: {
        licenseNumber: 'DL987654321',
        licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isOnline: true,
        rating: {
          average: 4.9,
          count: 200
        },
        earnings: {
          total: 7500,
          pending: 350,
          withdrawn: 7150
        },
        currentLocation: {
          latitude: 40.7128,
          longitude: -74.0060,
          lastUpdated: new Date()
        },
        vehicleDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2021,
          color: 'White',
          plateNumber: 'XYZ789',
          registrationNumber: 'REG789012',
          registrationExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          insuranceNumber: 'INS789012',
          insuranceExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        },
        bankDetails: {
          accountHolderName: 'Sarah Wilson',
          accountNumber: '0987654321',
          bankName: 'Bank of America',
          routingNumber: '026009593',
          accountType: 'checking'
        }
      }
    }
  ];

  for (const userData of sampleUsers) {
    const existingUser = await User.findOne({ email: userData.email });
    if (!existingUser) {
      const user = await User.create(userData);
      user.referralCode = `${userData.role.toUpperCase().slice(0, 3)}${user._id.toString().slice(-8).toUpperCase()}`;
      await user.save({ validateBeforeSave: false });
      logger.info(`Sample ${userData.role} created:`, userData.email);
    }
  }
};

/**
 * Seed sample bookings for development
 */
const seedSampleBookings = async () => {
  // This would create sample bookings for testing
  logger.info('Sample bookings seeding skipped (implement as needed)');
};

/**
 * Seed sample promo codes for development
 */
const seedSamplePromoCodes = async () => {
  const PromoCode = require('../models/PromoCode');
  const User = require('../models/User');

  const admin = await User.findOne({ role: 'admin' });
  if (!admin) return;

  const samplePromoCodes = [
    {
      code: 'WELCOME10',
      name: 'Welcome Discount',
      description: '10% off your first order',
      discountType: 'percentage',
      discountValue: 10,
      maximumDiscount: 20,
      minimumOrderValue: 10,
      usageLimit: {
        total: 1000,
        perUser: 1
      },
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      targetAudience: {
        userTypes: ['customer'],
        newUsersOnly: true
      },
      applicableServices: ['delivery', 'pickup'],
      status: 'active',
      isPublic: true,
      createdBy: admin._id
    },
    {
      code: 'SAVE5',
      name: 'Save $5',
      description: '$5 off orders over $25',
      discountType: 'fixed',
      discountValue: 5,
      minimumOrderValue: 25,
      usageLimit: {
        total: 500,
        perUser: 3
      },
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      targetAudience: {
        userTypes: ['customer'],
        newUsersOnly: false
      },
      applicableServices: ['all'],
      status: 'active',
      isPublic: true,
      createdBy: admin._id
    }
  ];

  for (const promoData of samplePromoCodes) {
    const existingPromo = await PromoCode.findOne({ code: promoData.code });
    if (!existingPromo) {
      await PromoCode.create(promoData);
      logger.info(`Sample promo code created: ${promoData.code}`);
    }
  }
};

// Handle command line arguments
const command = process.argv[2];

switch (command) {
  case 'seed':
    runSeeders();
    break;
  case 'clear':
    clearDatabase();
    break;
  case 'dev':
    seedDevelopmentData();
    break;
  default:
    logger.info('Available commands:');
    logger.info('  npm run seed        - Run basic seeders');
    logger.info('  npm run seed:clear  - Clear all data');
    logger.info('  npm run seed:dev    - Seed development data');
    process.exit(0);
}

module.exports = {
  runSeeders,
  clearDatabase,
  seedDevelopmentData
};
