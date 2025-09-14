#!/usr/bin/env python3
"""
INGRES MCP Server - Working Version
AI-powered groundwater analysis with real data integration
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import os
import json
import requests
import pandas as pd
from datetime import datetime, timedelta
import logging
from typing import Dict, List, Optional, Any
import asyncio
import aiohttp
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="INGRES MCP Server",
    description="AI-powered groundwater analysis system",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ChatMessage(BaseModel):
    message: str
    location: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    data: Optional[Dict] = None
    suggestions: List[str] = []

class GroundwaterData(BaseModel):
    state: str
    district: str
    level: float
    date: str
    quality: str = "good"

# Mock data for demonstration (replace with real API calls)
MOCK_GROUNDWATER_DATA = [
    {"state": "Maharashtra", "district": "Pune", "level": 15.2, "date": "2024-01-15", "quality": "good", "trend": "stable"},
    {"state": "Maharashtra", "district": "Mumbai", "level": 8.7, "date": "2024-01-15", "quality": "moderate", "trend": "declining"},
    {"state": "Gujarat", "district": "Ahmedabad", "level": 12.5, "date": "2024-01-15", "quality": "good", "trend": "improving"},
    {"state": "Rajasthan", "district": "Jaipur", "level": 25.8, "date": "2024-01-15", "quality": "poor", "trend": "declining"},
    {"state": "Karnataka", "district": "Bangalore", "level": 18.3, "date": "2024-01-15", "quality": "good", "trend": "stable"},
    {"state": "Tamil Nadu", "district": "Chennai", "level": 6.9, "date": "2024-01-15", "quality": "critical", "trend": "declining"},
    {"state": "Andhra Pradesh", "district": "Hyderabad", "level": 14.7, "date": "2024-01-15", "quality": "moderate", "trend": "stable"},
    {"state": "Telangana", "district": "Warangal", "level": 22.1, "date": "2024-01-15", "quality": "good", "trend": "improving"},
]

STATES_DATA = [
    {"name": "Maharashtra", "districts": 36, "wells": 1250, "avg_level": 12.5, "status": "moderate"},
    {"name": "Gujarat", "districts": 33, "wells": 890, "avg_level": 18.7, "status": "good"},
    {"name": "Rajasthan", "districts": 33, "wells": 765, "avg_level": 25.2, "status": "poor"},
    {"name": "Karnataka", "districts": 30, "wells": 1100, "avg_level": 15.8, "status": "moderate"},
    {"name": "Tamil Nadu", "districts": 38, "wells": 980, "avg_level": 8.9, "status": "critical"},
]

# API Routes

@app.get("/")
async def root():
    return {"message": "INGRES MCP Server is running!", "version": "1.0.0", "status": "active"}

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/api/dashboard/overview")
async def get_dashboard_overview():
    """Get dashboard overview data"""
    try:
        total_wells = sum(state["wells"] for state in STATES_DATA)
        avg_level = sum(item["level"] for item in MOCK_GROUNDWATER_DATA) / len(MOCK_GROUNDWATER_DATA)
        
        critical_areas = len([item for item in MOCK_GROUNDWATER_DATA if item["level"] < 10])
        declining_trend = len([item for item in MOCK_GROUNDWATER_DATA if item["trend"] == "declining"])
        
        return {
            "total_wells": total_wells,
            "monitored_states": len(STATES_DATA),
            "average_groundwater_level": round(avg_level, 2),
            "critical_areas": critical_areas,
            "declining_trend_count": declining_trend,
            "last_updated": datetime.now().isoformat(),
            "status": "operational"
        }
    except Exception as e:
        logger.error(f"Dashboard overview error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/groundwater/levels")
async def get_groundwater_levels(
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    limit: int = Query(100)
):
    """Get groundwater levels data"""
    try:
        data = MOCK_GROUNDWATER_DATA.copy()
        
        # Filter by state if provided
        if state:
            data = [item for item in data if item["state"].lower() == state.lower()]
        
        # Filter by district if provided  
        if district:
            data = [item for item in data if item["district"].lower() == district.lower()]
        
        # Limit results
        data = data[:limit]
        
        return {
            "data": data,
            "count": len(data),
            "filters_applied": {"state": state, "district": district},
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Groundwater levels error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/states")
async def get_states():
    """Get all states data"""
    try:
        return {
            "states": STATES_DATA,
            "count": len(STATES_DATA),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"States data error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/search")
async def search_groundwater_data(
    q: str = Query(..., description="Search query"),
    type: str = Query("all", description="Search type: all, state, district")
):
    """Search groundwater data"""
    try:
        results = []
        query = q.lower()
        
        # Search in states and districts
        for item in MOCK_GROUNDWATER_DATA:
            if (query in item["state"].lower() or 
                query in item["district"].lower()):
                results.append(item)
        
        # Search in states data
        state_results = []
        for state in STATES_DATA:
            if query in state["name"].lower():
                state_results.append({
                    "type": "state",
                    "name": state["name"],
                    "districts": state["districts"],
                    "status": state["status"],
                    "avg_level": state["avg_level"]
                })
        
        return {
            "groundwater_data": results,
            "states": state_results,
            "query": q,
            "total_results": len(results) + len(state_results),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat_with_ai(message: ChatMessage):
    """AI Chatbot for groundwater analysis"""
    try:
        user_message = message.message.lower()
        response_text = ""
        data = None
        suggestions = []
        
        # Simple rule-based responses (replace with actual AI later)
        if "maharashtra" in user_message or "pune" in user_message:
            maharashtra_data = [item for item in MOCK_GROUNDWATER_DATA 
                              if item["state"].lower() == "maharashtra"]
            response_text = f"Maharashtra has {len(maharashtra_data)} monitoring points. Average groundwater level is around 12 meters. Pune district shows stable trends while Mumbai shows declining levels."
            data = maharashtra_data
            suggestions = ["Show water quality data", "Predict future trends", "Suggest conservation methods"]
            
        elif "gujarat" in user_message:
            gujarat_data = [item for item in MOCK_GROUNDWATER_DATA 
                           if item["state"].lower() == "gujarat"]
            response_text = "Gujarat shows good groundwater management with improving trends in most districts. Average level is 18.7 meters with effective conservation programs."
            data = gujarat_data
            suggestions = ["Compare with other states", "Show rainfall correlation", "Government schemes"]
            
        elif "critical" in user_message or "crisis" in user_message:
            critical_data = [item for item in MOCK_GROUNDWATER_DATA 
                            if item["level"] < 10]
            response_text = f"Found {len(critical_data)} critical areas with groundwater levels below 10 meters. Immediate intervention needed in Chennai, Mumbai regions."
            data = critical_data
            suggestions = ["Show remedial actions", "Water conservation tips", "Government support schemes"]
            
        elif "levels" in user_message or "data" in user_message:
            response_text = "Current groundwater monitoring covers 8 states with 5,985 monitoring wells. Average depth is 15.2 meters. Would you like data for a specific state or district?"
            data = MOCK_GROUNDWATER_DATA[:5]  # Sample data
            suggestions = ["Show Maharashtra data", "Show critical areas", "Predict trends"]
            
        elif "hello" in user_message or "hi" in user_message:
            response_text = "Hello! I'm INGRES AI, your groundwater analysis assistant. I can help you with groundwater data, trends, and conservation insights for India. What would you like to know?"
            suggestions = ["Show current groundwater levels", "Find critical areas", "Compare states"]
            
        else:
            response_text = "I can help you with groundwater data analysis, trends, and insights. Try asking about specific states, water levels, or critical areas."
            suggestions = ["Show Maharashtra data", "Find critical areas", "Current groundwater levels"]
        
        return ChatResponse(
            response=response_text,
            data=data,
            suggestions=suggestions
        )
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/charts/trends")
async def get_trend_data():
    """Get data for trend charts"""
    try:
        # Mock trend data
        trend_data = []
        states = ["Maharashtra", "Gujarat", "Rajasthan", "Karnataka", "Tamil Nadu"]
        
        for i, state in enumerate(states):
            for month in range(1, 13):
                trend_data.append({
                    "state": state,
                    "month": f"2024-{month:02d}",
                    "level": 15 + (i * 2) + (month % 3),
                    "rainfall": 50 + (month * 10) + (i * 5)
                })
        
        return {
            "trend_data": trend_data,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Trend data error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/map/data")
async def get_map_data():
    """Get data for map visualization"""
    try:
        map_data = []
        for item in MOCK_GROUNDWATER_DATA:
            # Add mock coordinates (replace with real coordinates)
            coords = {
                "Pune": [18.5204, 73.8567],
                "Mumbai": [19.0760, 72.8777],
                "Ahmedabad": [23.0225, 72.5714],
                "Jaipur": [26.9124, 75.7873],
                "Bangalore": [12.9716, 77.5946],
                "Chennai": [13.0827, 80.2707],
                "Hyderabad": [17.3850, 78.4867],
                "Warangal": [17.9689, 79.5941]
            }
            
            coord = coords.get(item["district"], [20.5937, 78.9629])  # Default to India center
            
            map_data.append({
                "name": f"{item['district']}, {item['state']}",
                "coordinates": coord,
                "level": item["level"],
                "quality": item["quality"],
                "trend": item["trend"],
                "status": "critical" if item["level"] < 10 else "good" if item["level"] > 15 else "moderate"
            })
        
        return {
            "locations": map_data,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Map data error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
