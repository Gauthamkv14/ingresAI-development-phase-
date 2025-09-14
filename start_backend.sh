#!/bin/bash
echo "🐍 Starting INGRES MCP Backend Server..."
cd backend
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    echo "✅ Activated Python virtual environment"
fi
export PYTHONPATH=$PWD
python mcp_server.py
