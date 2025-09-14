from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geometry
import uuid
from datetime import datetime

Base = declarative_base()

class GroundwaterData(Base):
    __tablename__ = 'groundwater_data'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    unique_district_id = Column(String(50), index=True)  # Unique district identifier
    unique_taluk_id = Column(String(50), index=True)     # Unique taluk identifier
    state = Column(String(100), nullable=False, index=True)
    district = Column(String(100), nullable=False, index=True)
    taluk = Column(String(100), index=True)
    water_level = Column(Float)
    year = Column(Integer, index=True)
    month = Column(Integer)
    category = Column(String(50))  # Safe, Semi-Critical, Critical, Over-Exploited
    location = Column(Geometry('POINT'))
    data_source = Column(String(200))  # API or file source
    citation = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class WaterQuality(Base):
    __tablename__ = 'water_quality'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    unique_district_id = Column(String(50), index=True)
    state = Column(String(100), nullable=False, index=True)
    district = Column(String(100), nullable=False, index=True)
    ph_level = Column(Float)
    tds = Column(Float)
    fluoride = Column(Float)
    arsenic = Column(Float)
    nitrate = Column(Float)
    location = Column(Geometry('POINT'))
    test_date = Column(DateTime)
    data_source = Column(String(200))
    citation = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserSession(Base):
    __tablename__ = 'user_sessions'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(String(100), unique=True, index=True)
    conversation_history = Column(JSON)
    language = Column(String(10), default='en')
    created_at = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)

class UploadedFile(Base):
    __tablename__ = 'uploaded_files'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String(200), nullable=False)
    original_filename = Column(String(200), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    upload_date = Column(DateTime, default=datetime.utcnow)
    processed = Column(Boolean, default=False)
    record_count = Column(Integer, default=0)
    citation = Column(Text)
