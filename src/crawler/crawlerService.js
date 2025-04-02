/**
 * Crawler Service Module
 * 
 * This module provides the core web crawling functionality using Playwright.
 * It handles browser automation, page navigation, content extraction,
 * screenshot capture, and error handling during crawling operations.
 * 
 * The service implements features like:
 * - Headless browser automation
 * - Infinite scrolling detection and handling
 * - Rate limiting and retry logic
 * - Screenshot capturing for OCR processing
 * - Browser session management
 * 
 * Relationships with other modules:
 * - Used by crawlerController.js to handle crawl API requests
 * - Uses ocrService.js to process captured screenshots
 * - Emits events to the task manager for crawl-related tasks
 * - Stores crawl data and logs in the database
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');
const ocrService = require('../ocr/ocrService');
const CrawlJob = require('../models/CrawlJob');
const aiAssistant = require('../utils/aiAssistant');

// In-memory storage for active crawl jobs
const activeCrawls = new Map();

/**
 * Start a new crawl job
 * 
 * @param {string} crawlId - Unique identifier for the crawl job
 * @param {string} url - URL to crawl
 * @param {number} depth - Crawl depth
 * @param {Object} options - Additional crawl options
 * @returns {Promise<Object>} - Crawl job information
 */
const startCrawl = async (crawlId, url, depth, options = {}) => {
  try {
    // Create crawl data directories if they don't exist
    const screenshotDir = path.join(process.cwd(), 'data', 'screenshots', crawlId);
    await fs.mkdir(screenshotDir, { recursive: true });
    
    // Initialize crawl job in database
    const crawlJob = new CrawlJob({
      _id: crawlId,
      url,
      depth,
      status: 'running',
      options,
      screenshotDir,
      startedAt: new Date(),
    });
    
    await crawlJob.save();
    
    // Configure browser options
    const browserOptions = {
      headless: false, // Run with visible browser
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1280,800',
        '--start-maximized',
        // Enable display forwarding for Docker
        '--display=' + (process.env.DISPLAY || ':99')
      ]
    };
    
    // Launch browser
    logger.info(`Launching browser for crawl job ${crawlId}`);
    const browser = await chromium.launch(browserOptions);
    
    // Create new context with custom user agent if provided
    const context = await browser.newContext({
      userAgent: options.userAgent || process.env.USER_AGENT,
      viewport: options.viewport || { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });
    
    // Add event listeners for page console and errors
    context.on('page', async (page) => {
      page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('error') || text.includes('exception')) {
          logger.error(`Console ${msg.type()} in crawl ${crawlId}: ${text}`);
        } else {
          logger.debug(`Console ${msg.type()} in crawl ${crawlId}: ${text}`);
        }
      });
      
      page.on('pageerror', (error) => {
        logger.error(`Page error in crawl ${crawlId}: ${error.message}`);
      });
    });
    
    // Store active crawl data
    activeCrawls.set(crawlId, {
      browser,
      context,
      status: 'running',
      url,
      depth,
      options,
      screenshotDir,
      pages: new Set(),
      errors: [],
      capturedScreenshots: [],
      startTime: Date.now()
    });
    
    // Begin the crawl process asynchronously
    processCrawl(crawlId, url, depth, options)
      .catch(async (error) => {
        logger.error(`Crawl job ${crawlId} failed: ${error.message}`);
        await updateCrawlStatus(crawlId, 'failed', error.message);
      });
    
    return { crawlId, status: 'running' };
  } catch (error) {
    logger.error(`Failed to start crawl job: ${error.message}`);
    throw error;
  }
};

/**
 * Main crawl processing function
 * 
 * @param {string} crawlId - Crawl job ID
 * @param {string} startUrl - Starting URL
 * @param {number} maxDepth - Maximum crawl depth
 * @param {Object} options - Crawl options
 */
const processCrawl = async (crawlId, startUrl, maxDepth, options) => {
  const crawlData = activeCrawls.get(crawlId);
  
  if (!crawlData) {
    throw new Error(`Crawl job ${crawlId} not found in active crawls`);
  }
  
  try {
    const { context } = crawlData;
    const visitedUrls = new Set();
    const urlQueue = [{ url: startUrl, depth: 0 }];
    const rateLimit = options.rateLimit || parseInt(process.env.RATE_LIMIT_MS) || 2000;
    
    // Create a page for the current crawl
    const page = await context.newPage();
    crawlData.pages.add(page);
    
    // Add event listener for progress tracking
    page.on('request', request => {
      if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
        logger.debug(`XHR/Fetch request in crawl ${crawlId}: ${request.url()}`);
      }
    });
    
    // Process URLs in the queue
    while (urlQueue.length > 0 && crawlData.status === 'running') {
      const { url, depth } = urlQueue.shift();
      
      // Skip if URL already visited or depth exceeds maximum
      if (visitedUrls.has(url) || depth > maxDepth) continue;
      
      // Mark as visited
      visitedUrls.add(url);
      
      try {
        logger.info(`Crawling URL: ${url} (depth: ${depth}/${maxDepth})`);
        
        // Navigate to URL with timeout
        await page.goto(url, { 
          waitUntil: 'networkidle',
          timeout: options.navigationTimeout || 30000
        });
        
        // Wait for page to stabilize
        await page.waitForLoadState('networkidle');
        
        // Handle infinite scrolling if needed
        if (options.handleInfiniteScroll !== false) {
          await handleInfiniteScroll(page, crawlId, options);
        }
        
        // Capture screenshot
        const screenshotPath = path.join(crawlData.screenshotDir, `${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        crawlData.capturedScreenshots.push(screenshotPath);
        
        // Process screenshot with OCR if enabled and not explicitly skipped
        if (options.performOcr !== false && options.skipOcr !== true) {
          try {
            await processScreenshotWithOCR(crawlId, screenshotPath, url);
          } catch (ocrError) {
            logger.warn(`OCR processing error for ${url}, continuing crawl: ${ocrError.message}`);
            // Don't fail the crawl if OCR fails
          }
        } else if (options.skipOcr === true) {
          logger.info(`Skipping OCR processing for ${url} as requested`);
          
          // Still broadcast the screenshot if possible
          try {
            const socketManager = require('../utils/socketManager');
            socketManager.broadcastScreenshot(crawlId, url, screenshotPath);
            socketManager.broadcastLog('info', `Screenshot captured for ${url} (OCR skipped)`, {
              url
            });
          } catch (socketError) {
            logger.warn(`Could not broadcast screenshot: ${socketError.message}`);
          }
        }
        
        // Extract links for next level if not at max depth
        if (depth < maxDepth) {
          const links = await extractLinks(page, startUrl);
          
          // Add new links to the queue
          for (const link of links) {
            urlQueue.push({ url: link, depth: depth + 1 });
          }
        }
        
        // Add page data to crawl job
        await CrawlJob.updateOne(
          { _id: crawlId },
          { 
            $push: { visitedUrls: url },
            $inc: { pagesProcessed: 1 }
          }
        );
        
        // Use AI to analyze page and suggest next steps
        if (options.useAI !== false) {
          const aiSuggestions = await aiAssistant.analyzePage({
            url,
            title: await page.title(),
            depth,
            crawlId
          });
          
          logger.info(`AI suggestions for ${url}: ${JSON.stringify(aiSuggestions)}`);
          
          // Apply AI suggestions if available
          if (aiSuggestions.priorityUrls && aiSuggestions.priorityUrls.length > 0) {
            // Add AI-suggested URLs with higher priority
            for (const priorityUrl of aiSuggestions.priorityUrls) {
              if (!visitedUrls.has(priorityUrl)) {
                urlQueue.unshift({ url: priorityUrl, depth: depth + 1 });
              }
            }
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, rateLimit));
      } catch (error) {
        logger.error(`Error processing URL ${url}: ${error.message}`);
        crawlData.errors.push({ url, error: error.message, timestamp: new Date() });
        
        // Update crawl job with error
        await CrawlJob.updateOne(
          { _id: crawlId },
          { 
            $push: { errors: { url, message: error.message, timestamp: new Date() } }
          }
        );
      }
    }
    
    // Crawl completed successfully
    await updateCrawlStatus(crawlId, 'completed');
    
  } catch (error) {
    logger.error(`Crawl process error: ${error.message}`);
    await updateCrawlStatus(crawlId, 'failed', error.message);
    throw error;
  } finally {
    // Clean up resources
    await cleanupCrawl(crawlId);
  }
};

/**
 * Handle infinite scrolling on a page
 * 
 * @param {Page} page - Playwright page object
 * @param {string} crawlId - Crawl ID for logging
 * @param {Object} options - Scroll options
 */
const handleInfiniteScroll = async (page, crawlId, options) => {
  const scrollTimeout = options.scrollTimeout || parseInt(process.env.SCROLL_TIMEOUT_MS) || 30000;
  const maxScrolls = options.maxScrolls || 10;
  
  logger.info(`Handling infinite scroll for crawl ${crawlId}`);
  
  let previousHeight = 0;
  let scrollCount = 0;
  let startTime = Date.now();
  
  while (scrollCount < maxScrolls && Date.now() - startTime < scrollTimeout) {
    // Get current scroll height
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    
    // If no change in height after scrolling, we've reached the bottom
    if (currentHeight === previousHeight) {
      logger.info(`Scroll completed: No more content to load after ${scrollCount} scrolls`);
      break;
    }
    
    // Scroll to bottom of page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Wait for any new content to load
    await page.waitForTimeout(1000);
    
    // Update tracking variables
    previousHeight = currentHeight;
    scrollCount++;
    
    logger.debug(`Scroll ${scrollCount}/${maxScrolls} completed for crawl ${crawlId}`);
  }
  
  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
};

/**
 * Extract links from a page
 * 
 * @param {Page} page - Playwright page object
 * @param {string} baseUrl - Base URL for resolving relative links
 * @returns {Promise<string[]>} - Array of absolute URLs
 */
const extractLinks = async (page, baseUrl) => {
  // Extract all links from the page
  const links = await page.evaluate((baseUrl) => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    return anchors
      .map(anchor => {
        try {
          // Convert to absolute URL
          return new URL(anchor.href, baseUrl).href;
        } catch (e) {
          return null;
        }
      })
      .filter(url => 
        // Filter valid URLs and same origin
        url && url.startsWith('http') && new URL(url).origin === new URL(baseUrl).origin
      );
  }, baseUrl);
  
  // Return unique links
  return [...new Set(links)];
};

/**
 * Process a screenshot with OCR
 * 
 * @param {string} crawlId - Crawl ID
 * @param {string} screenshotPath - Path to screenshot file
 * @param {string} url - URL that was captured
 * @returns {Promise<Object>} - OCR result data
 */
const processScreenshotWithOCR = async (crawlId, screenshotPath, url = '') => {
  try {
    // Import socketManager at the top of the file
    const socketManager = require('../utils/socketManager');
    
    logger.debug(`Processing screenshot with OCR: ${screenshotPath}`);
    
    // Broadcast status update
    socketManager.broadcastLog('info', `Processing screenshot with OCR`, { url });
    
    // Send screenshot to connected clients
    socketManager.broadcastScreenshot(crawlId, url, screenshotPath);
    
    try {
      // Process the screenshot with OCR service
      const ocrResult = await ocrService.processImage(screenshotPath, {
        crawlId,
        url,
        analysisId: require('uuid').v4()
      });
      
      if (!ocrResult) {
        logger.warn(`OCR processing returned no results for ${screenshotPath}`);
        return null;
      }
      
      if (ocrResult.error) {
        logger.warn(`OCR processing had an error: ${ocrResult.error}`);
        socketManager.broadcastLog('warn', `OCR processing had an error: ${ocrResult.error}`, { url });
        return null;
      }
      
      logger.info(`OCR completed for ${screenshotPath}: ${ocrResult.text.length} characters extracted`);
      
      // Broadcast OCR success
      socketManager.broadcastLog('info', `OCR completed: ${ocrResult.text.length} characters extracted`, {
        confidence: ocrResult.confidence || 0,
        url
      });
      
      // Store OCR result with the crawl job
      await CrawlJob.updateOne(
        { _id: crawlId },
        {
          $push: {
            ocrResults: {
              screenshotPath,
              ocrResultId: ocrResult.analysisId,
              confidence: ocrResult.confidence,
              timestamp: new Date()
            }
          }
        }
      );
      
      return ocrResult;
    } catch (ocrError) {
      logger.error(`OCR processing exception: ${ocrError.message}`);
      socketManager.broadcastLog('error', `OCR processing exception: ${ocrError.message}`);
      
      // Let the crawler continue despite OCR errors
      return {
        analysisId: require('uuid').v4(),
        text: "",
        confidence: 0,
        processed: false,
        error: ocrError.message
      };
    }
  } catch (error) {
    logger.error(`OCR processing error: ${error.message}`);
    // Broadcast error if possible, but don't fail if this fails too
    try {
      const socketManager = require('../utils/socketManager');
      socketManager.broadcastLog('error', `OCR processing failed: ${error.message}`);
    } catch (socketError) {
      logger.error(`Failed to broadcast OCR error: ${socketError.message}`);
    }
    
    // Return a minimal result to allow the crawler to continue
    return {
      analysisId: require('uuid').v4(),
      text: "",
      confidence: 0,
      processed: false,
      error: error.message
    };
  }
};

/**
 * Update crawl status
 * 
 * @param {string} crawlId - Crawl ID
 * @param {string} status - New status
 * @param {string} errorMessage - Optional error message for failed status
 */
const updateCrawlStatus = async (crawlId, status, errorMessage = null) => {
  try {
    // Import socketManager at the top of the file
    const socketManager = require('../utils/socketManager');
    
    logger.info(`Updating crawl ${crawlId} status to ${status}`);
    
    const updateData = {
      status,
      ...(status === 'completed' ? { completedAt: new Date() } : {}),
      ...(status === 'failed' ? { failedAt: new Date(), errorMessage } : {}),
      ...(status === 'paused' ? { pausedAt: new Date() } : {}),
      ...(status === 'stopped' ? { stoppedAt: new Date() } : {})
    };
    
    if (status === 'completed' || status === 'failed' || status === 'stopped') {
      // Calculate duration if completing the crawl
      const crawlJob = await CrawlJob.findById(crawlId);
      if (crawlJob && crawlJob.startedAt) {
        const endTime = new Date();
        const duration = endTime - crawlJob.startedAt;
        updateData.duration = duration;
      }
    }
    
    // Update the crawl job in the database
    await CrawlJob.updateOne({ _id: crawlId }, updateData);
    
    // If the crawl is still active, update the in-memory data
    const crawlData = activeCrawls.get(crawlId);
    if (crawlData) {
      crawlData.status = status;
      
      if (errorMessage) {
        crawlData.errors.push({
          message: errorMessage,
          timestamp: new Date()
        });
      }
    }
    
    // Broadcast status update to connected clients
    socketManager.broadcastCrawlerUpdate({
      crawlId,
      status,
      timestamp: new Date().toISOString(),
      errorMessage: errorMessage || undefined
    });
    
    // Log status change
    const logLevel = status === 'failed' ? 'error' : 'info';
    const statusMessage = `Crawl ${crawlId} ${status}` + (errorMessage ? `: ${errorMessage}` : '');
    socketManager.broadcastLog(logLevel, statusMessage);
    
  } catch (error) {
    logger.error(`Error updating crawl status: ${error.message}`);
  }
};

/**
 * Clean up resources for a completed or failed crawl
 * 
 * @param {string} crawlId - Crawl ID
 */
const cleanupCrawl = async (crawlId) => {
  try {
    const crawlData = activeCrawls.get(crawlId);
    
    if (crawlData) {
      // Close all pages
      for (const page of crawlData.pages) {
        await page.close().catch(err => logger.error(`Error closing page: ${err.message}`));
      }
      
      // Close browser context and browser
      if (crawlData.context) {
        await crawlData.context.close().catch(err => logger.error(`Error closing context: ${err.message}`));
      }
      
      if (crawlData.browser) {
        await crawlData.browser.close().catch(err => logger.error(`Error closing browser: ${err.message}`));
      }
      
      // Calculate final statistics
      const duration = Date.now() - crawlData.startTime;
      const screenshotCount = crawlData.capturedScreenshots.length;
      const errorCount = crawlData.errors.length;
      
      // Update final statistics in database
      await CrawlJob.updateOne(
        { _id: crawlId },
        {
          duration,
          screenshotCount,
          errorCount
        }
      );
      
      // Remove from active crawls
      activeCrawls.delete(crawlId);
      
      logger.info(`Cleaned up resources for crawl ${crawlId}`);
    }
  } catch (error) {
    logger.error(`Error during crawl cleanup: ${error.message}`);
  }
};

/**
 * Get the status of a crawl job
 * 
 * @param {string} crawlId - Crawl ID
 * @returns {Promise<Object|null>} - Crawl status or null if not found
 */
const getCrawlStatus = async (crawlId) => {
  try {
    // Check active crawls first
    const activeCrawl = activeCrawls.get(crawlId);
    
    if (activeCrawl) {
      return {
        crawlId,
        url: activeCrawl.url,
        status: activeCrawl.status,
        pagesProcessed: activeCrawl.visitedUrls?.size || 0,
        screenshotCount: activeCrawl.capturedScreenshots.length,
        errorCount: activeCrawl.errors.length,
        startTime: activeCrawl.startTime,
        duration: Date.now() - activeCrawl.startTime,
        isActive: true
      };
    }
    
    // Check database for completed crawls
    const crawlJob = await CrawlJob.findById(crawlId);
    
    if (!crawlJob) {
      return null;
    }
    
    return {
      crawlId: crawlJob._id,
      url: crawlJob.url,
      status: crawlJob.status,
      pagesProcessed: crawlJob.visitedUrls?.length || 0,
      screenshotCount: crawlJob.screenshotCount || 0,
      errorCount: crawlJob.errorCount || 0,
      startTime: crawlJob.startedAt,
      completedAt: crawlJob.completedAt,
      failedAt: crawlJob.failedAt,
      duration: crawlJob.duration,
      errorMessage: crawlJob.errorMessage,
      isActive: false
    };
  } catch (error) {
    logger.error(`Error getting crawl status: ${error.message}`);
    throw error;
  }
};

/**
 * Pause a running crawl job
 * 
 * @param {string} crawlId - Crawl ID
 * @returns {Promise<boolean>} - True if paused, false if not found or not running
 */
const pauseCrawl = async (crawlId) => {
  try {
    const crawlData = activeCrawls.get(crawlId);
    
    if (!crawlData || crawlData.status !== 'running') {
      return false;
    }
    
    // Update status
    crawlData.status = 'paused';
    
    // Update in database
    await CrawlJob.updateOne(
      { _id: crawlId },
      { status: 'paused', pausedAt: new Date() }
    );
    
    logger.info(`Paused crawl job ${crawlId}`);
    return true;
  } catch (error) {
    logger.error(`Error pausing crawl: ${error.message}`);
    throw error;
  }
};

/**
 * Resume a paused crawl job
 * 
 * @param {string} crawlId - Crawl ID
 * @returns {Promise<boolean>} - True if resumed, false if not found or not paused
 */
const resumeCrawl = async (crawlId) => {
  try {
    const crawlData = activeCrawls.get(crawlId);
    
    if (!crawlData || crawlData.status !== 'paused') {
      return false;
    }
    
    // Update status
    crawlData.status = 'running';
    
    // Update in database
    await CrawlJob.updateOne(
      { _id: crawlId },
      { status: 'running', resumedAt: new Date() }
    );
    
    // Resume crawl process
    processCrawl(crawlId, crawlData.url, crawlData.depth, crawlData.options)
      .catch(async (error) => {
        logger.error(`Resumed crawl job ${crawlId} failed: ${error.message}`);
        await updateCrawlStatus(crawlId, 'failed', error.message);
      });
    
    logger.info(`Resumed crawl job ${crawlId}`);
    return true;
  } catch (error) {
    logger.error(`Error resuming crawl: ${error.message}`);
    throw error;
  }
};

/**
 * Stop a crawl job
 * 
 * @param {string} crawlId - Crawl ID
 * @returns {Promise<boolean>} - True if stopped, false if not found
 */
const stopCrawl = async (crawlId) => {
  try {
    const crawlData = activeCrawls.get(crawlId);
    
    if (!crawlData) {
      return false;
    }
    
    // Update status
    crawlData.status = 'stopped';
    
    // Update in database
    await CrawlJob.updateOne(
      { _id: crawlId },
      { status: 'stopped', stoppedAt: new Date() }
    );
    
    // Clean up resources
    await cleanupCrawl(crawlId);
    
    logger.info(`Stopped crawl job ${crawlId}`);
    return true;
  } catch (error) {
    logger.error(`Error stopping crawl: ${error.message}`);
    throw error;
  }
};

/**
 * Get logs for a crawl job
 * 
 * @param {string} crawlId - Crawl ID
 * @param {number} limit - Maximum number of log entries to return
 * @param {number} offset - Number of log entries to skip
 * @returns {Promise<Object[]|null>} - Array of log entries or null if not found
 */
const getCrawlLogs = async (crawlId, limit = 100, offset = 0) => {
  try {
    const crawlJob = await CrawlJob.findById(crawlId);
    
    if (!crawlJob) {
      return null;
    }
    
    // Combine logs from various sources
    const logs = [
      // Visited URLs as info logs
      ...(crawlJob.visitedUrls || []).map(url => ({
        level: 'info',
        message: `Visited URL: ${url}`,
        timestamp: new Date(), // Exact timestamp not available
        type: 'url'
      })),
      
      // Errors as error logs
      ...(crawlJob.errors || []).map(error => ({
        level: 'error',
        message: `Error at ${error.url}: ${error.message}`,
        timestamp: error.timestamp,
        type: 'error'
      })),
      
      // OCR results as info logs
      ...(crawlJob.ocrResults || []).map(result => ({
        level: 'info',
        message: `OCR processed: ${path.basename(result.screenshotPath)}`,
        timestamp: result.timestamp,
        type: 'ocr',
        details: {
          analysisId: result.analysisId,
          textLength: result.text?.length || 0,
          confidence: result.confidence
        }
      }))
    ];
    
    // Sort by timestamp (newest first)
    logs.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply pagination
    return logs.slice(offset, offset + limit);
  } catch (error) {
    logger.error(`Error getting crawl logs: ${error.message}`);
    throw error;
  }
};

/**
 * Get the latest screenshot from a crawl job
 * 
 * @param {string} crawlId - Crawl ID
 * @returns {Promise<Buffer|null>} - Screenshot buffer or null if not found
 */
const getLatestScreenshot = async (crawlId) => {
  try {
    // Check active crawls first
    const activeCrawl = activeCrawls.get(crawlId);
    
    if (activeCrawl && activeCrawl.capturedScreenshots.length > 0) {
      const latestScreenshotPath = activeCrawl.capturedScreenshots[activeCrawl.capturedScreenshots.length - 1];
      return await fs.readFile(latestScreenshotPath);
    }
    
    // Check database for completed crawls
    const crawlJob = await CrawlJob.findById(crawlId);
    
    if (!crawlJob || !crawlJob.screenshotDir) {
      return null;
    }
    
    // Get all screenshots in the directory
    const files = await fs.readdir(crawlJob.screenshotDir);
    
    if (files.length === 0) {
      return null;
    }
    
    // Sort by filename (timestamp) and get the latest
    files.sort();
    const latestScreenshot = files[files.length - 1];
    
    return await fs.readFile(path.join(crawlJob.screenshotDir, latestScreenshot));
  } catch (error) {
    logger.error(`Error getting latest screenshot: ${error.message}`);
    throw error;
  }
};

module.exports = {
  startCrawl,
  getCrawlStatus,
  pauseCrawl,
  resumeCrawl,
  stopCrawl,
  getCrawlLogs,
  getLatestScreenshot
}; 