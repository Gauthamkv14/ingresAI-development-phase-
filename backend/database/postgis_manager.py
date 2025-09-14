from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from geoalchemy2.functions import ST_Distance, ST_GeogFromText, ST_X, ST_Y
from .models import Base, GroundwaterData, WaterQuality, UserSession, UploadedFile
from config import Config
import logging
import hashlib

class PostGISManager:
    def __init__(self):
        self.config = Config()
        self.engine = create_engine(
            self.config.DATABASE_URL,
            pool_pre_ping=True,
            pool_recycle=3600, #Recycle conn every hour
            pool_size=20, #Conn pool size
            max_overflow=30, #Max overflow
            echo=False
        )
        self._ensure_connection()
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.setup_database()

    def _ensure_connection(self):
        """Ensure database connection with retry logic"""
        import time
        max_retries = 3
        for attempt in range(max_retries):
            try:
                with self.engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                    logging.info("Database connection established")
                    return
            except Exception as e:
                if attempt < max_retries - 1:
                    logging.warning(f"Connection attempt {attempt + 1} failed, retrying...")
                    time.sleep(2 ** attempt)  # Exponential backoff
                else:
                    logging.error(f"Failed to connect after {max_retries} attempts: {e}")
                    raise
    
    def setup_database(self):
        """Initialize database with PostGIS extension and create tables"""
        try:
            with self.engine.connect() as conn:
                # Enable PostGIS extension
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
                conn.commit()
            
            # Create all tables
            Base.metadata.create_all(bind=self.engine)
            logging.info("Database setup completed successfully")
            
        except SQLAlchemyError as e:
            logging.error(f"Database setup failed: {e}")
            raise
    
    def get_session(self):
        """Get database session"""
        return self.SessionLocal()
    
    def generate_unique_id(self, state: str, district: str, entity_type: str = "district") -> str:
        """Generate unique IDs for districts/taluks to avoid clashes"""
        # Create consistent hash-based ID
        identifier = f"{state}_{district}".lower().replace(" ", "_")
        hash_suffix = hashlib.md5(identifier.encode()).hexdigest()[:8]
        
        if entity_type == "district":
            return f"{self.config.DISTRICT_ID_PREFIX}{hash_suffix}"
        else:
            return f"{self.config.TALUK_ID_PREFIX}{hash_suffix}"
    
    def insert_groundwater_data(self, data_records: list, source: str, citation: str):
        """Insert groundwater data with unique IDs and spatial indexing"""
        session = self.get_session()
        try:
            for record in data_records:
                unique_district_id = self.generate_unique_id(
                    record.get('state', ''), 
                    record.get('district', ''),
                    'district'
                )
                
                unique_taluk_id = None
                if record.get('taluk'):
                    unique_taluk_id = self.generate_unique_id(
                        record.get('state', ''), 
                        f"{record.get('district', '')}_{record.get('taluk', '')}",
                        'taluk'
                    )
                
                # Create point geometry if lat/lon available
                location = None
                if record.get('latitude') and record.get('longitude'):
                    location = f"POINT({record['longitude']} {record['latitude']})"
                
                groundwater_entry = GroundwaterData(
                    unique_district_id=unique_district_id,
                    unique_taluk_id=unique_taluk_id,
                    state=record.get('state', ''),
                    district=record.get('district', ''),
                    taluk=record.get('taluk'),
                    water_level=record.get('water_level'),
                    year=record.get('year'),
                    month=record.get('month'),
                    category=record.get('category'),
                    location=location,
                    data_source=source,
                    citation=citation
                )
                
                session.add(groundwater_entry)
            
            session.commit()
            logging.info(f"Inserted {len(data_records)} groundwater records")
            return True
            
        except Exception as e:
            session.rollback()
            logging.error(f"Failed to insert groundwater data: {e}")
            return False
        finally:
            session.close()
    
    def query_groundwater_data(self, filters: dict = None, limit: int = 100):
        """Query groundwater data with spatial and temporal filters"""
        session = self.get_session()
        try:
            query = session.query(GroundwaterData)
            
            if filters:
                if filters.get('state'):
                    query = query.filter(GroundwaterData.state.ilike(f"%{filters['state']}%"))
                if filters.get('district'):
                    query = query.filter(GroundwaterData.district.ilike(f"%{filters['district']}%"))
                if filters.get('year'):
                    query = query.filter(GroundwaterData.year == filters['year'])
                if filters.get('category'):
                    query = query.filter(GroundwaterData.category == filters['category'])
                
                # Spatial query if coordinates provided
                if filters.get('latitude') and filters.get('longitude') and filters.get('radius_km'):
                    point = ST_GeogFromText(f"POINT({filters['longitude']} {filters['latitude']})")
                    query = query.filter(
                        ST_Distance(GroundwaterData.location, point) <= filters['radius_km'] * 1000
                    )
            
            results = query.limit(limit).all()
            
            # Convert to dict format with spatial data
            return [{
                'id': str(result.id),
                'unique_district_id': result.unique_district_id,
                'unique_taluk_id': result.unique_taluk_id,
                'state': result.state,
                'district': result.district,
                'taluk': result.taluk,
                'water_level': result.water_level,
                'year': result.year,
                'month': result.month,
                'category': result.category,
                'latitude': float(session.scalar(ST_Y(result.location))) if result.location else None,
                'longitude': float(session.scalar(ST_X(result.location))) if result.location else None,
                'data_source': result.data_source,
                'citation': result.citation,
                'created_at': result.created_at.isoformat()
            } for result in results]
            
        except Exception as e:
            logging.error(f"Query failed: {e}")
            return []
        finally:
            session.close()
    
    def get_aggregated_stats(self, groupby: str = 'state'):
        """Get aggregated statistics for dashboard"""
        session = self.get_session()
        try:
            if groupby == 'state':
                results = session.execute(text("""
                    SELECT state, 
                           COUNT(*) as total_records,
                           AVG(water_level) as avg_water_level,
                           COUNT(DISTINCT unique_district_id) as district_count,
                           mode() WITHIN GROUP (ORDER BY category) as dominant_category
                    FROM groundwater_data 
                    WHERE water_level IS NOT NULL
                    GROUP BY state
                    ORDER BY total_records DESC
                """)).fetchall()
            
            return [dict(row._mapping) for row in results]
            
        except Exception as e:
            logging.error(f"Aggregation query failed: {e}")
            return []
        finally:
            session.close()
