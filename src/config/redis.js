/**
 * Redis Configuration Module
 * 
 * Handles the connection to Redis.
 * Provides functions to initialize and interact with the Redis client.
 */

const { createClient } = require('redis');
const logger = require('../utils/logger');

// Create Redis client
let redisClient = null;

/**
 * Initialize Redis connection
 * 
 * Creates and connects to a Redis client using the URL from environment variables.
 * 
 * @returns {Promise<Object>} Resolves to the Redis client
 */
const initializeRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = createClient({
      url: redisUrl
    });
    
    // Set up event handlers
    redisClient.on('error', (err) => {
      logger.error(`Redis Error: ${err.message}`);
    });
    
    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });
    
    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting');
    });
    
    redisClient.on('end', () => {
      logger.info('Redis client disconnected');
    });
    
    // Connect to Redis
    await redisClient.connect();
    
    // Test connection
    await redisClient.set('test_connection', 'successful');
    const result = await redisClient.get('test_connection');
    
    if (result === 'successful') {
      logger.info('Redis connection test successful');
    }
    
    return redisClient;
  } catch (error) {
    logger.error(`Failed to initialize Redis: ${error.message}`);
    throw error;
  }
};

/**
 * Get the Redis client instance
 * 
 * @returns {Object} Redis client
 * @throws {Error} If Redis client is not initialized
 */
const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
};

/**
 * Close the Redis connection
 * 
 * @returns {Promise<void>}
 */
const closeRedisConnection = async () => {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  try {
    await closeRedisConnection();
  } catch (error) {
    logger.error(`Error closing Redis connection: ${error.message}`);
  }
});

module.exports = {
  initializeRedis,
  getRedisClient,
  closeRedisConnection
}; 