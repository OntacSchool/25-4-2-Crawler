/**
 * Database Configuration Module
 * 
 * Handles the connection to MongoDB.
 * Provides a function to connect to the database with proper error handling.
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Connect to MongoDB
 * 
 * Establishes a connection to the MongoDB database using the URI from
 * environment variables.
 * 
 * @returns {Promise} Resolves when the connection is established
 */
const connectDB = async () => {
  const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/crawler';
  
  try {
    // Configure mongoose
    mongoose.set('strictQuery', false);
    
    // Create connection
    const conn = await mongoose.connect(dbUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`MongoDB Connection Error: ${error.message}`);
    throw error;
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error(`MongoDB error: ${err.message}`);
});

// Handle process termination
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed due to app termination');
    process.exit(0);
  } catch (error) {
    logger.error(`Error closing MongoDB connection: ${error.message}`);
    process.exit(1);
  }
});

module.exports = connectDB; 