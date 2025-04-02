/**
 * Settings Controller
 * 
 * Handles requests related to system settings and configuration.
 * Provides endpoints for retrieving and updating crawler settings.
 */

const logger = require('../../utils/logger');

// Mock settings
let settings = {
  crawler: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    maxRetries: 3,
    rateLimit: 2000, // milliseconds
    scrollTimeout: 30000,
    maxPages: 10,
    headless: true
  },
  ocr: {
    language: 'eng',
    minConfidence: 70
  },
  storage: {
    screenshotsPath: './data/screenshots',
    reportsPath: './data/reports'
  },
  ui: {
    refreshRate: 5000 // milliseconds
  }
};

// Default settings for reset
const defaultSettings = { ...settings };

/**
 * Get all settings
 */
exports.getSettings = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    logger.error(`Error getting settings: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get settings',
      error: error.message
    });
  }
};

/**
 * Update settings
 */
exports.updateSettings = async (req, res) => {
  try {
    const updates = req.body;
    
    // Validate updates
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }
    
    // Deep merge the updates into the current settings
    settings = deepMerge(settings, updates);
    
    logger.info('Settings updated');
    
    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      settings
    });
  } catch (error) {
    logger.error(`Error updating settings: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message
    });
  }
};

/**
 * Reset settings to defaults
 */
exports.resetToDefaults = async (req, res) => {
  try {
    settings = { ...defaultSettings };
    
    logger.info('Settings reset to defaults');
    
    res.status(200).json({
      success: true,
      message: 'Settings reset to defaults',
      settings
    });
  } catch (error) {
    logger.error(`Error resetting settings: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to reset settings',
      error: error.message
    });
  }
};

/**
 * Helper function to deep merge objects
 */
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] instanceof Object && key in target) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
} 