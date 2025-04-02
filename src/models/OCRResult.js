/**
 * OCR Result Model
 * 
 * This module defines the Mongoose schema and model for OCR results.
 * It stores information about OCR processing operations, extracted text,
 * confidence levels, and associated keywords.
 * 
 * The schema includes:
 * - OCR processing metadata (analysis ID, source image)
 * - Extracted text content
 * - Confidence score
 * - Keyword analysis results
 * - Relationships to crawl jobs
 * 
 * Relationships with other modules:
 * - Created by ocrService.js when processing images
 * - Used by keywordService.js for text analysis
 * - Referenced in the UI dashboard for displaying OCR results
 */

const mongoose = require('mongoose');

/**
 * Keyword Schema Definition
 * Represents a keyword extracted from OCR text
 */
const keywordSchema = new mongoose.Schema({
  word: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  frequency: {
    type: Number,
    default: 1
  },
  category: {
    type: String,
    default: null
  }
});

/**
 * OCR Result Schema Definition
 */
const ocrResultSchema = new mongoose.Schema({
  analysisId: {
    type: String,
    required: true,
    unique: true
  },
  imagePath: {
    type: String,
    required: true
  },
  crawlId: {
    type: String,
    ref: 'CrawlJob',
    default: null
  },
  text: {
    type: String,
    default: ''
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  options: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  keywords: [keywordSchema],
  processingTime: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

/**
 * Text Length Virtual
 */
ocrResultSchema.virtual('textLength').get(function() {
  return this.text ? this.text.length : 0;
});

/**
 * Word Count Virtual
 */
ocrResultSchema.virtual('wordCount').get(function() {
  if (!this.text) return 0;
  return this.text.split(/\s+/).filter(word => word.length > 0).length;
});

/**
 * Static: Find results with specific keywords
 */
ocrResultSchema.statics.findByKeyword = function(keyword) {
  return this.find({
    'keywords.word': keyword
  });
};

/**
 * Static: Get high confidence results
 */
ocrResultSchema.statics.getHighConfidenceResults = function(minConfidence = 80) {
  return this.find({
    confidence: { $gte: minConfidence }
  });
};

/**
 * Static: Get recent results
 */
ocrResultSchema.statics.getRecentResults = function(limit = 10) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit);
};

/**
 * Add keywords to OCR result
 */
ocrResultSchema.methods.addKeywords = async function(keywords) {
  // Add or update keywords
  for (const keyword of keywords) {
    const existingKeyword = this.keywords.find(k => k.word === keyword.word);
    
    if (existingKeyword) {
      existingKeyword.score = keyword.score;
      existingKeyword.frequency += 1;
      existingKeyword.category = keyword.category || existingKeyword.category;
    } else {
      this.keywords.push(keyword);
    }
  }
  
  this.updatedAt = new Date();
  return await this.save();
};

/**
 * Export the OCR Result model
 */
const OCRResult = mongoose.model('OCRResult', ocrResultSchema);

module.exports = OCRResult; 