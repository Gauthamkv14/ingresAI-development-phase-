#!/bin/bash
echo "🔧 Starting INGRES MCP in Development Mode..."

# Start databases in background
if command -v docker-compose &> /dev/null; then
    echo "Starting databases with Docker..."
    docker-compose up -d postgres redis
    sleep 5
fi

# Start backend in background
echo "Starting backend..."
./start_backend.sh &
BACKEND_PID=$!

# Wait for backend to start
sleep 10

# Start API bridge in background  
echo "Starting API bridge..."
./start_api_bridge.sh &
BRIDGE_PID=$!

# Wait for API bridge
sleep 5

# Start frontend (foreground)
echo "Starting frontend..."
./start_frontend.sh

# Cleanup on exit
trap 'kill $BACKEND_PID $BRIDGE_PID 2>/dev/null' EXIT
