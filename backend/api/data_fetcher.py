import requests
import asyncio
import aiohttp
import pandas as pd
from typing import Dict, Any, List, Optional, Union
from datetime import datetime, timedelta
import logging
import json
from urllib.parse import urlencode
import time
import hashlib
from config import Config

logger = logging.getLogger(__name__)

class DataFetcher:
    def __init__(self):
        self.config = Config()
        self.session = None
        self.rate_limit_delay = 1  # 1 second between requests
        self.last_request_time = 0
        self.cache = {}  # Simple in-memory cache
        self.cache_ttl = 300  # 5 minutes cache TTL
        
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={'User-Agent': 'INGRES-MCP-Server/1.0'}
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
    
    def _generate_cache_key(self, url: str, params: Dict[str, Any]) -> str:
        """Generate cache key for request"""
        cache_string = f"{url}_{json.dumps(params, sort_keys=True)}"
        return hashlib.md5(cache_string.encode()).hexdigest()
    
    def _is_cache_valid(self, timestamp: float) -> bool:
        """Check if cached data is still valid"""
        return time.time() - timestamp < self.cache_ttl
    
    async def _rate_limit(self):
        """Implement rate limiting"""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        
        if time_since_last < self.rate_limit_delay:
            await asyncio.sleep(self.rate_limit_delay - time_since_last)
        
        self.last_request_time = time.time()
    
    async def fetch_data_gov_resource(
        self,
        resource_id: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0,
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """Fetch data from data.gov.in API with caching and error handling"""
        
        if not self.config.DATA_GOV_API_KEY:
            logger.error("DATA_GOV_API_KEY not configured")
            return {
                "success": False,
                "error": "Data.gov.in API key not configured",
                "data": []
            }
        
        # Prepare parameters
        params = {
            "api-key": self.config.DATA_GOV_API_KEY,
            "format": "json",
            "limit": limit,
            "offset": offset
        }
        
        # Add filters
        if filters:
            for key, value in filters.items():
                if value is not None:
                    params[f"filters[{key}]"] = str(value)
        
        # Check cache
        cache_key = self._generate_cache_key(
            f"{self.config.DATA_GOV_BASE_URL}/{resource_id}",
            params
        )
        
        if use_cache and cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if self._is_cache_valid(timestamp):
                logger.info(f"Returning cached data for resource {resource_id}")
                return {
                    "success": True,
                    "data": cached_data,
                    "cached": True,
                    "source": "cache"
                }
        
        # Rate limiting
        await self._rate_limit()
        
        try:
            url = f"{self.config.DATA_GOV_BASE_URL}/{resource_id}"
            
            if not self.session:
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, params=params) as response:
                        if response.status == 200:
                            data = await response.json()
                        else:
                            raise aiohttp.ClientResponseError(
                                request_info=response.request_info,
                                history=response.history,
                                status=response.status
                            )
            else:
                async with self.session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                    else:
                        raise aiohttp.ClientResponseError(
                            request_info=response.request_info,
                            history=response.history,
                            status=response.status
                        )
            
            # Process response
            records = data.get("records", [])
            total_records = data.get("total", len(records))
            
            # Cache the results
            if use_cache:
                self.cache[cache_key] = (records, time.time())
            
            # Clean and validate data
            cleaned_records = self._clean_government_data(records)
            
            logger.info(f"Successfully fetched {len(cleaned_records)} records from {resource_id}")
            
            return {
                "success": True,
                "data": cleaned_records,
                "total_records": total_records,
                "cached": False,
                "source": "api.data.gov.in",
                "resource_id": resource_id,
                "url": url,
                "timestamp": datetime.now().isoformat()
            }
            
        except aiohttp.ClientResponseError as e:
            logger.error(f"HTTP error fetching {resource_id}: {e.status}")
            return {
                "success": False,
                "error": f"HTTP {e.status}: {e.message}",
                "data": [],
                "resource_id": resource_id
            }
            
        except Exception as e:
            logger.error(f"Error fetching data from {resource_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": [],
                "resource_id": resource_id
            }
    
    def _clean_government_data(self, records: List[Dict]) -> List[Dict]:
        """Clean and standardize government data"""
        cleaned_records = []
        
        for record in records:
            try:
                # Create cleaned record
                cleaned_record = {}
                
                # Standardize common fields
                field_mappings = {
                    'state': ['state', 'state_name', 'state_ut'],
                    'district': ['district', 'district_name'],
                    'taluk': ['taluk', 'tehsil', 'block', 'taluka'],
                    'water_level': ['water_level', 'depth_to_water', 'water_depth', 'gwl'],
                    'year': ['year', 'observation_year'],
                    'month': ['month', 'observation_month'],
                    'latitude': ['latitude', 'lat'],
                    'longitude': ['longitude', 'lng', 'lon'],
                    'category': ['category', 'stage_of_development', 'assessment_category']
                }
                
                for target_field, possible_fields in field_mappings.items():
                    for field in possible_fields:
                        if field in record and record[field] is not None:
                            cleaned_record[target_field] = record[field]
                            break
                
                # Data type conversion and validation
                if 'water_level' in cleaned_record:
                    try:
                        cleaned_record['water_level'] = float(cleaned_record['water_level'])
                    except (ValueError, TypeError):
                        cleaned_record['water_level'] = None
                
                if 'year' in cleaned_record:
                    try:
                        year = int(cleaned_record['year'])
                        if year < 2000 or year > datetime.now().year:
                            cleaned_record['year'] = None
                        else:
                            cleaned_record['year'] = year
                    except (ValueError, TypeError):
                        cleaned_record['year'] = None
                
                if 'month' in cleaned_record:
                    try:
                        month = int(cleaned_record['month'])
                        if month < 1 or month > 12:
                            cleaned_record['month'] = None
                        else:
                            cleaned_record['month'] = month
                    except (ValueError, TypeError):
                        cleaned_record['month'] = None
                
                # Coordinate validation (India bounds)
                if 'latitude' in cleaned_record:
                    try:
                        lat = float(cleaned_record['latitude'])
                        if lat < 8 or lat > 37:  # India's approximate bounds
                            cleaned_record['latitude'] = None
                        else:
                            cleaned_record['latitude'] = lat
                    except (ValueError, TypeError):
                        cleaned_record['latitude'] = None
                
                if 'longitude' in cleaned_record:
                    try:
                        lon = float(cleaned_record['longitude'])
                        if lon < 68 or lon > 97:  # India's approximate bounds
                            cleaned_record['longitude'] = None
                        else:
                            cleaned_record['longitude'] = lon
                    except (ValueError, TypeError):
                        cleaned_record['longitude'] = None
                
                # Standardize category values
                if 'category' in cleaned_record:
                    category_mappings = {
                        'safe': 'Safe',
                        'semi-critical': 'Semi-Critical',
                        'critical': 'Critical',
                        'over-exploited': 'Over-Exploited',
                        'overexploited': 'Over-Exploited',
                        'semi critical': 'Semi-Critical',
                        'over exploited': 'Over-Exploited'
                    }
                    
                    category = str(cleaned_record['category']).lower().strip()
                    cleaned_record['category'] = category_mappings.get(category, 'Unknown')
                
                # Add data quality score
                cleaned_record['data_quality_score'] = self._calculate_data_quality(cleaned_record)
                
                # Add original record reference
                cleaned_record['original_record_id'] = record.get('id', f"record_{len(cleaned_records)}")
                
                cleaned_records.append(cleaned_record)
                
            except Exception as e:
                logger.warning(f"Failed to clean record: {e}")
                continue
        
        return cleaned_records
    
    def _calculate_data_quality(self, record: Dict) -> float:
        """Calculate data quality score (0-1)"""
        score = 0.0
        total_fields = 0
        
        # Core fields and their weights
        field_weights = {
            'state': 0.2,
            'district': 0.2,
            'water_level': 0.3,
            'year': 0.15,
            'latitude': 0.075,
            'longitude': 0.075
        }
        
        for field, weight in field_weights.items():
            total_fields += weight
            if field in record and record[field] is not None:
                score += weight
        
        return round(score / total_fields if total_fields > 0 else 0, 2)
    
    async def fetch_multiple_resources(
        self,
        resource_configs: List[Dict[str, Any]],
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """Fetch data from multiple resources concurrently"""
        
        tasks = []
        for config in resource_configs:
            task = self.fetch_data_gov_resource(
                resource_id=config['resource_id'],
                filters=config.get('filters'),
                limit=config.get('limit', 100),
                offset=config.get('offset', 0),
                use_cache=use_cache
            )
            tasks.append(task)
        
        try:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            combined_results = {
                "success": True,
                "resources": {},
                "total_records": 0,
                "errors": []
            }
            
            for i, result in enumerate(results):
                resource_id = resource_configs[i]['resource_id']
                
                if isinstance(result, Exception):
                    combined_results["errors"].append({
                        "resource_id": resource_id,
                        "error": str(result)
                    })
                    combined_results["resources"][resource_id] = {
                        "success": False,
                        "error": str(result),
                        "data": []
                    }
                else:
                    combined_results["resources"][resource_id] = result
                    if result.get("success"):
                        combined_results["total_records"] += len(result.get("data", []))
            
            return combined_results
            
        except Exception as e:
            logger.error(f"Error in multi-resource fetch: {e}")
            return {
                "success": False,
                "error": str(e),
                "resources": {},
                "total_records": 0
            }
    
    async def search_datasets(self, query: str, sector: str = "water") -> Dict[str, Any]:
        """Search for datasets on data.gov.in"""
        try:
            search_url = "https://api.data.gov.in/catalog"
            params = {
                "api-key": self.config.DATA_GOV_API_KEY,
                "format": "json",
                "q": query,
                "sector": sector,
                "limit": 50
            }
            
            await self._rate_limit()
            
            if not self.session:
                async with aiohttp.ClientSession() as session:
                    async with session.get(search_url, params=params) as response:
                        if response.status == 200:
                            data = await response.json()
                        else:
                            raise aiohttp.ClientResponseError(
                                request_info=response.request_info,
                                history=response.history,
                                status=response.status
                            )
            else:
                async with self.session.get(search_url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                    else:
                        raise aiohttp.ClientResponseError(
                            request_info=response.request_info,
                            history=response.history,
                            status=response.status
                        )
            
            return {
                "success": True,
                "datasets": data.get("records", []),
                "total": data.get("total", 0),
                "query": query,
                "sector": sector
            }
            
        except Exception as e:
            logger.error(f"Dataset search failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "datasets": [],
                "total": 0
            }
    
    def clear_cache(self):
        """Clear all cached data"""
        self.cache.clear()
        logger.info("Cache cleared")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        valid_entries = 0
        expired_entries = 0
        
        current_time = time.time()
        for _, (data, timestamp) in self.cache.items():
            if current_time - timestamp < self.cache_ttl:
                valid_entries += 1
            else:
                expired_entries += 1
        
        return {
            "total_entries": len(self.cache),
            "valid_entries": valid_entries,
            "expired_entries": expired_entries,
            "cache_ttl_seconds": self.cache_ttl
        }
