/**
 * Task Controller
 * 
 * Handles requests related to the task management system.
 * Provides endpoints for creating, updating, and retrieving tasks.
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

// Mock storage for tasks
const tasks = new Map();

// Create some initial tasks
const setupInitialTasks = () => {
  const initialTasks = [
    {
      id: uuidv4(),
      title: 'Setup Docker Environment',
      description: 'Configure Docker and Docker Compose for the web crawler system',
      status: 'completed',
      priority: 'high',
      category: 'setup',
      created: new Date(Date.now() - 86400000), // 1 day ago
      updated: new Date()
    },
    {
      id: uuidv4(),
      title: 'Implement Headless Browser',
      description: 'Set up Playwright for browser automation',
      status: 'in_progress',
      priority: 'high',
      category: 'crawler',
      created: new Date(Date.now() - 76400000),
      updated: new Date()
    },
    {
      id: uuidv4(),
      title: 'Configure OCR Module',
      description: 'Set up Tesseract for OCR processing',
      status: 'pending',
      priority: 'medium',
      category: 'ocr',
      created: new Date(Date.now() - 66400000),
      updated: new Date()
    }
  ];
  
  initialTasks.forEach(task => {
    tasks.set(task.id, task);
  });
  
  logger.info('Initial tasks created');
};

// Setup initial tasks
setupInitialTasks();

/**
 * Get all tasks
 */
exports.getAllTasks = async (req, res) => {
  try {
    // Convert Map to Array
    const taskList = Array.from(tasks.values());
    
    res.status(200).json({
      success: true,
      count: taskList.length,
      tasks: taskList
    });
  } catch (error) {
    logger.error(`Error getting tasks: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get tasks',
      error: error.message
    });
  }
};

/**
 * Get a single task by ID
 */
exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if the task exists
    if (!tasks.has(id)) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    const task = tasks.get(id);
    
    res.status(200).json({
      success: true,
      task
    });
  } catch (error) {
    logger.error(`Error getting task: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get task',
      error: error.message
    });
  }
};

/**
 * Create a new task
 */
exports.createTask = async (req, res) => {
  try {
    const { title, description, priority, category } = req.body;
    
    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a title for the task'
      });
    }
    
    const taskId = uuidv4();
    
    // Create the task
    const task = {
      id: taskId,
      title,
      description: description || '',
      status: 'pending',
      priority: priority || 'medium',
      category: category || 'general',
      created: new Date(),
      updated: new Date()
    };
    
    // Store the task
    tasks.set(taskId, task);
    
    logger.info(`Task created: ${taskId} - ${title}`);
    
    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task
    });
  } catch (error) {
    logger.error(`Error creating task: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to create task',
      error: error.message
    });
  }
};

/**
 * Update a task
 */
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, category } = req.body;
    
    // Check if the task exists
    if (!tasks.has(id)) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Get the existing task
    const task = tasks.get(id);
    
    // Update the task
    const updatedTask = {
      ...task,
      title: title || task.title,
      description: description !== undefined ? description : task.description,
      status: status || task.status,
      priority: priority || task.priority,
      category: category || task.category,
      updated: new Date()
    };
    
    // Store the updated task
    tasks.set(id, updatedTask);
    
    logger.info(`Task updated: ${id}`);
    
    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      task: updatedTask
    });
  } catch (error) {
    logger.error(`Error updating task: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update task',
      error: error.message
    });
  }
};

/**
 * Delete a task
 */
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if the task exists
    if (!tasks.has(id)) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Delete the task
    tasks.delete(id);
    
    logger.info(`Task deleted: ${id}`);
    
    res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting task: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task',
      error: error.message
    });
  }
};

/**
 * Mark a task as complete
 */
exports.markTaskComplete = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if the task exists
    if (!tasks.has(id)) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Get the existing task
    const task = tasks.get(id);
    
    // Update the task status
    const updatedTask = {
      ...task,
      status: 'completed',
      updated: new Date()
    };
    
    // Store the updated task
    tasks.set(id, updatedTask);
    
    logger.info(`Task marked complete: ${id}`);
    
    res.status(200).json({
      success: true,
      message: 'Task marked as complete',
      task: updatedTask
    });
  } catch (error) {
    logger.error(`Error marking task complete: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to mark task as complete',
      error: error.message
    });
  }
};

/**
 * Get tasks by category
 */
exports.getTasksByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    
    // Convert Map to Array and filter by category
    const taskList = Array.from(tasks.values()).filter(
      task => task.category.toLowerCase() === category.toLowerCase()
    );
    
    res.status(200).json({
      success: true,
      count: taskList.length,
      category,
      tasks: taskList
    });
  } catch (error) {
    logger.error(`Error getting tasks by category: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get tasks by category',
      error: error.message
    });
  }
}; 