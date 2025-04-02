/**
 * API Validation Middleware
 * 
 * This module provides request validation functions for API endpoints.
 * It ensures that incoming requests contain all required fields with valid data
 * before they are processed by controllers.
 * 
 * The validation functions use a consistent error response format and
 * detailed error messages to assist API clients in resolving validation issues.
 * 
 * Relationships with other modules:
 * - Used by the routes.js module to validate incoming requests
 * - Can be extended with additional validation functions as needed
 */

const logger = require('../../utils/logger');

/**
 * Validate a crawl request
 * Ensures the request contains the required fields and that they are valid.
 */
const validateCrawlRequest = (req, res, next) => {
  const { url, depth, keywords } = req.body;
  
  // Validate URL
  if (!url) {
    return res.status(400).json({
      success: false,
      message: 'URL is required'
    });
  }
  
  // Basic URL validation
  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid URL format'
    });
  }
  
  // Validate depth if provided
  if (depth !== undefined) {
    const depthNum = Number(depth);
    if (isNaN(depthNum) || depthNum < 1 || depthNum > 10) {
      return res.status(400).json({
        success: false,
        message: 'Depth must be a number between 1 and 10'
      });
    }
  }
  
  // Validate keywords if provided
  if (keywords !== undefined && !Array.isArray(keywords)) {
    return res.status(400).json({
      success: false,
      message: 'Keywords must be an array'
    });
  }
  
  // If validation passes, proceed to the next middleware
  next();
};

/**
 * Validates a task creation/update request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateTaskRequest = (req, res, next) => {
  const { title, description, priority } = req.body;
  const errors = [];

  // Check if title is provided
  if (!title) {
    errors.push('Task title is required');
  } else if (typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Task title must be a non-empty string');
  }

  // Check priority if provided
  if (priority !== undefined) {
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(priority)) {
      errors.push(`Priority must be one of: ${validPriorities.join(', ')}`);
    }
  }

  // If there are validation errors, return a 400 response
  if (errors.length > 0) {
    logger.warn(`Task validation failed: ${errors.join(', ')}`);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  // If validation passes, proceed to the next middleware
  next();
};

/**
 * Checks if a string is a valid URL
 * 
 * @param {string} string - The string to check
 * @returns {boolean} - True if the string is a valid URL, false otherwise
 */
const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  validateCrawlRequest,
  validateTaskRequest
}; 