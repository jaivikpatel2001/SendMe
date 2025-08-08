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
      lastName: 'Smith',
      email: 'john.smith@example.com',
      phone: '+447700900124',
      password: 'Customer@123',
      role: 'customer',
      status: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
      registrationSource: 'seeder'
    },
    {
      firstName: 'Emma',
      lastName: 'Johnson',
      email: 'emma.johnson@example.com',
      phone: '+447700900125',
      password: 'Customer@123',
      role: 'customer',
      status: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
      registrationSource: 'seeder'
    },
    // Sample drivers
    {
      firstName: 'Michael',
      lastName: 'Davies',
      email: 'michael.davies@example.com',
      phone: '+447700900126',
      password: 'Driver@123',
      role: 'driver',
      status: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
      registrationSource: 'seeder',
      driverInfo: {
        licenseNumber: 'DAVIE123456789',
        licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        isOnline: false,
        rating: {
          average: 4.8,
          count: 150
        },
        earnings: {
          total: 4000,
          pending: 200,
          withdrawn: 3800
        },
        vehicleDetails: {
          make: 'Ford',
          model: 'Transit',
          year: 2020,
          color: 'White',
          plateNumber: 'MD20 ABC',
          registrationNumber: 'REG123456',
          registrationExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          insuranceNumber: 'INS123456',
          insuranceExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        },
        bankDetails: {
          accountHolderName: 'Michael Davies',
          accountNumber: '12345678',
          bankName: 'Barclays Bank',
          sortCode: '20-00-00',
          accountType: 'current'
        }
      }
    },
    {
      firstName: 'Sarah',
      lastName: 'Williams',
      email: 'sarah.williams@example.com',
      phone: '+447700900127',
      password: 'Driver@123',
      role: 'driver',
      status: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
      registrationSource: 'seeder',
      driverInfo: {
        licenseNumber: 'WILLI987654321',
        licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isOnline: true,
        rating: {
          average: 4.9,
          count: 200
        },
        earnings: {
          total: 6000,
          pending: 280,
          withdrawn: 5720
        },
        currentLocation: {
          latitude: 53.4808,
          longitude: -2.2426,
          lastUpdated: new Date()
        },
        vehicleDetails: {
          make: 'Vauxhall',
          model: 'Vivaro',
          year: 2021,
          color: 'Silver',
          plateNumber: 'SW21 XYZ',
          registrationNumber: 'REG789012',
          registrationExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          insuranceNumber: 'INS789012',
          insuranceExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        },
        bankDetails: {
          accountHolderName: 'Sarah Williams',
          accountNumber: '87654321',
          bankName: 'HSBC Bank',
          sortCode: '40-00-00',
          accountType: 'current'
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
      maximumDiscount: 15,
      minimumOrderValue: 8,
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
      code: 'SAVE4',
      name: 'Save £4',
      description: '£4 off orders over £20',
      discountType: 'fixed',
      discountValue: 4,
      minimumOrderValue: 20,
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
