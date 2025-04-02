/**
 * CrawlJob Model
 * 
 * This module defines the Mongoose schema and model for crawl jobs.
 * It stores information about crawl operations, their status, configuration,
 * and results.
 * 
 * The schema includes:
 * - Basic job information (URL, depth, status)
 * - Configuration options
 * - Timestamps for tracking job lifecycle
 * - Lists of visited URLs and errors
 * - References to captured screenshots and OCR results
 * 
 * Relationships with other modules:
 * - Used by crawlerService.js for job tracking
 * - Referenced by OCR results for data association
 * - Displayed in the UI dashboard
 */

const mongoose = require('mongoose');

/**
 * Error Schema Definition
 * Represents an error that occurred during crawling
 */
const errorSchema = new mongoose.Schema({
  url: {
    type: String,
    default: null
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

/**
 * OCR Result Schema Definition
 * Represents the result of OCR processing on a screenshot
 */
const ocrResultSchema = new mongoose.Schema({
  analysisId: {
    type: String,
    required: true
  },
  screenshotPath: {
    type: String,
    required: true
  },
  text: {
    type: String,
    default: ''
  },
  confidence: {
    type: Number,
    default: 0
  },
  keywords: [{
    word: String,
    score: Number
  }],
  timestamp: {
    type: Date,
    default: Date.now
  }
});

/**
 * CrawlJob Schema Definition
 */
const crawlJobSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  depth: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'paused', 'completed', 'stopped', 'failed'],
    default: 'pending'
  },
  options: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  screenshotDir: {
    type: String,
    default: null
  },
  pagesProcessed: {
    type: Number,
    default: 0
  },
  screenshotCount: {
    type: Number,
    default: 0
  },
  errorCount: {
    type: Number,
    default: 0
  },
  visitedUrls: [{
    type: String
  }],
  errors: [errorSchema],
  ocrResults: [ocrResultSchema],
  duration: {
    type: Number,
    default: 0
  },
  errorMessage: {
    type: String,
    default: null
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  pausedAt: {
    type: Date,
    default: null
  },
  resumedAt: {
    type: Date,
    default: null
  },
  stoppedAt: {
    type: Date,
    default: null
  },
  failedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: {
    createdAt: 'startedAt',
    updatedAt: 'updatedAt'
  }
});

/**
 * Virtual for calculating completion percentage
 */
crawlJobSchema.virtual('completionPercentage').get(function() {
  if (this.status === 'completed') return 100;
  if (this.status === 'pending') return 0;
  
  // Estimate based on pages processed and expected depth
  const expectedPages = Math.pow(10, this.depth); // Rough estimate
  const percentage = Math.min(100, Math.floor((this.pagesProcessed / expectedPages) * 100));
  return percentage;
});

/**
 * Method to get a summary of the crawl job
 */
crawlJobSchema.methods.getSummary = function() {
  return {
    id: this._id,
    url: this.url,
    status: this.status,
    pagesProcessed: this.pagesProcessed,
    screenshotCount: this.screenshotCount,
    errorCount: this.errorCount,
    startedAt: this.startedAt,
    completedAt: this.completedAt,
    duration: this.duration,
    completionPercentage: this.completionPercentage
  };
};

/**
 * Statics
 */
crawlJobSchema.statics.getActiveJobs = function() {
  return this.find({
    status: { $in: ['pending', 'running', 'paused'] }
  });
};

crawlJobSchema.statics.getRecentJobs = function(limit = 10) {
  return this.find()
    .sort({ startedAt: -1 })
    .limit(limit);
};

/**
 * Export the CrawlJob model
 */
const CrawlJob = mongoose.model('CrawlJob', crawlJobSchema);

module.exports = CrawlJob; 