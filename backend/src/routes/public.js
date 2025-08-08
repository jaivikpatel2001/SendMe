/**
 * Public Routes
 * Handle all public endpoints accessible without authentication
 */

const express = require('express');
const {
  getHomeData,
  getDriverInfo,
  getVehicleTypes,
  getServiceAreas,
  getFAQs,
  contactSupport
} = require('../controllers/publicController');

const { generalLimiter, searchLimiter } = require('../middleware/rateLimiter');
const { validatePagination } = require('../middleware/validation');

const router = express.Router();

/**
 * @route   GET /api/public/home
 * @desc    Get home page data including vehicle types, services, and popular cities
 * @access  Public
 */
router.get('/home', generalLimiter, getHomeData);

/**
 * @route   GET /api/public/driver-info
 * @desc    Get driver registration information and benefits
 * @access  Public
 */
router.get('/driver-info', generalLimiter, getDriverInfo);

/**
 * @route   GET /api/public/vehicle-types
 * @desc    Get available vehicle types and pricing
 * @access  Public
 */
router.get('/vehicle-types', searchLimiter, getVehicleTypes);

/**
 * @route   GET /api/public/service-areas
 * @desc    Get list of service areas where platform operates
 * @access  Public
 */
router.get('/service-areas', generalLimiter, getServiceAreas);

/**
 * @route   GET /api/public/faqs
 * @desc    Get frequently asked questions
 * @access  Public
 */
router.get('/faqs', generalLimiter, getFAQs);

/**
 * @route   POST /api/public/contact
 * @desc    Submit contact form / support request
 * @access  Public
 */
router.post('/contact', generalLimiter, contactSupport);

module.exports = router;
