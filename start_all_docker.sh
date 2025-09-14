#!/bin/bash
echo "🐳 Starting complete INGRES MCP system with Docker..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please run setup.sh first."
    exit 1
fi

# Load environment variables
source .env

# Check critical environment variables
if [ -z "$DATA_GOV_API_KEY" ] || [ "$DATA_GOV_API_KEY" = "your_data_gov_in_api_key_here" ]; then
    echo "⚠️  WARNING: DATA_GOV_API_KEY not configured in .env"
fi

if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your_openai_api_key_here" ]; then
    echo "⚠️  WARNING: OPENAI_API_KEY not configured in .env"
fi

echo "🚀 Starting all services..."
docker-compose up --build

echo ""
echo "🌐 Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   API: http://localhost:8000"
echo "   Database Admin: http://localhost:8080 (if enabled)"
