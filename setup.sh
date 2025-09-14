#!/bin/bash

# INGRES MCP Chatbot Setup Script
# Comprehensive setup for development and production environments

set -e

echo "🚀 Starting INGRES MCP Chatbot Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "${BLUE}[SETUP]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

# Display banner
echo -e "${CYAN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║    INGRES MCP CHATBOT SETUP                          ║
║    AI-Driven Groundwater Analysis System            ║
║    Smart India Hackathon 2025                       ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos" 
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
fi

print_header "Detected OS: $OS"

# Check prerequisites
print_header "Checking prerequisites..."

# Check Python
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is required but not installed."
    print_error "Please install Python 3.11+ from https://www.python.org/"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
print_status "Found Python $PYTHON_VERSION"

if [[ $(echo "$PYTHON_VERSION < 3.11" | bc -l 2>/dev/null || python3 -c "print($PYTHON_VERSION < 3.11)") == "True" ]]; then
    print_warning "Python 3.11+ recommended, you have $PYTHON_VERSION"
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is required but not installed."
    print_error "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
print_status "Found Node.js $NODE_VERSION"

# Check Docker
DOCKER_AVAILABLE=false
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_status "Found Docker: $DOCKER_VERSION"
    DOCKER_AVAILABLE=true
    
    # Check Docker Compose
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version)
        print_status "Found Docker Compose: $COMPOSE_VERSION"
    elif docker compose version &> /dev/null 2>&1; then
        COMPOSE_VERSION=$(docker compose version)
        print_status "Found Docker Compose (Plugin): $COMPOSE_VERSION"
    else
        print_warning "Docker Compose not found. Install Docker Desktop or docker-compose"
    fi
else
    print_warning "Docker not found. You'll need to set up databases manually."
fi

# Check Git
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    print_status "Found Git: $GIT_VERSION"
else
    print_warning "Git not found. Recommended for version control."
fi

# Setup mode selection
echo ""
print_header "Choose setup mode:"
echo "1) 🐳 Full Docker Setup (Recommended - includes all services)"
echo "2) 🛠️  Development Setup (Local Python + Docker for databases)"
echo "3) ⚙️  Manual Setup (All services manual)"
echo ""

read -p "Enter choice (1-3): " -n 1 -r SETUP_MODE
echo ""

# Create project directories
print_header "Creating project directories..."
mkdir -p {uploads,data,logs,ml_models}
mkdir -p backend/{logs,uploads,data,ml_models}
mkdir -p frontend/build
mkdir -p database/backups
mkdir -p nginx/{logs,ssl}
mkdir -p monitoring/{prometheus,grafana}

# Environment file setup
print_header "Setting up environment files..."

if [ ! -f ".env" ]; then
    print_status "Creating .env file from template..."
    cp .env.example .env
    
    # Generate secure keys
    if command -v python3 &> /dev/null; then
        SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
        JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
        
        # Replace placeholder keys in .env
        if [[ "$OS" == "macos" ]]; then
            sed -i '' "s/generate_a_secure_secret_key_here/$SECRET_KEY/" .env
            sed -i '' "s/generate_a_jwt_secret_here/$JWT_SECRET/" .env
        else
            sed -i "s/generate_a_secure_secret_key_here/$SECRET_KEY/" .env
            sed -i "s/generate_a_jwt_secret_here/$JWT_SECRET/" .env
        fi
        
        print_status "Generated secure keys automatically"
    fi
    
    print_warning "⚠️  IMPORTANT: Edit .env file with your actual API keys and configuration!"
    print_warning "⚠️  Required: DATA_GOV_API_KEY, OPENAI_API_KEY"
    print_warning "⚠️  Change default passwords before production use!"
else
    print_status "Found existing .env file"
fi

# Setup based on chosen mode
case $SETUP_MODE in
    1)
        print_header "Setting up Full Docker Environment..."
        
        if [ "$DOCKER_AVAILABLE" = false ]; then
            print_error "Docker is required for this setup mode but not found."
            exit 1
        fi
        
        # Pull required images
        print_status "Pulling Docker images..."
        docker pull postgis/postgis:15-3.3
        docker pull redis:7-alpine
        docker pull nginx:alpine
        
        # Create Docker network
        print_status "Creating Docker network..."
        docker network create ingres_network 2>/dev/null || true
        
        print_success "Docker setup prepared!"
        print_status "Run 'docker-compose up --build' to start all services"
        ;;
        
    2)
        print_header "Setting up Development Environment..."
        
        # Backend setup
        print_status "Setting up Python backend..."
        
        if [ ! -d "backend/venv" ]; then
            print_status "Creating Python virtual environment..."
            cd backend
            python3 -m venv venv
            cd ..
        fi
        
        # Activate virtual environment and install dependencies
        print_status "Installing Python dependencies..."
        cd backend
        source venv/bin/activate
        pip install --upgrade pip
        pip install -r requirements.txt
        cd ..
        
        # Frontend setup
        print_status "Setting up React frontend..."
        cd frontend
        npm install
        cd ..
        
        # Start databases with Docker if available
        if [ "$DOCKER_AVAILABLE" = true ]; then
            print_status "Starting PostgreSQL and Redis with Docker..."
            docker-compose up -d postgres redis
            
            print_status "Waiting for database to be ready..."
            sleep 15
            
            # Initialize database
            print_status "Initializing database..."
            docker-compose exec postgres psql -U postgres -d ingres_db -f /docker-entrypoint-initdb.d/01-init.sql 2>/dev/null || true
        else
            print_warning "Install PostgreSQL with PostGIS and Redis manually"
            print_warning "Then run database/init.sql to set up the schema"
        fi
        
        print_success "Development environment ready!"
        ;;
        
    3)
        print_header "Manual Setup Mode..."
        print_status "Creating configuration files and directories only..."
        print_warning "You need to manually install and configure:"
        print_warning "- PostgreSQL with PostGIS extension"
        print_warning "- Redis server"
        print_warning "- Python dependencies (pip install -r backend/requirements.txt)"
        print_warning "- Node.js dependencies (npm install in frontend/)"
        print_warning "- Run database/init.sql to set up database schema"
        ;;
        
    *)
        print_error "Invalid choice. Please run setup again."
        exit 1
        ;;
esac

# Create startup scripts
print_header "Creating startup scripts..."

# Backend startup script
cat > start_backend.sh << 'EOF'
#!/bin/bash
echo "🐍 Starting INGRES MCP Backend Server..."
cd backend
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    echo "✅ Activated Python virtual environment"
fi
export PYTHONPATH=$PWD
python mcp_server.py
EOF

# Frontend startup script  
cat > start_frontend.sh << 'EOF'
#!/bin/bash
echo "⚛️  Starting React Frontend..."
cd frontend
npm start
EOF

# API Bridge startup script
cat > start_api_bridge.sh << 'EOF'
#!/bin/bash
echo "🌉 Starting API Bridge..."
cd backend
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi
python api_bridge.py
EOF

# Complete Docker startup script
cat > start_all_docker.sh << 'EOF'
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
EOF

# Development startup script
cat > start_dev.sh << 'EOF'
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
EOF

# Make scripts executable
chmod +x start_*.sh

# Create monitoring configuration
print_header "Creating monitoring configuration..."

mkdir -p monitoring/prometheus
cat > monitoring/prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'ingres-backend'
    static_configs:
      - targets: ['mcp_server:8000']
  - job_name: 'ingres-frontend'
    static_configs:
      - targets: ['frontend:3000']
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
EOF

# Create nginx configuration
print_header "Creating nginx configuration..."
mkdir -p nginx
cat > nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:3000;
    }
    
    upstream backend {
        server api_bridge:8001;
    }
    
    server {
        listen 80;
        server_name localhost;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        
        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        
        # Backend API
        location /api/ {
            proxy_pass http://backend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        
        # File uploads
        client_max_body_size 50M;
    }
}
EOF

# API Keys Setup Guide
print_header "📚 API Keys Setup Guide"
echo ""
print_warning "You need to obtain the following API keys:"
echo ""
echo -e "${CYAN}1. 📊 Data.gov.in API Key:${NC}"
echo "   🌐 Visit: https://api.data.gov.in/"
echo "   📝 Register and verify your email"
echo "   🔑 Get API key from dashboard"
echo "   📋 Add to .env as DATA_GOV_API_KEY"
echo ""
echo -e "${CYAN}2. 🤖 OpenAI API Key:${NC}"
echo "   🌐 Visit: https://platform.openai.com/api-keys"
echo "   💳 Create account and add billing"
echo "   🔑 Generate API key"
echo "   📋 Add to .env as OPENAI_API_KEY"
echo ""
echo -e "${CYAN}3. 🌐 Google Translate API (Optional):${NC}"
echo "   🌐 Visit: https://cloud.google.com/translate/docs/setup"
echo "   ⚙️  Enable Translation API"
echo "   🔑 Create service account key"
echo "   📋 Add to .env as GOOGLE_TRANSLATE_API_KEY"
echo ""
echo -e "${CYAN}4. 📈 Find Resource IDs from data.gov.in:${NC}"
echo "   🔍 Search 'groundwater' on data.gov.in"
echo "   📊 Open datasets and copy resource IDs from URLs"
echo "   📋 Add to .env file:"
echo "       GROUNDWATER_LEVELS_RESOURCE_ID=actual_resource_id"
echo "       WATER_QUALITY_RESOURCE_ID=actual_resource_id"
echo ""

# Final instructions
print_header "🎉 Setup Complete!"
echo ""
print_success "Next steps:"
echo ""
echo -e "${WHITE}1. 📝 Edit .env file with your API keys:${NC}"
echo "   nano .env"
echo ""
echo -e "${WHITE}2. 🚀 Start the application:${NC}"
echo ""

case $SETUP_MODE in
    1)
        echo "   ${GREEN}Docker (Recommended):${NC}"
        echo "   ./start_all_docker.sh"
        ;;
    2)
        echo "   ${GREEN}Development Mode:${NC}"
        echo "   ./start_dev.sh"
        echo ""
        echo "   ${YELLOW}Or manually:${NC}"
        echo "   Terminal 1: ./start_backend.sh"
        echo "   Terminal 2: ./start_api_bridge.sh" 
        echo "   Terminal 3: ./start_frontend.sh"
        ;;
    3)
        echo "   ${YELLOW}Manual startup (after installing dependencies):${NC}"
        echo "   ./start_dev.sh"
        ;;
esac

echo ""
echo -e "${WHITE}3. 🌐 Access the application:${NC}"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8000/health"
echo ""

print_warning "Important reminders:"
echo "📝 Configure API keys in .env before starting"
echo "🔐 Change default passwords for production"
echo "🧪 Test database connection after startup"
echo "📊 Upload sample CSV data to test functionality"
echo ""

print_success "INGRES MCP Chatbot setup completed successfully! 🚀"
print_status "Happy coding and good luck with SIH 2025! 🏆"
