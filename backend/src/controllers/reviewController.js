/**
 * Review Controller
 * Handle all review-related operations and business logic
 */

const Review = require('../models/Review');
const Booking = require('../models/Booking');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * @desc    Get all reviews with pagination, filtering, and sorting
 * @route   GET /api/reviews
 * @access  Admin, Customer (own reviews), Driver (own reviews)
 */
const getReviews = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    reviewType,
    status,
    rating,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    reviewerId,
    revieweeId
  } = req.query;

  // Build query based on user role
  let query = {};
  
  if (req.user.role === 'customer') {
    query.reviewer = req.user._id;
  } else if (req.user.role === 'driver') {
    query.$or = [
      { reviewer: req.user._id },
      { reviewee: req.user._id }
    ];
  }

  // Apply filters
  if (reviewType) query.reviewType = reviewType;
  if (status) query.status = status;
  if (rating) query.rating = parseInt(rating);
  if (reviewerId && req.user.role === 'admin') query.reviewer = reviewerId;
  if (revieweeId && req.user.role === 'admin') query.reviewee = revieweeId;

  // Search functionality
  if (search) {
    query.$or = [
      { review: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query
  const [reviews, total] = await Promise.all([
    Review.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('reviewer', 'firstName lastName email')
      .populate('reviewee', 'firstName lastName email')
      .populate('booking', 'bookingId serviceType status'),
    Review.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: {
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

/**
 * @desc    Get single review by ID
 * @route   GET /api/reviews/:id
 * @access  Admin, Reviewer, Reviewee
 */
const getReviewById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const review = await Review.findById(id)
    .populate('reviewer', 'firstName lastName email')
    .populate('reviewee', 'firstName lastName email')
    .populate('booking', 'bookingId serviceType status')
    .populate('moderatedBy', 'firstName lastName email');

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found'
    });
  }

  // Check access permissions
  const hasAccess = req.user.role === 'admin' ||
                   review.reviewer._id.toString() === req.user._id.toString() ||
                   review.reviewee._id.toString() === req.user._id.toString();

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  res.status(200).json({
    success: true,
    data: { review }
  });
});

/**
 * @desc    Create new review
 * @route   POST /api/reviews
 * @access  Customer, Driver
 */
const createReview = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const {
    bookingId,
    revieweeId,
    reviewType,
    rating,
    review,
    detailedRatings,
    tags
  } = req.body;

  // Verify booking exists and user has access
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Check if user can review this booking
  const canReview = (reviewType === 'customer_to_driver' && 
                    booking.customer.toString() === req.user._id.toString()) ||
                   (reviewType === 'driver_to_customer' && 
                    booking.driver && booking.driver.toString() === req.user._id.toString());

  if (!canReview) {
    return res.status(403).json({
      success: false,
      message: 'You cannot review this booking'
    });
  }

  // Check if booking is completed
  if (booking.status !== 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Can only review completed bookings'
    });
  }

  // Verify reviewee
  const reviewee = await User.findById(revieweeId);
  if (!reviewee) {
    return res.status(404).json({
      success: false,
      message: 'Reviewee not found'
    });
  }

  // Create review
  const newReview = await Review.create({
    booking: bookingId,
    reviewer: req.user._id,
    reviewee: revieweeId,
    reviewType,
    rating,
    review,
    detailedRatings,
    tags,
    status: 'approved', // Auto-approve reviews from verified bookings
    platform: 'web'
  });

  // Populate the created review
  await newReview.populate([
    { path: 'reviewer', select: 'firstName lastName email' },
    { path: 'reviewee', select: 'firstName lastName email' },
    { path: 'booking', select: 'bookingId serviceType status' }
  ]);

  // Update user's rating
  await updateUserRating(revieweeId, reviewType);

  logger.info(`New review created: ${newReview._id} by ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Review created successfully',
    data: { review: newReview }
  });
});

/**
 * @desc    Update review
 * @route   PUT /api/reviews/:id
 * @access  Reviewer (own review), Admin
 */
const updateReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const review = await Review.findById(id);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found'
    });
  }

  // Check permissions
  const canUpdate = req.user.role === 'admin' ||
                   review.reviewer.toString() === req.user._id.toString();

  if (!canUpdate) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Remove fields that shouldn't be updated directly
  delete updates.booking;
  delete updates.reviewer;
  delete updates.reviewee;
  delete updates.reviewType;
  delete updates.helpfulVotes;
  delete updates.unhelpfulVotes;
  delete updates.votedBy;

  const updatedReview = await Review.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  ).populate([
    { path: 'reviewer', select: 'firstName lastName email' },
    { path: 'reviewee', select: 'firstName lastName email' },
    { path: 'booking', select: 'bookingId serviceType status' }
  ]);

  // Update user's rating if rating changed
  if (updates.rating && updates.rating !== review.rating) {
    await updateUserRating(review.reviewee, review.reviewType);
  }

  logger.info(`Review updated: ${updatedReview._id}`);

  res.status(200).json({
    success: true,
    message: 'Review updated successfully',
    data: { review: updatedReview }
  });
});

/**
 * @desc    Partial update review
 * @route   PATCH /api/reviews/:id
 * @access  Reviewer (own review), Admin
 */
const patchReview = asyncHandler(async (req, res) => {
  // Use the same logic as updateReview for PATCH
  await updateReview(req, res);
});

/**
 * @desc    Delete review
 * @route   DELETE /api/reviews/:id
 * @access  Admin only
 */
const deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const review = await Review.findById(id);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found'
    });
  }

  await Review.findByIdAndDelete(id);

  // Update user's rating after deletion
  await updateUserRating(review.reviewee, review.reviewType);

  logger.info(`Review deleted: ${id}`);

  res.status(200).json({
    success: true,
    message: 'Review deleted successfully'
  });
});

/**
 * Helper function to update user's average rating
 */
const updateUserRating = async (userId, reviewType) => {
  const ratingData = await Review.getAverageRating(userId, reviewType);
  
  const updateField = reviewType === 'customer_to_driver' 
    ? 'driverInfo.rating' 
    : 'customerInfo.rating';

  await User.findByIdAndUpdate(userId, {
    [`${updateField}.average`]: ratingData.averageRating,
    [`${updateField}.count`]: ratingData.totalReviews
  });
};

/**
 * @desc    Moderate review (approve/reject/hide)
 * @route   PATCH /api/reviews/:id/moderate
 * @access  Admin only
 */
const moderateReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, moderationNotes } = req.body;

  const review = await Review.findById(id);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found'
    });
  }

  const validStatuses = ['pending', 'approved', 'rejected', 'hidden'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status value'
    });
  }

  review.status = status;
  review.moderationNotes = moderationNotes;
  review.moderatedBy = req.user._id;
  review.moderatedAt = new Date();

  await review.save();

  logger.info(`Review moderated: ${review._id} - ${status}`);

  res.status(200).json({
    success: true,
    message: `Review ${status} successfully`,
    data: { review: { _id: review._id, status: review.status } }
  });
});

/**
 * @desc    Vote on review helpfulness
 * @route   POST /api/reviews/:id/vote
 * @access  Authenticated users
 */
const voteOnReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { voteType } = req.body;

  const review = await Review.findById(id);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found'
    });
  }

  if (!['helpful', 'unhelpful'].includes(voteType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid vote type'
    });
  }

  // Check if user can vote
  if (!review.canUserVote(req.user._id)) {
    return res.status(400).json({
      success: false,
      message: 'You have already voted on this review'
    });
  }

  await review.addVote(req.user._id, voteType);

  res.status(200).json({
    success: true,
    message: 'Vote recorded successfully',
    data: {
      helpfulVotes: review.helpfulVotes,
      unhelpfulVotes: review.unhelpfulVotes
    }
  });
});

/**
 * @desc    Add response to review
 * @route   POST /api/reviews/:id/response
 * @access  Reviewee only
 */
const addReviewResponse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  const review = await Review.findById(id);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found'
    });
  }

  // Check if user is the reviewee
  if (review.reviewee.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Only the reviewee can respond to this review'
    });
  }

  if (review.response.content) {
    return res.status(400).json({
      success: false,
      message: 'Response already exists for this review'
    });
  }

  review.response = {
    content,
    respondedAt: new Date()
  };

  await review.save();

  res.status(201).json({
    success: true,
    message: 'Response added successfully',
    data: { response: review.response }
  });
});

/**
 * @desc    Get user's rating summary
 * @route   GET /api/reviews/user/:userId/summary
 * @access  Public
 */
const getUserRatingSummary = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { reviewType = 'customer_to_driver' } = req.query;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const [ratingData, detailedRatings] = await Promise.all([
    Review.getAverageRating(userId, reviewType),
    reviewType === 'customer_to_driver' ? Review.getDetailedRatingsAverage(userId) : null
  ]);

  res.status(200).json({
    success: true,
    data: {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName
      },
      rating: ratingData,
      detailedRatings
    }
  });
});

module.exports = {
  getReviews,
  getReviewById,
  createReview,
  updateReview,
  patchReview,
  deleteReview,
  moderateReview,
  voteOnReview,
  addReviewResponse,
  getUserRatingSummary
};
