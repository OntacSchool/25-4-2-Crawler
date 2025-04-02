/**
 * Keyword Model
 * 
 * This module defines the Mongoose schema and model for keywords extracted from OCR text.
 * It tracks keywords across multiple OCR results and crawl jobs, providing a global
 * view of keyword frequency, relevance, and categorization.
 * 
 * The schema includes:
 * - Keyword identification and frequency tracking
 * - Scoring and relevance metrics
 * - Categorization for analysis
 * - References to source crawl jobs
 * 
 * Relationships with other modules:
 * - Used by keywordService.js for tracking extracted keywords
 * - Referenced in analytics dashboards for trend analysis
 * - Used for generating insights and reports
 */

const mongoose = require('mongoose');

/**
 * Keyword Schema Definition
 */
const keywordSchema = new mongoose.Schema({
  word: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  frequency: {
    type: Number,
    default: 1,
    min: 1
  },
  totalScore: {
    type: Number,
    default: 0
  },
  averageScore: {
    type: Number,
    default: 0
  },
  category: {
    type: String,
    enum: ['brand', 'product', 'feature', 'marketing', 'action', 'other', null],
    default: null
  },
  crawlJobs: [{
    type: String,
    ref: 'CrawlJob'
  }],
  firstSeenAt: {
    type: Date,
    default: Date.now
  },
  lastSeenAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Index definition for efficient querying
 */
keywordSchema.index({ word: 1 }, { unique: true });
keywordSchema.index({ frequency: -1 });
keywordSchema.index({ averageScore: -1 });
keywordSchema.index({ category: 1 });
keywordSchema.index({ lastSeenAt: -1 });

/**
 * Virtual property for relevance score
 * Combines frequency and average score for a comprehensive metric
 */
keywordSchema.virtual('relevance').get(function() {
  // A weighted combination of frequency and score
  const frequencyFactor = Math.log10(Math.max(1, this.frequency));
  const scoreFactor = this.averageScore / 100;
  const relevance = (0.7 * frequencyFactor + 0.3 * scoreFactor) * 100;
  
  return Math.round(relevance * 10) / 10; // Round to one decimal place
});

/**
 * Virtual property for trend (frequency increase over time)
 */
keywordSchema.virtual('trend').get(function() {
  const ageInDays = (Date.now() - this.firstSeenAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageInDays < 1) return this.frequency; // New keywords have high trend
  
  // Frequency normalized by age
  return Math.round((this.frequency / ageInDays) * 10) / 10;
});

/**
 * Static method to find trending keywords
 */
keywordSchema.statics.findTrending = function(limit = 10) {
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  
  return this.find({
    lastSeenAt: { $gte: twoWeeksAgo }
  })
  .sort({ frequency: -1 })
  .limit(limit);
};

/**
 * Static method to find keywords by category
 */
keywordSchema.statics.findByCategory = function(category, limit = 20) {
  return this.find({ category })
    .sort({ frequency: -1 })
    .limit(limit);
};

/**
 * Static method to search keywords
 */
keywordSchema.statics.search = function(query, limit = 20) {
  return this.find({
    word: { $regex: query, $options: 'i' }
  })
  .sort({ frequency: -1 })
  .limit(limit);
};

/**
 * Export the Keyword model
 */
const Keyword = mongoose.model('Keyword', keywordSchema);

module.exports = Keyword; 