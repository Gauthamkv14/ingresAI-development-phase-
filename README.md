# 🌊 INGRES MCP Chatbot - SIH 2025

AI-Driven Chatbot for INGRES (India Groundwater Resource Estimation System) as Virtual Assistant

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose (recommended)
- PostgreSQL with PostGIS (if not using Docker)

### 1. Clone & Setup
git clone <your-repo-url>
cd ingres-mcp-chatbot
chmod +x setup.sh
./setup.sh

### 2. Configure Environment
Edit `.env` file with your API keys:
DATA_GOV_API_KEY=your_api_key_here
OPENAI_API_KEY=your_openai_key_here
GOOGLE_TRANSLATE_API_KEY=your_translate_key_here


### 3. Start Application
Option A: Docker (Recommended)
./start_all_docker.sh
Option B: Manual
./start_backend.sh # Terminal 1
./start_api_bridge.sh # Terminal 2
./start_frontend.sh # Terminal 3


### 4. Access Application
- Frontend: http://localhost:3000
- API: http://localhost:8000
- Health Check: http://localhost:8000/health

## 📋 Required API Keys & Configuration

### 1. Data.gov.in API Key
1. Visit https://data.gov.in/api
2. Register for account
3. Get API key
4. Add to `.env` as `DATA_GOV_API_KEY`

### 2. OpenAI API Key
1. Visit https://platform.openai.com/api-keys
2. Create account and billing
3. Generate API key
4. Add to `.env` as `OPENAI_API_KEY`

### 3. Google Translate API (Optional)
1. Visit Google Cloud Console
2. Enable Translation API
3. Create credentials
4. Add to `.env` as `GOOGLE_TRANSLATE_API_KEY`

### 4. Find Resource IDs
1. Search data.gov.in for groundwater datasets
2. Copy resource IDs from dataset URLs
3. Add to `.env` file:
GROUNDWATER_LEVELS_RESOURCE_ID=actual_resource_id
WATER_QUALITY_RESOURCE_ID=actual_resource_id
RESOURCE_ASSESSMENT_RESOURCE_ID=actual_resource_id


## 🏗️ Project Structure
ingres-mcp-chatbot/
├── backend/ # Python MCP Server
│ ├── mcp_server.py # Main MCP server
│ ├── api_bridge.py # FastAPI bridge for frontend
│ ├── tools/ # MCP tools
│ ├── rag/ # RAG implementation
│ ├── database/ # Database models
│ └── requirements.txt # Python dependencies
├── frontend/ # React Frontend
│ ├── src/
│ │ ├── components/ # React components
│ │ ├── contexts/ # React contexts
│ │ ├── hooks/ # Custom hooks
│ │ └── utils/ # Utilities
│ └── package.json # Node dependencies
├── database/
│ └── init.sql # Database initialization
├── uploads/ # File uploads
├── data/ # Processed data & models
├── docker-compose.yml # Docker services
└── .env # Environment variables


## 🔧 Features

### Core Functionality
- ✅ Natural language Q&A over INGRES data
- ✅ Real-time groundwater data fetching
- ✅ Interactive data visualizations
- ✅ CSV file upload and processing
- ✅ Multi-language support (9 Indian languages)
- ✅ ML-based water level predictions
- ✅ Citation system for data transparency

### Technical Features
- ✅ MCP (Model Context Protocol) architecture
- ✅ RAG (Retrieval Augmented Generation)
- ✅ PostGIS spatial database
- ✅ Redis caching
- ✅ Docker containerization
- ✅ Session management
- ✅ File upload/download

## 🧪 Testing

### Backend Tests
cd backend
source venv/bin/activate
python -m pytest


### Frontend Tests
cd frontend
npm test


## 🚢 Deployment

### Docker Production
docker-compose -f docker-compose.prod.yml up -d


### Manual Production
1. Set `ENVIRONMENT=production` in `.env`
2. Build frontend: `cd frontend && npm run build`
3. Start with production settings

## 📊 API Documentation

### MCP Tools Available
- `get_groundwater_levels` - Fetch groundwater data
- `get_resource_assessment` - Get state assessments
- `search_comprehensive_data` - Natural language search
- `rag_query` - Chat with AI assistant
- `predict_water_levels` - ML predictions
- `create_interactive_chart` - Generate visualizations
- `upload_csv_data` - File upload processing
- `translate_text` - Multi-language support

### REST API Endpoints
- `GET /health` - Health check
- `POST /api/mcp/call-tool` - Call MCP tools
- `POST /api/upload` - File upload
- `GET /api/files` - List files
- `GET /api/groundwater` - Get groundwater data

## 🛠️ Development

### Backend Development
cd backend
source venv/bin/activate
python mcp_server.py


### Frontend Development
cd frontend
npm start


### Add New MCP Tool
1. Create tool in `backend/tools/`
2. Register in `mcp_server.py`
3. Add frontend integration
4. Update documentation

## 🔍 Troubleshooting

### Common Issues

**Database Connection Failed**
- Check PostgreSQL is running
- Verify connection string in `.env`
- Ensure PostGIS extension is installed

**API Key Errors**
- Verify API keys in `.env` file
- Check API key permissions and quotas
- Test API endpoints manually

**File Upload Issues**
- Check file size limits (10MB default)
- Verify upload directory permissions
- Ensure CSV format compliance

**MCP Server Not Starting**
- Check Python version (3.11+ required)
- Verify all dependencies installed
- Check log files in `logs/` directory

### Getting Help
1. Check logs in `logs/` directory
2. Verify environment configuration
3. Test individual components
4. Review API documentation

## 📄 License

MIT License - See LICENSE file for details

## 👥 Contributors

SIH 2025 Team - AI-Driven Chatbot for INGRES

## 🙏 Acknowledgments

- Central Ground Water Board (CGWB)
- India-WRIS Team
- Smart India Hackathon 2025
- Open Government Data Platform India

## 📞 Support & Contact

- **Email:** team@sih2025.example.com
- **Documentation:** [Wiki](../../wiki)

---

**Made with ❤️ for Smart India Hackathon 2025 🇮🇳**

*Empowering India's water resource management through AI and data science.*


