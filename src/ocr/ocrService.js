/**
 * OCR Service Module
 * 
 * This module provides OCR (Optical Character Recognition) functionality using Tesseract.
 * It processes images to extract text content, which can then be analyzed for keywords
 * and insights.
 * 
 * The service handles:
 * - Image preprocessing to optimize OCR accuracy
 * - Text extraction with confidence scoring
 * - Storage of OCR results
 * - Error handling and retry mechanisms
 * 
 * Relationships with other modules:
 * - Used by crawlerService.js to process crawled screenshots
 * - Used by ocrController.js to handle OCR API requests
 * - Provides data to keywordService.js for further analysis
 */

const tesseract = require('node-tesseract-ocr');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const logger = require('../utils/logger');
const OCRResult = require('../models/OCRResult');
const { getRedisClient } = require('../config/redis');

// Try to import canvas, but fallback to a mock implementation if not available
let createCanvas;
let loadImage;
let canvasAvailable = false;

try {
  const canvas = require('canvas');
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
  canvasAvailable = true;
  logger.info('Canvas module loaded successfully for image preprocessing');
} catch (error) {
  logger.warn('Canvas module not available - OCR preprocessing will be limited');
  // Create mock implementations that will be used when canvas is not available
  createCanvas = (width, height) => {
    return {
      width,
      height,
      getContext: () => ({
        drawImage: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }),
        putImageData: () => {}
      }),
      toBuffer: () => Buffer.from([])
    };
  };
  loadImage = async (src) => ({ width: 100, height: 100 });
}

/**
 * Process an image using OCR to extract text
 * 
 * @param {string} analysisId - Unique identifier for this OCR analysis
 * @param {string|Buffer} imageSource - Path to image or base64 encoded image data
 * @param {Object} options - Additional OCR options
 * @returns {Promise<Object>} - OCR result with text and confidence score
 */
const processImage = async (imageSource, options = {}) => {
  const analysisId = options.analysisId || require('uuid').v4();
  
  try {
    logger.info(`Starting OCR processing for analysis ${analysisId}`);
    
    // Determine if imageSource is a path or base64 data
    let imagePath;
    let isTemporary = false;
    
    if (typeof imageSource === 'string' && (imageSource.startsWith('data:image') || imageSource.startsWith('http'))) {
      // Create a temporary file for the image data
      imagePath = path.join(process.cwd(), 'data', 'temp', `${analysisId}.png`);
      await fs.mkdir(path.dirname(imagePath), { recursive: true });
      
      // Download or convert base64 to file
      if (imageSource.startsWith('http')) {
        const response = await fetch(imageSource);
        const buffer = await response.arrayBuffer();
        await fs.writeFile(imagePath, Buffer.from(buffer));
      } else {
        // Extract base64 data
        const base64Data = imageSource.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        await fs.writeFile(imagePath, buffer);
      }
      
      isTemporary = true;
    } else if (typeof imageSource === 'string') {
      // Use the provided file path
      imagePath = imageSource;
    } else {
      throw new Error('Invalid image source. Must be a file path or base64 encoded image data.');
    }
    
    // Verify that the image file exists
    await fs.access(imagePath);
    
    // Preprocess the image if enabled and canvas is available
    if (options.preprocess !== false && canvasAvailable) {
      await preprocessImage(imagePath, options);
    } else if (options.preprocess !== false && !canvasAvailable) {
      logger.info('Skipping image preprocessing because canvas module is not available');
    }
    
    // Configure Tesseract options
    const tesseractConfig = {
      lang: options.lang || process.env.OCR_LANG || 'eng',
      oem: 1, // Neural net LSTM engine only
      psm: 3, // Auto page segmentation with OSD
      ...options.tesseract
    };
    
    // Perform OCR
    logger.debug(`Running Tesseract OCR on ${path.basename(imagePath)}`);
    const text = await tesseract.recognize(imagePath, tesseractConfig);
    
    // Extract confidence from Tesseract output (approximation)
    const confidence = calculateConfidence(text);
    
    // Create OCR result record
    const result = new OCRResult({
      analysisId,
      imagePath,
      text,
      confidence,
      options,
      crawlId: options.crawlId || null
    });
    
    await result.save();
    
    // Clean up temporary file if needed
    if (isTemporary) {
      await fs.unlink(imagePath).catch(err => {
        logger.warn(`Failed to delete temporary image file: ${err.message}`);
      });
    }
    
    logger.info(`OCR processing completed for analysis ${analysisId} with confidence ${confidence}%`);
    
    return {
      analysisId,
      text,
      confidence,
      processed: true
    };
  } catch (error) {
    logger.error(`OCR processing error: ${error.message}`);
    
    // Return a minimal result for error case so the app can continue
    return {
      analysisId,
      text: "",
      confidence: 0,
      processed: false,
      error: error.message
    };
  }
};

/**
 * Preprocess an image to improve OCR accuracy
 * Only runs if canvas is available
 * 
 * @param {string} imagePath - Path to the image file
 * @param {Object} options - Preprocessing options
 * @returns {Promise<void>}
 */
const preprocessImage = async (imagePath, options = {}) => {
  if (!canvasAvailable) {
    logger.warn('Skipping image preprocessing because canvas module is not available');
    return;
  }
  
  try {
    logger.debug(`Preprocessing image: ${path.basename(imagePath)}`);
    
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // Draw original image
    ctx.drawImage(image, 0, 0);
    
    // Apply grayscale
    if (options.grayscale !== false) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = avg; // r
        data[i + 1] = avg; // g
        data[i + 2] = avg; // b
      }
      
      ctx.putImageData(imageData, 0, 0);
    }
    
    // Apply contrast adjustment if specified
    if (options.contrast) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const factor = (259 * (options.contrast + 255)) / (255 * (259 - options.contrast));
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = truncateColor(factor * (data[i] - 128) + 128);
        data[i + 1] = truncateColor(factor * (data[i + 1] - 128) + 128);
        data[i + 2] = truncateColor(factor * (data[i + 2] - 128) + 128);
      }
      
      ctx.putImageData(imageData, 0, 0);
    }
    
    // Save the preprocessed image
    const outputBuffer = canvas.toBuffer('image/png');
    await fs.writeFile(imagePath, outputBuffer);
    
    logger.debug(`Image preprocessing completed for ${path.basename(imagePath)}`);
  } catch (error) {
    logger.warn(`Image preprocessing error: ${error.message}`);
    // Continue with original image if preprocessing fails
  }
};

/**
 * Helper function to ensure color values stay within 0-255 range
 * 
 * @param {number} value - Color value
 * @returns {number} - Truncated color value
 */
const truncateColor = (value) => {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return Math.round(value);
};

/**
 * Calculate OCR confidence based on text output
 * 
 * @param {string} text - OCR extracted text
 * @returns {number} - Confidence percentage (0-100)
 */
const calculateConfidence = (text) => {
  if (!text || text.trim().length === 0) {
    return 0;
  }
  
  // Simple heuristic: longer text with more words generally means higher confidence
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;
  
  // Calculate word length average (longer words tend to be more reliable)
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / Math.max(1, wordCount);
  
  // Count common OCR errors (?, #, ~, |, etc.)
  const errorChars = text.match(/[?#~|{}\[\]]/g) || [];
  const errorRatio = errorChars.length / text.length;
  
  // Calculate base confidence from word count (logarithmic scale)
  let confidence = Math.min(100, 40 + 30 * Math.log10(Math.max(1, wordCount)));
  
  // Adjust based on average word length
  confidence += Math.min(20, avgWordLength * 2);
  
  // Penalize for error characters
  confidence -= errorRatio * 50;
  
  // Ensure confidence is within 0-100 range
  return Math.max(0, Math.min(100, Math.round(confidence)));
};

/**
 * Get OCR results for a specific analysis ID
 * 
 * @param {string} analysisId - OCR analysis ID
 * @returns {Promise<Object|null>} - OCR result or null if not found
 */
const getResults = async (analysisId) => {
  try {
    const result = await OCRResult.findOne({ analysisId });
    
    if (!result) {
      return null;
    }
    
    return {
      analysisId: result.analysisId,
      text: result.text,
      confidence: result.confidence,
      processedAt: result.createdAt,
      keywords: result.keywords || []
    };
  } catch (error) {
    logger.error(`Error retrieving OCR results: ${error.message}`);
    throw error;
  }
};

/**
 * Get statistics about OCR processing
 * 
 * @returns {Promise<Object>} - OCR statistics
 */
const getStatistics = async () => {
  try {
    const totalCount = await OCRResult.countDocuments();
    const successCount = await OCRResult.countDocuments({ confidence: { $gte: 50 } });
    const lowConfidenceCount = await OCRResult.countDocuments({ confidence: { $lt: 50 } });
    
    // Get average confidence
    const avgConfidenceResult = await OCRResult.aggregate([
      { $group: { _id: null, avgConfidence: { $avg: '$confidence' } } }
    ]);
    
    const avgConfidence = avgConfidenceResult.length > 0 
      ? Math.round(avgConfidenceResult[0].avgConfidence * 10) / 10
      : 0;
    
    // Get recent processing times
    const recentResults = await OCRResult.find()
      .sort({ createdAt: -1 })
      .limit(10);
    
    return {
      totalProcessed: totalCount,
      successRate: totalCount > 0 ? (successCount / totalCount) * 100 : 0,
      averageConfidence: avgConfidence,
      lowConfidenceCount,
      recentResults: recentResults.map(result => ({
        analysisId: result.analysisId,
        confidence: result.confidence,
        textLength: result.text.length,
        processedAt: result.createdAt
      }))
    };
  } catch (error) {
    logger.error(`Error getting OCR statistics: ${error.message}`);
    throw error;
  }
};

module.exports = {
  processImage,
  getResults,
  getStatistics
}; 