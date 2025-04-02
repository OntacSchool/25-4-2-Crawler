# Use Node.js as base image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Install system dependencies including Playwright browser dependencies and Tesseract OCR
RUN apt-get update && \
    apt-get install -y wget gnupg ca-certificates procps libssl-dev \
    tesseract-ocr tesseract-ocr-eng libtesseract-dev \
    libpng-dev libjpeg-dev libgif-dev \
    # Canvas dependencies
    build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    # X11 and VNC for browser visualization
    x11vnc xvfb fluxbox && \
    # Install Playwright dependencies
    npx playwright install-deps chromium && \
    # Clean up
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Playwright browser
RUN npx playwright install chromium

# Create VNC password and directories
RUN mkdir -p ~/.vnc ~/.fluxbox/apps
RUN x11vnc -storepasswd "crawlerpassword" ~/.vnc/passwd

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies including canvas
RUN npm install --production
RUN npm install canvas socket.io

# Copy source code
COPY . .

# Make the start script executable
RUN chmod +x start.sh

# Expose ports (API server, UI dashboard, VNC)
EXPOSE 3000 8080 5900

# Set environment variables
ENV NODE_ENV=production
ENV TESSERACT_PATH=/usr/bin/tesseract
ENV GEMINI_API_KEY=AIzaSyDmB-rOcxY_szn5S4FJh7QjWonws_AFQls
ENV DISPLAY=:99

# Start using the shell script
CMD ["./start.sh"] 