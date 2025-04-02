/**
 * Keyword Service Module
 * 
 * This module provides keyword extraction and analysis functionality from OCR text.
 * It uses natural language processing techniques to identify important keywords,
 * categorize them, and track their frequency across multiple OCR results.
 * 
 * The service handles:
 * - Keyword extraction using NLP techniques
 * - Keyword scoring based on relevance
 * - Keyword categorization (e.g., brands, products, marketing terms)
 * - Tracking keyword trends over time
 * 
 * Relationships with other modules:
 * - Used by ocrService.js to analyze extracted text
 * - Provides data to the keyword analytics dashboard
 * - Can be called directly via API through keywordController
 */

const natural = require('natural');
const stopwords = require('stopwords').english;
const logger = require('../utils/logger');
const OCRResult = require('../models/OCRResult');
const Keyword = require('../models/Keyword');
const aiAssistant = require('../utils/aiAssistant');

// Initialize NLP tools
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;
const tfidf = new natural.TfIdf();

/**
 * Extract keywords from OCR text
 * 
 * @param {string} analysisId - OCR analysis ID
 * @param {string} text - Text to extract keywords from
 * @param {Object} options - Extraction options
 * @returns {Promise<Object[]>} - Array of extracted keywords
 */
const extractKeywords = async (analysisId, text, options = {}) => {
  try {
    logger.info(`Extracting keywords from OCR analysis ${analysisId}`);
    
    if (!text || text.trim().length === 0) {
      logger.warn(`No text to extract keywords from for analysis ${analysisId}`);
      return [];
    }
    
    // Find OCR result
    const ocrResult = await OCRResult.findOne({ analysisId });
    
    if (!ocrResult) {
      throw new Error(`OCR result with ID ${analysisId} not found`);
    }
    
    // Preprocess text
    const preprocessedText = preprocessText(text);
    
    // Extract keywords using NLP
    let keywords = [];
    
    // Check if AI-based extraction is enabled
    if (options.useAI !== false && process.env.GEMINI_API_KEY) {
      try {
        // Use AI to extract keywords
        const aiKeywords = await extractKeywordsWithAI(preprocessedText);
        keywords = aiKeywords;
      } catch (error) {
        logger.error(`AI keyword extraction failed: ${error.message}`);
        // Fall back to statistical extraction
        keywords = extractKeywordsStatistical(preprocessedText);
      }
    } else {
      // Use statistical methods for keyword extraction
      keywords = extractKeywordsStatistical(preprocessedText);
    }
    
    // Save keywords to OCR result
    await ocrResult.addKeywords(keywords);
    
    // Add keywords to global keyword tracking
    await addKeywordsToGlobal(keywords, ocrResult.crawlId);
    
    logger.info(`Extracted ${keywords.length} keywords from OCR analysis ${analysisId}`);
    
    return keywords;
  } catch (error) {
    logger.error(`Keyword extraction error: ${error.message}`);
    throw error;
  }
};

/**
 * Preprocess text for keyword extraction
 * 
 * @param {string} text - Raw text
 * @returns {string} - Preprocessed text
 */
const preprocessText = (text) => {
  // Convert to lowercase
  let processed = text.toLowerCase();
  
  // Remove extra whitespace
  processed = processed.replace(/\s+/g, ' ').trim();
  
  // Remove special characters except alphanumeric and spaces
  processed = processed.replace(/[^\w\s]/g, ' ');
  
  // Remove numbers
  processed = processed.replace(/\d+/g, ' ');
  
  return processed;
};

/**
 * Extract keywords using statistical methods
 * 
 * @param {string} text - Preprocessed text
 * @returns {Object[]} - Array of extracted keywords
 */
const extractKeywordsStatistical = (text) => {
  // Tokenize the text
  const tokens = tokenizer.tokenize(text);
  
  // Remove stopwords and short words
  const filteredTokens = tokens.filter(token => 
    token.length > 2 && 
    !stopwords.includes(token)
  );
  
  // Add document to TF-IDF
  tfidf.addDocument(filteredTokens);
  
  // Get term frequency
  const terms = {};
  filteredTokens.forEach(token => {
    const stem = stemmer.stem(token);
    terms[stem] = (terms[stem] || 0) + 1;
  });
  
  // Convert to array and sort by frequency
  const keywords = Object.entries(terms)
    .map(([stem, frequency]) => {
      // Find original form of the word
      const originalForms = filteredTokens.filter(token => 
        stemmer.stem(token) === stem
      );
      
      // Get the most common original form
      const wordFreq = {};
      originalForms.forEach(word => {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      });
      
      const word = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])[0][0];
      
      // Calculate score based on frequency and word length
      const score = frequency * (0.5 + Math.min(0.5, word.length / 10));
      
      return { word, score, frequency };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20); // Limit to top 20 keywords
  
  return keywords;
};

/**
 * Extract keywords using AI
 * 
 * @param {string} text - Preprocessed text
 * @returns {Promise<Object[]>} - Array of extracted keywords with scores
 */
const extractKeywordsWithAI = async (text) => {
  try {
    const prompt = `
    Extract the most important keywords and phrases from the following text. 
    Consider marketing terms, brand names, product features, and action words.
    For each keyword, provide a relevance score between 0 and 1.
    Return as JSON array of objects with 'word' and 'score' properties.
    Only include significant words and phrases.
    
    Text: "${text.substring(0, 1000)}"
    `;
    
    const result = await aiAssistant.generateText(prompt, {
      temperature: 0.2,
      maxOutputTokens: 1024,
    });
    
    // Parse the JSON response
    const jsonStart = result.indexOf('[');
    const jsonEnd = result.lastIndexOf(']');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('AI response is not in the expected JSON format');
    }
    
    const jsonStr = result.substring(jsonStart, jsonEnd + 1);
    const keywords = JSON.parse(jsonStr);
    
    // Validate and normalize keywords
    return keywords
      .filter(k => k && k.word && typeof k.score === 'number')
      .map(k => ({
        word: k.word.toLowerCase().trim(),
        score: parseFloat((k.score * 100).toFixed(2)),
        frequency: 1,
        category: k.category || null
      }))
      .filter(k => k.word.length > 0 && k.score > 0);
  } catch (error) {
    logger.error(`AI keyword extraction error: ${error.message}`);
    throw error;
  }
};

/**
 * Add keywords to global keyword tracking
 * 
 * @param {Object[]} keywords - Array of keywords
 * @param {string} crawlId - Crawl job ID
 */
const addKeywordsToGlobal = async (keywords, crawlId) => {
  try {
    for (const keywordData of keywords) {
      // Find or create keyword
      let keyword = await Keyword.findOne({ word: keywordData.word });
      
      if (keyword) {
        // Update existing keyword
        keyword.frequency += 1;
        keyword.totalScore += keywordData.score;
        keyword.averageScore = keyword.totalScore / keyword.frequency;
        
        // Add crawl ID if not already present
        if (crawlId && !keyword.crawlJobs.includes(crawlId)) {
          keyword.crawlJobs.push(crawlId);
        }
        
        // Update last seen
        keyword.lastSeenAt = new Date();
      } else {
        // Create new keyword
        keyword = new Keyword({
          word: keywordData.word,
          frequency: 1,
          totalScore: keywordData.score,
          averageScore: keywordData.score,
          category: keywordData.category,
          crawlJobs: crawlId ? [crawlId] : []
        });
      }
      
      await keyword.save();
    }
  } catch (error) {
    logger.error(`Error adding keywords to global tracking: ${error.message}`);
    // Continue despite errors
  }
};

/**
 * Get top keywords with optional filtering
 * 
 * @param {Object} options - Filter options
 * @returns {Promise<Object[]>} - Array of top keywords
 */
const getTopKeywords = async (options = {}) => {
  try {
    const { 
      limit = 100, 
      minFrequency = 1, 
      sortBy = 'frequency', 
      category = null 
    } = options;
    
    // Build filter
    const filter = { frequency: { $gte: minFrequency } };
    if (category) filter.category = category;
    
    // Build sort options
    const sort = {};
    sort[sortBy === 'score' ? 'averageScore' : 'frequency'] = -1;
    
    // Query database
    const keywords = await Keyword.find(filter)
      .sort(sort)
      .limit(limit);
    
    return keywords.map(keyword => ({
      word: keyword.word,
      frequency: keyword.frequency,
      score: keyword.averageScore,
      category: keyword.category,
      lastSeenAt: keyword.lastSeenAt
    }));
  } catch (error) {
    logger.error(`Error getting top keywords: ${error.message}`);
    throw error;
  }
};

/**
 * Categorize keywords using AI
 * 
 * @param {string[]} words - Array of words to categorize
 * @returns {Promise<Object[]>} - Array of categorized keywords
 */
const categorizeKeywords = async (words) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured for AI categorization');
    }
    
    const prompt = `
    Categorize the following keywords into these categories:
    - brand: Brand names and companies
    - product: Product names and types
    - feature: Product features and specifications
    - marketing: Marketing and promotional terms
    - action: Action words and calls to action
    - other: Any other terms
    
    Return as JSON array of objects with 'word' and 'category' properties.
    
    Keywords: ${words.join(', ')}
    `;
    
    const result = await aiAssistant.generateText(prompt, {
      temperature: 0.1,
      maxOutputTokens: 1024,
    });
    
    // Parse the JSON response
    const jsonStart = result.indexOf('[');
    const jsonEnd = result.lastIndexOf(']');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('AI response is not in the expected JSON format');
    }
    
    const jsonStr = result.substring(jsonStart, jsonEnd + 1);
    const categorized = JSON.parse(jsonStr);
    
    // Update categories in the database
    for (const item of categorized) {
      if (item.word && item.category) {
        await Keyword.updateOne(
          { word: item.word.toLowerCase().trim() },
          { category: item.category }
        );
      }
    }
    
    return categorized;
  } catch (error) {
    logger.error(`Error categorizing keywords: ${error.message}`);
    throw error;
  }
};

/**
 * Get keyword statistics
 * 
 * @returns {Promise<Object>} - Keyword statistics
 */
const getKeywordStats = async () => {
  try {
    const totalCount = await Keyword.countDocuments();
    const frequentCount = await Keyword.countDocuments({ frequency: { $gte: 5 } });
    
    // Get category distribution
    const categoryStats = await Keyword.aggregate([
      { $match: { category: { $ne: null } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get recent keywords
    const recentKeywords = await Keyword.find()
      .sort({ lastSeenAt: -1 })
      .limit(10);
    
    return {
      totalKeywords: totalCount,
      frequentKeywords: frequentCount,
      categoryDistribution: categoryStats.map(cat => ({
        category: cat._id,
        count: cat.count
      })),
      recentKeywords: recentKeywords.map(k => ({
        word: k.word,
        frequency: k.frequency,
        score: k.averageScore,
        category: k.category,
        lastSeenAt: k.lastSeenAt
      }))
    };
  } catch (error) {
    logger.error(`Error getting keyword stats: ${error.message}`);
    throw error;
  }
};

module.exports = {
  extractKeywords,
  getTopKeywords,
  categorizeKeywords,
  getKeywordStats
}; 