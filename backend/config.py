import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # API Keys - YOU NEED TO ADD THESE
    DATA_GOV_API_KEY = os.getenv("DATA_GOV_API_KEY", "YOUR_DATA_GOV_API_KEY_HERE")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "YOUR_OPENAI_API_KEY_HERE")
    GOOGLE_TRANSLATE_API_KEY = os.getenv("GOOGLE_TRANSLATE_API_KEY", "YOUR_GOOGLE_TRANSLATE_KEY")
    
    # Database Configuration
    POSTGIS_HOST = os.getenv("POSTGIS_HOST", "localhost")
    POSTGIS_PORT = os.getenv("POSTGIS_PORT", "5432")
    POSTGIS_DB = os.getenv("POSTGIS_DB", "ingres_db")
    POSTGIS_USER = os.getenv("POSTGIS_USER", "postgres")
    POSTGIS_PASSWORD = os.getenv("POSTGIS_PASSWORD", "your_password")
    
    @property
    def DATABASE_URL(self):
        return f"postgresql://{self.POSTGIS_USER}:{self.POSTGIS_PASSWORD}@{self.POSTGIS_HOST}:{self.POSTGIS_PORT}/{self.POSTGIS_DB}"
    
    # API Endpoints
    DATA_GOV_BASE_URL = "https://api.data.gov.in/resource"
    WRIS_BASE_URL = "https://indiawris.gov.in/api"
    CGWB_BASE_URL = "https://cgwb.gov.in/api"  # If available
    
    # Resource IDs - YOU NEED TO FIND ACTUAL ONES
    RESOURCE_IDS = {
        "groundwater_levels": "your-groundwater-levels-resource-id",
        "water_quality": "your-water-quality-resource-id", 
        "resource_assessment": "your-resource-assessment-id",
        "district_data": "your-district-data-resource-id"
    }
    
    # File Storage
    UPLOAD_FOLDER = "uploads"
    DATA_FOLDER = "data"
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    
    # Redis for caching
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # Supported Languages
    SUPPORTED_LANGUAGES = {
        'en': 'English',
        'hi': 'हिंदी',
        'te': 'తెలుగు',
        'ta': 'தமிழ்',
        'kn': 'ಕನ್ನಡ',
        'ml': 'മലയാളം',
        'gu': 'ગુજરાતી',
        'mr': 'मराठी',
        'bn': 'বাংলা'
    }
    
    # District/Taluk ID Generation
    DISTRICT_ID_PREFIX = "IND_DIST_"
    TALUK_ID_PREFIX = "IND_TALUK_"

    # Performance settings
    DATABASE_POOL_SIZE = int(os.getenv("DATABASE_POOL_SIZE", "20"))
    DATABASE_MAX_OVERFLOW = int(os.getenv("DATABASE_MAX_OVERFLOW", "30"))
    
    # RAG settings
    RAG_CHUNK_SIZE = int(os.getenv("RAG_CHUNK_SIZE", "1000"))
    RAG_CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "200"))
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4")
    
    # Memory management
    CONVERSATION_MEMORY_TTL_HOURS = int(os.getenv("CONVERSATION_MEMORY_TTL_HOURS", "24"))
