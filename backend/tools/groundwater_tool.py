import requests
import pandas as pd
from typing import Dict, Any, List, Optional
from config import Config
from database.postgis_manager import PostGISManager
from api.citation_manager import CitationManager
import logging
from datetime import datetime

class GroundwaterTool:
    def __init__(self):
        self.config = Config()
        self.db_manager = PostGISManager()
        self.citation_manager = CitationManager()
        
    async def get_groundwater_levels(
        self, 
        state: Optional[str] = None,
        district: Optional[str] = None, 
        year: Optional[str] = "2024",
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """Fetch groundwater level data with caching and citations"""
        try:
            # Try local database first if use_cache is True
            if use_cache:
                local_data = self.db_manager.query_groundwater_data({
                    'state': state,
                    'district': district,
                    'year': int(year) if year else None
                })
                
                if local_data:
                    return {
                        "success": True,
                        "data": local_data,
                        "source": "local_database",
                        "citation": self.citation_manager.generate_citation(
                            "Local PostGIS Database", 
                            "INGRES MCP Server Local Cache",
                            datetime.now()
                        ),
                        "total_records": len(local_data),
                        "cached": True
                    }
            
            # Fetch from government API
            url = f"{self.config.DATA_GOV_BASE_URL}/{self.config.RESOURCE_IDS['groundwater_levels']}"
            params = {
                "api-key": self.config.DATA_GOV_API_KEY,
                "format": "json",
                "limit": 100
            }
            
            if state:
                params["filters[state]"] = state
            if district:
                params["filters[district]"] = district  
            if year:
                params["filters[year]"] = year
                
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            api_data = response.json()
            records = api_data.get("records", [])
            
            # Process and enhance data
            processed_records = []
            for record in records:
                # Generate unique IDs for districts/taluks
                unique_district_id = self.db_manager.generate_unique_id(
                    record.get('state', ''), 
                    record.get('district', ''),
                    'district'
                )
                
                processed_record = {
                    'unique_district_id': unique_district_id,
                    'state': record.get('state', ''),
                    'district': record.get('district', ''),
                    'taluk': record.get('taluk', ''),
                    'water_level': float(record.get('water_level', 0)) if record.get('water_level') else None,
                    'year': int(record.get('year', year)) if record.get('year') else int(year),
                    'month': int(record.get('month', 1)) if record.get('month') else None,
                    'latitude': float(record.get('latitude')) if record.get('latitude') else None,
                    'longitude': float(record.get('longitude')) if record.get('longitude') else None,
                    'category': record.get('category', 'Unknown'),
                    'data_quality': self._assess_data_quality(record)
                }
                processed_records.append(processed_record)
            
            # Cache data locally
            if processed_records:
                citation = self.citation_manager.generate_citation(
                    "Government of India Open Data Platform",
                    url,
                    datetime.now()
                )
                
                self.db_manager.insert_groundwater_data(
                    processed_records, 
                    "data_gov_api",
                    citation
                )
            
            return {
                "success": True,
                "data": processed_records,
                "source": url,
                "citation": citation,
                "total_records": len(processed_records),
                "cached": False,
                "data_quality_summary": self._summarize_data_quality(processed_records)
            }
            
        except requests.RequestException as e:
            logging.error(f"API request failed: {e}")
            return {
                "success": False,
                "error": f"Failed to fetch data from government API: {str(e)}",
                "data": [],
                "fallback": "Try using cached data or check API connectivity"
            }
        except Exception as e:
            logging.error(f"Groundwater data fetch failed: {e}")
            return {
                "success": False,
                "error": f"Data processing error: {str(e)}",
                "data": []
            }
    
    def _assess_data_quality(self, record: dict) -> dict:
        """Assess data quality of individual records"""
        quality = {
            "completeness": 0.0,
            "validity": True,
            "issues": []
        }
        
        # Check completeness
        required_fields = ['state', 'district', 'water_level', 'year']
        present_fields = sum(1 for field in required_fields if record.get(field))
        quality["completeness"] = present_fields / len(required_fields)
        
        # Check validity
        if record.get('water_level'):
            try:
                water_level = float(record['water_level'])
                if water_level < -100 or water_level > 50:  # Reasonable range check
                    quality["validity"] = False
                    quality["issues"].append("Water level outside normal range")
            except (ValueError, TypeError):
                quality["validity"] = False
                quality["issues"].append("Invalid water level format")
        
        if record.get('year'):
            try:
                year = int(record['year'])
                if year < 2000 or year > datetime.now().year:
                    quality["validity"] = False
                    quality["issues"].append("Invalid year")
            except (ValueError, TypeError):
                quality["validity"] = False
                quality["issues"].append("Invalid year format")
        
        return quality
    
    def _summarize_data_quality(self, records: list) -> dict:
        """Summarize overall data quality"""
        if not records:
            return {"overall_quality": "no_data"}
        
        total_records = len(records)
        valid_records = sum(1 for record in records if record.get('data_quality', {}).get('validity', False))
        avg_completeness = sum(record.get('data_quality', {}).get('completeness', 0) for record in records) / total_records
        
        return {
            "total_records": total_records,
            "valid_records": valid_records,
            "validity_percentage": round((valid_records / total_records) * 100, 2),
            "average_completeness": round(avg_completeness * 100, 2),
            "overall_quality": "high" if valid_records / total_records > 0.9 else "medium" if valid_records / total_records > 0.7 else "low"
        }

    async def get_resource_assessment(self, state: str) -> Dict[str, Any]:
        """Get comprehensive resource assessment for a state"""
        try:
            # Fetch from API
            url = f"{self.config.DATA_GOV_BASE_URL}/{self.config.RESOURCE_IDS['resource_assessment']}"
            params = {
                "api-key": self.config.DATA_GOV_API_KEY,
                "format": "json",
                "filters[state]": state
            }
            
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            api_data = response.json()
            records = api_data.get("records", [])
            
            if not records:
                return {
                    "success": False,
                    "error": f"No resource assessment data found for {state}",
                    "data": []
                }
            
            # Process assessment data
            assessment_summary = {
                "state": state,
                "total_assessment_units": len(records),
                "category_distribution": {},
                "average_extraction_stage": 0,
                "critical_areas": [],
                "safe_areas": []
            }
            
            total_extraction = 0
            for record in records:
                category = record.get('category', 'Unknown')
                assessment_summary['category_distribution'][category] = assessment_summary['category_distribution'].get(category, 0) + 1
                
                extraction_stage = float(record.get('stage_of_extraction', 0))
                total_extraction += extraction_stage
                
                if category in ['Critical', 'Over-Exploited']:
                    assessment_summary['critical_areas'].append({
                        'district': record.get('district', ''),
                        'category': category,
                        'extraction_stage': extraction_stage
                    })
                elif category == 'Safe':
                    assessment_summary['safe_areas'].append({
                        'district': record.get('district', ''),
                        'extraction_stage': extraction_stage
                    })
            
            assessment_summary['average_extraction_stage'] = round(total_extraction / len(records), 2)
            
            citation = self.citation_manager.generate_citation(
                "Central Ground Water Board (CGWB)",
                "Dynamic Ground Water Resources Assessment",
                datetime.now()
            )
            
            return {
                "success": True,
                "data": records,
                "summary": assessment_summary,
                "source": url,
                "citation": citation,
                "recommendations": self._generate_recommendations(assessment_summary)
            }
            
        except Exception as e:
            logging.error(f"Resource assessment fetch failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": []
            }
    
    def _generate_recommendations(self, summary: dict) -> list:
        """Generate management recommendations based on assessment"""
        recommendations = []
        
        critical_count = summary['category_distribution'].get('Critical', 0) + summary['category_distribution'].get('Over-Exploited', 0)
        total_units = summary['total_assessment_units']
        
        if critical_count / total_units > 0.3:
            recommendations.append({
                "priority": "high",
                "action": "Immediate water conservation measures needed",
                "details": f"{critical_count} out of {total_units} assessment units are critical/over-exploited"
            })
        
        if summary['average_extraction_stage'] > 70:
            recommendations.append({
                "priority": "medium", 
                "action": "Monitor extraction levels closely",
                "details": f"Average extraction stage is {summary['average_extraction_stage']}%"
            })
        
        recommendations.append({
            "priority": "low",
            "action": "Regular monitoring and assessment",
            "details": "Continue systematic monitoring as per CGWB guidelines"
        })
        
        return recommendations

    async def search_comprehensive_data(self, query: str, filters: dict = None) -> Dict[str, Any]:
        """Comprehensive search across multiple data sources"""
        try:
            results = {
                "groundwater_levels": [],
                "water_quality": [],
                "resource_assessment": [],
                "local_cache": []
            }
            
            # Search local database
            local_results = self.db_manager.query_groundwater_data(filters or {})
            results["local_cache"] = local_results
            
            # Search government APIs
            for resource_type, resource_id in self.config.RESOURCE_IDS.items():
                try:
                    url = f"{self.config.DATA_GOV_BASE_URL}/{resource_id}"
                    params = {
                        "api-key": self.config.DATA_GOV_API_KEY,
                        "format": "json",
                        "q": query,
                        "limit": 20
                    }
                    
                    if filters:
                        for key, value in filters.items():
                            params[f"filters[{key}]"] = value
                    
                    response = requests.get(url, params=params, timeout=20)
                    if response.status_code == 200:
                        api_data = response.json()
                        results[resource_type] = api_data.get("records", [])
                        
                except Exception as e:
                    logging.warning(f"Failed to search {resource_type}: {e}")
                    continue
            
            # Combine and rank results
            all_results = []
            for source_type, data in results.items():
                for item in data:
                    item["result_source"] = source_type
                    all_results.append(item)
            
            citation = self.citation_manager.generate_citation(
                "Multiple Government Data Sources",
                "Comprehensive INGRES Database Search",
                datetime.now()
            )
            
            return {
                "success": True,
                "query": query,
                "total_results": len(all_results),
                "results_by_source": results,
                "combined_results": all_results[:50],  # Limit combined results
                "citation": citation,
                "search_quality": self._assess_search_quality(all_results, query)
            }
            
        except Exception as e:
            logging.error(f"Comprehensive search failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "results_by_source": {}
            }
    
    def _assess_search_quality(self, results: list, query: str) -> dict:
        """Assess the quality and relevance of search results"""
        if not results:
            return {"quality": "no_results", "relevance": 0}
        
        # Simple relevance scoring based on query terms
        query_terms = query.lower().split()
        relevant_results = 0
        
        for result in results:
            result_text = str(result).lower()
            matches = sum(1 for term in query_terms if term in result_text)
            if matches > 0:
                relevant_results += 1
        
        relevance = relevant_results / len(results) if results else 0
        
        return {
            "total_results": len(results),
            "relevant_results": relevant_results,
            "relevance_score": round(relevance * 100, 2),
            "quality": "high" if relevance > 0.7 else "medium" if relevance > 0.4 else "low"
        }
