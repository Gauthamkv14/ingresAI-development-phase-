import os
import pandas as pd
import csv
from typing import Dict, Any, List
import uuid
from datetime import datetime
import aiofiles
from config import Config
from database.postgis_manager import PostGISManager
from api.citation_manager import CitationManager
import logging
import hashlib

class FileManager:
    def __init__(self):
        self.config = Config()
        self.db_manager = PostGISManager()
        self.citation_manager = CitationManager()
        
        # Create upload directory if it doesn't exist
        os.makedirs(self.config.UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(self.config.DATA_FOLDER, exist_ok=True)
    
    async def upload_csv_file(self, file_content: bytes, original_filename: str, user_info: str = None) -> Dict[str, Any]:
        """Handle CSV file upload and processing"""
        try:
            # Generate unique filename
            file_id = str(uuid.uuid4())
            file_extension = os.path.splitext(original_filename)[1]
            unique_filename = f"{file_id}{file_extension}"
            file_path = os.path.join(self.config.UPLOAD_FOLDER, unique_filename)
            
            # Check file size
            if len(file_content) > self.config.MAX_FILE_SIZE:
                return {
                    "success": False,
                    "error": f"File size ({len(file_content)} bytes) exceeds maximum allowed ({self.config.MAX_FILE_SIZE} bytes)"
                }
            
            # Save file
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(file_content)
            
            # Process and validate CSV
            processing_result = await self._process_csv_file(file_path, original_filename)
            
            if not processing_result["success"]:
                # Clean up file if processing failed
                os.remove(file_path)
                return processing_result
            
            # Generate citation for uploaded file
            citation = self.citation_manager.generate_citation(
                f"User uploaded file: {original_filename}",
                file_path,
                datetime.now(),
                user_info
            )
            
            # Save file metadata to database
            session = self.db_manager.get_session()
            from database.models import UploadedFile
            
            uploaded_file = UploadedFile(
                filename=unique_filename,
                original_filename=original_filename,
                file_path=file_path,
                file_size=len(file_content),
                processed=True,
                record_count=processing_result["record_count"],
                citation=citation
            )
            
            session.add(uploaded_file)
            session.commit()
            
            file_db_id = str(uploaded_file.id)
            session.close()
            
            return {
                "success": True,
                "file_id": file_db_id,
                "filename": unique_filename,
                "original_filename": original_filename,
                "file_size": len(file_content),
                "record_count": processing_result["record_count"],
                "data_summary": processing_result["data_summary"],
                "citation": citation,
                "upload_date": datetime.now().isoformat(),
                "processing_time": processing_result.get("processing_time", 0)
            }
            
        except Exception as e:
            logging.error(f"File upload failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _process_csv_file(self, file_path: str, original_filename: str) -> Dict[str, Any]:
        """Process and validate CSV file"""
        try:
            start_time = datetime.now()
            
            # Read CSV file
            df = pd.read_csv(file_path)
            
            if df.empty:
                return {
                    "success": False,
                    "error": "CSV file is empty"
                }
            
            # Validate and clean data
            validation_result = self._validate_groundwater_data(df)
            
            if not validation_result["is_valid"]:
                return {
                    "success": False,
                    "error": "Data validation failed",
                    "validation_issues": validation_result["issues"]
                }
            
            # Clean and standardize data
            cleaned_df = self._clean_data(df)
            
            # Convert to format suitable for database
            processed_records = []
            for _, row in cleaned_df.iterrows():
                record = {
                    'state': str(row.get('state', '')).strip(),
                    'district': str(row.get('district', '')).strip(),
                    'taluk': str(row.get('taluk', '')).strip() if 'taluk' in row else None,
                    'water_level': float(row.get('water_level', 0)) if pd.notna(row.get('water_level')) else None,
                    'year': int(row.get('year', datetime.now().year)) if pd.notna(row.get('year')) else datetime.now().year,
                    'month': int(row.get('month', 1)) if pd.notna(row.get('month')) else None,
                    'latitude': float(row.get('latitude')) if pd.notna(row.get('latitude')) else None,
                    'longitude': float(row.get('longitude')) if pd.notna(row.get('longitude')) else None,
                    'category': str(row.get('category', 'Unknown')).strip()
                }
                processed_records.append(record)
            
            # Store in database
            citation = f"Uploaded CSV file: {original_filename}"
            success = self.db_manager.insert_groundwater_data(
                processed_records, 
                f"uploaded_file_{original_filename}",
                citation
            )
            
            if not success:
                return {
                    "success": False,
                    "error": "Failed to store data in database"
                }
            
            processing_time = (datetime.now() - start_time).total_seconds()
            
            return {
                "success": True,
                "record_count": len(processed_records),
                "data_summary": self._generate_data_summary(cleaned_df),
                "processing_time": processing_time,
                "validation_passed": True
            }
            
        except Exception as e:
            logging.error(f"CSV processing failed: {e}")
            return {
                "success": False,
                "error": f"CSV processing failed: {str(e)}"
            }
    
    def _validate_groundwater_data(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Validate groundwater data structure and content"""
        issues = []
        
        # Check required columns
        required_columns = ['state', 'district']
        optional_columns = ['water_level', 'year', 'month', 'latitude', 'longitude', 'category', 'taluk']
        
        missing_required = [col for col in required_columns if col not in df.columns]
        if missing_required:
            issues.append(f"Missing required columns: {missing_required}")
        
        # Check data types and ranges
        if 'water_level' in df.columns:
            invalid_water_levels = df[
                (pd.to_numeric(df['water_level'], errors='coerce').isna()) | 
                (pd.to_numeric(df['water_level'], errors='coerce') < -200) |
                (pd.to_numeric(df['water_level'], errors='coerce') > 100)
            ]
            if not invalid_water_levels.empty:
                issues.append(f"Invalid water level values in {len(invalid_water_levels)} rows")
        
        if 'year' in df.columns:
            invalid_years = df[
                (pd.to_numeric(df['year'], errors='coerce').isna()) |
                (pd.to_numeric(df['year'], errors='coerce') < 2000) |
                (pd.to_numeric(df['year'], errors='coerce') > datetime.now().year)
            ]
            if not invalid_years.empty:
                issues.append(f"Invalid year values in {len(invalid_years)} rows")
        
        if 'latitude' in df.columns:
            invalid_lat = df[
                (pd.to_numeric(df['latitude'], errors='coerce') < 8) |
                (pd.to_numeric(df['latitude'], errors='coerce') > 37)
            ]
            if not invalid_lat.empty:
                issues.append(f"Latitude values outside India range in {len(invalid_lat)} rows")
        
        if 'longitude' in df.columns:
            invalid_lon = df[
                (pd.to_numeric(df['longitude'], errors='coerce') < 68) |
                (pd.to_numeric(df['longitude'], errors='coerce') > 97)
            ]
            if not invalid_lon.empty:
                issues.append(f"Longitude values outside India range in {len(invalid_lon)} rows")
        
        # Check for completely empty rows
        empty_rows = df.isnull().all(axis=1).sum()
        if empty_rows > 0:
            issues.append(f"{empty_rows} completely empty rows found")
        
        return {
            "is_valid": len(issues) == 0,
            "issues": issues,
            "total_rows": len(df),
            "columns_found": list(df.columns)
        }
    
    def _clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and standardize the data"""
        cleaned_df = df.copy()
        
        # Remove completely empty rows
        cleaned_df = cleaned_df.dropna(how='all')
        
        # Standardize state and district names
        if 'state' in cleaned_df.columns:
            cleaned_df['state'] = cleaned_df['state'].str.strip().str.title()
        
        if 'district' in cleaned_df.columns:
            cleaned_df['district'] = cleaned_df['district'].str.strip().str.title()
        
        # Standardize category values
        if 'category' in cleaned_df.columns:
            category_mapping = {
                'safe': 'Safe',
                'semi-critical': 'Semi-Critical',
                'critical': 'Critical',
                'over-exploited': 'Over-Exploited',
                'overexploited': 'Over-Exploited'
            }
            cleaned_df['category'] = cleaned_df['category'].str.lower().map(category_mapping).fillna('Unknown')
        
        # Convert numeric columns
        numeric_columns = ['water_level', 'year', 'month', 'latitude', 'longitude']
        for col in numeric_columns:
            if col in cleaned_df.columns:
                cleaned_df[col] = pd.to_numeric(cleaned_df[col], errors='coerce')
        
        return cleaned_df
    
    def _generate_data_summary(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Generate summary statistics for the data"""
        summary = {
            "total_records": len(df),
            "columns": list(df.columns),
            "states_covered": df['state'].nunique() if 'state' in df.columns else 0,
            "districts_covered": df['district'].nunique() if 'district' in df.columns else 0,
            "data_quality": {}
        }
        
        if 'water_level' in df.columns:
            water_level_stats = df['water_level'].describe()
            summary["water_level_stats"] = {
                "mean": round(water_level_stats['mean'], 2),
                "median": round(water_level_stats['50%'], 2),
                "min": round(water_level_stats['min'], 2),
                "max": round(water_level_stats['max'], 2),
                "std": round(water_level_stats['std'], 2)
            }
        
        if 'year' in df.columns:
            summary["year_range"] = {
                "min": int(df['year'].min()),
                "max": int(df['year'].max())
            }
        
        if 'category' in df.columns:
            summary["category_distribution"] = df['category'].value_counts().to_dict()
        
        # Data quality assessment
        summary["data_quality"] = {
            "completeness": round((1 - df.isnull().sum().sum() / (len(df) * len(df.columns))) * 100, 2),
            "unique_records": len(df.drop_duplicates()),
            "duplicate_records": len(df) - len(df.drop_duplicates())
        }
        
        return summary
    
    async def download_data(self, file_id: str = None, filters: Dict = None, format: str = "csv") -> Dict[str, Any]:
        """Download data as CSV file"""
        try:
            if file_id:
                # Download specific uploaded file
                session = self.db_manager.get_session()
                from database.models import UploadedFile
                
                uploaded_file = session.query(UploadedFile).filter(UploadedFile.id == file_id).first()
                session.close()
                
                if not uploaded_file:
                    return {
                        "success": False,
                        "error": f"File with ID {file_id} not found"
                    }
                
                if not os.path.exists(uploaded_file.file_path):
                    return {
                        "success": False,
                        "error": "Original file no longer exists"
                    }
                
                async with aiofiles.open(uploaded_file.file_path, 'rb') as f:
                    content = await f.read()
                
                return {
                    "success": True,
                    "filename": uploaded_file.original_filename,
                    "content": content,
                    "content_type": "text/csv",
                    "citation": uploaded_file.citation
                }
            
            else:
                # Download filtered data from database
                data = self.db_manager.query_groundwater_data(filters or {}, limit=10000)
                
                if not data:
                    return {
                        "success": False,
                        "error": "No data found matching the criteria"
                    }
                
                # Convert to DataFrame and CSV
                df = pd.DataFrame(data)
                
                if format.lower() == "csv":
                    csv_buffer = io.StringIO()
                    df.to_csv(csv_buffer, index=False)
                    content = csv_buffer.getvalue().encode('utf-8')
                    filename = f"groundwater_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
                    content_type = "text/csv"
                
                elif format.lower() == "json":
                    content = df.to_json(orient='records', indent=2).encode('utf-8')
                    filename = f"groundwater_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                    content_type = "application/json"
                
                else:
                    return {
                        "success": False,
                        "error": f"Format '{format}' not supported"
                    }
                
                citation = self.citation_manager.generate_citation(
                    "INGRES MCP Server Database Export",
                    "Local PostGIS Database",
                    datetime.now()
                )
                
                return {
                    "success": True,
                    "filename": filename,
                    "content": content,
                    "content_type": content_type,
                    "record_count": len(data),
                    "citation": citation
                }
                
        except Exception as e:
            logging.error(f"Data download failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def list_uploaded_files(self) -> Dict[str, Any]:
        """List all uploaded files with metadata"""
        try:
            session = self.db_manager.get_session()
            from database.models import UploadedFile
            
            files = session.query(UploadedFile).order_by(UploadedFile.upload_date.desc()).all()
            session.close()
            
            file_list = []
            for file in files:
                file_info = {
                    "file_id": str(file.id),
                    "original_filename": file.original_filename,
                    "file_size": file.file_size,
                    "upload_date": file.upload_date.isoformat(),
                    "record_count": file.record_count,
                    "processed": file.processed,
                    "citation": file.citation
                }
                file_list.append(file_info)
            
            return {
                "success": True,
                "files": file_list,
                "total_files": len(file_list)
            }
            
        except Exception as e:
            logging.error(f"File listing failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
 
