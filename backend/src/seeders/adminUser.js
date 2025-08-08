/**
 * Admin User Seeder
 * Create default admin user for the platform
 */

const User = require('../models/User');
const logger = require('../utils/logger');

const adminUserData = {
  firstName: 'Admin',
  lastName: 'User',
  email: 'admin@sendmelogistics.com',
  phone: '+1234567890',
  password: 'Admin@123456', // This will be hashed by the model
  role: 'admin',
  status: 'active',
  isEmailVerified: true,
  isPhoneVerified: true,
  registrationSource: 'seeder',
  addresses: [
    {
      type: 'work',
      label: 'SendMe HQ',
      address: '123 Business Ave, Suite 100',
      city: 'New York',
      state: 'NY',
      country: 'US',
      postalCode: '10001',
      coordinates: {
        latitude: 40.7128,
        longitude: -74.0060
      },
      isDefault: true
    }
  ],
  preferences: {
    language: 'en',
    currency: 'USD',
    timezone: 'America/New_York',
    notifications: {
      email: true,
      sms: true,
      push: true,
      marketing: false
    }
  },
  adminInfo: {
    permissions: [
      'user_management',
      'booking_management',
      'driver_approval',
      'promo_code_management',
      'support_management',
      'analytics_access',
      'system_settings'
    ],
    department: 'operations',
    accessLevel: 'super_admin'
  }
};

/**
 * Seed admin user
 */
const seedAdminUser = async () => {
  try {
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ 
      email: adminUserData.email,
      role: 'admin'
    });

    if (existingAdmin) {
      logger.info('Admin user already exists, skipping creation');
      return existingAdmin;
    }

    // Create admin user
    const adminUser = await User.create(adminUserData);
    
    // Generate referral code
    adminUser.referralCode = `ADM${adminUser._id.toString().slice(-8).toUpperCase()}`;
    await adminUser.save({ validateBeforeSave: false });

    logger.info('Admin user created successfully', {
      id: adminUser._id,
      email: adminUser.email,
      referralCode: adminUser.referralCode
    });

    return adminUser;
  } catch (error) {
    logger.error('Error seeding admin user:', error);
    throw error;
  }
};

/**
 * Create additional admin users
 */
const seedAdditionalAdmins = async () => {
  const additionalAdmins = [
    {
      firstName: 'Support',
      lastName: 'Manager',
      email: 'support@sendmelogistics.com',
      phone: '+1234567891',
      password: 'Support@123456',
      role: 'admin',
      status: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
      registrationSource: 'seeder',
      adminInfo: {
        permissions: [
          'support_management',
          'user_management',
          'booking_management'
        ],
        department: 'support',
        accessLevel: 'admin'
      }
    },
    {
      firstName: 'Operations',
      lastName: 'Manager',
      email: 'operations@sendmelogistics.com',
      phone: '+1234567892',
      password: 'Operations@123456',
      role: 'admin',
      status: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
      registrationSource: 'seeder',
      adminInfo: {
        permissions: [
          'booking_management',
          'driver_approval',
          'analytics_access'
        ],
        department: 'operations',
        accessLevel: 'admin'
      }
    }
  ];

  try {
    const createdAdmins = [];

    for (const adminData of additionalAdmins) {
      // Check if admin already exists
      const existingAdmin = await User.findOne({ 
        email: adminData.email,
        role: 'admin'
      });

      if (!existingAdmin) {
        const admin = await User.create(adminData);
        admin.referralCode = `ADM${admin._id.toString().slice(-8).toUpperCase()}`;
        await admin.save({ validateBeforeSave: false });
        createdAdmins.push(admin);
        
        logger.info('Additional admin created:', {
          email: admin.email,
          department: admin.adminInfo.department
        });
      }
    }

    return createdAdmins;
  } catch (error) {
    logger.error('Error seeding additional admin users:', error);
    throw error;
  }
};

module.exports = {
  seedAdminUser,
  seedAdditionalAdmins,
  adminUserData
};
