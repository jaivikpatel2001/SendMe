/**
 * Pricing Utility
 * Handle fare calculations and pricing logic
 */

const VehicleType = require('../models/Vehicle');
const PromoCode = require('../models/PromoCode');
const logger = require('./logger');

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calculate estimated duration based on distance and traffic
 * @param {number} distance - Distance in kilometers
 * @param {string} timeOfDay - Time of day (morning, afternoon, evening, night)
 * @returns {number} Duration in minutes
 */
const calculateDuration = (distance, timeOfDay = 'afternoon') => {
  // Average speeds based on time of day (km/h)
  const averageSpeeds = {
    morning: 25,    // Rush hour
    afternoon: 35,  // Normal traffic
    evening: 20,    // Heavy traffic
    night: 45       // Light traffic
  };

  const speed = averageSpeeds[timeOfDay] || 35;
  const durationHours = distance / speed;
  const durationMinutes = durationHours * 60;
  
  // Add buffer time for pickup and delivery
  const bufferTime = 10; // 10 minutes buffer
  
  return Math.round(durationMinutes + bufferTime);
};

/**
 * Determine time of day category
 * @param {Date} date - Date object
 * @returns {string} Time category
 */
const { getUTCHour, getUTCDay } = require('./time');

const getTimeOfDay = (date = new Date()) => {
  const hour = getUTCHour(date);

  if (hour >= 6 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
};

/**
 * Check if current time is peak hour
 * @param {Date} date - Date object
 * @returns {boolean} Is peak hour
 */
const isPeakHour = (date = new Date()) => {
  const hour = getUTCHour(date);
  const day = getUTCDay(date); // 0 = Sunday, 6 = Saturday

  // Weekday peak hours: 7-10 AM and 5-8 PM (UTC)
  if (day >= 1 && day <= 5) {
    return (hour >= 7 && hour < 10) || (hour >= 17 && hour < 20);
  }

  // Weekend peak hours: 11 AM - 2 PM and 6-9 PM (UTC)
  return (hour >= 11 && hour < 14) || (hour >= 18 && hour < 21);
};

/**
 * Calculate base fare for a booking
 * @param {Object} params - Calculation parameters
 * @returns {Object} Pricing breakdown
 */
const calculateBaseFare = async (params) => {
  const {
    vehicleTypeId,
    pickupCoordinates,
    dropCoordinates,
    scheduledFor = new Date(),
    serviceType = 'delivery',
    additionalStops = []
  } = params;

  // Get vehicle type
  const vehicleType = await VehicleType.findById(vehicleTypeId);
  if (!vehicleType || vehicleType.status !== 'active') {
    throw new Error('Invalid or inactive vehicle type');
  }

  // Calculate total distance
  let totalDistance = calculateDistance(
    pickupCoordinates.latitude,
    pickupCoordinates.longitude,
    dropCoordinates.latitude,
    dropCoordinates.longitude
  );

  // Add distance for additional stops
  let previousCoords = pickupCoordinates;
  for (const stop of additionalStops) {
    totalDistance += calculateDistance(
      previousCoords.latitude,
      previousCoords.longitude,
      stop.coordinates.latitude,
      stop.coordinates.longitude
    );
    previousCoords = stop.coordinates;
  }

  // Add final leg to drop location if there are additional stops
  if (additionalStops.length > 0) {
    const lastStop = additionalStops[additionalStops.length - 1];
    totalDistance += calculateDistance(
      lastStop.coordinates.latitude,
      lastStop.coordinates.longitude,
      dropCoordinates.latitude,
      dropCoordinates.longitude
    );
  }

  // Check distance restrictions
  if (totalDistance < vehicleType.restrictions.minDistance) {
    throw new Error(`Minimum distance is ${vehicleType.restrictions.minDistance} km`);
  }
  if (totalDistance > vehicleType.restrictions.maxDistance) {
    throw new Error(`Maximum distance is ${vehicleType.restrictions.maxDistance} km`);
  }

  // Calculate duration
  const timeOfDay = getTimeOfDay(scheduledFor);
  const estimatedDuration = calculateDuration(totalDistance, timeOfDay);

  // Base pricing calculation
  let baseFare = vehicleType.pricing.baseFare;
  let distanceFare = totalDistance * vehicleType.pricing.perKmRate;
  let timeFare = 0;

  // Add time-based fare if applicable
  if (vehicleType.pricing.perMinuteRate > 0) {
    timeFare = estimatedDuration * vehicleType.pricing.perMinuteRate;
  }

  // Service type multipliers
  const serviceMultipliers = {
    delivery: 1.0,
    pickup: 1.0,
    moving: 1.2,
    express: 1.5,
    scheduled: 0.9
  };

  const serviceMultiplier = serviceMultipliers[serviceType] || 1.0;

  // Calculate subtotal
  let subtotal = (baseFare + distanceFare + timeFare) * serviceMultiplier;

  // Apply peak hour multiplier
  let peakHourMultiplier = 1.0;
  if (vehicleType.peakHourPricing.enabled && isPeakHour(scheduledFor)) {
    peakHourMultiplier = vehicleType.peakHourPricing.multiplier;
    subtotal *= peakHourMultiplier;
  }

  // Additional charges for extra stops
  const additionalStopCharge = additionalStops.length * 2.00; // £2.00 per additional stop

  // Ensure minimum fare
  subtotal = Math.max(subtotal + additionalStopCharge, vehicleType.pricing.minimumFare);

  return {
    baseFare,
    distanceFare,
    timeFare,
    serviceMultiplier,
    peakHourMultiplier,
    additionalStopCharge,
    subtotal,
    distance: {
      total: totalDistance,
      unit: 'km'
    },
    duration: {
      estimated: estimatedDuration,
      unit: 'minutes'
    },
    currency: vehicleType.pricing.currency,
    breakdown: {
      baseFare: baseFare,
      distanceCharge: distanceFare,
      timeCharge: timeFare,
      serviceCharge: subtotal - (baseFare + distanceFare + timeFare),
      additionalStops: additionalStopCharge
    }
  };
};

/**
 * Apply promo code discount
 * @param {Object} pricing - Base pricing object
 * @param {string} promoCode - Promo code
 * @param {string} userId - User ID
 * @returns {Object} Updated pricing with discount
 */
const applyPromoCode = async (pricing, promoCode, userId) => {
  if (!promoCode) {
    return pricing;
  }

  const promo = await PromoCode.findOne({ 
    code: promoCode.toUpperCase(),
    status: 'active'
  });

  if (!promo) {
    throw new Error('Invalid promo code');
  }

  // Check if user can use this promo code
  const canUseResult = await promo.canUserUse(userId, pricing.subtotal);
  if (!canUseResult.canUse) {
    throw new Error(canUseResult.reason);
  }

  // Calculate discount
  const discountAmount = promo.calculateDiscount(pricing.subtotal);

  return {
    ...pricing,
    discount: {
      code: promo.code,
      type: promo.discountType,
      value: promo.discountValue,
      amount: discountAmount,
      description: promo.description
    },
    subtotalAfterDiscount: pricing.subtotal - discountAmount
  };
};

/**
 * Calculate taxes
 * @param {Object} pricing - Pricing object
 * @param {Object} location - Location for tax calculation
 * @returns {Object} Updated pricing with taxes
 */
const calculateTaxes = (pricing, location = {}) => {
  // Tax rates by state/region (mock data)
  const taxRates = {
    'CA': 0.0875, // California
    'NY': 0.08,   // New York
    'TX': 0.0625, // Texas
    'FL': 0.06,   // Florida
    'default': 0.08
  };

  const taxRate = taxRates[location.state] || taxRates.default;
  const taxableAmount = pricing.subtotalAfterDiscount || pricing.subtotal;
  const taxAmount = taxableAmount * taxRate;

  return {
    ...pricing,
    tax: {
      rate: taxRate,
      amount: taxAmount,
      description: `${(taxRate * 100).toFixed(2)}% Sales Tax`
    },
    total: taxableAmount + taxAmount
  };
};

/**
 * Calculate final pricing for a booking
 * @param {Object} params - All pricing parameters
 * @returns {Object} Complete pricing breakdown
 */
const calculateFinalPricing = async (params) => {
  try {
    // Calculate base fare
    let pricing = await calculateBaseFare(params);

    // Apply promo code if provided
    if (params.promoCode && params.userId) {
      pricing = await applyPromoCode(pricing, params.promoCode, params.userId);
    }

    // Calculate taxes
    pricing = calculateTaxes(pricing, params.location);

    // Add platform fee (if applicable)
    const platformFeeRate = 0.02; // 2% platform fee
    const platformFee = pricing.subtotal * platformFeeRate;
    pricing.platformFee = {
      rate: platformFeeRate,
      amount: platformFee
    };
    pricing.total += platformFee;

    // Round to 2 decimal places
    Object.keys(pricing).forEach(key => {
      if (typeof pricing[key] === 'number') {
        pricing[key] = Math.round(pricing[key] * 100) / 100;
      }
    });

    if (pricing.breakdown) {
      Object.keys(pricing.breakdown).forEach(key => {
        pricing.breakdown[key] = Math.round(pricing.breakdown[key] * 100) / 100;
      });
    }

    logger.info('Pricing calculated', {
      vehicleType: params.vehicleTypeId,
      distance: pricing.distance.total,
      subtotal: pricing.subtotal,
      total: pricing.total,
      promoApplied: !!pricing.discount
    });

    return pricing;

  } catch (error) {
    logger.error('Pricing calculation failed:', {
      error: error.message,
      params
    });
    throw error;
  }
};

/**
 * Get pricing estimate without creating booking
 * @param {Object} params - Estimation parameters
 * @returns {Object} Pricing estimate
 */
const getPricingEstimate = async (params) => {
  const pricing = await calculateFinalPricing(params);
  
  return {
    estimate: pricing,
    disclaimer: 'Final price may vary based on actual distance, time, and surge pricing.',
    validFor: '15 minutes'
  };
};

/**
 * Calculate driver earnings from booking
 * @param {Object} booking - Booking object
 * @param {Object} vehicleType - Vehicle type object
 * @returns {Object} Driver earnings breakdown
 */
const calculateDriverEarnings = (booking, vehicleType) => {
  const totalFare = booking.pricing.total;
  const platformCommission = totalFare * (vehicleType.commission.platformPercentage / 100);
  const driverEarnings = totalFare - platformCommission;

  return {
    totalFare,
    platformCommission: {
      percentage: vehicleType.commission.platformPercentage,
      amount: platformCommission
    },
    driverEarnings: {
      percentage: vehicleType.commission.driverPercentage,
      amount: driverEarnings
    },
    tips: booking.tips || 0,
    totalDriverEarnings: driverEarnings + (booking.tips || 0)
  };
};

module.exports = {
  calculateDistance,
  calculateDuration,
  getTimeOfDay,
  isPeakHour,
  calculateBaseFare,
  applyPromoCode,
  calculateTaxes,
  calculateFinalPricing,
  getPricingEstimate,
  calculateDriverEarnings
};
