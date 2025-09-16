from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import pandas as pd
import os
import logging
import re
from typing import Optional, Dict, Any, List
from datetime import datetime
import json

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ingres-backend")

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

# canonical CSV path used by endpoints
CSV_FILENAME = "ingris_report.csv"
CSV_PATH = os.path.join(DATA_DIR, CSV_FILENAME)

# optional geojson (if you put one in backend/data/)
GEOJSON_FILENAME = "india_districts.geojson"
GEOJSON_PATH = os.path.join(DATA_DIR, GEOJSON_FILENAME)

app = FastAPI(title="INGRES MCP Backend", version="0.2.0")

# CORS: restrict in production; "*" ok for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Optionally expose backend/data as static files
app.mount("/file", StaticFiles(directory=DATA_DIR), name="files")

def read_csv_df(path: str = CSV_PATH) -> Optional[pd.DataFrame]:
    """Read CSV into DataFrame; return None if file not present."""
    if not os.path.exists(path):
        logger.debug("CSV not found at %s", path)
        return None
    try:
        df = pd.read_csv(path)
        logger.info("Loaded CSV %s with shape %s", path, df.shape)
        return df
    except Exception as e:
        logger.exception("Failed to read CSV %s: %s", path, e)
        raise

def find_column(df: pd.DataFrame, *candidates) -> Optional[str]:
    """Return first matching column name in df for any of the candidates (case-insensitive)."""
    lowered = {c.lower(): c for c in df.columns}
    for cand in candidates:
        if cand is None:
            continue
        key = cand.strip().lower()
        if key in lowered:
            return lowered[key]
    return None

def get_safe_value(row, col_name, default="Unknown"):
    """Safely get value from pandas row"""
    if col_name and col_name in row.index:
        val = row[col_name]
        if pd.notna(val):
            return str(val).strip()
    return default

def get_safe_numeric(row, col_name, default=0.0):
    """Safely get numeric value from pandas row"""
    if col_name and col_name in row.index:
        val = row[col_name]
        if pd.notna(val):
            try:
                # Handle comma-separated numbers
                if isinstance(val, str):
                    val = val.replace(',', '')
                return float(val)
            except (ValueError, TypeError):
                pass
    return default

def extract_location_from_message(message: str, df: pd.DataFrame) -> Dict[str, Any]:
    """Extract state/district names from user message and find matching data"""
    message_lower = message.lower()
    
    # Find column names
    state_col = find_column(df, "state", "STATE", "State")
    district_col = find_column(df, "district", "DISTRICT", "District")
    
    results = {
        "states_found": [],
        "districts_found": [],
        "matched_data": pd.DataFrame(),
        "location_type": None
    }
    
    if state_col:
        # Get all unique states
        all_states = df[state_col].dropna().unique()
        
        # Check if any state name is in the message
        for state in all_states:
            if state.lower() in message_lower:
                state_data = df[df[state_col].str.lower().str.contains(state.lower(), na=False)]
                results["states_found"].append(state)
                results["matched_data"] = pd.concat([results["matched_data"], state_data])
                results["location_type"] = "state"
    
    if district_col:
        # Get all unique districts
        all_districts = df[district_col].dropna().unique()
        
        # Check if any district name is in the message
        for district in all_districts:
            if district.lower() in message_lower:
                district_data = df[df[district_col].str.lower().str.contains(district.lower(), na=False)]
                results["districts_found"].append(district)
                results["matched_data"] = pd.concat([results["matched_data"], district_data])
                results["location_type"] = "district"
    
    # Remove duplicates
    results["matched_data"] = results["matched_data"].drop_duplicates()
    
    return results

def analyze_location_data(data: pd.DataFrame, location_name: str, location_type: str) -> str:
    """Analyze data for a specific location and return formatted response"""
    if data.empty:
        return f"❌ No data found for {location_name}."
    
    # Find columns
    level_col = find_column(data, "water level", "water_level", "waterlevel", "level", "depth")
    state_col = find_column(data, "state", "STATE", "State")
    district_col = find_column(data, "district", "DISTRICT", "District")
    wells_col = find_column(data, "wells", "num_wells", "WELLS", "well_count")
    date_col = find_column(data, "date", "timestamp", "datetime", "year", "period")
    
    response = f"📊 **{location_name.title()} Groundwater Analysis:**\n\n"
    response += f"• **Total records:** {len(data):,}\n"
    
    # Water level analysis
    if level_col:
        levels = pd.to_numeric(data[level_col].astype(str).str.replace(',', ''), errors="coerce").dropna()
        if not levels.empty:
            avg_level = round(levels.mean(), 2)
            max_level = round(levels.max(), 2)
            min_level = round(levels.min(), 2)
            critical_count = int((levels < 10).sum())
            warning_count = int(((levels >= 10) & (levels < 20)).sum())
            normal_count = int((levels >= 20).sum())
            
            response += f"• **Average water level:** {avg_level}m\n"
            response += f"• **Range:** {min_level}m to {max_level}m\n"
            response += f"• **Critical areas:** {critical_count} ({round(critical_count/len(levels)*100, 1)}%)\n"
            response += f"• **Warning areas:** {warning_count} ({round(warning_count/len(levels)*100, 1)}%)\n"
            response += f"• **Normal areas:** {normal_count} ({round(normal_count/len(levels)*100, 1)}%)\n"
            
            # Status assessment
            if critical_count > len(levels) * 0.3:
                response += "\n🚨 **HIGH RISK**: Over 30% of areas have critically low water levels!"
            elif critical_count > 0:
                response += f"\n⚠️ **ATTENTION**: {critical_count} areas need immediate monitoring."
            else:
                response += "\n✅ **GOOD**: Water levels are stable across the region."
    
    # Geographic breakdown
    if location_type == "state" and district_col:
        districts = data[district_col].dropna().unique()
        if len(districts) > 1:
            response += f"\n• **Districts covered:** {len(districts)}\n"
            response += f"  - {', '.join(districts[:5])}"
            if len(districts) > 5:
                response += f" (+{len(districts)-5} more)"
    
    if location_type == "district" and state_col:
        states = data[state_col].dropna().unique()
        if len(states) > 0:
            response += f"\n• **State:** {states[0]}\n"
    
    # Wells information
    if wells_col:
        total_wells = data[wells_col].sum()
        if total_wells > 0:
            response += f"• **Total wells monitored:** {int(total_wells):,}\n"
    
    # Time information
    if date_col:
        dates = data[date_col].dropna()
        if not dates.empty:
            response += f"• **Data period:** {dates.min()} to {dates.max()}\n"
    
    return response

def get_trending_analysis(df: pd.DataFrame, message: str) -> str:
    """Analyze trends based on user query"""
    level_col = find_column(df, "water level", "water_level", "waterlevel", "level", "depth")
    date_col = find_column(df, "date", "timestamp", "datetime", "year", "period")
    state_col = find_column(df, "state", "STATE", "State")
    
    if not level_col:
        return "❌ Water level data not available for trend analysis."
    
    # Get recent vs older data for trend
    levels = pd.to_numeric(df[level_col].astype(str).str.replace(',', ''), errors="coerce").dropna()
    
    if levels.empty:
        return "❌ No valid water level data for trend analysis."
    
    # Basic trend analysis
    recent_data = levels.tail(len(levels)//2)  # Last half of data
    older_data = levels.head(len(levels)//2)   # First half of data
    
    recent_avg = recent_data.mean()
    older_avg = older_data.mean()
    
    trend_direction = "stable"
    trend_percent = 0
    
    if recent_avg > older_avg:
        trend_direction = "improving"
        trend_percent = round(((recent_avg - older_avg) / older_avg) * 100, 1)
    elif recent_avg < older_avg:
        trend_direction = "declining"
        trend_percent = round(((older_avg - recent_avg) / older_avg) * 100, 1)
    
    response = f"📈 **Groundwater Trends Analysis:**\n\n"
    response += f"• **Overall trend:** {trend_direction.upper()}\n"
    response += f"• **Recent average:** {round(recent_avg, 2)}m\n"
    response += f"• **Previous average:** {round(older_avg, 2)}m\n"
    
    if trend_percent > 0:
        response += f"• **Change:** {trend_percent}% {trend_direction}\n"
    
    # State-wise trends if available
    if state_col and "state" in message:
        state_trends = []
        for state in df[state_col].dropna().unique()[:5]:  # Top 5 states
            state_data = df[df[state_col] == state]
            if level_col in state_data.columns:
                state_levels = pd.to_numeric(state_data[level_col].astype(str).str.replace(',', ''), errors="coerce").dropna()
                if not state_levels.empty:
                    state_avg = round(state_levels.mean(), 2)
                    state_trends.append(f"  - {state}: {state_avg}m avg")
        
        if state_trends:
            response += f"\n• **State-wise averages:**\n" + "\n".join(state_trends)
    
    return response

def get_comparison_analysis(df: pd.DataFrame, message: str) -> str:
    """Compare different regions or time periods"""
    state_col = find_column(df, "state", "STATE", "State")
    district_col = find_column(df, "district", "DISTRICT", "District")
    level_col = find_column(df, "water level", "water_level", "waterlevel", "level", "depth")
    
    if not level_col:
        return "❌ Water level data not available for comparison."
    
    response = f"🔄 **Regional Comparison Analysis:**\n\n"
    
    # Compare top states
    if state_col:
        state_comparison = []
        for state in df[state_col].dropna().unique()[:8]:  # Top 8 states
            state_data = df[df[state_col] == state]
            if level_col in state_data.columns:
                levels = pd.to_numeric(state_data[level_col].astype(str).str.replace(',', ''), errors="coerce").dropna()
                if not levels.empty:
                    avg_level = round(levels.mean(), 2)
                    critical_count = int((levels < 10).sum())
                    state_comparison.append({
                        "state": state,
                        "avg_level": avg_level,
                        "critical": critical_count,
                        "records": len(levels)
                    })
        
        # Sort by average level (highest first)
        state_comparison.sort(key=lambda x: x["avg_level"], reverse=True)
        
        response += "**States by Average Water Level:**\n"
        for i, state_info in enumerate(state_comparison[:5], 1):
            status = "🟢" if state_info["avg_level"] >= 20 else "🟡" if state_info["avg_level"] >= 10 else "🔴"
            response += f"{i}. {status} **{state_info['state']}**: {state_info['avg_level']}m avg"
            if state_info["critical"] > 0:
                response += f" ({state_info['critical']} critical areas)"
            response += "\n"
    
    return response

def build_summary_from_df(df: pd.DataFrame) -> Dict[str, Any]:
    """Create summarized metrics from the dataframe."""
    level_col = find_column(df, "water level", "water_level", "waterlevel", "level", "depth")
    date_col = find_column(df, "date", "timestamp", "datetime", "year", "period")
    state_col = find_column(df, "state", "STATE", "State")
    district_col = find_column(df, "district", "DISTRICT", "District")

    # Ensure numeric for level column
    avg_level = 0.0
    critical_count = 0
    if level_col:
        try:
            ser = pd.to_numeric(df[level_col].astype(str).str.replace(',', ''), errors="coerce")
            non_na = ser.dropna()
            if not non_na.empty:
                avg_level = round(float(non_na.mean()), 2)
                critical_count = int((non_na < 10).sum())
        except Exception:
            logger.exception("Error coercing level column to numeric")

    monitored_states = int(df[state_col].nunique()) if state_col else 0
    total_rows = int(len(df))

    # Monthly trends as array for frontend
    monthly_trends = []
    if date_col and level_col:
        try:
            tmp_df = df[[date_col, level_col]].copy()
            
            # Try to parse dates, if fails create dummy monthly data
            try:
                tmp_df[date_col] = pd.to_datetime(tmp_df[date_col], errors="coerce")
                tmp_df[level_col] = pd.to_numeric(tmp_df[level_col].astype(str).str.replace(',', ''), errors="coerce")
                tmp_df = tmp_df.dropna()
                
                if not tmp_df.empty:
                    grouped = tmp_df.groupby(pd.Grouper(key=date_col, freq="M"))[level_col].mean()
                    monthly_trends = [{"month": k.strftime("%Y-%m"), "level": round(float(v), 2)} 
                                    for k, v in grouped.items()]
            except:
                # Create dummy monthly trends from available data
                sample_data = pd.to_numeric(df[level_col].astype(str).str.replace(',', ''), errors="coerce").dropna().head(12)
                for i, level in enumerate(sample_data):
                    monthly_trends.append({
                        "month": f"2024-{str(i+1).zfill(2)}", 
                        "level": round(float(level), 2)
                    })
        except Exception:
            logger.exception("Failed to compute monthly trends")

    return {
        "total_rows": total_rows,
        "monitored_states": max(monitored_states, 1),
        "average_level": avg_level,
        "critical_areas": critical_count,
        "monthly_data": monthly_trends,
        "columns": list(df.columns),
        "status": "success"
    }

# ========================= ORIGINAL ROUTES =========================

@app.get("/")
async def root():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}

@app.get("/summary")
async def get_summary():
    df = read_csv_df()
    if df is None:
        return JSONResponse({"error": f"No {CSV_FILENAME} found on server."}, status_code=404)
    try:
        summary = build_summary_from_df(df)
        return summary
    except Exception as e:
        logger.exception("Error building summary")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/data")
async def get_data(limit: int = 1000, offset: int = 0):
    df = read_csv_df()
    if df is None:
        return []
    try:
        total = len(df)
        df_slice = df.iloc[offset: offset + limit].fillna("").copy()
        data = df_slice.to_dict(orient="records")
        return data
    except Exception as e:
        logger.exception("Error returning data")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/geojson")
async def get_geojson():
    if not os.path.exists(GEOJSON_PATH):
        raise HTTPException(status_code=404, detail="GeoJSON not found on server")
    return FileResponse(GEOJSON_PATH, filename=GEOJSON_FILENAME, media_type="application/geo+json")

@app.get("/download")
async def download_csv():
    if not os.path.exists(CSV_PATH):
        raise HTTPException(status_code=404, detail="CSV file not found on server")
    return FileResponse(CSV_PATH, filename=CSV_FILENAME, media_type="text/csv")

@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")
    try:
        contents = await file.read()
        with open(CSV_PATH, "wb") as f:
            f.write(contents)
        logger.info("Saved uploaded file to %s", CSV_PATH)
    except Exception as e:
        logger.exception("Failed to save uploaded CSV")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    df = read_csv_df()
    summary = build_summary_from_df(df) if df is not None else {}
    return {"filename": file.filename, "saved_to": CSV_PATH, "summary": summary}

@app.get("/meta")
async def meta():
    df_exists = os.path.exists(CSV_PATH)
    geo_exists = os.path.exists(GEOJSON_PATH)
    return {"csv_present": df_exists, "geojson_present": geo_exists}

# ========================= FRONTEND API ROUTES =========================

@app.get("/api/dashboard/overview")
async def get_dashboard_overview():
    """Return dashboard overview data in format frontend expects"""
    df = read_csv_df()
    if df is None:
        return {
            "total_rows": 0,
            "monitored_states": 0,
            "average_level": 0,
            "critical_areas": 0,
            "monthly_data": [],
            "status": "no_data"
        }
    try:
        summary = build_summary_from_df(df)
        return summary
    except Exception as e:
        logger.exception("Error building dashboard overview")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/groundwater/levels")
async def get_groundwater_levels(limit: int = 50):
    """Return groundwater levels as array for frontend table"""
    df = read_csv_df()
    if df is None:
        return []
    
    try:
        # Find relevant columns
        state_col = find_column(df, "state", "STATE", "State")
        district_col = find_column(df, "district", "DISTRICT", "District")
        level_col = find_column(df, "water level", "water_level", "waterlevel", "level", "depth")
        date_col = find_column(df, "date", "timestamp", "datetime", "year", "period")
        location_col = find_column(df, "location", "place", "site", "village", "block")
        wells_col = find_column(df, "wells", "num_wells", "WELLS", "well_count")
        
        # Get sample data for table
        df_sample = df.head(limit)
        
        levels_data = []
        for idx, row in df_sample.iterrows():
            # Create location string
            location_parts = []
            if district_col:
                district = get_safe_value(row, district_col)
                if district != "Unknown":
                    location_parts.append(district)
            
            if state_col:
                state = get_safe_value(row, state_col)
                if state != "Unknown":
                    location_parts.append(state)
            
            if location_col:
                loc = get_safe_value(row, location_col)
                if loc != "Unknown":
                    location_parts.insert(0, loc)
            
            location = ", ".join(location_parts) if location_parts else "Unknown Location"
            
            # Get water level
            water_level = get_safe_numeric(row, level_col, 0.0)
            
            # Determine status
            if water_level == 0:
                status = "No Data"
                trend = "stable"
            elif water_level < 10:
                status = "Critical"
                trend = "declining"
            elif water_level < 20:
                status = "Warning"
                trend = "declining"
            else:
                status = "Normal"
                trend = "stable"
            
            # Get date
            date_val = get_safe_value(row, date_col, "2024")
            
            # Get wells count
            wells_count = int(get_safe_numeric(row, wells_col, 1))
            
            item = {
                "id": int(idx) + 1,
                "location": location,
                "water_level": round(water_level, 2),
                "quality_status": status,
                "trend": trend,
                "wells": wells_count,
                "last_updated": date_val,
                "actions": "View Details"
            }
            levels_data.append(item)
        
        return levels_data
        
    except Exception as e:
        logger.exception("Error getting groundwater levels")
        return []

@app.get("/api/dashboard/data")
async def get_dashboard_data(limit: int = 50):
    """Return dashboard data as array"""
    return await get_groundwater_levels(limit=limit)

@app.get("/api/map/geojson")
async def get_map_geojson():
    """Return GeoJSON for map"""
    return await get_geojson()

# ========================= CHARTS AND TRENDS =========================

@app.get("/api/charts/trends")
async def get_chart_trends():
    """Return chart trends data for Water Level Analytics"""
    df = read_csv_df()
    if df is None:
        return []
    
    try:
        level_col = find_column(df, "water level", "water_level", "waterlevel", "level", "depth")
        date_col = find_column(df, "date", "timestamp", "datetime", "year", "period")
        state_col = find_column(df, "state", "STATE", "State")
        
        trends_data = []
        
        if level_col:
            # Try to create time-based trends
            if date_col:
                try:
                    tmp_df = df[[date_col, level_col]].copy()
                    tmp_df[level_col] = pd.to_numeric(tmp_df[level_col].astype(str).str.replace(',', ''), errors="coerce")
                    tmp_df = tmp_df.dropna(subset=[level_col])
                    
                    # Try parsing dates
                    try:
                        tmp_df[date_col] = pd.to_datetime(tmp_df[date_col], errors="coerce")
                        tmp_df = tmp_df.dropna(subset=[date_col])
                        if not tmp_df.empty:
                            grouped = tmp_df.groupby(pd.Grouper(key=date_col, freq="M"))[level_col].mean()
                            for date, level in grouped.items():
                                trends_data.append({
                                    "date": date.strftime("%Y-%m"),
                                    "level": round(float(level), 2),
                                    "type": "monthly_average"
                                })
                    except:
                        # If date parsing fails, create sample monthly data
                        sample_levels = tmp_df[level_col].head(12)
                        for i, level in enumerate(sample_levels):
                            trends_data.append({
                                "date": f"2024-{str(i+1).zfill(2)}",
                                "level": round(float(level), 2),
                                "type": "sample_data"
                            })
                except Exception:
                    pass
            
            # If no trends data yet, create from level column
            if not trends_data:
                sample_levels = pd.to_numeric(df[level_col].astype(str).str.replace(',', ''), errors="coerce").dropna().head(12)
                months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
                
                for i, level in enumerate(sample_levels):
                    month_name = months[i % 12]
                    trends_data.append({
                        "date": f"2024-{month_name}",
                        "level": round(float(level), 2),
                        "type": "sample_data"
                    })
        
        return trends_data[:12]  # Return max 12 data points
        
    except Exception as e:
        logger.exception("Error getting chart trends")
        return []

# ========================= EXPORT ENDPOINT =========================

@app.get("/api/groundwater/export")
async def export_groundwater_data():
    """Export groundwater data as CSV"""
    if not os.path.exists(CSV_PATH):
        raise HTTPException(status_code=404, detail="CSV file not found on server")
    return FileResponse(
        CSV_PATH, 
        filename=f"groundwater_data_{datetime.now().strftime('%Y%m%d')}.csv", 
        media_type="text/csv"
    )

# ========================= INTELLIGENT CHAT ENDPOINT =========================

@app.post("/api/chat")
async def chat_endpoint(request_data: dict):
    """Enhanced intelligent chat that handles any location and question type"""
    try:
        message = request_data.get("message", "").strip()
        df = read_csv_df()
        
        if df is None:
            return {
                "response": "❌ No groundwater data is currently loaded. Please upload a CSV file to begin analysis.",
                "timestamp": datetime.utcnow().isoformat(),
                "status": "no_data"
            }
        
        message_lower = message.lower()
        
        # Extract location information from message
        location_info = extract_location_from_message(message, df)
        
        # Determine query type and respond accordingly
        if location_info["matched_data"].empty and any(word in message_lower for word in ["show", "tell", "about", "data", "information"]):
            # Try to extract location names manually for broader search
            words = message.split()
            potential_locations = [word.strip(".,!?").title() for word in words if len(word) > 3 and word.isalpha()]
            
            for location in potential_locations:
                state_col = find_column(df, "state", "STATE", "State")
                district_col = find_column(df, "district", "DISTRICT", "District")
                
                if state_col:
                    fuzzy_match = df[df[state_col].str.contains(location, case=False, na=False)]
                    if not fuzzy_match.empty:
                        location_info["matched_data"] = fuzzy_match
                        location_info["states_found"] = [location]
                        location_info["location_type"] = "state"
                        break
                
                if district_col and location_info["matched_data"].empty:
                    fuzzy_match = df[df[district_col].str.contains(location, case=False, na=False)]
                    if not fuzzy_match.empty:
                        location_info["matched_data"] = fuzzy_match
                        location_info["districts_found"] = [location]
                        location_info["location_type"] = "district"
                        break
        
        # SPECIFIC LOCATION QUERIES
        if not location_info["matched_data"].empty:
            if location_info["states_found"]:
                location_name = location_info["states_found"][0]
                response = analyze_location_data(location_info["matched_data"], location_name, "state")
            elif location_info["districts_found"]:
                location_name = location_info["districts_found"][0]
                response = analyze_location_data(location_info["matched_data"], location_name, "district")
            else:
                response = analyze_location_data(location_info["matched_data"], "Selected Region", "region")
        
        # TREND ANALYSIS QUERIES
        elif any(word in message_lower for word in ["trend", "trending", "change", "improving", "declining", "over time"]):
            response = get_trending_analysis(df, message_lower)
        
        # COMPARISON QUERIES
        elif any(word in message_lower for word in ["compare", "comparison", "versus", "vs", "best", "worst", "rank"]):
            response = get_comparison_analysis(df, message_lower)
        
        # CRITICAL AREAS QUERIES
        elif any(word in message_lower for word in ["critical", "danger", "emergency", "low level", "risk"]):
            level_col = find_column(df, "water level", "water_level", "waterlevel", "level", "depth")
            state_col = find_column(df, "state", "STATE", "State")
            
            if level_col:
                levels = pd.to_numeric(df[level_col].astype(str).str.replace(',', ''), errors="coerce")
                critical_data = df[levels < 10]
                
                if not critical_data.empty:
                    response = f"🚨 **Critical Areas Analysis:**\n\n"
                    response += f"• **Total critical areas:** {len(critical_data)}\n"
                    
                    if state_col:
                        critical_states = critical_data[state_col].value_counts().head(5)
                        response += f"• **Most affected states:**\n"
                        for state, count in critical_states.items():
                            response += f"  - {state}: {count} critical locations\n"
                    
                    lowest_levels = levels[levels < 10].nsmallest(5)
                    if not lowest_levels.empty:
                        response += f"• **Lowest levels:** {round(lowest_levels.min(), 2)}m to {round(lowest_levels.max(), 2)}m\n"
                else:
                    response = "✅ **Good news!** No critical water level areas found in the current dataset."
            else:
                response = "❌ Water level data not available for critical area analysis."
        
        # STATISTICS/SUMMARY QUERIES
        elif any(word in message_lower for word in ["summary", "overview", "statistics", "stats", "total", "how many"]):
            summary = build_summary_from_df(df)
            response = f"📊 **Complete Groundwater Statistics:**\n\n"
            response += f"• **Total monitoring records:** {summary['total_rows']:,}\n"
            response += f"• **States covered:** {summary['monitored_states']}\n"
            response += f"• **Average water level:** {summary['average_level']}m\n"
            response += f"• **Critical areas:** {summary['critical_areas']}\n"
            
            # Add state breakdown
            state_col = find_column(df, "state", "STATE", "State")
            if state_col:
                state_counts = df[state_col].value_counts().head(5)
                response += f"\n**Top monitored states:**\n"
                for state, count in state_counts.items():
                    response += f"• {state}: {count:,} records\n"
        
        # HELP QUERIES
        elif any(word in message_lower for word in ["help", "what can you", "how to", "commands"]):
            response = """🤖 **INGRES AI Assistant - I can help you with:**

🔍 **Location Analysis:**
• "Show me Maharashtra data"
• "Tell me about Bangalore district"
• "Water levels in Gujarat"

📈 **Trends & Comparisons:**
• "Show trending analysis"
• "Compare states by water level"
• "Which areas are improving?"

🚨 **Risk Assessment:**
• "Show critical areas"
• "Which regions are at risk?"
• "Emergency locations"

📊 **Statistics:**
• "Overall summary"
• "Total statistics" 
• "How many states monitored?"

Just ask naturally about any state, district, or analysis you need!"""
        
        # DEFAULT INTELLIGENT RESPONSE
        else:
            # Try to be helpful with available data
            state_col = find_column(df, "state", "STATE", "State")
            summary = build_summary_from_df(df)
            
            response = f"🌊 I have access to groundwater data from **{summary['monitored_states']} states** with **{summary['total_rows']:,} monitoring records**.\n\n"
            
            if state_col:
                available_states = df[state_col].dropna().unique()[:8]
                response += f"**Available regions:** {', '.join(available_states)}\n\n"
            
            response += "💡 **You can ask me about:**\n"
            response += "• Specific states/districts (e.g., 'Show me Punjab data')\n"
            response += "• Water level trends and comparisons\n"
            response += "• Critical areas and risk assessment\n"
            response += "• Overall statistics and summaries\n\n"
            response += "What would you like to explore?"
        
        return {
            "response": response,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "success"
        }
        
    except Exception as e:
        logger.exception("Error in chat endpoint")
        return {
            "response": "⚠️ I encountered an error processing your request. Please try asking about a specific state, district, or general groundwater trends.",
            "timestamp": datetime.utcnow().isoformat(),
            "status": "error"
        }

# ========================= STATIC FILES AND PWA =========================

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "csv_loaded": os.path.exists(CSV_PATH),
        "geojson_loaded": os.path.exists(GEOJSON_PATH)
    }

@app.get("/manifest.json")
async def get_manifest():
    """Return PWA manifest"""
    manifest_path = os.path.join(BASE_DIR, "../frontend/public/manifest.json")
    if os.path.exists(manifest_path):
        return FileResponse(manifest_path, media_type="application/json")
    
    default_manifest = {
        "name": "INGRES Dashboard",
        "short_name": "INGRES",
        "description": "AI-powered groundwater intelligence",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": "#000000",
        "icons": []
    }
    return JSONResponse(default_manifest)

@app.get("/sw.js")
async def get_service_worker():
    """Return service worker"""
    sw_path = os.path.join(BASE_DIR, "../frontend/public/sw.js")
    if os.path.exists(sw_path):
        return FileResponse(sw_path, media_type="application/javascript")
    return JSONResponse({"error": "Service worker not found"}, status_code=404)

@app.get("/favicon.ico")
async def get_favicon():
    favicon_path = os.path.join(BASE_DIR, "../frontend/public/favicon.ico")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path, media_type="image/x-icon")
    return JSONResponse({"error": "Favicon not found"}, status_code=404)

@app.get("/robots.txt")
async def get_robots():
    robots_path = os.path.join(BASE_DIR, "../frontend/public/robots.txt")
    if os.path.exists(robots_path):
        return FileResponse(robots_path, media_type="text/plain")
    return JSONResponse({"error": "Robots not found"}, status_code=404)

# ========================= FONT FILES =========================

@app.get("/Roboto-Regular.ttf")
async def get_roboto_font():
    font_paths = [
        os.path.join(BASE_DIR, "../frontend/public/fonts/Roboto-Regular.ttf"),
        os.path.join(BASE_DIR, "../frontend/src/assets/fonts/Roboto-Regular.ttf"),
    ]
    
    for font_path in font_paths:
        if os.path.exists(font_path):
            return FileResponse(font_path, media_type="font/ttf")
    
    return JSONResponse({"error": "Font not found"}, status_code=404)

@app.get("/DMSans-Regular.ttf")
async def get_dmsans_font():
    font_paths = [
        os.path.join(BASE_DIR, "../frontend/public/fonts/DMSans-Regular.ttf"),
        os.path.join(BASE_DIR, "../frontend/src/assets/fonts/DMSans-Regular.ttf"),
    ]
    
    for font_path in font_paths:
        if os.path.exists(font_path):
            return FileResponse(font_path, media_type="font/ttf")
    
    return JSONResponse({"error": "Font not found"}, status_code=404)

# ========================= CATCH-ALL ROUTE =========================

@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    """Catch-all route to log missing endpoints"""
    logger.warning(f"Missing endpoint requested: /{full_path}")
    return JSONResponse({"error": f"Endpoint /{full_path} not found"}, status_code=404)
