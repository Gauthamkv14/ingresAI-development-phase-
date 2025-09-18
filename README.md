# 🌊 INGRES Chatbot - SIH 2025

AI-Driven Chatbot for INGRES (India Groundwater Resource Estimation System) as Virtual Assistant

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+

### 1. Clone 
git clone <your-repo-url>

### 2. Configure Environment
Edit `.env` file with your API keys:
DATA_GOV_API_KEY=your_api_key_here
OPENAI_API_KEY=your_openai_key_here

### 3. Backend Setup
cd backend
# create virtual environment
python -m venv venv
.\venv\Scripts\activate   # (Windows PowerShell)
# or
source venv/bin/activate  # (Linux/macOS)
# upgrade pip/setuptools
python -m pip install --upgrade pip setuptools wheel build
# install deps
pip install -r requirements.txt

### 4. Frontend Setup
cd ../frontend
# ensure Node 18 is active
node -v   # should be v18.20.x
npm -v    # should be 9.x
# clean old installs (if any)
rm -rf node_modules package-lock.json
npm cache clean --force
# install deps
npm install

### 5. Start Application
From root, using 2 terminals run:
1. For backend
-cd backend
-uvicorn mcp_server:app --host 0.0.0.0 --port 8000 --reload

2. For frontend
-cd frontend
-npm start

### 4. Access Application
- Frontend: http://localhost:3000
- API: http://localhost:8000
- Health Check: http://localhost:8000/health
- 

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

### 3. Find Resource IDs
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
├── data/ # Processed data & mode
└── .env # Environment variables


## 🧪 Testing

### Backend Tests
cd backend
source venv/bin/activate
python -m pytest


### Frontend Tests
cd frontend
npm test


## 📊 API Documentation

### REST API Endpoints
- `GET /health` - Health check
- `GET /api/files` - List files
- `GET /api/groundwater` - Get groundwater data


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

### Getting Help
1. Check logs in `logs/` directory
2. Verify environment configuration
3. Test individual components
4. Review API documentation

## 📄 License
-

## 👥 Contributors

Team GroundZero - AI-Driven Chatbot for INGRES for SIH 25

## 🙏 Acknowledgments

- Central Ground Water Board (CGWB)
- India-WRIS Team
- Smart India Hackathon 2025
- Open Government Data Platform India

## 📞 Support & Contact

- **Email:** 1ds23is051.dsce.edu.in

---

**Made with ❤️ for Smart India Hackathon 2025 🇮🇳**

*Empowering India's water resource management through AI and data science.*


