"""
Machine Learning models for INGRES MCP server
Handles water level predictions and trend analysis
"""

from .water_predictor import WaterLevelPredictor
from .trend_analyzer import TrendAnalyzer

__all__ = ['WaterLevelPredictor', 'TrendAnalyzer']
