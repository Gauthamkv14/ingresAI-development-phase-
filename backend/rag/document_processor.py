import re
import json
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import logging
import pandas as pd
import numpy as np
from pathlib import Path
import hashlib
import pickle
import os
from config import Config

logger = logging.getLogger(__name__)

class DocumentProcessor:
    def __init__(self):
        self.config = Config()
        self.processed_docs_cache = {}
        self.entity_patterns = self._compile_entity_patterns()
        
    def _compile_entity_patterns(self) -> Dict[str, Any]:
        """Compile regex patterns for entity extraction"""
        patterns = {
            # Indian states and UTs
            'states': re.compile(r'\b(?:Andhra Pradesh|Arunachal Pradesh|Assam|Bihar|Chhattisgarh|Goa|Gujarat|Haryana|Himachal Pradesh|Jharkhand|Karnataka|Kerala|Madhya Pradesh|Maharashtra|Manipur|Meghalaya|Mizoram|Nagaland|Odisha|Punjab|Rajasthan|Sikkim|Tamil Nadu|Telangana|Tripura|Uttar Pradesh|Uttarakhand|West Bengal|Andaman and Nicobar Islands|Chandigarh|Dadra and Nagar Haveli|Daman and Diu|Delhi|Jammu and Kashmir|Ladakh|Lakshadweep|Puducherry)\b', re.IGNORECASE),
            
            # Water level measurements
            'water_levels': re.compile(r'(?:water level|groundwater level|depth to water|water depth|water table|piezometric level|static water level)[\s:]*(?:is|of|at|=)?\s*([+-]?\d+\.?\d*)\s*(m|meter|meters|ft|feet|bgl|mbgl)', re.IGNORECASE),
            
            # Coordinates
            'coordinates': re.compile(r'(?:lat|latitude)[\s:]*([+-]?\d+\.?\d+)[°\s]*(?:N|n)?\s*,?\s*(?:lon|long|longitude)[\s:]*([+-]?\d+\.?\d+)[°\s]*(?:E|e)?', re.IGNORECASE),
            
            # Years
            'years': re.compile(r'\b(19\d{2}|20[0-4]\d)\b'),
            
            # Groundwater categories
            'categories': re.compile(r'\b(?:safe|semi-critical|semi critical|critical|over-exploited|over exploited|overexploited)\b', re.IGNORECASE),
            
            # Water quality parameters
            'quality_params': re.compile(r'(?:pH|TDS|fluoride|arsenic|nitrate|chloride|sulphate|hardness)[\s:]*(?:is|of|at|=)?\s*([+-]?\d+\.?\d*)\s*(?:mg/l|ppm|µg/l)', re.IGNORECASE),
            
            # Organizations
            'organizations': re.compile(r'\b(?:CGWB|Central Ground Water Board|WRIS|India-WRIS|CWC|Central Water Commission|GSI|Geological Survey of India|IMD|Indian Meteorological Department)\b', re.IGNORECASE),
            
            # Technical terms
            'technical_terms': re.compile(r'\b(?:aquifer|confined aquifer|unconfined aquifer|perched aquifer|water table|piezometer|tube well|bore well|open well|recharge|discharge|extraction|pumping|hydraulic conductivity|transmissivity|storativity|cone of depression)\b', re.IGNORECASE)
        }
        
        return patterns
    
    def process_groundwater_document(self, content: str, source: str, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Process a groundwater-related document for RAG system"""
        try:
            start_time = datetime.now()
            
            if not content or not content.strip():
                return {
                    "success": False,
                    "error": "Empty document content"
                }
            
            # Generate document hash for caching
            doc_hash = hashlib.md5(content.encode()).hexdigest()
            
            if doc_hash in self.processed_docs_cache:
                logger.info(f"Retrieved cached processed document {doc_hash[:8]}")
                return self.processed_docs_cache[doc_hash]
            
            # Clean and preprocess content
            cleaned_content = self._clean_content(content)
            
            # Extract entities and structured information
            entities = self._extract_entities(cleaned_content)
            
            # Split into chunks
            chunks = self._create_chunks(cleaned_content)
            
            # Enhance chunks with metadata and entities
            enhanced_chunks = self._enhance_chunks(chunks, entities, metadata or {})
            
            # Generate document summary
            summary = self._generate_summary(cleaned_content, entities)
            
            # Calculate processing metrics
            processing_time = (datetime.now() - start_time).total_seconds()
            
            result = {
                "success": True,
                "document_id": doc_hash,
                "source": source,
                "original_length": len(content),
                "cleaned_length": len(cleaned_content),
                "chunk_count": len(enhanced_chunks),
                "chunks": enhanced_chunks,
                "entities": entities,
                "summary": summary,
                "metadata": {
                    "processed_at": datetime.now().isoformat(),
                    "processing_time_seconds": processing_time,
                    "content_type": self._detect_content_type(content),
                    **metadata
                },
                "quality_score": self._calculate_quality_score(content, entities)
            }
            
            # Cache the result
            self.processed_docs_cache[doc_hash] = result
            
            logger.info(f"Processed document {doc_hash[:8]} into {len(enhanced_chunks)} chunks in {processing_time:.2f}s")
            
            return result
            
        except Exception as e:
            logger.error(f"Document processing failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _clean_content(self, content: str) -> str:
        """Clean and normalize document content"""
        # Remove extra whitespace
        content = re.sub(r'\s+', ' ', content)
        
        # Remove special characters but keep important punctuation
        content = re.sub(r'[^\w\s\.\,\;\:\!\?\-\(\)\[\]\{\}\/\\\"\'\%\°\+\=]', ' ', content)
        
        # Normalize common groundwater terms
        replacements = {
            'ground water': 'groundwater',
            'ground-water': 'groundwater',
            'mbgl': 'meters below ground level',
            'bgl': 'below ground level',
            'masl': 'meters above sea level',
            'msl': 'mean sea level',
            'cu m': 'cubic meters',
            'mcm': 'million cubic meters',
            'bcm': 'billion cubic meters'
        }
        
        for old, new in replacements.items():
            content = re.sub(re.escape(old), new, content, flags=re.IGNORECASE)
        
        # Remove URLs and email addresses
        content = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', content)
        content = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '', content)
        
        # Clean up extra spaces
        content = re.sub(r'\s+', ' ', content).strip()
        
        return content
    
    def _extract_entities(self, content: str) -> Dict[str, List[Dict[str, Any]]]:
        """Extract relevant entities from groundwater documents"""
        entities = {
            'locations': [],
            'measurements': [],
            'coordinates': [],
            'dates': [],
            'categories': [],
            'quality_parameters': [],
            'organizations': [],
            'technical_terms': []
        }
        
        try:
            # Extract states and locations
            state_matches = self.entity_patterns['states'].finditer(content)
            for match in state_matches:
                entities['locations'].append({
                    'type': 'state',
                    'value': match.group().strip(),
                    'position': match.span(),
                    'confidence': 0.9
                })
            
            # Extract water level measurements
            water_level_matches = self.entity_patterns['water_levels'].finditer(content)
            for match in water_level_matches:
                try:
                    value = float(match.group(1))
                    unit = match.group(2).lower()
                    
                    # Convert to meters if needed
                    if unit in ['ft', 'feet']:
                        value = value * 0.3048
                        unit = 'meters'
                    
                    entities['measurements'].append({
                        'type': 'water_level',
                        'value': round(value, 2),
                        'unit': unit,
                        'original_text': match.group(),
                        'position': match.span(),
                        'confidence': 0.8
                    })
                except ValueError:
                    continue
            
            # Extract coordinates
            coord_matches = self.entity_patterns['coordinates'].finditer(content)
            for match in coord_matches:
                try:
                    lat = float(match.group(1))
                    lon = float(match.group(2))
                    
                    # Validate coordinates are within India
                    if 8 <= lat <= 37 and 68 <= lon <= 97:
                        entities['coordinates'].append({
                            'latitude': lat,
                            'longitude': lon,
                            'original_text': match.group(),
                            'position': match.span(),
                            'confidence': 0.9
                        })
                except ValueError:
                    continue
            
            # Extract years
            year_matches = self.entity_patterns['years'].finditer(content)
            for match in year_matches:
                year = int(match.group())
                if 1990 <= year <= datetime.now().year:
                    entities['dates'].append({
                        'type': 'year',
                        'value': year,
                        'original_text': match.group(),
                        'position': match.span(),
                        'confidence': 0.8
                    })
            
            # Extract groundwater categories
            category_matches = self.entity_patterns['categories'].finditer(content)
            for match in category_matches:
                category = match.group().strip().lower()
                # Standardize category names
                standard_categories = {
                    'safe': 'Safe',
                    'semi-critical': 'Semi-Critical',
                    'semi critical': 'Semi-Critical',
                    'critical': 'Critical',
                    'over-exploited': 'Over-Exploited',
                    'over exploited': 'Over-Exploited',
                    'overexploited': 'Over-Exploited'
                }
                
                if category in standard_categories:
                    entities['categories'].append({
                        'value': standard_categories[category],
                        'original_text': match.group(),
                        'position': match.span(),
                        'confidence': 0.85
                    })
            
            # Extract water quality parameters
            quality_matches = self.entity_patterns['quality_params'].finditer(content)
            for match in quality_matches:
                try:
                    param_name = match.group().split(':')[0].split('=')[0].strip()
                    value = float(match.group(1))
                    
                    entities['quality_parameters'].append({
                        'parameter': param_name,
                        'value': value,
                        'original_text': match.group(),
                        'position': match.span(),
                        'confidence': 0.7
                    })
                except (ValueError, IndexError):
                    continue
            
            # Extract organizations
            org_matches = self.entity_patterns['organizations'].finditer(content)
            for match in org_matches:
                entities['organizations'].append({
                    'name': match.group().strip(),
                    'original_text': match.group(),
                    'position': match.span(),
                    'confidence': 0.9
                })
            
            # Extract technical terms
            tech_matches = self.entity_patterns['technical_terms'].finditer(content)
            unique_terms = set()
            for match in tech_matches:
                term = match.group().strip().lower()
                if term not in unique_terms:
                    unique_terms.add(term)
                    entities['technical_terms'].append({
                        'term': term,
                        'original_text': match.group(),
                        'position': match.span(),
                        'confidence': 0.6
                    })
            
        except Exception as e:
            logger.warning(f"Entity extraction failed: {e}")
        
        # Filter out low-confidence entities
        for entity_type in entities:
            entities[entity_type] = [e for e in entities[entity_type] if e.get('confidence', 0) > 0.5]
        
        return entities
    
    def _create_chunks(self, content: str, chunk_size: int = 1000, overlap: int = 200) -> List[Dict[str, Any]]:
        """Create overlapping chunks from document content"""
        chunks = []
        
        # Split by paragraphs first
        paragraphs = [p.strip() for p in content.split('\n') if p.strip()]
        
        if not paragraphs:
            # Fallback to sentence splitting
            sentences = [s.strip() for s in re.split(r'[.!?]+', content) if s.strip()]
            paragraphs = sentences
        
        current_chunk = ""
        chunk_id = 0
        
        for para in paragraphs:
            # Check if adding this paragraph would exceed chunk size
            if len(current_chunk) + len(para) > chunk_size and current_chunk:
                # Save current chunk
                chunks.append({
                    'id': chunk_id,
                    'content': current_chunk.strip(),
                    'length': len(current_chunk),
                    'start_pos': content.find(current_chunk.split()[0]) if current_chunk.split() else 0
                })
                
                chunk_id += 1
                
                # Start new chunk with overlap
                if overlap > 0 and len(current_chunk) > overlap:
                    overlap_text = current_chunk[-overlap:]
                    # Find a good break point
                    break_point = overlap_text.rfind('. ')
                    if break_point > overlap // 2:
                        overlap_text = overlap_text[break_point + 2:]
                    
                    current_chunk = overlap_text + " " + para
                else:
                    current_chunk = para
            else:
                # Add to current chunk
                if current_chunk:
                    current_chunk += " " + para
                else:
                    current_chunk = para
        
        # Add final chunk
        if current_chunk.strip():
            chunks.append({
                'id': chunk_id,
                'content': current_chunk.strip(),
                'length': len(current_chunk),
                'start_pos': content.find(current_chunk.split()[0]) if current_chunk.split() else 0
            })
        
        return chunks
    
    def _enhance_chunks(self, chunks: List[Dict], entities: Dict[str, List], metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Enhance chunks with entity information and metadata"""
        enhanced_chunks = []
        
        for chunk in chunks:
            chunk_content = chunk['content']
            chunk_start = chunk.get('start_pos', 0)
            chunk_end = chunk_start + chunk['length']
            
            # Find entities that appear in this chunk
            chunk_entities = {}
            for entity_type, entity_list in entities.items():
                chunk_entities[entity_type] = []
                for entity in entity_list:
                    entity_pos = entity.get('position', (0, 0))
                    if chunk_start <= entity_pos[0] <= chunk_end:
                        chunk_entities[entity_type].append(entity)
            
            # Create enhanced chunk
            enhanced_chunk = {
                **chunk,
                'entities': chunk_entities,
                'entity_count': sum(len(elist) for elist in chunk_entities.values()),
                'metadata': {
                    'has_measurements': len(chunk_entities.get('measurements', [])) > 0,
                    'has_coordinates': len(chunk_entities.get('coordinates', [])) > 0,
                    'has_locations': len(chunk_entities.get('locations', [])) > 0,
                    'has_dates': len(chunk_entities.get('dates', [])) > 0,
                    'has_categories': len(chunk_entities.get('categories', [])) > 0,
                    'complexity_score': self._calculate_chunk_complexity(chunk_content),
                    'relevance_score': self._calculate_chunk_relevance(chunk_content),
                    **metadata
                }
            }
            
            enhanced_chunks.append(enhanced_chunk)
        
        return enhanced_chunks
    
    def _calculate_chunk_complexity(self, content: str) -> float:
        """Calculate complexity score for a chunk (0-1)"""
        try:
            # Factors that contribute to complexity
            score = 0.0
            
            # Technical term density
            tech_terms = len(self.entity_patterns['technical_terms'].findall(content))
            score += min(tech_terms / 10, 0.3)  # Max 0.3 from technical terms
            
            # Number density (measurements, coordinates)
            numbers = len(re.findall(r'\d+\.?\d*', content))
            score += min(numbers / 20, 0.2)  # Max 0.2 from numbers
            
            # Sentence complexity (average words per sentence)
            sentences = re.split(r'[.!?]+', content)
            if sentences:
                avg_words = np.mean([len(s.split()) for s in sentences if s.strip()])
                if avg_words > 15:
                    score += min((avg_words - 15) / 35, 0.2)  # Max 0.2 from sentence length
            
            # Vocabulary richness
            words = content.lower().split()
            if words:
                unique_ratio = len(set(words)) / len(words)
                score += unique_ratio * 0.3  # Max 0.3 from vocabulary richness
            
            return min(score, 1.0)
            
        except Exception as e:
            logger.warning(f"Complexity calculation failed: {e}")
            return 0.5  # Default medium complexity
    
    def _calculate_chunk_relevance(self, content: str) -> float:
        """Calculate relevance score for groundwater domain (0-1)"""
        try:
            score = 0.0
            content_lower = content.lower()
            
            # Core groundwater terms
            core_terms = ['groundwater', 'water level', 'aquifer', 'well', 'recharge', 'extraction']
            core_count = sum(1 for term in core_terms if term in content_lower)
            score += min(core_count / len(core_terms), 0.4)  # Max 0.4 from core terms
            
            # Location relevance (Indian states/districts)
            if self.entity_patterns['states'].search(content):
                score += 0.2
            
            # Measurement relevance
            if self.entity_patterns['water_levels'].search(content):
                score += 0.2
            
            # Organizational credibility
            if self.entity_patterns['organizations'].search(content):
                score += 0.1
            
            # Temporal relevance (recent years)
            years = [int(y) for y in re.findall(r'\b(20[0-2]\d)\b', content)]
            if years:
                recent_years = [y for y in years if y >= 2010]
                if recent_years:
                    score += 0.1
            
            return min(score, 1.0)
            
        except Exception as e:
            logger.warning(f"Relevance calculation failed: {e}")
            return 0.5
    
    def _generate_summary(self, content: str, entities: Dict[str, List]) -> Dict[str, Any]:
        """Generate a summary of the document content"""
        try:
            word_count = len(content.split())
            char_count = len(content)
            
            # Key topics based on entity frequency
            key_locations = [e['value'] for e in entities.get('locations', [])]
            key_measurements = [e['value'] for e in entities.get('measurements', [])]
            key_categories = [e['value'] for e in entities.get('categories', [])]
            key_dates = [e['value'] for e in entities.get('dates', [])]
            
            # Most frequent terms (excluding common words)
            words = content.lower().split()
            stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'must', 'this', 'that', 'these', 'those'}
            
            content_words = [w for w in words if w not in stop_words and len(w) > 3]
            word_freq = {}
            for word in content_words:
                word_freq[word] = word_freq.get(word, 0) + 1
            
            top_terms = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:10]
            
            summary = {
                'word_count': word_count,
                'character_count': char_count,
                'entity_summary': {
                    'locations_mentioned': len(set(key_locations)),
                    'measurements_found': len(key_measurements),
                    'categories_found': len(set(key_categories)),
                    'date_range': f"{min(key_dates)}-{max(key_dates)}" if key_dates else None,
                    'total_entities': sum(len(entity_list) for entity_list in entities.values())
                },
                'top_terms': [{'term': term, 'frequency': freq} for term, freq in top_terms],
                'content_type': self._detect_content_type(content),
                'estimated_reading_time_minutes': max(1, word_count // 200)
            }
            
            return summary
            
        except Exception as e:
            logger.warning(f"Summary generation failed: {e}")
            return {'error': str(e)}
    
    def _detect_content_type(self, content: str) -> str:
        """Detect the type of content (report, data, technical, etc.)"""
        content_lower = content.lower()
        
        # Check for data patterns
        if re.search(r'\b\d+\.?\d*\s*(?:m|meter|ft|feet|bgl|mbgl)', content):
            if re.search(r'\b(?:table|data|record|measurement|observation)\b', content_lower):
                return 'data_table'
        
        # Check for technical report patterns
        if re.search(r'\b(?:abstract|introduction|methodology|conclusion|reference)\b', content_lower):
            return 'technical_report'
        
        # Check for policy/guideline patterns
        if re.search(r'\b(?:guideline|policy|regulation|standard|procedure)\b', content_lower):
            return 'policy_document'
        
        # Check for news/announcement patterns
        if re.search(r'\b(?:announced|reported|stated|according to|press release)\b', content_lower):
            return 'news_article'
        
        # Default
        return 'general_document'
    
    def _calculate_quality_score(self, content: str, entities: Dict[str, List]) -> float:
        """Calculate overall document quality score (0-1)"""
        try:
            score = 0.0
            
            # Content length score
            word_count = len(content.split())
            if word_count >= 100:
                score += min(word_count / 1000, 0.2)  # Max 0.2 for length
            
            # Entity richness score
            total_entities = sum(len(entity_list) for entity_list in entities.values())
            score += min(total_entities / 20, 0.3)  # Max 0.3 for entities
            
            # Information density score
            info_density = total_entities / max(word_count / 100, 1)  # Entities per 100 words
            score += min(info_density / 5, 0.2)  # Max 0.2 for density
            
            # Structured data score
            structured_score = 0
            if entities.get('measurements'):
                structured_score += 0.1
            if entities.get('coordinates'):
                structured_score += 0.1
            if entities.get('dates'):
                structured_score += 0.05
            if entities.get('locations'):
                structured_score += 0.1
            if entities.get('organizations'):
                structured_score += 0.05
            
            score += min(structured_score, 0.3)  # Max 0.3 for structured data
            
            return min(score, 1.0)
            
        except Exception as e:
            logger.warning(f"Quality score calculation failed: {e}")
            return 0.5
    
    def process_csv_data(self, csv_content: str, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Process CSV data specifically for groundwater information"""
        try:
            # Parse CSV
            from io import StringIO
            df = pd.read_csv(StringIO(csv_content))
            
            if df.empty:
                return {
                    "success": False,
                    "error": "Empty CSV data"
                }
            
            # Convert DataFrame to narrative text for RAG processing
            narrative_chunks = []
            
            for idx, row in df.iterrows():
                # Create narrative description for each row
                narrative_parts = []
                
                for col, val in row.items():
                    if pd.notna(val) and val != '':
                        if col.lower() in ['state', 'district', 'taluk', 'block']:
                            narrative_parts.append(f"located in {col} {val}")
                        elif col.lower() in ['water_level', 'depth', 'gwl']:
                            narrative_parts.append(f"water level is {val} meters")
                        elif col.lower() in ['year', 'observation_year']:
                            narrative_parts.append(f"measured in year {val}")
                        elif col.lower() in ['month', 'observation_month']:
                            narrative_parts.append(f"during month {val}")
                        elif col.lower() in ['category', 'classification']:
                            narrative_parts.append(f"classified as {val}")
                        elif col.lower() in ['latitude', 'lat']:
                            narrative_parts.append(f"latitude {val}")
                        elif col.lower() in ['longitude', 'lon', 'lng']:
                            narrative_parts.append(f"longitude {val}")
                        else:
                            narrative_parts.append(f"{col} is {val}")
                
                if narrative_parts:
                    narrative = f"Groundwater observation {idx + 1}: " + ", ".join(narrative_parts) + "."
                    narrative_chunks.append({
                        'content': narrative,
                        'row_index': idx,
                        'source': 'csv_data',
                        'metadata': {
                            'original_row': row.to_dict(),
                            'data_completeness': row.notna().sum() / len(row),
                            'has_coordinates': pd.notna(row.get('latitude')) and pd.notna(row.get('longitude')),
                            'has_water_level': any(pd.notna(row.get(col)) for col in ['water_level', 'depth', 'gwl']),
                            'has_location': any(pd.notna(row.get(col)) for col in ['state', 'district'])
                        }
                    })
            
            # Process the combined narrative
            combined_content = "\n".join([chunk['content'] for chunk in narrative_chunks])
            processed_doc = self.process_groundwater_document(combined_content, "CSV Data", metadata)
            
            if processed_doc['success']:
                processed_doc['csv_info'] = {
                    'total_rows': len(df),
                    'columns': list(df.columns),
                    'data_types': df.dtypes.to_dict(),
                    'missing_data_summary': df.isnull().sum().to_dict(),
                    'narrative_chunks': len(narrative_chunks)
                }
                
                # Add CSV-specific entities
                csv_entities = self._extract_csv_entities(df)
                processed_doc['csv_entities'] = csv_entities
            
            return processed_doc
            
        except Exception as e:
            logger.error(f"CSV processing failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _extract_csv_entities(self, df: pd.DataFrame) -> Dict[str, List]:
        """Extract entities specifically from CSV data"""
        entities = {
            'locations': [],
            'measurements': [],
            'coordinates': [],
            'dates': [],
            'categories': []
        }
        
        try:
            # Extract unique locations
            for col in ['state', 'district', 'taluk', 'block']:
                if col in df.columns:
                    unique_values = df[col].dropna().unique()
                    for value in unique_values:
                        entities['locations'].append({
                            'type': col,
                            'value': str(value),
                            'count': df[col].value_counts().get(value, 0),
                            'confidence': 0.9
                        })
            
            # Extract water level ranges
            for col in ['water_level', 'depth', 'gwl']:
                if col in df.columns:
                    values = pd.to_numeric(df[col], errors='coerce').dropna()
                    if not values.empty:
                        entities['measurements'].append({
                            'type': 'water_level_range',
                            'min_value': float(values.min()),
                            'max_value': float(values.max()),
                            'mean_value': float(values.mean()),
                            'count': len(values),
                            'unit': 'meters',
                            'confidence': 0.95
                        })
            
            # Extract coordinate ranges
            if 'latitude' in df.columns and 'longitude' in df.columns:
                lat_values = pd.to_numeric(df['latitude'], errors='coerce').dropna()
                lon_values = pd.to_numeric(df['longitude'], errors='coerce').dropna()
                
                if not lat_values.empty and not lon_values.empty:
                    entities['coordinates'].append({
                        'type': 'coordinate_bounds',
                        'lat_min': float(lat_values.min()),
                        'lat_max': float(lat_values.max()),
                        'lon_min': float(lon_values.min()),
                        'lon_max': float(lon_values.max()),
                        'count': min(len(lat_values), len(lon_values)),
                        'confidence': 0.9
                    })
            
            # Extract date ranges
            for col in ['year', 'observation_year']:
                if col in df.columns:
                    values = pd.to_numeric(df[col], errors='coerce').dropna()
                    if not values.empty:
                        entities['dates'].append({
                            'type': 'year_range',
                            'min_year': int(values.min()),
                            'max_year': int(values.max()),
                            'count': len(values),
                            'confidence': 0.95
                        })
            
            # Extract categories
            for col in ['category', 'classification', 'stage_of_development']:
                if col in df.columns:
                    category_counts = df[col].value_counts().to_dict()
                    for category, count in category_counts.items():
                        if pd.notna(category):
                            entities['categories'].append({
                                'value': str(category),
                                'count': int(count),
                                'percentage': round((count / len(df)) * 100, 1),
                                'confidence': 0.9
                            })
            
        except Exception as e:
            logger.warning(f"CSV entity extraction failed: {e}")
        
        return entities
    
    def get_processing_stats(self) -> Dict[str, Any]:
        """Get processing statistics"""
        return {
            'cached_documents': len(self.processed_docs_cache),
            'total_cache_size_mb': sum(
                len(str(doc).encode('utf-8')) for doc in self.processed_docs_cache.values()
            ) / (1024 * 1024),
            'entity_patterns_loaded': len(self.entity_patterns)
        }
    
    def clear_cache(self):
        """Clear the document processing cache"""
        self.processed_docs_cache.clear()
        logger.info("Document processing cache cleared")
