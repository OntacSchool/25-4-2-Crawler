# Web Crawler System

A production-level, containerized web crawler system with headless browser integration, OCR-based keyword extraction, and a real-time web UI dashboard.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)

## 🚀 Features

- **Headless Browser Automation**: Crawl dynamic websites using Playwright with support for infinite scrolling
- **OCR Processing**: Extract text from ad assets using Tesseract OCR
- **Keyword Analysis**: Extract and analyze keywords using NLP and AI techniques
- **Task Management**: Automated markdown-based to-do list with dependency tracking
- **Web Dashboard**: Real-time monitoring and control of crawl operations
- **Containerization**: Complete Docker setup for easy deployment
- **AI Integration**: Uses Google's Gemini AI for intelligent crawling and analysis

## 📋 Prerequisites

- Node.js (>= 16.0.0)
- Docker and Docker Compose (for containerized deployment)
- MongoDB and Redis (included in Docker setup)
- Tesseract OCR (included in Docker setup)

## 🔧 Installation

### Using Docker (Recommended)

1. Clone this repository:
```bash
git clone https://github.com/yourusername/web-crawler-system.git
cd web-crawler-system
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. Build and start the container:
```bash
docker-compose up --build
```

4. Access the dashboard at http://localhost:8080

### Local Development

1. Clone this repository:
```bash
git clone https://github.com/yourusername/web-crawler-system.git
cd web-crawler-system
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your settings
```

4. Start development server:
```bash
npm run dev
```

5. Access the dashboard at http://localhost:8080

## 🧪 Testing

Run the test suite:

```bash
npm test
```

## 📖 Documentation

- [Technical Documentation](src/docs/technical-documentation.md): Detailed system architecture and API documentation
- [User Guide](src/docs/user-guide.md): Guide for using the web crawler system
- [API Reference](src/docs/api-reference.md): Complete API reference

## 🌟 Key Components

### Crawler Module

The crawler module uses Playwright to:
- Automate browser navigation and interaction
- Handle infinite scrolling on dynamic websites
- Capture screenshots of ad assets
- Extract HTML content for analysis

### OCR Module

The OCR module processes captured screenshots to:
- Preprocess images for optimal OCR results
- Extract text using Tesseract OCR
- Calculate confidence scores for extracted text
- Store and categorize OCR results

### Keyword Analysis Module

The keyword analysis module uses NLP and AI to:
- Extract important keywords from OCR text
- Categorize keywords (brands, products, features, etc.)
- Track keyword frequency and trends
- Generate insights about competitor ad strategies

### Task Management Module

The task management module provides:
- Automated tracking of system setup and operation tasks
- Dependency management for task workflows
- Automatic task completion based on system events
- Markdown-based to-do list generation

### Web UI Dashboard

The web dashboard offers:
- Real-time crawl status monitoring
- Task management interface
- Keyword analytics visualizations
- System logs and performance metrics
- Crawl job control (start, pause, resume, stop)

## 📝 Usage Examples

### Starting a Crawl Job

```javascript
// Using the API
const response = await fetch('/api/crawl', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://example.com',
    depth: 3,
    options: {
      handleInfiniteScroll: true,
      performOcr: true
    }
  })
});

const data = await response.json();
console.log('Crawl job started with ID:', data.crawlId);
```

### Retrieving Extracted Keywords

```javascript
// Using the API
const response = await fetch('/api/ocr/keywords?minFrequency=3&sortBy=frequency');
const data = await response.json();

console.log('Top keywords:', data.data);
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Playwright](https://playwright.dev/) for browser automation
- [Tesseract.js](https://github.com/naptha/tesseract.js) for OCR functionality
- [Natural](https://github.com/NaturalNode/natural) for NLP processing
- [Google's Gemini API](https://ai.google.dev/) for AI-powered analysis

---

Built with ❤️ by [Your Name] 