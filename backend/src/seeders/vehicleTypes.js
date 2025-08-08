/**
 * Vehicle Types Seeder
 * Populate database with default vehicle types
 */

const VehicleType = require('../models/Vehicle');
const logger = require('../utils/logger');

const vehicleTypesData = [
  {
    name: 'motorcycle',
    displayName: 'Motorcycle',
    description: 'Fast delivery for small packages and documents',
    specifications: {
      maxWeight: 5,
      maxDimensions: {
        length: 40,
        width: 30,
        height: 20
      },
      loadCapacity: 'Small packages up to 5kg',
      fuelType: 'petrol'
    },
    pricing: {
      baseFare: 3.00,
      perKmRate: 0.50,
      perMinuteRate: 0.10,
      waitingChargePerMinute: 0.25,
      minimumFare: 5.00,
      cancellationFee: 2.00,
      currency: 'USD'
    },
    peakHourPricing: {
      enabled: true,
      multiplier: 1.5,
      timeSlots: [
        {
          startTime: '07:00',
          endTime: '10:00',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        },
        {
          startTime: '17:00',
          endTime: '20:00',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        }
      ]
    },
    images: {
      icon: '/images/vehicles/motorcycle-icon.svg',
      thumbnail: '/images/vehicles/motorcycle-thumb.jpg',
      gallery: ['/images/vehicles/motorcycle-1.jpg', '/images/vehicles/motorcycle-2.jpg']
    },
    availability: {
      isActive: true,
      serviceAreas: [
        {
          city: 'New York',
          state: 'NY',
          country: 'US',
          coordinates: {
            center: {
              latitude: 40.7128,
              longitude: -74.0060
            },
            radius: 50
          }
        },
        {
          city: 'Los Angeles',
          state: 'CA',
          country: 'US',
          coordinates: {
            center: {
              latitude: 34.0522,
              longitude: -118.2437
            },
            radius: 50
          }
        }
      ]
    },
    features: [
      {
        name: 'Express Delivery',
        description: 'Fast delivery within 30 minutes',
        icon: '/images/icons/express.svg',
        isHighlight: true
      },
      {
        name: 'Real-time Tracking',
        description: 'Track your package in real-time',
        icon: '/images/icons/tracking.svg',
        isHighlight: true
      }
    ],
    restrictions: {
      minDistance: 0.5,
      maxDistance: 25,
      prohibitedItems: ['fragile items', 'liquids', 'oversized packages'],
      specialRequirements: ['Valid motorcycle license'],
      ageRestriction: 21,
      licenseRequirements: ['Motorcycle license', 'Commercial insurance']
    },
    commission: {
      platformPercentage: 20,
      driverPercentage: 80
    },
    sortOrder: 1,
    isPopular: true,
    isFeatured: true,
    status: 'active'
  },
  {
    name: 'car',
    displayName: 'Car',
    description: 'Reliable delivery for medium-sized packages',
    specifications: {
      maxWeight: 25,
      maxDimensions: {
        length: 100,
        width: 60,
        height: 40
      },
      loadCapacity: 'Medium packages up to 25kg',
      fuelType: 'petrol'
    },
    pricing: {
      baseFare: 5.00,
      perKmRate: 1.00,
      perMinuteRate: 0.15,
      waitingChargePerMinute: 0.30,
      minimumFare: 8.00,
      cancellationFee: 3.00,
      currency: 'USD'
    },
    peakHourPricing: {
      enabled: true,
      multiplier: 1.3,
      timeSlots: [
        {
          startTime: '07:00',
          endTime: '10:00',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        },
        {
          startTime: '17:00',
          endTime: '20:00',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        }
      ]
    },
    images: {
      icon: '/images/vehicles/car-icon.svg',
      thumbnail: '/images/vehicles/car-thumb.jpg',
      gallery: ['/images/vehicles/car-1.jpg', '/images/vehicles/car-2.jpg']
    },
    availability: {
      isActive: true,
      serviceAreas: [
        {
          city: 'New York',
          state: 'NY',
          country: 'US',
          coordinates: {
            center: {
              latitude: 40.7128,
              longitude: -74.0060
            },
            radius: 75
          }
        },
        {
          city: 'Los Angeles',
          state: 'CA',
          country: 'US',
          coordinates: {
            center: {
              latitude: 34.0522,
              longitude: -118.2437
            },
            radius: 75
          }
        }
      ]
    },
    features: [
      {
        name: 'Climate Controlled',
        description: 'Temperature controlled environment',
        icon: '/images/icons/climate.svg',
        isHighlight: true
      },
      {
        name: 'Secure Storage',
        description: 'Locked trunk for secure transport',
        icon: '/images/icons/secure.svg',
        isHighlight: false
      }
    ],
    restrictions: {
      minDistance: 1,
      maxDistance: 100,
      prohibitedItems: ['hazardous materials', 'live animals'],
      specialRequirements: ['Valid driver license'],
      ageRestriction: 21,
      licenseRequirements: ['Driver license', 'Commercial insurance']
    },
    commission: {
      platformPercentage: 18,
      driverPercentage: 82
    },
    sortOrder: 2,
    isPopular: true,
    isFeatured: true,
    status: 'active'
  },
  {
    name: 'van',
    displayName: 'Van',
    description: 'Perfect for large packages and furniture delivery',
    specifications: {
      maxWeight: 500,
      maxDimensions: {
        length: 200,
        width: 150,
        height: 150
      },
      loadCapacity: 'Large packages up to 500kg',
      fuelType: 'diesel'
    },
    pricing: {
      baseFare: 15.00,
      perKmRate: 2.50,
      perMinuteRate: 0.25,
      waitingChargePerMinute: 0.50,
      minimumFare: 25.00,
      cancellationFee: 10.00,
      currency: 'USD'
    },
    peakHourPricing: {
      enabled: true,
      multiplier: 1.4,
      timeSlots: [
        {
          startTime: '08:00',
          endTime: '18:00',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        }
      ]
    },
    images: {
      icon: '/images/vehicles/van-icon.svg',
      thumbnail: '/images/vehicles/van-thumb.jpg',
      gallery: ['/images/vehicles/van-1.jpg', '/images/vehicles/van-2.jpg']
    },
    availability: {
      isActive: true,
      serviceAreas: [
        {
          city: 'New York',
          state: 'NY',
          country: 'US',
          coordinates: {
            center: {
              latitude: 40.7128,
              longitude: -74.0060
            },
            radius: 100
          }
        }
      ]
    },
    features: [
      {
        name: 'Large Capacity',
        description: 'Spacious cargo area for big items',
        icon: '/images/icons/capacity.svg',
        isHighlight: true
      },
      {
        name: 'Loading Assistance',
        description: 'Driver helps with loading/unloading',
        icon: '/images/icons/assistance.svg',
        isHighlight: true
      }
    ],
    restrictions: {
      minDistance: 2,
      maxDistance: 200,
      prohibitedItems: ['hazardous materials', 'perishable food'],
      specialRequirements: ['Commercial driver license'],
      ageRestriction: 25,
      licenseRequirements: ['CDL license', 'Commercial insurance']
    },
    commission: {
      platformPercentage: 15,
      driverPercentage: 85
    },
    sortOrder: 3,
    isPopular: false,
    isFeatured: true,
    status: 'active'
  },
  {
    name: 'truck',
    displayName: 'Truck',
    description: 'Heavy-duty delivery for large shipments and moving',
    specifications: {
      maxWeight: 2000,
      maxDimensions: {
        length: 400,
        width: 200,
        height: 200
      },
      loadCapacity: 'Heavy packages up to 2000kg',
      fuelType: 'diesel'
    },
    pricing: {
      baseFare: 30.00,
      perKmRate: 4.00,
      perMinuteRate: 0.50,
      waitingChargePerMinute: 1.00,
      minimumFare: 50.00,
      cancellationFee: 20.00,
      currency: 'USD'
    },
    peakHourPricing: {
      enabled: false,
      multiplier: 1.0,
      timeSlots: []
    },
    images: {
      icon: '/images/vehicles/truck-icon.svg',
      thumbnail: '/images/vehicles/truck-thumb.jpg',
      gallery: ['/images/vehicles/truck-1.jpg', '/images/vehicles/truck-2.jpg']
    },
    availability: {
      isActive: true,
      serviceAreas: [
        {
          city: 'New York',
          state: 'NY',
          country: 'US',
          coordinates: {
            center: {
              latitude: 40.7128,
              longitude: -74.0060
            },
            radius: 150
          }
        }
      ],
      operatingHours: {
        enabled: true,
        schedule: [
          {
            day: 'monday',
            startTime: '06:00',
            endTime: '20:00',
            isAvailable: true
          },
          {
            day: 'tuesday',
            startTime: '06:00',
            endTime: '20:00',
            isAvailable: true
          },
          {
            day: 'wednesday',
            startTime: '06:00',
            endTime: '20:00',
            isAvailable: true
          },
          {
            day: 'thursday',
            startTime: '06:00',
            endTime: '20:00',
            isAvailable: true
          },
          {
            day: 'friday',
            startTime: '06:00',
            endTime: '20:00',
            isAvailable: true
          },
          {
            day: 'saturday',
            startTime: '08:00',
            endTime: '18:00',
            isAvailable: true
          },
          {
            day: 'sunday',
            startTime: '10:00',
            endTime: '16:00',
            isAvailable: false
          }
        ]
      }
    },
    features: [
      {
        name: 'Heavy Duty',
        description: 'Designed for heavy and bulky items',
        icon: '/images/icons/heavy-duty.svg',
        isHighlight: true
      },
      {
        name: 'Professional Crew',
        description: 'Experienced team for complex deliveries',
        icon: '/images/icons/crew.svg',
        isHighlight: true
      }
    ],
    restrictions: {
      minDistance: 5,
      maxDistance: 500,
      prohibitedItems: ['hazardous materials', 'live animals', 'perishable food'],
      specialRequirements: ['Commercial driver license', 'Moving experience'],
      ageRestriction: 25,
      licenseRequirements: ['CDL license', 'Commercial insurance', 'DOT certification']
    },
    commission: {
      platformPercentage: 12,
      driverPercentage: 88
    },
    sortOrder: 4,
    isPopular: false,
    isFeatured: false,
    status: 'active'
  }
];

/**
 * Seed vehicle types
 */
const seedVehicleTypes = async () => {
  try {
    // Clear existing vehicle types
    await VehicleType.deleteMany({});
    logger.info('Cleared existing vehicle types');

    // Insert new vehicle types
    const vehicleTypes = await VehicleType.insertMany(vehicleTypesData);
    logger.info(`Seeded ${vehicleTypes.length} vehicle types`);

    return vehicleTypes;
  } catch (error) {
    logger.error('Error seeding vehicle types:', error);
    throw error;
  }
};

module.exports = {
  seedVehicleTypes,
  vehicleTypesData
};
