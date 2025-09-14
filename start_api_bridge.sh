#!/bin/bash
echo "🌉 Starting API Bridge..."
cd backend
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi
python api_bridge.py
