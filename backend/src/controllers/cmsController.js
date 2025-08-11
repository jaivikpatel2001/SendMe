/**
 * CMS Controller
 * Handle all CMS content-related operations and business logic
 */

const CmsContent = require('../models/CmsContent');
const { catchAsync } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * @desc    Get all CMS content with pagination, filtering, and sorting
 * @route   GET /api/cms
 * @access  Admin (all), Public (published only)
 */
const getCmsContent = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    type,
    status,
    category,
    visibility,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    language = 'en'
  } = req.query;

  // Build query based on user role
  let query = {};
  
  // Non-admin users can only see published, public content
  if (req.user?.role !== 'admin') {
    const { nowUTC } = require('../utils/time');
    const now = nowUTC();
    query.status = 'published';
    query.visibility = 'public';
    query.publishAt = { $lte: now };
    query.$or = [
      { unpublishAt: { $exists: false } },
      { unpublishAt: { $gte: now } }
    ];
  }

  // Apply filters
  if (type) query.type = type;
  if (status && req.user?.role === 'admin') query.status = status;
  if (category) query.category = category;
  if (visibility && req.user?.role === 'admin') query.visibility = visibility;
  if (language) query.language = language;

  // Search functionality
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { slug: { $regex: search, $options: 'i' } },
      { 'content.text': { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query
  const [contents, total] = await Promise.all([
    CmsContent.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName email'),
    CmsContent.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: {
      contents,
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
 * @desc    Get single CMS content by ID or slug
 * @route   GET /api/cms/:identifier
 * @access  Admin (all), Public (published only)
 */
const getCmsContentById = catchAsync(async (req, res) => {
  const { identifier } = req.params;

  // Try to find by ID first, then by slug
  let query = {};
  if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
    query._id = identifier;
  } else {
    query.slug = identifier;
  }

  // Non-admin users can only see published, public content
  if (req.user?.role !== 'admin') {
    const { nowUTC } = require('../utils/time');
    const now = nowUTC();
    query.status = 'published';
    query.visibility = 'public';
    query.publishAt = { $lte: now };
    query.$or = [
      { unpublishAt: { $exists: false } },
      { unpublishAt: { $gte: now } }
    ];
  }

  const content = await CmsContent.findOne(query)
    .populate('author', 'firstName lastName email')
    .populate('lastModifiedBy', 'firstName lastName email')
    .populate('previousVersions.modifiedBy', 'firstName lastName email');

  if (!content) {
    return res.status(404).json({
      success: false,
      message: 'Content not found'
    });
  }

  // Increment view count for published content
  if (content.status === 'published') {
    content.analytics.views += 1;
    content.analytics.lastViewed = new Date();
    await content.save();
  }

  res.status(200).json({
    success: true,
    data: { content }
  });
});

/**
 * @desc    Create new CMS content
 * @route   POST /api/cms
 * @access  Admin only
 */
const createCmsContent = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const contentData = {
    ...req.body,
    author: req.user._id
  };

  // Generate slug if not provided
  if (!contentData.slug) {
    contentData.slug = contentData.title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // Check if slug already exists
  const existingContent = await CmsContent.findOne({ slug: contentData.slug });
  if (existingContent) {
    contentData.slug = `${contentData.slug}-${Date.now()}`;
  }

  const content = await CmsContent.create(contentData);

  // Populate the created content
  await content.populate([
    { path: 'author', select: 'firstName lastName email' }
  ]);

  logger.info(`New CMS content created: ${content.title} by ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Content created successfully',
    data: { content }
  });
});

/**
 * @desc    Update CMS content
 * @route   PUT /api/cms/:id
 * @access  Admin only
 */
const updateCmsContent = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updates = {
    ...req.body,
    lastModifiedBy: req.user._id
  };

  const content = await CmsContent.findById(id);

  if (!content) {
    return res.status(404).json({
      success: false,
      message: 'Content not found'
    });
  }

  // Create version backup before updating
  if (content.version > 0) {
    content.previousVersions.push({
      version: content.version,
      content: content.content,
      modifiedBy: req.user._id,
      modifiedAt: new Date(),
      changeLog: updates.changeLog || 'Content updated'
    });
  }

  // Increment version
  updates.version = content.version + 1;

  // Update slug if title changed
  if (updates.title && updates.title !== content.title) {
    updates.slug = updates.title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if new slug already exists
    const existingContent = await CmsContent.findOne({ 
      slug: updates.slug,
      _id: { $ne: id }
    });
    if (existingContent) {
      updates.slug = `${updates.slug}-${Date.now()}`;
    }
  }

  const updatedContent = await CmsContent.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  ).populate([
    { path: 'author', select: 'firstName lastName email' },
    { path: 'lastModifiedBy', select: 'firstName lastName email' }
  ]);

  logger.info(`CMS content updated: ${updatedContent.title}`);

  res.status(200).json({
    success: true,
    message: 'Content updated successfully',
    data: { content: updatedContent }
  });
});

/**
 * @desc    Partial update CMS content
 * @route   PATCH /api/cms/:id
 * @access  Admin only
 */
const patchCmsContent = catchAsync(async (req, res) => {
  // Use the same logic as updateCmsContent for PATCH
  await updateCmsContent(req, res);
});

/**
 * @desc    Delete CMS content
 * @route   DELETE /api/cms/:id
 * @access  Admin only
 */
const deleteCmsContent = catchAsync(async (req, res) => {
  const { id } = req.params;

  const content = await CmsContent.findById(id);

  if (!content) {
    return res.status(404).json({
      success: false,
      message: 'Content not found'
    });
  }

  await CmsContent.findByIdAndDelete(id);

  logger.info(`CMS content deleted: ${content.title}`);

  res.status(200).json({
    success: true,
    message: 'Content deleted successfully'
  });
});

/**
 * @desc    Publish/unpublish CMS content
 * @route   PATCH /api/cms/:id/publish
 * @access  Admin only
 */
const publishContent = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, publishAt, unpublishAt } = req.body;

  const content = await CmsContent.findById(id);

  if (!content) {
    return res.status(404).json({
      success: false,
      message: 'Content not found'
    });
  }

  const validStatuses = ['draft', 'published', 'archived', 'scheduled'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status value'
    });
  }

  const { parseDateToUTCStart, parseDateToUTCEnd } = require('../utils/time');
  content.status = status;
  if (publishAt) content.publishAt = parseDateToUTCStart(publishAt);
  if (unpublishAt) content.unpublishAt = parseDateToUTCEnd(unpublishAt);

  await content.save();

  logger.info(`CMS content ${status}: ${content.title}`);

  res.status(200).json({
    success: true,
    message: `Content ${status} successfully`,
    data: { 
      content: { 
        _id: content._id, 
        status: content.status,
        publishAt: content.publishAt,
        unpublishAt: content.unpublishAt
      } 
    }
  });
});

module.exports = {
  getCmsContent,
  getCmsContentById,
  createCmsContent,
  updateCmsContent,
  patchCmsContent,
  deleteCmsContent,
  publishContent
};
