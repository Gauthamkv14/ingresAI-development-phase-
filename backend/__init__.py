"""
INGRES MCP Chatbot Backend
AI-Driven Chatbot for INGRES (India Groundwater Resource Estimation System)

This is the main backend package for the INGRES MCP (Model Context Protocol) server.
It provides AI-powered groundwater data analysis, predictions, and visualizations
for the Indian water resources management.

Modules:
- api: Government API data fetching and citation management
- database: PostGIS spatial database operations
- ml_models: Machine learning predictions and trend analysis
- rag: Retrieval Augmented Generation for AI responses
- tools: MCP tools for various operations

Author: SIH 2025 Team
License: MIT
"""

import logging
import os
from pathlib import Path

# Set up logging configuration
def setup_logging():
    """Set up logging configuration for the entire backend"""
    
    # Create logs directory if it doesn't exist
    log_dir = Path(__file__).parent / "logs"
    log_dir.mkdir(exist_ok=True)
    
    # Configure logging
    log_format = '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
    
    logging.basicConfig(
        level=logging.INFO,
        format=log_format,
        handlers=[
            logging.FileHandler(log_dir / "ingres_backend.log"),
            logging.StreamHandler()  # Console output
        ]
    )
    
    # Set specific log levels for external libraries
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("requests").setLevel(logging.WARNING)
    logging.getLogger("chromadb").setLevel(logging.WARNING)
    logging.getLogger("openai").setLevel(logging.WARNING)
    
    logger = logging.getLogger(__name__)
    logger.info("INGRES Backend logging initialized")

# Version information
__version__ = "1.0.0"
__author__ = "SIH 2025 Team"
__email__ = "team@sih2025.example.com"
__description__ = "AI-Driven Chatbot for INGRES (India Groundwater Resource Estimation System)"

# Initialize logging when package is imported
setup_logging()

# Package metadata
__all__ = [
    'setup_logging',
    '__version__',
    '__author__',
    '__email__',
    '__description__'
]
