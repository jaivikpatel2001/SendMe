/**
 * CMS Content Model
 * Handle dynamic content management for the platform
 */

const mongoose = require('mongoose');

const cmsContentSchema = new mongoose.Schema({
  // Content Identification
  key: {
    type: String,
    required: [true, 'Content key is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9_-]+$/, 'Key can only contain lowercase letters, numbers, hyphens, and underscores']
  },
  
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  
  // Content Type
  type: {
    type: String,
    enum: [
      'page',           // Full page content
      'section',        // Page section
      'popup',          // Popup/modal content
      'email_template', // Email template
      'sms_template',   // SMS template
      'notification',   // Push notification template
      'faq',           // FAQ item
      'policy',        // Terms, privacy policy, etc.
      'banner',        // Promotional banner
      'announcement',  // System announcement
      'help_article'   // Help/support article
    ],
    required: [true, 'Content type is required']
  },
  
  // Content Data
  content: {
    // Rich text content
    html: String,
    text: String,
    markdown: String,
    
    // Structured content
    json: mongoose.Schema.Types.Mixed,
    
    // Template variables
    variables: [{
      name: String,
      type: {
        type: String,
        enum: ['string', 'number', 'boolean', 'date', 'url', 'email']
      },
      description: String,
      defaultValue: String,
      required: Boolean
    }],
    
    // Media assets
    images: [{
      url: String,
      alt: String,
      caption: String,
      width: Number,
      height: Number
    }],
    
    videos: [{
      url: String,
      thumbnail: String,
      duration: Number,
      title: String
    }],
    
    // Links and CTAs
    links: [{
      text: String,
      url: String,
      type: {
        type: String,
        enum: ['internal', 'external', 'email', 'phone']
      },
      target: {
        type: String,
        enum: ['_self', '_blank'],
        default: '_self'
      }
    }]
  },
  
  // Metadata
  meta: {
    description: String,
    keywords: [String],
    author: String,
    
    // SEO
    seo: {
      title: String,
      description: String,
      keywords: [String],
      canonicalUrl: String,
      ogTitle: String,
      ogDescription: String,
      ogImage: String,
      twitterTitle: String,
      twitterDescription: String,
      twitterImage: String
    }
  },
  
  // Localization
  language: {
    type: String,
    default: 'en',
    required: true
  },
  
  translations: [{
    language: {
      type: String,
      required: true
    },
    title: String,
    content: {
      html: String,
      text: String,
      markdown: String,
      json: mongoose.Schema.Types.Mixed
    },
    meta: {
      description: String,
      keywords: [String],
      seo: {
        title: String,
        description: String,
        keywords: [String]
      }
    }
  }],
  
  // Publishing and Visibility
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'scheduled'],
    default: 'draft'
  },
  
  visibility: {
    type: String,
    enum: ['public', 'private', 'restricted'],
    default: 'public'
  },
  
  // Access Control
  permissions: {
    roles: [{
      type: String,
      enum: ['customer', 'driver', 'admin', 'guest']
    }],
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  
  // Scheduling
  publishAt: Date,
  unpublishAt: Date,
  
  // Categorization
  category: {
    type: String,
    enum: [
      'legal',
      'help',
      'marketing',
      'system',
      'onboarding',
      'notification',
      'email',
      'sms',
      'general'
    ]
  },
  
  tags: [String],
  
  // Versioning
  version: {
    type: Number,
    default: 1
  },
  
  previousVersions: [{
    version: Number,
    content: mongoose.Schema.Types.Mixed,
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    modifiedAt: Date,
    changeLog: String
  }],
  
  // Analytics and Tracking
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    uniqueViews: {
      type: Number,
      default: 0
    },
    lastViewed: Date,
    
    // Engagement metrics
    engagement: {
      clicks: Number,
      shares: Number,
      downloads: Number,
      timeSpent: Number // average time in seconds
    }
  },
  
  // Template Configuration
  template: {
    name: String,
    layout: String,
    theme: String,
    customCSS: String,
    customJS: String
  },
  
  // Form Configuration (for contact forms, etc.)
  form: {
    fields: [{
      name: String,
      type: {
        type: String,
        enum: ['text', 'email', 'phone', 'textarea', 'select', 'checkbox', 'radio', 'file']
      },
      label: String,
      placeholder: String,
      required: Boolean,
      options: [String], // for select, radio, checkbox
      validation: {
        pattern: String,
        minLength: Number,
        maxLength: Number,
        min: Number,
        max: Number
      }
    }],
    submitAction: {
      type: String,
      enum: ['email', 'database', 'webhook', 'redirect']
    },
    submitConfig: mongoose.Schema.Types.Mixed
  },
  
  // Cache Configuration
  cache: {
    enabled: {
      type: Boolean,
      default: true
    },
    ttl: {
      type: Number,
      default: 3600 // 1 hour in seconds
    },
    tags: [String]
  },
  
  // Admin Information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  approvedAt: Date,
  
  // Comments and Notes
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    comment: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  internalNotes: String

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
cmsContentSchema.index({ key: 1 });
cmsContentSchema.index({ type: 1, status: 1 });
cmsContentSchema.index({ category: 1, status: 1 });
cmsContentSchema.index({ language: 1 });
cmsContentSchema.index({ publishAt: 1, unpublishAt: 1 });
cmsContentSchema.index({ tags: 1 });
cmsContentSchema.index({ createdAt: -1 });

// Virtual for is published
cmsContentSchema.virtual('isPublished').get(function() {
  const now = new Date();
  return this.status === 'published' &&
         (!this.publishAt || this.publishAt <= now) &&
         (!this.unpublishAt || this.unpublishAt > now);
});

// Virtual for content length
cmsContentSchema.virtual('contentLength').get(function() {
  if (this.content.text) return this.content.text.length;
  if (this.content.html) return this.content.html.replace(/<[^>]*>/g, '').length;
  if (this.content.markdown) return this.content.markdown.length;
  return 0;
});

// Virtual for reading time (words per minute)
cmsContentSchema.virtual('readingTime').get(function() {
  const wordsPerMinute = 200;
  const wordCount = this.contentLength / 5; // Approximate words
  return Math.ceil(wordCount / wordsPerMinute);
});

// Pre-save middleware to handle versioning
cmsContentSchema.pre('save', function(next) {
  if (this.isModified('content') && !this.isNew) {
    // Save previous version
    this.previousVersions.push({
      version: this.version,
      content: this.content,
      modifiedBy: this.lastModifiedBy,
      modifiedAt: new Date()
    });
    
    // Increment version
    this.version += 1;
    
    // Keep only last 10 versions
    if (this.previousVersions.length > 10) {
      this.previousVersions = this.previousVersions.slice(-10);
    }
  }
  next();
});

// Pre-save middleware to handle scheduled publishing
cmsContentSchema.pre('save', function(next) {
  const now = new Date();
  
  if (this.status === 'scheduled' && this.publishAt && this.publishAt <= now) {
    this.status = 'published';
  }
  
  if (this.status === 'published' && this.unpublishAt && this.unpublishAt <= now) {
    this.status = 'archived';
  }
  
  next();
});

// Instance method to get content for language
cmsContentSchema.methods.getContentForLanguage = function(language = 'en') {
  if (this.language === language) {
    return {
      title: this.title,
      content: this.content,
      meta: this.meta
    };
  }
  
  const translation = this.translations.find(t => t.language === language);
  if (translation) {
    return {
      title: translation.title || this.title,
      content: translation.content || this.content,
      meta: translation.meta || this.meta
    };
  }
  
  // Fallback to default language
  return {
    title: this.title,
    content: this.content,
    meta: this.meta
  };
};

// Instance method to render content with variables
cmsContentSchema.methods.renderContent = function(variables = {}, language = 'en') {
  const contentData = this.getContentForLanguage(language);
  let content = contentData.content.html || contentData.content.text || '';
  
  // Replace variables in content
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    content = content.replace(regex, variables[key]);
  });
  
  return content;
};

// Instance method to increment view count
cmsContentSchema.methods.incrementViews = function(isUnique = false) {
  this.analytics.views += 1;
  if (isUnique) {
    this.analytics.uniqueViews += 1;
  }
  this.analytics.lastViewed = new Date();
  
  return this.save({ validateBeforeSave: false });
};

// Instance method to add comment
cmsContentSchema.methods.addComment = function(userId, comment) {
  this.comments.push({
    user: userId,
    comment,
    timestamp: new Date()
  });
  
  return this.save();
};

// Static method to get published content by key
cmsContentSchema.statics.getPublishedByKey = async function(key, language = 'en') {
  const content = await this.findOne({
    key,
    status: 'published',
    $or: [
      { publishAt: { $lte: new Date() } },
      { publishAt: null }
    ],
    $or: [
      { unpublishAt: { $gte: new Date() } },
      { unpublishAt: null }
    ]
  });
  
  if (!content) return null;
  
  // Increment view count
  content.incrementViews();
  
  return content.getContentForLanguage(language);
};

// Static method to search content
cmsContentSchema.statics.search = async function(query, options = {}) {
  const {
    type = null,
    category = null,
    language = 'en',
    status = 'published',
    page = 1,
    limit = 20
  } = options;
  
  const searchQuery = {
    status,
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { 'content.text': { $regex: query, $options: 'i' } },
      { 'meta.description': { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ]
  };
  
  if (type) searchQuery.type = type;
  if (category) searchQuery.category = category;
  if (language) searchQuery.language = language;
  
  const skip = (page - 1) * limit;
  
  const [results, total] = await Promise.all([
    this.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('key title type category meta.description tags createdAt'),
    this.countDocuments(searchQuery)
  ]);
  
  return {
    results,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

const CmsContent = mongoose.model('CmsContent', cmsContentSchema);

module.exports = CmsContent;
