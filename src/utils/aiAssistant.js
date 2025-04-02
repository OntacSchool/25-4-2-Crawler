/**
 * AI Assistant Module
 * 
 * This module provides integration with Google's Gemini API for AI-powered features
 * throughout the crawler system. It enables intelligent decision making, content analysis,
 * and natural language processing capabilities.
 * 
 * The module handles:
 * - Text generation and completion
 * - Page content analysis
 * - Keyword extraction and categorization
 * - Decision making for crawl strategies
 * 
 * Relationships with other modules:
 * - Used by crawlerService.js for intelligent crawling decisions
 * - Used by keywordService.js for AI-powered keyword extraction
 * - Used by taskManager.js for task automation
 */

const axios = require('axios');
const logger = require('./logger');

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.0-flash';

/**
 * Generate text using Gemini AI
 * 
 * @param {string} prompt - The text prompt for generation
 * @param {Object} options - Configuration options
 * @returns {Promise<string>} - Generated text
 */
const generateText = async (prompt, options = {}) => {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    
    const model = options.model || DEFAULT_MODEL;
    const apiUrl = `${GEMINI_API_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await axios.post(apiUrl, {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: options.temperature !== undefined ? options.temperature : 0.5,
        maxOutputTokens: options.maxOutputTokens || 1024,
        topP: options.topP || 0.9,
        topK: options.topK || 40
      }
    });
    
    if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
      throw new Error('No response from Gemini API');
    }
    
    // Extract the text from the response
    let generatedText = '';
    const candidate = response.data.candidates[0];
    if (candidate.content && candidate.content.parts) {
      generatedText = candidate.content.parts
        .filter(part => part.text)
        .map(part => part.text)
        .join('\n');
    }
    
    return generatedText;
  } catch (error) {
    logger.error(`Gemini API error: ${error.message}`);
    if (error.response) {
      logger.error(`Gemini API response error: ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`AI generation failed: ${error.message}`);
  }
};

/**
 * Analyze a webpage to extract insights
 * 
 * @param {Object} pageData - Information about the page
 * @returns {Promise<Object>} - Analysis results
 */
const analyzePage = async (pageData) => {
  try {
    if (!GEMINI_API_KEY) {
      logger.warn('GEMINI_API_KEY not configured, skipping page analysis');
      return { success: false, reason: 'AI not configured' };
    }
    
    const { url, title, depth, crawlId } = pageData;
    
    const prompt = `
    Analyze this webpage information:
    URL: ${url}
    Title: ${title}
    Current Depth: ${depth}
    
    As a web crawler focusing on ad assets and marketing content, provide insights on:
    1. How relevant is this page for marketing/ad analysis?
    2. What specific sections or elements should I focus on?
    3. Are there any URLs on this page that likely contain valuable ad content?
    
    Return your analysis as valid JSON with the following structure:
    {
      "relevanceScore": [0-100],
      "focusAreas": ["list", "of", "areas"],
      "priorityUrls": ["list", "of", "urls"],
      "shouldExtractImages": true/false
    }
    `;
    
    const result = await generateText(prompt, {
      temperature: 0.3,
      maxOutputTokens: 1024
    });
    
    // Extract JSON response
    const jsonStart = result.indexOf('{');
    const jsonEnd = result.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('AI response is not in the expected JSON format');
    }
    
    const jsonStr = result.substring(jsonStart, jsonEnd + 1);
    const analysis = JSON.parse(jsonStr);
    
    return {
      ...analysis,
      success: true,
      url,
      crawlId
    };
  } catch (error) {
    logger.error(`Page analysis error: ${error.message}`);
    return {
      success: false,
      reason: error.message,
      relevanceScore: 50,
      priorityUrls: [],
      shouldExtractImages: true
    };
  }
};

/**
 * Generate a reflection on the crawl progress and suggest next steps
 * 
 * @param {Object} crawlData - Data about the current crawl
 * @returns {Promise<Object>} - Reflection and suggestions
 */
const reflectOnCrawl = async (crawlData) => {
  try {
    if (!GEMINI_API_KEY) {
      logger.warn('GEMINI_API_KEY not configured, skipping crawl reflection');
      return { success: false, reason: 'AI not configured' };
    }
    
    const { crawlId, pagesProcessed, visitedUrls, errors } = crawlData;
    
    // Limit the number of URLs to include in the prompt
    const sampleUrls = visitedUrls && visitedUrls.length > 0 
      ? visitedUrls.slice(0, 5).join('\n')
      : 'No URLs processed yet';
    
    const errorSummary = errors && errors.length > 0
      ? `${errors.length} errors encountered`
      : 'No errors so far';
    
    const prompt = `
    Reflect on this web crawl progress:
    Crawl ID: ${crawlId}
    Pages Processed: ${pagesProcessed}
    Sample URLs visited:
    ${sampleUrls}
    
    Status Summary:
    ${errorSummary}
    
    As an AI assistant for web crawling with focus on ad assets and marketing content:
    1. Evaluate the crawl progress so far
    2. Suggest improvements to the crawl strategy
    3. Identify potential issues to watch for
    
    Return your reflection as valid JSON with the following structure:
    {
      "progressEvaluation": "string evaluation",
      "strategySuggestions": ["list", "of", "suggestions"],
      "potentialIssues": ["list", "of", "issues"],
      "nextSteps": ["list", "of", "recommended", "next", "steps"]
    }
    `;
    
    const result = await generateText(prompt, {
      temperature: 0.4,
      maxOutputTokens: 1024
    });
    
    // Extract JSON response
    const jsonStart = result.indexOf('{');
    const jsonEnd = result.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('AI response is not in the expected JSON format');
    }
    
    const jsonStr = result.substring(jsonStart, jsonEnd + 1);
    const reflection = JSON.parse(jsonStr);
    
    return {
      ...reflection,
      success: true,
      crawlId,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error(`Crawl reflection error: ${error.message}`);
    return {
      success: false,
      reason: error.message,
      progressEvaluation: "Unable to evaluate progress due to an error",
      strategySuggestions: ["Continue with default crawling strategy"],
      nextSteps: ["Proceed with standard crawling approach"]
    };
  }
};

/**
 * Plan a crawl strategy for a given URL
 * 
 * @param {string} url - URL to crawl
 * @param {Object} options - Planning options
 * @returns {Promise<Object>} - Crawl plan
 */
const planCrawlStrategy = async (url, options = {}) => {
  try {
    if (!GEMINI_API_KEY) {
      logger.warn('GEMINI_API_KEY not configured, using default crawl strategy');
      return { success: false, reason: 'AI not configured' };
    }
    
    const prompt = `
    Plan a web crawling strategy for this URL:
    ${url}
    
    Goal: Extract ad assets and marketing content for competitor analysis
    
    Consider:
    - Site structure and navigation patterns
    - Likely locations of ad assets
    - Handling of dynamic content and infinite scrolling
    - Rate limiting and politeness
    
    Return your plan as valid JSON with the following structure:
    {
      "siteType": "e-commerce/social media/corporate/etc",
      "expectedAdLocations": ["list", "of", "locations"],
      "recommendedDepth": number,
      "priorityPaths": ["list", "of", "paths"],
      "technicalConsiderations": ["list", "of", "considerations"],
      "crawlParameters": {
        "userAgent": "string",
        "rateLimit": number,
        "maxScrolls": number
      }
    }
    `;
    
    const result = await generateText(prompt, {
      temperature: 0.3,
      maxOutputTokens: 1024
    });
    
    // Extract JSON response
    const jsonStart = result.indexOf('{');
    const jsonEnd = result.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('AI response is not in the expected JSON format');
    }
    
    const jsonStr = result.substring(jsonStart, jsonEnd + 1);
    const plan = JSON.parse(jsonStr);
    
    return {
      ...plan,
      success: true,
      url,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error(`Crawl planning error: ${error.message}`);
    return {
      success: false,
      reason: error.message,
      recommendedDepth: 3,
      crawlParameters: {
        rateLimit: 2000,
        maxScrolls: 5
      }
    };
  }
};

module.exports = {
  generateText,
  analyzePage,
  reflectOnCrawl,
  planCrawlStrategy
}; 