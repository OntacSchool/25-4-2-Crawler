/**
 * OCR Controller
 * 
 * Handles requests related to OCR (Optical Character Recognition) functionality.
 * Provides endpoints for image analysis and keyword extraction.
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

// Mock storage for OCR jobs
const ocrJobs = new Map();

// Mock extracted keywords
const extractedKeywords = [
  { keyword: 'example', count: 12, sources: ['page1.jpg', 'page2.jpg'] },
  { keyword: 'test', count: 8, sources: ['page1.jpg'] },
  { keyword: 'sample', count: 5, sources: ['page3.jpg'] }
];

/**
 * Analyze an image using OCR
 */
exports.analyzeImage = async (req, res) => {
  try {
    // In a real implementation, we would get the image from the request
    // For now, we'll just simulate an analysis
    
    const ocrId = uuidv4();
    
    // Create a new OCR job
    const job = {
      id: ocrId,
      status: 'completed',
      created: new Date(),
      results: {
        text: 'This is example text extracted from the image',
        confidence: 95,
        keywords: ['example', 'text']
      }
    };
    
    // Store the job
    ocrJobs.set(ocrId, job);
    
    logger.info(`OCR analysis completed for job ${ocrId}`);
    
    res.status(200).json({
      success: true,
      message: 'OCR analysis completed',
      ocrId,
      results: job.results
    });
  } catch (error) {
    logger.error(`Error analyzing image: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze image',
      error: error.message
    });
  }
};

/**
 * Get OCR results for a specific job
 */
exports.getOCRResults = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if the job exists
    if (!ocrJobs.has(id)) {
      return res.status(404).json({
        success: false,
        message: 'OCR job not found'
      });
    }
    
    const job = ocrJobs.get(id);
    
    res.status(200).json({
      success: true,
      results: job.results
    });
  } catch (error) {
    logger.error(`Error getting OCR results: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get OCR results',
      error: error.message
    });
  }
};

/**
 * Get all extracted keywords
 */
exports.getExtractedKeywords = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      keywords: extractedKeywords
    });
  } catch (error) {
    logger.error(`Error getting extracted keywords: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get extracted keywords',
      error: error.message
    });
  }
}; 