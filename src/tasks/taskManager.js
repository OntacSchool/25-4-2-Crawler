/**
 * Task Manager Module
 * 
 * This module implements the automated markdown-based to-do list system.
 * It manages the creation, tracking, and automatic completion of tasks
 * related to the crawler system setup and operation.
 * 
 * The manager handles:
 * - Initialization of system tasks
 * - Task dependency tracking
 * - Automatic task completion based on system events
 * - Task status updates and notifications
 * 
 * Relationships with other modules:
 * - Used by the main application for task system initialization
 * - Receives events from crawlerService.js and ocrService.js
 * - Provides data to the UI dashboard for task display
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const Task = require('../models/Task');
const aiAssistant = require('../utils/aiAssistant');

// In-memory cache of task automations
const taskAutomations = new Map();

/**
 * Initialize the task manager
 * Creates initial system tasks if they don't exist
 * 
 * @returns {Promise<void>}
 */
const setupTaskManager = async () => {
  try {
    logger.info('Initializing task manager');
    
    // Check if initial tasks exist
    const taskCount = await Task.countDocuments();
    
    if (taskCount === 0) {
      // Create initial system tasks
      await createInitialTasks();
    }
    
    // Set up automation triggers
    setupAutomationTriggers();
    
    logger.info('Task manager initialized successfully');
  } catch (error) {
    logger.error(`Task manager initialization error: ${error.message}`);
    throw error;
  }
};

/**
 * Create initial system tasks
 * 
 * @returns {Promise<void>}
 */
const createInitialTasks = async () => {
  try {
    logger.info('Creating initial system tasks');
    
    // Define initial tasks with dependencies
    const initialTasks = [
      // Setup Tasks
      {
        title: 'Set up Docker environment',
        description: 'Configure Docker and Docker Compose for the crawler system.',
        category: 'setup',
        priority: 'high',
        automationTrigger: 'docker_ready'
      },
      {
        title: 'Configure environment variables',
        description: 'Set up environment variables for development and production environments.',
        category: 'setup',
        priority: 'high',
        dependencies: []
      },
      {
        title: 'Set up MongoDB and Redis',
        description: 'Configure database connections and schemas.',
        category: 'setup',
        priority: 'high',
        automationTrigger: 'database_connected'
      },
      
      // Crawler Tasks
      {
        title: 'Develop headless browser integration',
        description: 'Implement Playwright/Puppeteer integration for browser automation.',
        category: 'crawler',
        priority: 'high',
        dependencies: []
      },
      {
        title: 'Implement infinite scroll handling',
        description: 'Add logic to detect and handle infinite scrolling on web pages.',
        category: 'crawler',
        priority: 'medium',
        dependencies: []
      },
      {
        title: 'Implement screenshot capture',
        description: 'Add functionality to capture screenshots of ad assets.',
        category: 'crawler',
        priority: 'medium',
        dependencies: []
      },
      {
        title: 'Add error handling and retry mechanisms',
        description: 'Implement robust error handling and retry logic for crawling operations.',
        category: 'crawler',
        priority: 'high',
        dependencies: []
      },
      
      // OCR Tasks
      {
        title: 'Integrate Tesseract OCR',
        description: 'Set up Tesseract OCR for text extraction from images.',
        category: 'ocr',
        priority: 'high',
        dependencies: []
      },
      {
        title: 'Implement image preprocessing',
        description: 'Add image preprocessing to improve OCR accuracy.',
        category: 'ocr',
        priority: 'medium',
        dependencies: []
      },
      {
        title: 'Develop keyword extraction',
        description: 'Implement NLP-based keyword extraction from OCR text.',
        category: 'ocr',
        priority: 'high',
        dependencies: []
      },
      
      // UI Tasks
      {
        title: 'Create responsive dashboard layout',
        description: 'Design and implement the main dashboard UI layout.',
        category: 'ui',
        priority: 'high',
        dependencies: []
      },
      {
        title: 'Implement task list component',
        description: 'Create component to display and manage the to-do list.',
        category: 'ui',
        priority: 'medium',
        dependencies: []
      },
      {
        title: 'Build crawl status visualizer',
        description: 'Create visualizations for crawl status and progress.',
        category: 'ui',
        priority: 'medium',
        dependencies: []
      },
      {
        title: 'Implement keyword analytics dashboard',
        description: 'Create visualizations for extracted keywords and trends.',
        category: 'ui',
        priority: 'medium',
        dependencies: []
      },
      
      // Integration Tasks
      {
        title: 'Connect crawler with OCR pipeline',
        description: 'Integrate screenshot capture with OCR processing.',
        category: 'integration',
        priority: 'high',
        dependencies: []
      },
      {
        title: 'Implement real-time updates',
        description: 'Add WebSocket support for real-time dashboard updates.',
        category: 'integration',
        priority: 'medium',
        dependencies: []
      },
      
      // Documentation Tasks
      {
        title: 'Create system architecture documentation',
        description: 'Document the overall system architecture and module relationships.',
        category: 'documentation',
        priority: 'medium',
        dependencies: []
      },
      {
        title: 'Document API endpoints',
        description: 'Create comprehensive API documentation for all endpoints.',
        category: 'documentation',
        priority: 'medium',
        dependencies: []
      },
      {
        title: 'Write user guide',
        description: 'Create a user guide for operating the crawler system.',
        category: 'documentation',
        priority: 'low',
        dependencies: []
      }
    ];
    
    // Create tasks
    for (const taskData of initialTasks) {
      const task = new Task(taskData);
      await task.save();
      logger.debug(`Created task: ${task.title}`);
    }
    
    // Update dependencies
    await updateTaskDependencies();
    
    logger.info(`Created ${initialTasks.length} initial tasks`);
  } catch (error) {
    logger.error(`Error creating initial tasks: ${error.message}`);
    throw error;
  }
};

/**
 * Update task dependencies based on category relationships
 * 
 * @returns {Promise<void>}
 */
const updateTaskDependencies = async () => {
  try {
    // Get all tasks organized by category
    const tasks = await Task.find();
    const tasksByCategory = {};
    
    tasks.forEach(task => {
      if (!tasksByCategory[task.category]) {
        tasksByCategory[task.category] = [];
      }
      tasksByCategory[task.category].push(task);
    });
    
    // Define category dependencies
    const categoryDependencies = {
      'integration': ['crawler', 'ocr', 'ui'],
      'ocr': ['setup'],
      'crawler': ['setup'],
      'ui': ['setup']
    };
    
    // Update task dependencies based on category relationships
    for (const task of tasks) {
      if (categoryDependencies[task.category]) {
        const dependentCategories = categoryDependencies[task.category];
        
        for (const category of dependentCategories) {
          if (tasksByCategory[category]) {
            // Find a high priority task from the dependent category
            const dependencyTask = tasksByCategory[category].find(t => 
              t.priority === 'high' && !task.dependencies.includes(t._id)
            );
            
            if (dependencyTask && !task.dependencies.includes(dependencyTask._id)) {
              task.dependencies.push(dependencyTask._id);
            }
          }
        }
        
        // Save updated dependencies
        await task.save();
      }
    }
    
    logger.info('Updated task dependencies');
  } catch (error) {
    logger.error(`Error updating task dependencies: ${error.message}`);
  }
};

/**
 * Set up automation triggers for automatic task completion
 */
const setupAutomationTriggers = () => {
  // Define automation triggers and conditions
  const automations = [
    {
      trigger: 'docker_ready',
      condition: () => true, // Simple check for now
      taskTitle: 'Set up Docker environment'
    },
    {
      trigger: 'database_connected',
      condition: () => true, // Will be replaced with actual condition
      taskTitle: 'Set up MongoDB and Redis'
    },
    {
      trigger: 'crawler_running',
      condition: () => true,
      taskTitle: 'Develop headless browser integration'
    },
    {
      trigger: 'infinite_scroll_detected',
      condition: () => true,
      taskTitle: 'Implement infinite scroll handling'
    },
    {
      trigger: 'screenshot_captured',
      condition: () => true,
      taskTitle: 'Implement screenshot capture'
    },
    {
      trigger: 'ocr_processed',
      condition: () => true,
      taskTitle: 'Integrate Tesseract OCR'
    },
    {
      trigger: 'keywords_extracted',
      condition: () => true,
      taskTitle: 'Develop keyword extraction'
    }
  ];
  
  // Register automations
  automations.forEach(automation => {
    taskAutomations.set(automation.trigger, automation);
  });
  
  logger.info(`Set up ${automations.length} task automation triggers`);
};

/**
 * Trigger a task automation event
 * 
 * @param {string} trigger - Automation trigger name
 * @param {Object} data - Event data
 * @returns {Promise<boolean>} - True if a task was completed
 */
const triggerAutomation = async (trigger, data = {}) => {
  try {
    const automation = taskAutomations.get(trigger);
    
    if (!automation) {
      return false;
    }
    
    // Check condition
    if (!automation.condition(data)) {
      return false;
    }
    
    // Find task by title or automation trigger
    let task = await Task.findOne({ 
      $or: [
        { title: automation.taskTitle },
        { automationTrigger: trigger }
      ],
      status: { $ne: 'completed' }
    });
    
    if (!task) {
      return false;
    }
    
    // Complete the task
    task.status = 'completed';
    task.completedAt = new Date();
    task.completionNotes = `Automatically completed by system trigger: ${trigger}`;
    
    await task.save();
    
    logger.info(`Task "${task.title}" automatically completed by trigger: ${trigger}`);
    
    // Notify about dependent tasks that can now be started
    await updateDependentTasks(task._id);
    
    return true;
  } catch (error) {
    logger.error(`Error in task automation: ${error.message}`);
    return false;
  }
};

/**
 * Update tasks that depend on a completed task
 * 
 * @param {string} taskId - ID of the completed task
 * @returns {Promise<void>}
 */
const updateDependentTasks = async (taskId) => {
  try {
    // Find all tasks that depend on this task
    const dependentTasks = await Task.find({
      dependencies: taskId,
      status: { $ne: 'completed' }
    });
    
    for (const task of dependentTasks) {
      // Check if all dependencies are completed
      const dependencies = await Task.find({
        _id: { $in: task.dependencies }
      });
      
      const allDependenciesComplete = dependencies.every(dep => dep.status === 'completed');
      
      if (allDependenciesComplete) {
        // Update task status to indicate it can be started
        task.status = 'in-progress';
        await task.save();
        
        logger.info(`Task "${task.title}" is now ready to start (all dependencies completed)`);
      }
    }
  } catch (error) {
    logger.error(`Error updating dependent tasks: ${error.message}`);
  }
};

/**
 * Generate a markdown representation of all tasks
 * 
 * @returns {Promise<string>} - Markdown content
 */
const generateTaskMarkdown = async () => {
  try {
    // Get all tasks grouped by category
    const tasks = await Task.find().sort({ category: 1, priority: -1 });
    
    // Group tasks by category
    const tasksByCategory = {};
    tasks.forEach(task => {
      if (!tasksByCategory[task.category]) {
        tasksByCategory[task.category] = [];
      }
      tasksByCategory[task.category].push(task);
    });
    
    // Generate markdown
    let markdown = '# Web Crawler System Tasks\n\n';
    
    // Add progress summary
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const progressPercent = Math.round((completedTasks / totalTasks) * 100);
    
    markdown += `## Progress: ${completedTasks}/${totalTasks} (${progressPercent}%)\n\n`;
    markdown += `![Progress](https://progress-bar.dev/${progressPercent}/?width=400)\n\n`;
    
    // Add tasks by category
    for (const [category, categoryTasks] of Object.entries(tasksByCategory)) {
      markdown += `## ${category.charAt(0).toUpperCase() + category.slice(1)} Tasks\n\n`;
      
      for (const task of categoryTasks) {
        const status = {
          'pending': '⏳',
          'in-progress': '🔄',
          'completed': '✅',
          'failed': '❌'
        }[task.status];
        
        const priority = {
          'low': '🔽',
          'medium': '⏺️',
          'high': '🔼'
        }[task.priority];
        
        markdown += `### ${status} ${task.title} ${priority}\n\n`;
        
        if (task.description) {
          markdown += `${task.description}\n\n`;
        }
        
        if (task.status === 'completed' && task.completedAt) {
          markdown += `**Completed at:** ${task.completedAt.toISOString()}\n\n`;
        }
      }
    }
    
    return markdown;
  } catch (error) {
    logger.error(`Error generating task markdown: ${error.message}`);
    return '# Error generating tasks';
  }
};

/**
 * Save task markdown to a file
 * 
 * @returns {Promise<string>} - Path to saved file
 */
const saveTaskMarkdown = async () => {
  try {
    const markdown = await generateTaskMarkdown();
    const filePath = path.join(process.cwd(), 'data', 'tasks.md');
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Write markdown file
    await fs.writeFile(filePath, markdown);
    
    logger.info(`Task markdown saved to ${filePath}`);
    return filePath;
  } catch (error) {
    logger.error(`Error saving task markdown: ${error.message}`);
    throw error;
  }
};

/**
 * Event handler for when a task is created
 * 
 * @param {Object} task - The created task
 */
const onTaskCreated = (task) => {
  logger.info(`Task created: ${task.title}`);
};

/**
 * Event handler for when a task is updated
 * 
 * @param {Object} task - The updated task
 */
const onTaskUpdated = (task) => {
  logger.info(`Task updated: ${task.title}`);
};

/**
 * Event handler for when a task is deleted
 * 
 * @param {string} taskId - ID of the deleted task
 */
const onTaskDeleted = (taskId) => {
  logger.info(`Task deleted: ${taskId}`);
};

/**
 * Event handler for when a task is completed
 * 
 * @param {Object} task - The completed task
 */
const onTaskCompleted = async (task) => {
  logger.info(`Task completed: ${task.title}`);
  
  // Update dependent tasks
  await updateDependentTasks(task._id);
  
  // Update markdown file
  await saveTaskMarkdown();
};

// Export the setupTaskManager function at the end of the file
module.exports = setupTaskManager; 