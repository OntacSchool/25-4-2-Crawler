# Rebuild Instructions for Web Crawler System

## Fixed Issues

1. **Express Router Issue**: 
   - Missing or incorrect controller functions for OCR routes
   - Missing `getTasksByCategory` function in taskController
   - Route order issue causing the `/tasks/category/:category` route to not be matched correctly

2. **X11/VNC Server Conflicts**: 
   - Display lock file conflicts preventing proper startup
   - Improved startup sequence with proper cleanup

## Rebuild Steps

1. **Stop existing containers**:
   ```bash
   docker-compose down
   ```

2. **Rebuild containers with no cache**:
   ```bash
   docker-compose build --no-cache
   ```

3. **Start the system**:
   ```bash
   docker-compose up
   ```

4. **Monitor logs for errors**:
   ```bash
   docker-compose logs -f
   ```

## Accessing the System

1. **Web Interface**: http://localhost:3000
2. **VNC Viewer**: Connect to localhost:5900 (Password: crawlerpassword)

## Troubleshooting

If you continue to experience issues:

1. **Check lock files**:
   ```bash
   docker exec -it web-crawler-system bash -c "ls -la /tmp/.X*"
   ```

2. **Manually restart the X server**:
   ```bash
   docker exec -it web-crawler-system bash -c "rm -f /tmp/.X* && Xvfb :99 -screen 0 1280x800x16 -ac &"
   ```

3. **Check logs for specific errors**:
   ```bash
   docker-compose logs -f web-crawler-system
   ```

4. **Repair routes issue manually**:
   ```bash
   docker exec -it web-crawler-system bash -c "cd /app && nano src/api/routes.js"
   ```
   Make sure `/tasks/category/:category` route is defined before `/tasks/:id` 