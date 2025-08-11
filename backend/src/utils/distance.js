/**
 * Distance and Location Utility
 * Handle distance calculations, geocoding, and route optimization
 */

const axios = require('axios');
const logger = require('./logger');
const { AppError } = require('../middleware/errorHandler');

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
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
 * Get distance and duration using Google Maps API
 * @param {Object} origin - Origin coordinates {lat, lng}
 * @param {Object} destination - Destination coordinates {lat, lng}
 * @param {Array} waypoints - Optional waypoints
 * @returns {Promise<Object>} Distance and duration data
 */
const getGoogleMapsDistance = async (origin, destination, waypoints = []) => {
  try {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      throw new Error('Google Maps API key not configured');
    }

    const baseUrl = 'https://maps.googleapis.com/maps/api/distancematrix/json';
    const params = {
      origins: `${origin.lat},${origin.lng}`,
      destinations: `${destination.lat},${destination.lng}`,
      key: process.env.GOOGLE_MAPS_API_KEY,
      units: 'metric',
      mode: 'driving',
      traffic_model: 'best_guess',
      departure_time: 'now'
    };

    const response = await axios.get(baseUrl, { params });

    if (response.data.status !== 'OK') {
      throw new Error(`Google Maps API error: ${response.data.status}`);
    }

    const element = response.data.rows[0].elements[0];
    
    if (element.status !== 'OK') {
      throw new Error(`Route calculation failed: ${element.status}`);
    }

    return {
      distance: {
        value: element.distance.value, // in meters
        text: element.distance.text,
        km: element.distance.value / 1000
      },
      duration: {
        value: element.duration.value, // in seconds
        text: element.duration.text,
        minutes: Math.round(element.duration.value / 60)
      },
      durationInTraffic: element.duration_in_traffic ? {
        value: element.duration_in_traffic.value,
        text: element.duration_in_traffic.text,
        minutes: Math.round(element.duration_in_traffic.value / 60)
      } : null
    };

  } catch (error) {
    logger.error('Google Maps distance calculation failed:', {
      error: error.message,
      origin,
      destination
    });

    // Fallback to Haversine calculation
    const distance = calculateHaversineDistance(
      origin.lat, origin.lng,
      destination.lat, destination.lng
    );

    return {
      distance: {
        value: distance * 1000,
        text: `${distance.toFixed(1)} km`,
        km: distance
      },
      duration: {
        value: (distance / 30) * 3600, // Assume 30 km/h average speed
        text: `${Math.round(distance / 30 * 60)} mins`,
        minutes: Math.round(distance / 30 * 60)
      },
      fallback: true
    };
  }
};

/**
 * Get route information with turn-by-turn directions
 * @param {Object} origin - Origin coordinates
 * @param {Object} destination - Destination coordinates
 * @param {Array} waypoints - Optional waypoints
 * @returns {Promise<Object>} Route information
 */
const getRoute = async (origin, destination, waypoints = []) => {
  try {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      throw new Error('Google Maps API key not configured');
    }

    const baseUrl = 'https://maps.googleapis.com/maps/api/directions/json';
    let waypointsParam = '';
    
    if (waypoints.length > 0) {
      waypointsParam = waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|');
    }

    const params = {
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      key: process.env.GOOGLE_MAPS_API_KEY,
      mode: 'driving',
      traffic_model: 'best_guess',
      departure_time: 'now'
    };

    if (waypointsParam) {
      params.waypoints = waypointsParam;
    }

    const response = await axios.get(baseUrl, { params });

    if (response.data.status !== 'OK') {
      throw new Error(`Google Directions API error: ${response.data.status}`);
    }

    const route = response.data.routes[0];
    const leg = route.legs[0];

    return {
      distance: {
        value: leg.distance.value,
        text: leg.distance.text,
        km: leg.distance.value / 1000
      },
      duration: {
        value: leg.duration.value,
        text: leg.duration.text,
        minutes: Math.round(leg.duration.value / 60)
      },
      durationInTraffic: leg.duration_in_traffic ? {
        value: leg.duration_in_traffic.value,
        text: leg.duration_in_traffic.text,
        minutes: Math.round(leg.duration_in_traffic.value / 60)
      } : null,
      polyline: route.overview_polyline.points,
      bounds: route.bounds,
      steps: leg.steps.map(step => ({
        distance: step.distance,
        duration: step.duration,
        instructions: step.html_instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
        maneuver: step.maneuver,
        startLocation: step.start_location,
        endLocation: step.end_location
      }))
    };

  } catch (error) {
    logger.error('Route calculation failed:', {
      error: error.message,
      origin,
      destination
    });
    throw new AppError('Failed to calculate route', 500);
  }
};

/**
 * Geocode an address to coordinates
 * @param {string} address - Address to geocode
 * @returns {Promise<Object>} Geocoding result
 */
const geocodeAddress = async (address) => {
  try {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      throw new Error('Google Maps API key not configured');
    }

    const baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    const params = {
      address,
      key: process.env.GOOGLE_MAPS_API_KEY
    };

    const response = await axios.get(baseUrl, { params });

    if (response.data.status !== 'OK') {
      throw new Error(`Geocoding failed: ${response.data.status}`);
    }

    const result = response.data.results[0];
    
    return {
      coordinates: {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng
      },
      formattedAddress: result.formatted_address,
      addressComponents: result.address_components,
      placeId: result.place_id,
      types: result.types
    };

  } catch (error) {
    logger.error('Geocoding failed:', {
      error: error.message,
      address
    });
    throw new AppError('Failed to geocode address', 400);
  }
};

/**
 * Reverse geocode coordinates to address
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} Reverse geocoding result
 */
const reverseGeocode = async (lat, lng) => {
  try {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      throw new Error('Google Maps API key not configured');
    }

    const baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    const params = {
      latlng: `${lat},${lng}`,
      key: process.env.GOOGLE_MAPS_API_KEY
    };

    const response = await axios.get(baseUrl, { params });

    if (response.data.status !== 'OK') {
      throw new Error(`Reverse geocoding failed: ${response.data.status}`);
    }

    const result = response.data.results[0];
    
    return {
      formattedAddress: result.formatted_address,
      addressComponents: result.address_components,
      placeId: result.place_id,
      types: result.types
    };

  } catch (error) {
    logger.error('Reverse geocoding failed:', {
      error: error.message,
      lat,
      lng
    });
    throw new AppError('Failed to reverse geocode coordinates', 400);
  }
};

/**
 * Find nearby drivers within radius
 * @param {Object} location - Center location {lat, lng}
 * @param {number} radiusKm - Search radius in kilometers
 * @returns {Promise<Array>} Array of nearby drivers
 */
const findNearbyDrivers = async (location, radiusKm = 10) => {
  try {
    const User = require('../models/User');
    
    // Convert radius to meters for MongoDB
    const radiusMeters = radiusKm * 1000;

    const nearbyDrivers = await User.find({
      role: 'driver',
      status: 'active',
      'driverInfo.isOnline': true,
      'driverInfo.currentLocation': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [location.lng, location.lat]
          },
          $maxDistance: radiusMeters
        }
      }
    })
    .select('firstName lastName driverInfo.currentLocation driverInfo.rating driverInfo.vehicleType')
    .limit(20);

    // Calculate distance for each driver
    const driversWithDistance = nearbyDrivers.map(driver => {
      const driverLocation = driver.driverInfo.currentLocation;
      const distance = calculateHaversineDistance(
        location.lat, location.lng,
        driverLocation.latitude, driverLocation.longitude
      );

      return {
        ...driver.toObject(),
        distanceKm: Math.round(distance * 100) / 100,
        estimatedArrival: Math.round(distance / 30 * 60) // Assume 30 km/h average speed
      };
    });

    // Sort by distance
    driversWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

    return driversWithDistance;

  } catch (error) {
    logger.error('Finding nearby drivers failed:', {
      error: error.message,
      location,
      radiusKm
    });
    throw new AppError('Failed to find nearby drivers', 500);
  }
};

/**
 * Optimize route for multiple stops
 * @param {Object} origin - Starting point
 * @param {Object} destination - End point
 * @param {Array} waypoints - Intermediate stops
 * @returns {Promise<Object>} Optimized route
 */
const optimizeRoute = async (origin, destination, waypoints = []) => {
  try {
    if (waypoints.length === 0) {
      return await getRoute(origin, destination);
    }

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      throw new Error('Google Maps API key not configured');
    }

    const baseUrl = 'https://maps.googleapis.com/maps/api/directions/json';
    const waypointsParam = waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|');

    const params = {
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      waypoints: `optimize:true|${waypointsParam}`,
      key: process.env.GOOGLE_MAPS_API_KEY,
      mode: 'driving'
    };

    const response = await axios.get(baseUrl, { params });

    if (response.data.status !== 'OK') {
      throw new Error(`Route optimization failed: ${response.data.status}`);
    }

    const route = response.data.routes[0];
    
    // Calculate total distance and duration
    let totalDistance = 0;
    let totalDuration = 0;
    
    route.legs.forEach(leg => {
      totalDistance += leg.distance.value;
      totalDuration += leg.duration.value;
    });

    return {
      distance: {
        value: totalDistance,
        text: `${(totalDistance / 1000).toFixed(1)} km`,
        km: totalDistance / 1000
      },
      duration: {
        value: totalDuration,
        text: `${Math.round(totalDuration / 60)} mins`,
        minutes: Math.round(totalDuration / 60)
      },
      polyline: route.overview_polyline.points,
      optimizedOrder: route.waypoint_order,
      legs: route.legs.map(leg => ({
        distance: leg.distance,
        duration: leg.duration,
        startAddress: leg.start_address,
        endAddress: leg.end_address
      }))
    };

  } catch (error) {
    logger.error('Route optimization failed:', {
      error: error.message,
      origin,
      destination,
      waypoints: waypoints.length
    });
    throw new AppError('Failed to optimize route', 500);
  }
};

/**
 * Validate coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} Are coordinates valid
 */
const validateCoordinates = (lat, lng) => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
};

/**
 * Get estimated arrival time
 * @param {Object} driverLocation - Driver's current location
 * @param {Object} pickupLocation - Pickup location
 * @returns {Promise<Object>} ETA information
 */
const getEstimatedArrival = async (driverLocation, pickupLocation) => {
  try {
    const routeInfo = await getGoogleMapsDistance(driverLocation, pickupLocation);
    const arrivalTime = new Date(Date.now() + routeInfo.duration.value * 1000);

    return {
      distance: routeInfo.distance,
      duration: routeInfo.duration,
      arrivalTime,
      formattedArrival: arrivalTime.toISOString()
    };

  } catch (error) {
    // Fallback calculation
    const distance = calculateHaversineDistance(
      driverLocation.lat, driverLocation.lng,
      pickupLocation.lat, pickupLocation.lng
    );
    
    const estimatedMinutes = Math.round(distance / 30 * 60); // 30 km/h average
    const arrivalTime = new Date(Date.now() + estimatedMinutes * 60 * 1000);

    return {
      distance: { km: distance, text: `${distance.toFixed(1)} km` },
      duration: { minutes: estimatedMinutes, text: `${estimatedMinutes} mins` },
      arrivalTime,
      formattedArrival: arrivalTime.toISOString(),
      fallback: true
    };
  }
};

module.exports = {
  calculateHaversineDistance,
  getGoogleMapsDistance,
  getRoute,
  geocodeAddress,
  reverseGeocode,
  findNearbyDrivers,
  optimizeRoute,
  validateCoordinates,
  getEstimatedArrival
};
