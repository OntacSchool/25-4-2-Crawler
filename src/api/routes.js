/**
 * API Routes Module
 * 
 * This module defines all REST API endpoints for the web crawler system.
 * It organizes routes by feature and delegates request handling to appropriate controllers.
 * 
 * Routes structure:
 * - /api/crawler: Crawler related operations
 * - /api/ocr: OCR processing operations
 * - /api/tasks: Task management operations
 * - /api/stats: Statistics and monitoring
 * - /api/settings: System settings
 * 
 * Relationships with other modules:
 * - Registered in the main application (index.js)
 * - Uses controller modules to handle request logic
 * - Protected by authentication middleware where needed
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Import controllers
const crawlerController = require('./controllers/crawlerController');
const ocrController = require('./controllers/ocrController');
const taskController = require('./controllers/taskController');
const statsController = require('./controllers/statsController');
const settingsController = require('./controllers/settingsController');

// Import middleware
const { validateCrawlRequest } = require('./middleware/validation');

// Crawler routes
router.post('/crawler/start', validateCrawlRequest, crawlerController.startCrawl);
router.get('/crawler/:id/status', crawlerController.getCrawlStatus);
router.put('/crawler/:id/pause', crawlerController.pauseCrawl);
router.put('/crawler/:id/resume', crawlerController.resumeCrawl);
router.put('/crawler/:id/stop', crawlerController.stopCrawl);
router.get('/crawler/:id/logs', crawlerController.getCrawlLogs);
router.get('/crawler/:id/screenshots/:filename', crawlerController.getScreenshot);

// Serve placeholder image for screenshots
router.get('/crawler/placeholder.png', (req, res) => {
  const placeholderPath = path.join(process.cwd(), 'assets', 'placeholder.png');
  
  // Check if placeholder exists
  fs.access(placeholderPath, fs.constants.F_OK)
    .then(() => {
      // Placeholder exists, serve it
      res.sendFile(placeholderPath);
    })
    .catch(() => {
      // Placeholder doesn't exist, create a simple gray image as data URL
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
        <rect width="600" height="400" fill="#f0f0f0" />
        <text x="300" y="200" font-family="Arial" font-size="20" text-anchor="middle" fill="#999">
          No Screenshot Available
        </text>
      </svg>`;
      
      const buffer = Buffer.from(svg);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(buffer);
    });
});

// OCR routes
router.get('/ocr/results', ocrController.getOCRResults);
router.get('/ocr/results/:id', ocrController.getOCRResults);
router.get('/ocr/keywords', ocrController.getExtractedKeywords);

// Task routes
router.get('/tasks', taskController.getAllTasks);
router.get('/tasks/category/:category', taskController.getTasksByCategory);
router.get('/tasks/:id', taskController.getTaskById);
router.post('/tasks', taskController.createTask);
router.put('/tasks/:id', taskController.updateTask);
router.delete('/tasks/:id', taskController.deleteTask);

// Stats routes
router.get('/stats', statsController.getSystemStats);

// Settings routes
router.get('/settings', settingsController.getSettings);
router.put('/settings', settingsController.updateSettings);

// System health check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router; 