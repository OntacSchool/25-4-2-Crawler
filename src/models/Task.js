/**
 * Task Model
 * 
 * This module defines the Mongoose schema and model for the task system.
 * It represents a single task in the automated to-do list with properties
 * for status tracking, dependencies, and markdown content.
 * 
 * The schema includes:
 * - Basic task information (title, description)
 * - Status tracking (pending, in-progress, completed, failed)
 * - Priority levels
 * - Categorization
 * - Dependencies on other tasks
 * - Timestamps for creation, updates, and completion
 * 
 * Relationships with other modules:
 * - Used by taskController.js for CRUD operations
 * - Used by taskManager.js for automated task tracking
 * - Used by the UI dashboard for displaying task status
 */

const mongoose = require('mongoose');

/**
 * Task Schema Definition
 */
const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'failed'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['setup', 'crawler', 'ocr', 'ui', 'integration', 'testing', 'documentation', 'general'],
    default: 'general'
  },
  markdownContent: {
    type: String,
    default: ''
  },
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  completionNotes: {
    type: String,
    default: ''
  },
  automationTrigger: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  failedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

/**
 * Pre-save middleware to update markdownContent
 */
taskSchema.pre('save', function(next) {
  // Update markdown content based on task properties
  if (!this.markdownContent || this.isModified('title') || this.isModified('description') || this.isModified('status')) {
    this.markdownContent = generateMarkdownContent(this);
  }
  next();
});

/**
 * Generate markdown content for a task
 * 
 * @param {Object} task - Task object
 * @returns {String} - Markdown formatted content
 */
function generateMarkdownContent(task) {
  const statusSymbol = {
    'pending': '⏳',
    'in-progress': '🔄',
    'completed': '✅',
    'failed': '❌'
  }[task.status];

  const prioritySymbol = {
    'low': '🔽',
    'medium': '⏺️',
    'high': '🔼'
  }[task.priority];

  let markdown = `# ${task.title} ${statusSymbol}\n\n`;
  markdown += `**Priority:** ${prioritySymbol} ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}\n`;
  markdown += `**Category:** ${task.category.charAt(0).toUpperCase() + task.category.slice(1)}\n`;
  
  if (task.description) {
    markdown += `\n## Description\n\n${task.description}\n`;
  }
  
  if (task.completionNotes && task.status === 'completed') {
    markdown += `\n## Completion Notes\n\n${task.completionNotes}\n`;
  }

  if (task.status === 'completed') {
    markdown += `\n**Completed at:** ${task.completedAt ? task.completedAt.toISOString() : 'Unknown'}\n`;
  } else if (task.status === 'failed') {
    markdown += `\n**Failed at:** ${task.failedAt ? task.failedAt.toISOString() : 'Unknown'}\n`;
  }

  return markdown;
}

/**
 * Statics
 */
taskSchema.statics.findDependentTasks = async function(taskId) {
  return this.find({ dependencies: taskId });
};

/**
 * Export the Task model
 */
const Task = mongoose.model('Task', taskSchema);

module.exports = Task; 