/**
 * Crawler Controller
 * 
 * Handles API requests related to the crawler functionality.
 * Provides endpoints for starting, pausing, resuming, stopping, and monitoring crawl jobs.
 * Integrates with the crawler service and provides real-time feedback via socket.io.
 * 
 * Relationships with other modules:
 * - Consumes services from crawlerService.js for actual crawling operations
 * - Uses socketManager.js for real-time updates to clients
 * - Integrates with aiAssistant.js for intelligent crawling
 * - Provides API endpoints used by the web UI
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../../utils/logger');
const crawlerService = require('../../crawler/crawlerService');
const aiAssistant = require('../../utils/aiAssistant');
const socketManager = require('../../utils/socketManager');

/**
 * Start a new crawl job
 */
exports.startCrawl = async (req, res) => {
  try {
    const { url, depth, keywords, options = {} } = req.body;
    
    // Generate a unique ID for this crawl job
    const crawlId = uuidv4();
    
    // Create screenshot directory if it doesn't exist
    const screenshotDir = path.join(process.cwd(), 'data', 'screenshots', crawlId);
    await fs.mkdir(screenshotDir, { recursive: true });
    
    // Log the start of crawl job
    logger.info(`Starting crawl job ${crawlId} for URL: ${url}`);
    socketManager.broadcastLog('info', `Starting new crawl of ${url} (depth: ${depth || 2})`);
    
    // Use AI to plan crawl strategy
    let crawlOptions = { ...options };
    
    try {
      const aiPlan = await aiAssistant.planCrawlStrategy(url, {
        keywords,
        depth
      });
      
      // If AI planning was successful, apply the suggestions
      if (aiPlan.success) {
        crawlOptions = {
          ...crawlOptions,
          userAgent: aiPlan.crawlParameters?.userAgent || options.userAgent,
          rateLimit: aiPlan.crawlParameters?.rateLimit || options.rateLimit,
          maxScrolls: aiPlan.crawlParameters?.maxScrolls || options.maxScrolls,
          priorityPaths: aiPlan.priorityPaths || [],
          useAI: true
        };
        
        // Share AI insights with users
        socketManager.broadcastLog('info', `AI Strategy: ${aiPlan.siteType} site detected`, { 
          expectedAdLocations: aiPlan.expectedAdLocations 
        });
      }
    } catch (error) {
      logger.warn(`AI crawl planning failed: ${error.message}`);
      socketManager.broadcastLog('warning', 'AI planning failed, using default crawl strategy');
    }
    
    // Start the crawl job
    const jobInfo = await crawlerService.startCrawl(
      crawlId,
      url,
      parseInt(depth) || 2,
      {
        ...crawlOptions,
        keywords: keywords || [],
        screenshotDir
      }
    );
    
    // Set up crawl progress monitoring
    monitorCrawlProgress(crawlId);
    
    res.status(200).json({
      success: true,
      message: 'Crawl job started successfully',
      crawlId,
      jobInfo
    });
  } catch (error) {
    logger.error(`Error starting crawl: ${error.message}`);
    socketManager.broadcastLog('error', `Failed to start crawl: ${error.message}`);
    
    res.status(500).json({
      success: false,
      message: 'Failed to start crawl job',
      error: error.message
    });
  }
};

/**
 * Monitor crawl progress and broadcast updates
 * 
 * @param {string} crawlId - Crawl job ID
 */
const monitorCrawlProgress = (crawlId) => {
  // Initial delay before starting to monitor
  setTimeout(async () => {
    const intervalId = setInterval(async () => {
      try {
        // Get current status
        const status = await crawlerService.getCrawlStatus(crawlId);
        
        if (!status) {
          // Crawl job not found, stop monitoring
          clearInterval(intervalId);
          return;
        }
        
        // Broadcast status update
        socketManager.broadcastCrawlerUpdate(status);
        
        // If the crawl is complete or failed, generate reflection and stop monitoring
        if (['completed', 'failed', 'stopped'].includes(status.status)) {
          clearInterval(intervalId);
          
          // Get the latest screenshot for the final view
          try {
            const latestScreenshot = await crawlerService.getLatestScreenshot(crawlId);
            if (latestScreenshot) {
              socketManager.broadcastScreenshot(
                crawlId,
                latestScreenshot.url || '',
                latestScreenshot.path || latestScreenshot
              );
            }
          } catch (screenshotError) {
            logger.error(`Error getting final screenshot: ${screenshotError.message}`);
          }
          
          // Generate AI reflection on the crawl
          try {
            const reflection = await aiAssistant.reflectOnCrawl({
              crawlId,
              pagesProcessed: status.pagesProcessed,
              visitedUrls: status.visitedUrls || [],
              errors: status.errors || []
            });
            
            if (reflection && reflection.success) {
              socketManager.broadcastLog('info', 'AI Crawl Analysis:', { 
                evaluation: reflection.progressEvaluation,
                suggestions: reflection.strategySuggestions,
                issues: reflection.potentialIssues
              });
            }
          } catch (reflectionError) {
            logger.error(`Error generating crawl reflection: ${reflectionError.message}`);
            // Don't let the error stop monitoring
          }
        }
      } catch (error) {
        logger.error(`Error monitoring crawl ${crawlId}: ${error.message}`);
        // Don't stop the interval on error - it will try again next time
      }
    }, 2000); // Update every 2 seconds
  }, 1000); // Start monitoring after 1 second
};

/**
 * Get the status of a crawl job
 */
exports.getCrawlStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get status from crawler service
    const status = await crawlerService.getCrawlStatus(id);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Crawl job not found'
      });
    }
    
    res.status(200).json({
      success: true,
      status
    });
  } catch (error) {
    logger.error(`Error getting crawl status: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get crawl status',
      error: error.message
    });
  }
};

/**
 * Pause a running crawl job
 */
exports.pauseCrawl = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Pause the crawl job
    const success = await crawlerService.pauseCrawl(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Crawl job not found or not running'
      });
    }
    
    logger.info(`Paused crawl job ${id}`);
    socketManager.broadcastLog('info', `Crawl job ${id} paused`);
    
    res.status(200).json({
      success: true,
      message: 'Crawl job paused successfully'
    });
  } catch (error) {
    logger.error(`Error pausing crawl: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to pause crawl job',
      error: error.message
    });
  }
};

/**
 * Resume a paused crawl job
 */
exports.resumeCrawl = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Resume the crawl job
    const success = await crawlerService.resumeCrawl(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Crawl job not found or not paused'
      });
    }
    
    logger.info(`Resumed crawl job ${id}`);
    socketManager.broadcastLog('info', `Crawl job ${id} resumed`);
    
    // Resume monitoring
    monitorCrawlProgress(id);
    
    res.status(200).json({
      success: true,
      message: 'Crawl job resumed successfully'
    });
  } catch (error) {
    logger.error(`Error resuming crawl: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to resume crawl job',
      error: error.message
    });
  }
};

/**
 * Stop a crawl job
 */
exports.stopCrawl = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Stop the crawl job
    const success = await crawlerService.stopCrawl(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Crawl job not found'
      });
    }
    
    logger.info(`Stopped crawl job ${id}`);
    socketManager.broadcastLog('info', `Crawl job ${id} stopped`);
    
    res.status(200).json({
      success: true,
      message: 'Crawl job stopped successfully'
    });
  } catch (error) {
    logger.error(`Error stopping crawl: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to stop crawl job',
      error: error.message
    });
  }
};

/**
 * Get logs for a crawl job
 */
exports.getCrawlLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    // Get logs from crawler service
    const logs = await crawlerService.getCrawlLogs(id, limit, offset);
    
    if (!logs) {
      return res.status(404).json({
        success: false,
        message: 'Crawl job not found'
      });
    }
    
    res.status(200).json({
      success: true,
      logs
    });
  } catch (error) {
    logger.error(`Error getting crawl logs: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get crawl logs',
      error: error.message
    });
  }
};

/**
 * Get a screenshot from a crawl job
 */
exports.getScreenshot = async (req, res) => {
  try {
    const { id, filename } = req.params;
    
    // Construct path to screenshot
    const screenshotPath = path.join(process.cwd(), 'data', 'screenshots', id, filename);
    
    // Check if file exists
    try {
      await fs.access(screenshotPath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Screenshot not found'
      });
    }
    
    // Send file
    res.sendFile(screenshotPath);
  } catch (error) {
    logger.error(`Error getting screenshot: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get screenshot',
      error: error.message
    });
  }
}; 