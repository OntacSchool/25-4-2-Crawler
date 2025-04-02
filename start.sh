#!/bin/bash

# Clean up any existing X server locks
rm -f /tmp/.X*-lock
rm -rf /tmp/.X11-unix

# Start Xvfb
Xvfb :99 -screen 0 1280x800x16 -ac &
export DISPLAY=:99

# Wait for Xvfb to start
sleep 2

# Start window manager
fluxbox &

# Start VNC server
x11vnc -display :99 -forever -usepw -shared &

# Start the web application
npm start 