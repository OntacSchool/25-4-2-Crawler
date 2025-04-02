/**
 * Socket Manager Module
 * 
 * This module handles real-time communication between the server and client
 * using Socket.io. It broadcasts crawler updates, logs, and screenshots to
 * connected clients for visualization purposes.
 * 
 * The module manages:
 * - Socket.io server setup and configuration
 * - Event emission for crawler updates
 * - Real-time logging to connected clients
 * - Screenshot streaming
 * 
 * Relationships with other modules:
 * - Used by index.js for Socket.io initialization
 * - Used by crawlerService.js to broadcast crawler status
 * - Used by ocrService.js to broadcast OCR results
 * - Connected to the web UI for real-time updates
 */

const path = require('path');
const logger = require('./logger');

// Store for active socket connections
let io = null;
const activeConnections = new Set();

/**
 * Setup Socket.io handlers
 * 
 * @param {Object} socketIo - Socket.io server instance
 */
const setupSocketHandlers = (socketIo) => {
  try {
    io = socketIo;
    
    io.on('connection', (socket) => {
      const clientId = socket.id.substring(0, 8);
      logger.info(`New client connected: ${clientId}`);
      activeConnections.add(socket);
      
      // Send welcome message to client
      socket.emit('crawlerLog', {
        level: 'info',
        message: 'Connected to Web Crawler System'
      });
      
      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${clientId}`);
        activeConnections.delete(socket);
      });
      
      // Handle client crawl requests
      socket.on('startCrawl', (data) => {
        logger.info(`Client ${clientId} requested crawl: ${JSON.stringify(data)}`);
        // This will be handled by the API, but we log it here
      });
    });
    
    logger.info('Socket.io handlers initialized successfully');
  } catch (error) {
    logger.error(`Socket.io initialization error: ${error.message}`);
  }
};

/**
 * Broadcast crawler status update to all connected clients
 * 
 * @param {Object} statusData - Crawler status data
 */
const broadcastCrawlerUpdate = (statusData) => {
  if (!io) return;
  
  try {
    io.emit('crawlerUpdate', statusData);
    logger.debug(`Broadcasted crawler update: ${JSON.stringify(statusData)}`);
  } catch (error) {
    logger.error(`Error broadcasting crawler update: ${error.message}`);
  }
};

/**
 * Broadcast log entry to all connected clients
 * 
 * @param {string} level - Log level (info, warning, error)
 * @param {string} message - Log message
 * @param {Object} data - Additional log data
 */
const broadcastLog = (level, message, data = {}) => {
  if (!io) return;
  
  try {
    io.emit('crawlerLog', {
      level,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error broadcasting log: ${error.message}`);
  }
};

/**
 * Broadcast screenshot update to all connected clients
 * 
 * @param {string} crawlId - Crawler ID
 * @param {string} url - URL that was captured
 * @param {string} screenshotPath - Path to the screenshot file
 */
const broadcastScreenshot = (crawlId, url, screenshotPath) => {
  if (!io) return;
  
  try {
    // Convert local filesystem path to a web-accessible URL
    const screenshotUrl = `/api/crawler/${crawlId}/screenshots/${encodeURIComponent(path.basename(screenshotPath))}`;
    
    io.emit('screenshotUpdate', {
      crawlId,
      url,
      screenshotUrl,
      timestamp: new Date().toISOString()
    });
    
    logger.debug(`Broadcasted screenshot update for ${url}`);
  } catch (error) {
    logger.error(`Error broadcasting screenshot: ${error.message}`);
  }
};

/**
 * Get the number of connected clients
 * 
 * @returns {number} - Number of connected clients
 */
const getConnectionCount = () => {
  return activeConnections.size;
};

module.exports = {
  setupSocketHandlers,
  broadcastCrawlerUpdate,
  broadcastLog,
  broadcastScreenshot,
  getConnectionCount
}; 