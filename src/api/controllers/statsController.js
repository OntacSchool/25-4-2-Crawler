/**
 * Stats Controller
 * 
 * Handles requests related to system statistics and monitoring.
 * Provides endpoints for retrieving overall system performance,
 * crawler statistics, and keyword analysis data.
 */

const os = require('os');

// Mock data for demonstration since we don't have actual stats yet
let mockStats = {
  crawler: {
    status: 'Idle',
    pagesCrawled: 0,
    imagesProcessed: 0,
    keywordsExtracted: 0,
    lastCrawlTime: null
  },
  system: {
    uptime: 0,
    cpuUsage: '0%',
    memoryUsage: '0 MB'
  }
};

/**
 * Get an overall summary of the system stats
 */
exports.getSummary = async (req, res) => {
  try {
    // Update system stats
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsage = ((totalMem - freeMem) / totalMem) * 100;
    
    mockStats.system = {
      uptime: Math.floor(process.uptime()),
      cpuUsage: `${Math.floor(Math.random() * 10)}%`, // Simplified CPU usage calculation
      memoryUsage: `${Math.floor((totalMem - freeMem) / 1024 / 1024)} MB`
    };

    res.status(200).json({
      success: true,
      stats: {
        ...mockStats.crawler,
        ...mockStats.system
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve system stats',
      error: error.message
    });
  }
};

/**
 * Get detailed performance metrics
 */
exports.getPerformanceMetrics = async (req, res) => {
  try {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    res.status(200).json({
      success: true,
      metrics: {
        cpuCount: cpus.length,
        loadAverage: loadAvg,
        freeMemory: `${Math.floor(os.freemem() / 1024 / 1024)} MB`,
        totalMemory: `${Math.floor(os.totalmem() / 1024 / 1024)} MB`,
        uptime: os.uptime()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve performance metrics',
      error: error.message
    });
  }
};

/**
 * Get keyword statistics
 */
exports.getKeywordStats = async (req, res) => {
  try {
    // Mock keyword data
    const keywords = [
      { keyword: 'example', count: 12, sites: 3 },
      { keyword: 'test', count: 8, sites: 2 },
      { keyword: 'sample', count: 5, sites: 1 }
    ];
    
    res.status(200).json({
      success: true,
      keywords
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve keyword stats',
      error: error.message
    });
  }
};

/**
 * Simple endpoint for the dashboard
 */
exports.getStats = async (req, res) => {
  try {
    // Increment the stats a bit each time for demo purposes
    if (Math.random() > 0.7) {
      mockStats.crawler.pagesCrawled += Math.floor(Math.random() * 3);
      mockStats.crawler.imagesProcessed += Math.floor(Math.random() * 2);
      mockStats.crawler.keywordsExtracted += Math.floor(Math.random() * 5);
    }
    
    res.status(200).json({
      success: true,
      stats: mockStats.crawler
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve stats',
      error: error.message
    });
  }
}; 