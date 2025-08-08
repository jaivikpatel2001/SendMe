/**
 * Public Controller
 * Handle public endpoints accessible without authentication
 */

const VehicleType = require('../models/Vehicle');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Get home page data
 * @route GET /api/public/home
 * @access Public
 */
const getHomeData = catchAsync(async (req, res, next) => {
  // Get active vehicle types
  const vehicleTypes = await VehicleType.find({
    status: 'active',
    'availability.isActive': true
  })
  .select('name displayName description images pricing features isPopular isFeatured')
  .sort({ sortOrder: 1, createdAt: -1 })
  .limit(6);

  // Popular cities (this would typically come from a database)
  const popularCities = [
    {
      name: 'New York',
      state: 'NY',
      country: 'US',
      image: '/images/cities/new-york.jpg',
      isActive: true
    },
    {
      name: 'Los Angeles',
      state: 'CA',
      country: 'US',
      image: '/images/cities/los-angeles.jpg',
      isActive: true
    },
    {
      name: 'Chicago',
      state: 'IL',
      country: 'US',
      image: '/images/cities/chicago.jpg',
      isActive: true
    },
    {
      name: 'Houston',
      state: 'TX',
      country: 'US',
      image: '/images/cities/houston.jpg',
      isActive: true
    }
  ];

  // Available services
  const services = [
    {
      id: 'delivery',
      name: 'Package Delivery',
      description: 'Fast and reliable package delivery service',
      icon: '/images/icons/delivery.svg',
      features: ['Real-time tracking', 'Same-day delivery', 'Secure handling']
    },
    {
      id: 'pickup',
      name: 'Pickup Service',
      description: 'Convenient pickup from any location',
      icon: '/images/icons/pickup.svg',
      features: ['Flexible timing', 'Multiple locations', 'Professional drivers']
    },
    {
      id: 'moving',
      name: 'Moving Service',
      description: 'Complete moving solutions for homes and offices',
      icon: '/images/icons/moving.svg',
      features: ['Packing assistance', 'Furniture handling', 'Insurance coverage']
    },
    {
      id: 'express',
      name: 'Express Delivery',
      description: 'Ultra-fast delivery for urgent packages',
      icon: '/images/icons/express.svg',
      features: ['1-hour delivery', 'Priority handling', 'Live tracking']
    }
  ];

  // About us content
  const aboutUs = {
    title: 'About SendMe Logistics',
    description: 'SendMe is a leading logistics and delivery platform connecting customers with reliable drivers for fast, secure, and affordable delivery services.',
    features: [
      'Real-time tracking',
      'Secure payments',
      'Professional drivers',
      '24/7 customer support',
      'Competitive pricing',
      'Multiple vehicle options'
    ],
    stats: {
      totalDeliveries: '1M+',
      activeCities: '50+',
      registeredDrivers: '10K+',
      customerSatisfaction: '4.8/5'
    }
  };

  // Support information
  const support = {
    phone: process.env.SUPPORT_PHONE || '+44-800-SENDME',
    email: process.env.SUPPORT_EMAIL || 'support@sendmelogistics.com',
    hours: '24/7',
    languages: ['English']
  };

  logger.info('Home data requested', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(200).json({
    success: true,
    data: {
      vehicleTypes,
      popularCities,
      services,
      aboutUs,
      support
    }
  });
});

/**
 * Get driver information page data
 * @route GET /api/public/driver-info
 * @access Public
 */
const getDriverInfo = catchAsync(async (req, res, next) => {
  // Driver registration information
  const driverInfo = {
    title: 'Become a SendMe Driver',
    subtitle: 'Join thousands of drivers earning money on their schedule',
    
    benefits: [
      {
        title: 'Flexible Schedule',
        description: 'Work when you want, where you want',
        icon: '/images/icons/flexible.svg'
      },
      {
        title: 'Competitive Earnings',
        description: 'Earn up to $25/hour during peak times',
        icon: '/images/icons/earnings.svg'
      },
      {
        title: 'Weekly Payouts',
        description: 'Get paid weekly with instant payout options',
        icon: '/images/icons/payout.svg'
      },
      {
        title: 'Insurance Coverage',
        description: 'Comprehensive insurance coverage while driving',
        icon: '/images/icons/insurance.svg'
      },
      {
        title: 'Driver Support',
        description: '24/7 driver support and assistance',
        icon: '/images/icons/support.svg'
      },
      {
        title: 'Growth Opportunities',
        description: 'Advance to premium delivery tiers',
        icon: '/images/icons/growth.svg'
      }
    ],

    howItWorks: [
      {
        step: 1,
        title: 'Sign Up',
        description: 'Complete your driver application with required documents'
      },
      {
        step: 2,
        title: 'Get Approved',
        description: 'We review your application and conduct background checks'
      },
      {
        step: 3,
        title: 'Start Driving',
        description: 'Go online and start accepting delivery requests'
      },
      {
        step: 4,
        title: 'Get Paid',
        description: 'Earn money for each completed delivery'
      }
    ],

    requirements: {
      age: 'Must be 21 years or older',
      license: 'Valid driver\'s license',
      vehicle: 'Reliable vehicle with insurance',
      phone: 'Smartphone with data plan',
      background: 'Clean driving and criminal record'
    },

    documents: [
      'Driver\'s License',
      'Vehicle Registration',
      'Insurance Certificate',
      'Bank Account Information',
      'Profile Photo',
      'Vehicle Photos'
    ],

    earnings: {
      baseRate: '$2.50 per delivery',
      perMile: '$1.25 per mile',
      peakBonus: 'Up to 2x during peak hours',
      tips: '100% of customer tips',
      bonuses: 'Weekly and monthly bonuses available'
    },

    faqs: [
      {
        question: 'How much can I earn as a SendMe driver?',
        answer: 'Earnings vary based on location, time, and demand. Most drivers earn $15-25 per hour.'
      },
      {
        question: 'When do I get paid?',
        answer: 'Payments are processed weekly every Tuesday. Instant payout is available for a small fee.'
      },
      {
        question: 'What vehicles are accepted?',
        answer: 'We accept cars, motorcycles, bicycles, and small trucks depending on your city.'
      },
      {
        question: 'Do I need commercial insurance?',
        answer: 'No, your personal auto insurance is sufficient. We provide additional coverage during deliveries.'
      },
      {
        question: 'Can I work in multiple cities?',
        answer: 'Yes, you can deliver in any city where SendMe operates.'
      },
      {
        question: 'How long does the approval process take?',
        answer: 'Most applications are reviewed within 2-3 business days.'
      }
    ]
  };

  logger.info('Driver info requested', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(200).json({
    success: true,
    data: driverInfo
  });
});

/**
 * Get vehicle types and pricing
 * @route GET /api/public/vehicle-types
 * @access Public
 */
const getVehicleTypes = catchAsync(async (req, res, next) => {
  const { city, state, country } = req.query;

  let query = {
    status: 'active',
    'availability.isActive': true
  };

  // Filter by service area if location provided
  if (city && state) {
    query['availability.serviceAreas'] = {
      $elemMatch: {
        city: new RegExp(city, 'i'),
        state: new RegExp(state, 'i'),
        country: country || process.env.DEFAULT_COUNTRY || 'US'
      }
    };
  }

  const vehicleTypes = await VehicleType.find(query)
    .select('name displayName description images pricing features specifications restrictions')
    .sort({ sortOrder: 1, isPopular: -1, createdAt: -1 });

  res.status(200).json({
    success: true,
    data: {
      vehicleTypes,
      count: vehicleTypes.length
    }
  });
});

/**
 * Get service areas
 * @route GET /api/public/service-areas
 * @access Public
 */
const getServiceAreas = catchAsync(async (req, res, next) => {
  const vehicleTypes = await VehicleType.find({
    status: 'active',
    'availability.isActive': true
  }).select('availability.serviceAreas');

  // Extract unique service areas
  const serviceAreas = [];
  const uniqueAreas = new Set();

  vehicleTypes.forEach(vehicle => {
    vehicle.availability.serviceAreas.forEach(area => {
      const areaKey = `${area.city}-${area.state}-${area.country}`;
      if (!uniqueAreas.has(areaKey)) {
        uniqueAreas.add(areaKey);
        serviceAreas.push({
          city: area.city,
          state: area.state,
          country: area.country,
          coordinates: area.coordinates
        });
      }
    });
  });

  res.status(200).json({
    success: true,
    data: {
      serviceAreas,
      count: serviceAreas.length
    }
  });
});

/**
 * Get FAQ data
 * @route GET /api/public/faqs
 * @access Public
 */
const getFAQs = catchAsync(async (req, res, next) => {
  const { category } = req.query;

  const faqs = {
    general: [
      {
        question: 'What is SendMe Logistics?',
        answer: 'SendMe is an on-demand logistics platform that connects customers with professional drivers for fast, reliable delivery services.'
      },
      {
        question: 'How does SendMe work?',
        answer: 'Simply create a booking, choose your vehicle type, add pickup and delivery details, and track your package in real-time.'
      },
      {
        question: 'What areas do you serve?',
        answer: 'We currently operate in 50+ cities across the United States. Check our service areas page for availability in your location.'
      },
      {
        question: 'How much does delivery cost?',
        answer: 'Pricing varies based on distance, vehicle type, and demand. You\'ll see the exact price before confirming your booking.'
      },
      {
        question: 'How can I track my delivery?',
        answer: 'You can track your delivery in real-time through our mobile app or website using your booking ID.'
      }
    ],
    
    customer: [
      {
        question: 'How do I create an account?',
        answer: 'You can sign up using your email, phone number, or social media accounts. Verification is required for security.'
      },
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept credit/debit cards, digital wallets, UPI, and cash payments depending on your location.'
      },
      {
        question: 'Can I schedule a delivery for later?',
        answer: 'Yes, you can schedule deliveries up to 7 days in advance during our operating hours.'
      },
      {
        question: 'What if my package is damaged or lost?',
        answer: 'We provide insurance coverage for all deliveries. Contact our support team to file a claim.'
      },
      {
        question: 'Can I cancel my booking?',
        answer: 'Yes, you can cancel your booking before the driver picks up your package. Cancellation fees may apply.'
      }
    ],

    driver: [
      {
        question: 'How do I become a SendMe driver?',
        answer: 'Complete our online application, submit required documents, pass background checks, and start earning.'
      },
      {
        question: 'What are the driver requirements?',
        answer: 'You must be 21+, have a valid license, reliable vehicle, smartphone, and clean driving record.'
      },
      {
        question: 'How much can I earn?',
        answer: 'Earnings vary by location and time. Most drivers earn $15-25 per hour including tips and bonuses.'
      },
      {
        question: 'When do I get paid?',
        answer: 'Weekly payments every Tuesday. Instant payout available for a small fee.'
      },
      {
        question: 'Do I need special insurance?',
        answer: 'Your personal auto insurance is sufficient. We provide additional coverage during active deliveries.'
      }
    ]
  };

  const responseData = category && faqs[category] ? faqs[category] : faqs;

  res.status(200).json({
    success: true,
    data: {
      faqs: responseData,
      categories: Object.keys(faqs)
    }
  });
});

/**
 * Contact support
 * @route POST /api/public/contact
 * @access Public
 */
const contactSupport = catchAsync(async (req, res, next) => {
  const { name, email, phone, subject, message, category } = req.body;

  // Here you would typically save the contact request to database
  // and send notification to support team

  logger.info('Contact form submitted', {
    name,
    email: email?.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
    phone: phone?.replace(/\d(?=\d{4})/g, '*'),
    subject,
    category,
    ip: req.ip
  });

  res.status(200).json({
    success: true,
    message: 'Your message has been sent successfully. Our support team will contact you within 24 hours.',
    data: {
      ticketId: `TICKET-${Date.now()}`,
      estimatedResponse: '24 hours'
    }
  });
});

module.exports = {
  getHomeData,
  getDriverInfo,
  getVehicleTypes,
  getServiceAreas,
  getFAQs,
  contactSupport
};
