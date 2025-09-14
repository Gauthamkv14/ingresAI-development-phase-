-- INGRES MCP Chatbot Database Initialization
-- This script sets up the PostGIS-enabled PostgreSQL database for groundwater data

-- Enable PostGIS extension for spatial operations
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS postgis_sfcgal;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text similarity searches

-- Set search path to include PostGIS
SET search_path = public, postgis;

-- Create custom types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'groundwater_category') THEN
        CREATE TYPE groundwater_category AS ENUM ('Safe', 'Semi-Critical', 'Critical', 'Over-Exploited', 'Unknown');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'data_quality') THEN
        CREATE TYPE data_quality AS ENUM ('high', 'medium', 'low', 'unknown');
    END IF;
END
$$;

-- Create groundwater_data table with spatial support
CREATE TABLE IF NOT EXISTS groundwater_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Location identifiers
    unique_district_id VARCHAR(50),
    unique_taluk_id VARCHAR(50),
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    taluk VARCHAR(100),
    block VARCHAR(100),
    
    -- Water level measurements
    water_level NUMERIC(10,3), -- meters below ground level
    depth_to_water NUMERIC(10,3), -- alias for water_level
    static_water_level NUMERIC(10,3), -- static water level
    pumping_water_level NUMERIC(10,3), -- pumping water level
    
    -- Temporal data
    year INTEGER CHECK (year >= 1900 AND year <= 2100),
    month INTEGER CHECK (month >= 1 AND month <= 12),
    observation_date DATE,
    season VARCHAR(20), -- Pre-Monsoon, Monsoon, Post-Monsoon
    
    -- Classification
    category groundwater_category DEFAULT 'Unknown',
    stage_of_development VARCHAR(50),
    
    -- Spatial data (SRID 4326 = WGS84)
    location GEOMETRY(POINT, 4326),
    latitude NUMERIC(10,6) CHECK (latitude >= 6.0 AND latitude <= 38.0), -- India bounds
    longitude NUMERIC(10,6) CHECK (longitude >= 68.0 AND longitude <= 98.0), -- India bounds
    elevation NUMERIC(8,2), -- meters above sea level
    
    -- Well information
    well_type VARCHAR(50), -- Bore well, Open well, Tube well, etc.
    well_depth NUMERIC(8,2), -- total depth of well in meters
    aquifer_type VARCHAR(50), -- Confined, Unconfined, Perched
    
    -- Data source and quality
    data_source VARCHAR(200) NOT NULL DEFAULT 'unknown',
    source_organization VARCHAR(100),
    data_quality data_quality DEFAULT 'unknown',
    measurement_method VARCHAR(100),
    
    -- Metadata
    citation TEXT,
    notes TEXT,
    data_completeness NUMERIC(5,2) DEFAULT 0.0 CHECK (data_completeness >= 0 AND data_completeness <= 100),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    updated_by VARCHAR(100) DEFAULT 'system'
);

-- Create water_quality table for chemical analysis data
CREATE TABLE IF NOT EXISTS water_quality (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Location reference
    groundwater_data_id UUID REFERENCES groundwater_data(id),
    unique_district_id VARCHAR(50),
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    
    -- Chemical parameters (all in mg/L unless specified)
    ph_level NUMERIC(4,2) CHECK (ph_level >= 0 AND ph_level <= 14),
    tds NUMERIC(8,2) CHECK (tds >= 0), -- Total Dissolved Solids
    electrical_conductivity NUMERIC(8,2), -- µS/cm
    
    -- Major ions
    fluoride NUMERIC(6,3) CHECK (fluoride >= 0),
    arsenic NUMERIC(6,3) CHECK (arsenic >= 0),
    nitrate NUMERIC(6,2) CHECK (nitrate >= 0),
    chloride NUMERIC(8,2) CHECK (chloride >= 0),
    sulphate NUMERIC(8,2) CHECK (sulphate >= 0),
    
    -- Hardness
    total_hardness NUMERIC(8,2) CHECK (total_hardness >= 0),
    calcium NUMERIC(6,2) CHECK (calcium >= 0),
    magnesium NUMERIC(6,2) CHECK (magnesium >= 0),
    
    -- Other parameters
    iron NUMERIC(6,3) CHECK (iron >= 0),
    manganese NUMERIC(6,3) CHECK (manganese >= 0),
    turbidity NUMERIC(6,2) CHECK (turbidity >= 0), -- NTU
    
    -- Spatial data
    location GEOMETRY(POINT, 4326),
    latitude NUMERIC(10,6),
    longitude NUMERIC(10,6),
    
    -- Temporal data
    test_date DATE,
    year INTEGER,
    month INTEGER,
    
    -- Metadata
    data_source VARCHAR(200) NOT NULL DEFAULT 'unknown',
    laboratory VARCHAR(100),
    test_method VARCHAR(100),
    citation TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_sessions table for chat session management
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) UNIQUE NOT NULL,
    user_id VARCHAR(100), -- Optional user identifier
    
    -- Session data
    conversation_history JSONB DEFAULT '[]',
    session_metadata JSONB DEFAULT '{}',
    language VARCHAR(10) DEFAULT 'en',
    
    -- Statistics
    query_count INTEGER DEFAULT 0,
    files_uploaded INTEGER DEFAULT 0,
    charts_generated INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

-- Create uploaded_files table for file management
CREATE TABLE IF NOT EXISTS uploaded_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100),
    
    -- File information
    filename VARCHAR(200) NOT NULL,
    original_filename VARCHAR(200) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER CHECK (file_size >= 0),
    mime_type VARCHAR(100),
    
    -- Processing status
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE,
    processing_status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    
    -- Data metrics
    record_count INTEGER DEFAULT 0,
    valid_records INTEGER DEFAULT 0,
    data_quality_score NUMERIC(5,2) DEFAULT 0.0,
    
    -- Metadata
    file_metadata JSONB DEFAULT '{}',
    citation TEXT,
    
    FOREIGN KEY (session_id) REFERENCES user_sessions(session_id) ON DELETE CASCADE
);

-- Create ml_models table for model management
CREATE TABLE IF NOT EXISTS ml_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR(100) NOT NULL,
    model_type VARCHAR(50) NOT NULL, -- random_forest, gradient_boosting, etc.
    region VARCHAR(100), -- State/region the model is trained for
    
    -- Model metadata
    training_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    model_version VARCHAR(20) DEFAULT '1.0',
    training_data_size INTEGER,
    feature_count INTEGER,
    
    -- Performance metrics
    r2_score NUMERIC(6,4),
    rmse NUMERIC(10,4),
    mae NUMERIC(10,4),
    cv_score NUMERIC(6,4),
    
    -- Model storage
    model_path VARCHAR(500),
    feature_columns JSONB,
    model_params JSONB,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial indexes for fast geographic queries
CREATE INDEX IF NOT EXISTS idx_groundwater_location ON groundwater_data USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_water_quality_location ON water_quality USING GIST(location);

-- Create regular indexes for common queries
CREATE INDEX IF NOT EXISTS idx_groundwater_state ON groundwater_data(state);
CREATE INDEX IF NOT EXISTS idx_groundwater_district ON groundwater_data(district);
CREATE INDEX IF NOT EXISTS idx_groundwater_year ON groundwater_data(year);
CREATE INDEX IF NOT EXISTS idx_groundwater_category ON groundwater_data(category);
CREATE INDEX IF NOT EXISTS idx_groundwater_unique_district ON groundwater_data(unique_district_id);
CREATE INDEX IF NOT EXISTS idx_groundwater_data_source ON groundwater_data(data_source);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_groundwater_location_time ON groundwater_data(state, district, year, month);
CREATE INDEX IF NOT EXISTS idx_groundwater_spatial_temporal ON groundwater_data USING GIST(location, observation_date);

-- Water quality indexes
CREATE INDEX IF NOT EXISTS idx_water_quality_state ON water_quality(state);
CREATE INDEX IF NOT EXISTS idx_water_quality_district ON water_quality(district);
CREATE INDEX IF NOT EXISTS idx_water_quality_date ON water_quality(test_date);

-- Session and file indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_session ON uploaded_files(session_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_processed ON uploaded_files(processed);

-- Text search indexes using pg_trgm extension
CREATE INDEX IF NOT EXISTS idx_groundwater_state_trgm ON groundwater_data USING gin(state gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_groundwater_district_trgm ON groundwater_data USING gin(district gin_trgm_ops);

-- Create functions and triggers

-- Function to automatically update location from lat/lng
CREATE OR REPLACE FUNCTION update_location_from_coords()
RETURNS TRIGGER AS $$
BEGIN
    -- Update location point from latitude/longitude if they exist
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    END IF;
    
    -- Update coordinates from location if they don't exist but location does
    IF NEW.location IS NOT NULL AND (NEW.latitude IS NULL OR NEW.longitude IS NULL) THEN
        NEW.longitude := ST_X(NEW.location);
        NEW.latitude := ST_Y(NEW.location);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique district ID if not provided
CREATE OR REPLACE FUNCTION generate_unique_district_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.unique_district_id IS NULL THEN
        NEW.unique_district_id := 'IND_DIST_' || 
                                 upper(replace(NEW.state, ' ', '_')) || '_' ||
                                 upper(replace(NEW.district, ' ', '_')) || '_' ||
                                 extract(epoch from CURRENT_TIMESTAMP)::bigint;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS trigger_update_location_groundwater ON groundwater_data;
CREATE TRIGGER trigger_update_location_groundwater
    BEFORE INSERT OR UPDATE ON groundwater_data
    FOR EACH ROW EXECUTE FUNCTION update_location_from_coords();

DROP TRIGGER IF EXISTS trigger_update_location_water_quality ON water_quality;
CREATE TRIGGER trigger_update_location_water_quality
    BEFORE INSERT OR UPDATE ON water_quality
    FOR EACH ROW EXECUTE FUNCTION update_location_from_coords();

DROP TRIGGER IF EXISTS trigger_update_groundwater_updated_at ON groundwater_data;
CREATE TRIGGER trigger_update_groundwater_updated_at
    BEFORE UPDATE ON groundwater_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_generate_district_id ON groundwater_data;
CREATE TRIGGER trigger_generate_district_id
    BEFORE INSERT ON groundwater_data
    FOR EACH ROW EXECUTE FUNCTION generate_unique_district_id();

-- Session cleanup trigger
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a view for easy groundwater data access
CREATE OR REPLACE VIEW v_groundwater_summary AS
SELECT 
    gd.id,
    gd.state,
    gd.district,
    gd.water_level,
    gd.year,
    gd.month,
    gd.category,
    gd.latitude,
    gd.longitude,
    gd.data_source,
    ST_AsText(gd.location) as location_wkt,
    -- Calculate depth category
    CASE 
        WHEN gd.water_level IS NULL THEN 'Unknown'
        WHEN gd.water_level >= -5 THEN 'Shallow (<5m)'
        WHEN gd.water_level >= -15 THEN 'Medium (5-15m)'
        WHEN gd.water_level >= -30 THEN 'Deep (15-30m)'
        ELSE 'Very Deep (>30m)'
    END as depth_category,
    -- Recent data indicator
    CASE 
        WHEN gd.year >= extract(year from CURRENT_DATE) - 2 THEN 'Recent'
        WHEN gd.year >= extract(year from CURRENT_DATE) - 5 THEN 'Moderately Recent'
        ELSE 'Old'
    END as data_recency,
    gd.created_at,
    gd.updated_at
FROM groundwater_data gd
WHERE gd.water_level IS NOT NULL;

-- Create a spatial view for geographic analysis
CREATE OR REPLACE VIEW v_groundwater_spatial AS
SELECT 
    gd.*,
    ST_AsGeoJSON(gd.location) as geojson,
    -- Calculate distances from major cities (examples)
    CASE 
        WHEN ST_DWithin(gd.location, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326), 1.0) 
        THEN ST_Distance(gd.location, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)) * 111320 -- Bangalore
        ELSE NULL 
    END as distance_from_bangalore_m
FROM groundwater_data gd
WHERE gd.location IS NOT NULL;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO postgres;

-- Create database statistics
ANALYZE groundwater_data;
ANALYZE water_quality;
ANALYZE user_sessions;
ANALYZE uploaded_files;

-- Log initialization completion
INSERT INTO groundwater_data (
    state, district, water_level, year, category, 
    latitude, longitude, data_source, citation,
    notes
) VALUES (
    'System', 'Database', 0.0, extract(year from CURRENT_DATE), 'Safe',
    20.5937, 78.9629, 'system_init', 
    'Database initialization marker - INGRES MCP System',
    'This record indicates successful database initialization on ' || CURRENT_TIMESTAMP
);

-- Display initialization summary
DO $$
BEGIN
    RAISE NOTICE '=== INGRES MCP Database Initialization Complete ===';
    RAISE NOTICE 'PostGIS Extensions: Enabled';
    RAISE NOTICE 'Tables Created: 5 (groundwater_data, water_quality, user_sessions, uploaded_files, ml_models)';
    RAISE NOTICE 'Indexes Created: 15+ spatial and regular indexes';
    RAISE NOTICE 'Views Created: 2 (v_groundwater_summary, v_groundwater_spatial)';
    RAISE NOTICE 'Triggers: Location sync, timestamp updates, unique ID generation';
    RAISE NOTICE 'Ready for INGRES MCP Server connection!';
END
$$;
