#!/bin/bash

# Complete system startup script
echo "🚀 Starting INGRES MCP Chatbot System..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please run setup.sh first."
    exit 1
fi

# Check if API keys are set
source .env
if [ -z "$DATA_GOV_API_KEY" ] || [ "$DATA_GOV_API_KEY" = "your_data_gov_in_api_key_here" ]; then
    echo "⚠️  Warning: DATA_GOV_API_KEY not set in .env file"
fi

if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your_openai_api_key_here" ]; then
    echo "⚠️  Warning: OPENAI_API_KEY not set in .env file"
fi

# Start services
echo "🐳 Starting Docker services..."
docker-compose up --build -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 30

# Check service health
echo "🔍 Checking service health..."
curl -f http://localhost:8000/health || echo "❌ Backend health check failed"
curl -f http://localhost:3000 || echo "❌ Frontend health check failed"

echo "✅ System started! Access the application at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8000"
echo "   API Documentation: http://localhost:8000/docs"

echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "📝 To view logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 To stop all services:"
echo "   docker-compose down"
