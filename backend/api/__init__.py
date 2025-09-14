"""
API module for INGRES MCP server
Handles data fetching from government APIs and citation management
"""

from .data_fetcher import DataFetcher
from .citation_manager import CitationManager

__all__ = ['DataFetcher', 'CitationManager']

