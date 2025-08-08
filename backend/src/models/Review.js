/**
 * Review Model
 * Handle customer and driver reviews and ratings
 */

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  // Review Identification
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking reference is required']
  },
  
  // Reviewer and Reviewee
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Reviewer is required']
  },
  reviewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Reviewee is required']
  },
  
  // Review Type
  reviewType: {
    type: String,
    enum: ['customer_to_driver', 'driver_to_customer'],
    required: [true, 'Review type is required']
  },
  
  // Rating and Review Content
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    validate: {
      validator: function(value) {
        return Number.isInteger(value);
      },
      message: 'Rating must be a whole number'
    }
  },
  
  review: {
    type: String,
    maxlength: [1000, 'Review cannot exceed 1000 characters'],
    trim: true
  },
  
  // Detailed Ratings (for drivers)
  detailedRatings: {
    punctuality: {
      type: Number,
      min: 1,
      max: 5,
      validate: {
        validator: function(value) {
          return this.reviewType === 'customer_to_driver' ? value !== undefined : true;
        },
        message: 'Punctuality rating is required for driver reviews'
      }
    },
    communication: {
      type: Number,
      min: 1,
      max: 5
    },
    professionalism: {
      type: Number,
      min: 1,
      max: 5
    },
    carHandling: {
      type: Number,
      min: 1,
      max: 5
    },
    packageCondition: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  
  // Review Tags
  tags: [{
    type: String,
    enum: [
      'excellent_service',
      'on_time',
      'professional',
      'friendly',
      'careful_handling',
      'clean_vehicle',
      'good_communication',
      'fast_delivery',
      'helpful',
      'courteous',
      'late',
      'unprofessional',
      'poor_communication',
      'damaged_package',
      'rude_behavior',
      'dirty_vehicle',
      'careless_handling'
    ]
  }],
  
  // Review Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'hidden'],
    default: 'pending'
  },
  
  // Moderation
  moderationNotes: String,
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: Date,
  
  // Flags and Reports
  isReported: {
    type: Boolean,
    default: false
  },
  reportReasons: [{
    reason: {
      type: String,
      enum: ['inappropriate_content', 'fake_review', 'spam', 'harassment', 'other']
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reportedAt: {
      type: Date,
      default: Date.now
    },
    description: String
  }],
  
  // Helpfulness
  helpfulVotes: {
    type: Number,
    default: 0
  },
  unhelpfulVotes: {
    type: Number,
    default: 0
  },
  votedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    vote: {
      type: String,
      enum: ['helpful', 'unhelpful']
    },
    votedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Response from Reviewee
  response: {
    content: {
      type: String,
      maxlength: [500, 'Response cannot exceed 500 characters']
    },
    respondedAt: Date
  },
  
  // Verification
  isVerified: {
    type: Boolean,
    default: true // Automatically verified if from completed booking
  },
  
  // Platform and Source
  platform: {
    type: String,
    enum: ['web', 'mobile', 'admin'],
    default: 'mobile'
  },
  
  // Analytics
  viewCount: {
    type: Number,
    default: 0
  },
  
  // Metadata
  ipAddress: String,
  userAgent: String,
  location: {
    city: String,
    state: String,
    country: String
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
reviewSchema.index({ booking: 1 });
reviewSchema.index({ reviewer: 1, createdAt: -1 });
reviewSchema.index({ reviewee: 1, createdAt: -1 });
reviewSchema.index({ reviewType: 1, status: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ createdAt: -1 });

// Compound indexes
reviewSchema.index({ reviewee: 1, reviewType: 1, status: 1 });
reviewSchema.index({ booking: 1, reviewType: 1 });

// Virtual for helpfulness ratio
reviewSchema.virtual('helpfulnessRatio').get(function() {
  const totalVotes = this.helpfulVotes + this.unhelpfulVotes;
  if (totalVotes === 0) return 0;
  return (this.helpfulVotes / totalVotes) * 100;
});

// Virtual for overall detailed rating
reviewSchema.virtual('overallDetailedRating').get(function() {
  if (!this.detailedRatings || this.reviewType !== 'customer_to_driver') {
    return null;
  }
  
  const ratings = Object.values(this.detailedRatings).filter(rating => rating !== undefined);
  if (ratings.length === 0) return null;
  
  const sum = ratings.reduce((acc, rating) => acc + rating, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
});

// Pre-save middleware to ensure one review per booking per reviewer
reviewSchema.pre('save', async function(next) {
  if (this.isNew) {
    const existingReview = await this.constructor.findOne({
      booking: this.booking,
      reviewer: this.reviewer,
      reviewType: this.reviewType
    });
    
    if (existingReview) {
      const error = new Error('You have already reviewed this booking');
      error.statusCode = 400;
      return next(error);
    }
  }
  next();
});

// Pre-save middleware to calculate overall rating from detailed ratings
reviewSchema.pre('save', function(next) {
  if (this.detailedRatings && this.reviewType === 'customer_to_driver') {
    const ratings = Object.values(this.detailedRatings).filter(rating => rating !== undefined);
    if (ratings.length > 0) {
      const sum = ratings.reduce((acc, rating) => acc + rating, 0);
      this.rating = Math.round(sum / ratings.length);
    }
  }
  next();
});

// Static method to get average rating for a user
reviewSchema.statics.getAverageRating = async function(userId, reviewType = 'customer_to_driver') {
  const result = await this.aggregate([
    {
      $match: {
        reviewee: mongoose.Types.ObjectId(userId),
        reviewType: reviewType,
        status: 'approved'
      }
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);

  if (result.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  }

  const data = result[0];
  
  // Calculate rating distribution
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  data.ratingDistribution.forEach(rating => {
    distribution[rating] = (distribution[rating] || 0) + 1;
  });

  return {
    averageRating: Math.round(data.averageRating * 10) / 10,
    totalReviews: data.totalReviews,
    ratingDistribution: distribution
  };
};

// Static method to get detailed ratings average for a driver
reviewSchema.statics.getDetailedRatingsAverage = async function(driverId) {
  const result = await this.aggregate([
    {
      $match: {
        reviewee: mongoose.Types.ObjectId(driverId),
        reviewType: 'customer_to_driver',
        status: 'approved',
        'detailedRatings.punctuality': { $exists: true }
      }
    },
    {
      $group: {
        _id: null,
        avgPunctuality: { $avg: '$detailedRatings.punctuality' },
        avgCommunication: { $avg: '$detailedRatings.communication' },
        avgProfessionalism: { $avg: '$detailedRatings.professionalism' },
        avgCarHandling: { $avg: '$detailedRatings.carHandling' },
        avgPackageCondition: { $avg: '$detailedRatings.packageCondition' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  if (result.length === 0) {
    return null;
  }

  const data = result[0];
  return {
    punctuality: Math.round(data.avgPunctuality * 10) / 10,
    communication: Math.round(data.avgCommunication * 10) / 10,
    professionalism: Math.round(data.avgProfessionalism * 10) / 10,
    carHandling: Math.round(data.avgCarHandling * 10) / 10,
    packageCondition: Math.round(data.avgPackageCondition * 10) / 10,
    totalReviews: data.totalReviews
  };
};

// Instance method to check if user can vote on this review
reviewSchema.methods.canUserVote = function(userId) {
  return !this.votedBy.some(vote => vote.user.toString() === userId.toString());
};

// Instance method to add vote
reviewSchema.methods.addVote = function(userId, voteType) {
  if (!this.canUserVote(userId)) {
    throw new Error('User has already voted on this review');
  }

  this.votedBy.push({
    user: userId,
    vote: voteType,
    votedAt: new Date()
  });

  if (voteType === 'helpful') {
    this.helpfulVotes += 1;
  } else {
    this.unhelpfulVotes += 1;
  }

  return this.save();
};

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
