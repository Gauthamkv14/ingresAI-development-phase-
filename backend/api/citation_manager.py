from typing import Dict, Any, Optional
from datetime import datetime
import hashlib

class CitationManager:
    def __init__(self):
        self.citation_styles = {
            'apa': self._format_apa_citation,
            'mla': self._format_mla_citation,
            'chicago': self._format_chicago_citation,
            'government': self._format_government_citation
        }
    
    def generate_citation(self, 
                         source_name: str, 
                         source_url: str, 
                         access_date: datetime,
                         additional_info: str = None,
                         style: str = 'government') -> str:
        """Generate standardized citation for data sources"""
        
        citation_data = {
            'source_name': source_name,
            'source_url': source_url,
            'access_date': access_date,
            'additional_info': additional_info
        }
        
        if style in self.citation_styles:
            return self.citation_styles[style](citation_data)
        else:
            return self.citation_styles['government'](citation_data)
    
    def _format_government_citation(self, data: Dict[str, Any]) -> str:
        """Format citation for government data sources"""
        citation_parts = []
        
        # Source organization
        citation_parts.append(data['source_name'])
        
        # Date accessed
        access_date_str = data['access_date'].strftime('%Y-%m-%d')
        citation_parts.append(f"Accessed: {access_date_str}")
        
        # Source URL or identifier
        if data['source_url']:
            if data['source_url'].startswith('http'):
                citation_parts.append(f"URL: {data['source_url']}")
            else:
                citation_parts.append(f"Source: {data['source_url']}")
        
        # Additional information
        if data['additional_info']:
            citation_parts.append(data['additional_info'])
        
        return " | ".join(citation_parts)
    
    def _format_apa_citation(self, data: Dict[str, Any]) -> str:
        """Format citation in APA style"""
        year = data['access_date'].year
        access_date_str = data['access_date'].strftime('%B %d, %Y')
        
        citation = f"{data['source_name']} ({year}). Retrieved {access_date_str}"
        
        if data['source_url'] and data['source_url'].startswith('http'):
            citation += f", from {data['source_url']}"
        
        return citation
    
    def _format_mla_citation(self, data: Dict[str, Any]) -> str:
        """Format citation in MLA style"""
        access_date_str = data['access_date'].strftime('%d %b %Y')
        
        citation = f'"{data["source_name"]}" Web. {access_date_str}'
        
        if data['source_url'] and data['source_url'].startswith('http'):
            citation = f'"{data["source_name"]}" {data["source_url"]}. Web. {access_date_str}'
        
        return citation
    
    def _format_chicago_citation(self, data: Dict[str, Any]) -> str:
        """Format citation in Chicago style"""
        access_date_str = data['access_date'].strftime('%B %d, %Y')
        
        citation = f'{data["source_name"]}, accessed {access_date_str}'
        
        if data['source_url'] and data['source_url'].startswith('http'):
            citation += f', {data["source_url"]}'
        
        return citation + '.'
    
    def generate_batch_citation(self, sources: list, style: str = 'government') -> Dict[str, Any]:
        """Generate citations for multiple sources"""
        citations = []
        
        for source in sources:
            if isinstance(source, dict):
                citation = self.generate_citation(
                    source.get('source_name', 'Unknown Source'),
                    source.get('source_url', ''),
                    source.get('access_date', datetime.now()),
                    source.get('additional_info'),
                    style
                )
                citations.append({
                    'source': source.get('source_name', 'Unknown Source'),
                    'citation': citation
                })
        
        return {
            "citations": citations,
            "style": style,
            "generated_date": datetime.now().isoformat(),
            "total_sources": len(citations)
        }
    
    def validate_citation_completeness(self, citation_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate if citation has all required information"""
        required_fields = ['source_name', 'access_date']
        optional_fields = ['source_url', 'additional_info']
        
        missing_required = [field for field in required_fields if not citation_data.get(field)]
        missing_optional = [field for field in optional_fields if not citation_data.get(field)]
        
        completeness_score = (len(required_fields) - len(missing_required)) / len(required_fields)
        if not missing_optional:
            completeness_score = 1.0
        elif len(missing_optional) < len(optional_fields):
            completeness_score += 0.1
            
        return {
            "is_complete": len(missing_required) == 0,
            "completeness_score": round(completeness_score, 2),
            "missing_required": missing_required,
            "missing_optional": missing_optional,
            "quality_rating": "high" if completeness_score > 0.8 else "medium" if completeness_score > 0.5 else "low"
        }
