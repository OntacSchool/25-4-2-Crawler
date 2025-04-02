# Web Crawler System Technical Documentation

## Overview

This document provides technical information about the Web Crawler System, a production-level containerized solution for automated web crawling, OCR processing, and keyword extraction. The system is designed to extract and analyze ad assets from various websites, providing insights into competitor advertising strategies.

## System Architecture

The Web Crawler System is built using a modular architecture with the following core components:

1. **Crawler Module**: Handles web navigation and content extraction using headless browser automation.
2. **OCR Module**: Processes captured screenshots to extract text using Tesseract OCR.
3. **Keyword Analysis Module**: Extracts and categorizes keywords from OCR results using NLP techniques.
4. **Task Management Module**: Tracks system tasks and automates progress reporting.
5. **Web UI Dashboard**: Provides a user interface for monitoring and controlling the system.
6. **API Layer**: Exposes system functionality through RESTful endpoints.

### High-Level Architecture Diagram

```
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│    Web Browser    │────▶│    API Server     │◀───▶│   MongoDB/Redis   │
└───────────────────┘     └───────────────────┘     └───────────────────┘
                                    ▲
                                    │
                                    ▼
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│    Crawler with   │     │  OCR Processing   │     │  Keyword Analysis │
│  Headless Browser │────▶│  (Tesseract OCR)  │────▶│  (NLP/AI Models)  │
└───────────────────┘     └───────────────────┘     └───────────────────┘
         ▲                                                    │
         └────────────────────────────────────────────────────┘
```

## Technologies Used

- **Backend**: Node.js with Express.js
- **Database**: MongoDB for data storage, Redis for caching
- **Headless Browser**: Playwright for web automation
- **OCR Engine**: Tesseract OCR
- **NLP Processing**: Natural language processing libraries
- **AI Integration**: Google's Gemini AI for advanced analysis
- **Containerization**: Docker and Docker Compose
- **Frontend**: React.js with responsive design

## Setup and Installation

### Prerequisites

- Docker and Docker Compose
- Node.js (>= 16.x) for local development
- MongoDB and Redis (for local development without Docker)

### Using Docker (Recommended)

1. Clone the repository
2. Configure environment variables in `.env` or use Docker environment variables
3. Build and run with Docker Compose:

```bash
docker-compose up --build
```

### Local Development Setup

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Configure environment variables in `.env`
4. Start the development server:

```bash
npm run dev
```

## Configuration

The system configuration is managed through environment variables, which can be set in the `.env` file or through Docker environment variables.

### Core Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | `development` |
| `PORT` | API server port | `3000` |
| `UI_PORT` | UI dashboard port | `8080` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://localhost:27017/crawler` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `HEADLESS` | Run browser in headless mode | `true` |
| `USER_AGENT` | Custom user agent for crawler | Mozilla/5.0... |
| `MAX_RETRIES` | Max retry attempts for failed requests | `3` |
| `RATE_LIMIT_MS` | Rate limiting in milliseconds | `2000` |
| `TESSERACT_PATH` | Path to Tesseract binary | `/usr/bin/tesseract` |
| `GEMINI_API_KEY` | Google Gemini API key | - |

## API Documentation

The system exposes a RESTful API for controlling the crawler and accessing results.

### Authentication

API endpoints can be secured using JWT authentication (implementation details in authentication middleware).

### Crawler Endpoints

| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/api/crawl` | POST | Start a new crawl job | `{ url, depth, options }` | Crawl job details |
| `/api/crawl/:id` | GET | Get crawl job status | - | Job status details |
| `/api/crawl/:id/pause` | PUT | Pause a running crawl | - | Updated status |
| `/api/crawl/:id/resume` | PUT | Resume a paused crawl | - | Updated status |
| `/api/crawl/:id` | DELETE | Stop and delete a crawl | - | Success message |
| `/api/crawl/:id/logs` | GET | Get crawl logs | - | Log entries |
| `/api/crawl/:id/screenshot` | GET | Get latest screenshot | - | PNG image |

### OCR Endpoints

| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/api/ocr/analyze` | POST | Analyze an image | `{ imageBase64 or imagePath }` | Analysis ID |
| `/api/ocr/:id/results` | GET | Get OCR results | - | OCR results |
| `/api/ocr/keywords` | GET | Get extracted keywords | Query params for filtering | Keywords list |

### Task Management Endpoints

| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/api/tasks` | GET | Get all tasks | Query params for filtering | List of tasks |
| `/api/tasks/:id` | GET | Get task by ID | - | Task details |
| `/api/tasks` | POST | Create a new task | Task details | Created task |
| `/api/tasks/:id` | PUT | Update a task | Updated fields | Updated task |
| `/api/tasks/:id` | DELETE | Delete a task | - | Success message |

## Using the Crawler

### Starting a Crawl Job

To start a new crawl job, send a POST request to the `/api/crawl` endpoint:

```javascript
// Example using fetch API
const response = await fetch('/api/crawl', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://example.com',
    depth: 3,
    options: {
      handleInfiniteScroll: true,
      performOcr: true,
      useAI: true,
      rateLimit: 2000
    }
  })
});

const data = await response.json();
console.log('Crawl job started:', data.crawlId);
```

### Available Crawl Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `headless` | Boolean | Run in headless mode | `true` |
| `userAgent` | String | Custom user agent | From .env |
| `handleInfiniteScroll` | Boolean | Detect and handle infinite scrolling | `true` |
| `maxScrolls` | Number | Maximum scroll attempts | `10` |
| `scrollTimeout` | Number | Timeout for infinite scrolling in ms | `30000` |
| `navigationTimeout` | Number | Page navigation timeout in ms | `30000` |
| `rateLimit` | Number | Delay between page loads in ms | `2000` |
| `performOcr` | Boolean | Process screenshots with OCR | `true` |
| `useAI` | Boolean | Use AI for page analysis | `true` |

## OCR and Keyword Extraction

### OCR Processing

The system captures screenshots during crawling and processes them with Tesseract OCR to extract text. The OCR module includes:

1. Image preprocessing to improve OCR accuracy
2. Text extraction with confidence scoring
3. Storage of OCR results for further analysis

### Keyword Extraction

The keyword extraction module processes OCR text to identify important keywords using:

1. Statistical analysis (TF-IDF, word frequency)
2. AI-powered extraction using Google's Gemini API
3. Keyword categorization (brands, products, features, marketing terms)

## Task Management System

The system includes an automated task management system that:

1. Tracks setup and operational tasks with status updates
2. Automatically marks tasks as complete based on system events
3. Tracks task dependencies to manage workflow
4. Generates markdown-based task reports

## Error Handling and Resilience

The system implements several error handling strategies:

1. Automatic retry for failed requests with exponential backoff
2. Error logging and monitoring
3. Graceful degradation of AI features when API keys are not available
4. Transaction safety for database operations

## Performance Considerations

For optimal performance:

1. Adjust rate limiting based on target website's capacity
2. Configure MongoDB connection pooling appropriately
3. Consider dedicated Redis instance for high-volume crawling
4. Use a dedicated OCR server for processing-intensive workloads

## Extending the System

The modular architecture makes it easy to extend the system:

1. Add new crawler strategies in the `crawler` module
2. Implement custom OCR preprocessing in the `ocr` module
3. Add new keyword analysis techniques in the `keyword` module
4. Create new dashboard visualizations in the `ui` module

## Security Considerations

1. Use secure environment variables for API keys
2. Implement rate limiting for public API endpoints
3. Validate and sanitize all input parameters
4. Follow responsible crawling practices

## Logging and Monitoring

The system uses Winston for structured logging with different log levels:

1. Error logs for critical issues
2. Info logs for operational events
3. Debug logs for development purposes

Logs are stored in the `logs` directory and can be integrated with external monitoring tools.

## Troubleshooting

Common issues and solutions:

1. **Browser launch fails in Docker**: Ensure the Docker container has the necessary dependencies for Playwright.
2. **OCR returns low-confidence results**: Adjust image preprocessing parameters or check Tesseract installation.
3. **Database connection issues**: Verify MongoDB/Redis connection strings and network accessibility.
4. **High memory usage**: Adjust the number of concurrent browser contexts or implement pagination for large crawls.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

© 2024 Web Crawler System 