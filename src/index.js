/**
 * Main Application Entry Point
 * 
 * This file initializes all key components of the web crawler system:
 * - Configures environment variables
 * - Sets up logging
 * - Connects to databases (MongoDB, Redis)
 * - Initializes the Express server for API endpoints
 * - Initializes the UI server
 * - Sets up error handlers and process event listeners
 * 
 * The application follows a modular architecture where each component
 * is responsible for a specific functionality and can be maintained independently.
 */

// Load environment variables
require('dotenv').config();

// Import core dependencies
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Import custom modules
const logger = require('./utils/logger');
const connectDB = require('./config/database');
const apiRoutes = require('./api/routes');
const setupTaskManager = require('./tasks/taskManager');
const { initializeRedis } = require('./config/redis');
const { setupSocketHandlers } = require('./utils/socketManager');

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Setup socket handlers
setupSocketHandlers(io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// API Routes
app.use('/api', apiRoutes);

// Create a simple dashboard HTML instead of serving from a build directory
app.get('/', (req, res) => {
  const dashboardHtml = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web Crawler Dashboard</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 0;
        color: #333;
        background-color: #f4f7f9;
      }
      .container {
        width: 80%;
        margin: 0 auto;
        padding: 20px;
      }
      header {
        background-color: #2c3e50;
        color: #fff;
        padding: 1rem;
        text-align: center;
      }
      .dashboard {
        display: flex;
        flex-wrap: wrap;
        margin-top: 20px;
      }
      .card {
        background-color: #fff;
        border-radius: 5px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        margin: 10px;
        padding: 20px;
        flex: 1 1 300px;
      }
      .api-section {
        background-color: #fff;
        border-radius: 5px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        margin: 20px 0;
        padding: 20px;
      }
      .endpoint {
        background-color: #f8f9fa;
        border-left: 4px solid #007bff;
        padding: 10px;
        margin: 10px 0;
      }
      h1, h2, h3 {
        color: #2c3e50;
      }
      button {
        background-color: #3498db;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      }
      button:hover {
        background-color: #2980b9;
      }
      pre {
        background-color: #f8f9fa;
        padding: 10px;
        border-radius: 5px;
        overflow-x: auto;
      }
      #crawler-viewer {
        background-color: #fff;
        border-radius: 5px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        margin: 20px 0;
        padding: 20px;
        height: 400px;
        overflow: auto;
      }
      #crawler-log {
        height: 200px;
        overflow-y: auto;
        background-color: #f8f9fa;
        padding: 10px;
        border-radius: 5px;
        font-family: monospace;
        margin-top: 10px;
      }
      .log-entry {
        margin: 2px 0;
        padding: 2px 5px;
        border-left: 3px solid #ddd;
      }
      .log-info {
        border-left-color: #3498db;
      }
      .log-error {
        border-left-color: #e74c3c;
      }
      .log-warning {
        border-left-color: #f39c12;
      }
      .screenshot-container {
        margin-top: 20px;
        text-align: center;
      }
      #crawler-screenshot {
        max-width: 100%;
        max-height: 300px;
        border: 1px solid #ddd;
        border-radius: 5px;
      }
    </style>
    <script src="/socket.io/socket.io.js"></script>
  </head>
  <body>
    <header>
      <h1>Web Crawler System Dashboard</h1>
    </header>
    <div class="container">
      <div class="dashboard">
        <div class="card">
          <h2>Crawler Status</h2>
          <p>Status: <span id="crawlerStatus">Idle</span></p>
          <p>Pages Crawled: <span id="pagesCrawled">0</span></p>
          <button onclick="startCrawler()">Start New Crawl</button>
        </div>
        <div class="card">
          <h2>OCR Analysis</h2>
          <p>Images Processed: <span id="imagesProcessed">0</span></p>
          <p>Keywords Extracted: <span id="keywordsExtracted">0</span></p>
        </div>
        <div class="card">
          <h2>System Stats</h2>
          <p>CPU Usage: <span id="cpuUsage">0%</span></p>
          <p>Memory Usage: <span id="memoryUsage">0 MB</span></p>
        </div>
      </div>
      
      <!-- Add crawler viewer section -->
      <div id="crawler-viewer">
        <h2>Crawler Live View</h2>
        <p>Real-time crawler activity visualization</p>
        
        <div id="crawler-log"></div>
        
        <div class="screenshot-container">
          <h3>Latest Screenshot</h3>
          <img id="crawler-screenshot" src="/api/crawler/placeholder.png" alt="No screenshot available">
        </div>
      </div>
      
      <div class="api-section">
        <h2>API Documentation</h2>
        
        <div class="endpoint">
          <h3>Start a Crawl</h3>
          <p>POST /api/crawler/start</p>
          <pre>
{
  "url": "https://example.com",
  "depth": 2,
  "keywords": ["example", "domain"]
}
          </pre>
        </div>
        
        <div class="endpoint">
          <h3>Get Tasks</h3>
          <p>GET /api/tasks</p>
        </div>
        
        <div class="endpoint">
          <h3>Get OCR Results</h3>
          <p>GET /api/ocr/results</p>
        </div>
      </div>
    </div>
    
    <script>
      // Connect to Socket.io
      const socket = io();
      
      // Listen for crawler updates
      socket.on('crawlerUpdate', (data) => {
        document.getElementById('crawlerStatus').textContent = data.status;
        document.getElementById('pagesCrawled').textContent = data.pagesProcessed || 0;
      });
      
      // Listen for new log entries
      socket.on('crawlerLog', (entry) => {
        const logContainer = document.getElementById('crawler-log');
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry log-' + entry.level;
        logEntry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + entry.message;
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
      });
      
      // Listen for screenshot updates
      socket.on('screenshotUpdate', (data) => {
        const screenshotImg = document.getElementById('crawler-screenshot');
        screenshotImg.src = data.screenshotUrl;
        screenshotImg.alt = 'Screenshot from ' + data.url;
      });
      
      // Simple frontend JavaScript to interact with the API
      async function startCrawler() {
        try {
          const response = await fetch('/api/crawler/start', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              url: 'https://example.com',
              depth: 2,
              keywords: ['example', 'domain']
            })
          });
          
          const data = await response.json();
          if (data.success) {
            document.getElementById('crawlerStatus').textContent = 'Running';
            alert('Crawler started successfully!');
          } else {
            alert('Failed to start crawler: ' + data.message);
          }
        } catch (error) {
          console.error('Error:', error);
          alert('Error starting crawler');
        }
      }
      
      // Fetch current stats
      async function fetchStats() {
        try {
          const response = await fetch('/api/stats');
          const data = await response.json();
          
          if (data.success) {
            document.getElementById('pagesCrawled').textContent = data.stats.pagesCrawled || 0;
            document.getElementById('imagesProcessed').textContent = data.stats.imagesProcessed || 0;
            document.getElementById('keywordsExtracted').textContent = data.stats.keywordsExtracted || 0;
            document.getElementById('crawlerStatus').textContent = data.stats.status || 'Idle';
          }
        } catch (error) {
          console.error('Error fetching stats:', error);
        }
      }
      
      // Update stats every 5 seconds
      setInterval(fetchStats, 5000);
    </script>
  </body>
  </html>
  `;
  
  res.send(dashboardHtml);
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize the application
const initializeApp = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    logger.info('MongoDB connected successfully');

    // Initialize Redis
    await initializeRedis();
    logger.info('Redis initialized successfully');

    // Setup task manager
    await setupTaskManager();
    logger.info('Task manager initialized successfully');

    // Start the server
    server.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Failed to initialize application: ${error.message}`);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  // Close server & exit process
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  // Close server & exit process
  process.exit(1);
});

// Initialize the application
initializeApp(); 