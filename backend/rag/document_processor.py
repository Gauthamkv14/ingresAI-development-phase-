from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import pandas as pd
import os
import logging
from typing import Optional, Dict, Any
from datetime import datetime

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

# Optionally expose backend/data as static files (e.g. /data/files/ingris_report.csv or geojson)
# Only use this in dev. In production, serve static files from a proper static server.
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

def build_summary_from_df(df: pd.DataFrame) -> Dict[str, Any]:
    """Create summarized metrics from the dataframe."""
    # Map common column names
    level_col = find_column(df, "water level", "water_level", "waterlevel", "level")
    date_col = find_column(df, "date", "timestamp", "datetime")
    state_col = find_column(df, "state", "STATE", "State")
    district_col = find_column(df, "district", "DISTRICT", "District")
    wells_col = find_column(df, "wells", "num_wells", "WELLS")

    # Ensure numeric for level column
    avg_level = None
    critical_count = 0
    if level_col:
        try:
            ser = pd.to_numeric(df[level_col], errors="coerce")
            non_na = ser.dropna()
            if not non_na.empty:
                avg_level = round(float(non_na.mean()), 2)
                critical_count = int((non_na < 10).sum())
        except Exception:
            logger.exception("Error coercing level column to numeric")
            avg_level = None
            critical_count = 0

    monitored_states = int(df[state_col].nunique()) if state_col in df.columns else 0
    total_rows = int(len(df))

    # Monthly trends
    monthly_trends = {}
    if date_col and level_col and (date_col in df.columns):
        try:
            tmp = df[[date_col, level_col]].copy()
            tmp[date_col] = pd.to_datetime(tmp[date_col], errors="coerce")
            tmp[level_col] = pd.to_numeric(tmp[level_col], errors="coerce")
            tmp = tmp.dropna(subset=[date_col, level_col])
            if not tmp.empty:
                grouped = tmp.groupby(pd.Grouper(key=date_col, freq="M"))[level_col].mean()
                monthly_trends = {k.strftime("%Y-%m"): round(float(v), 2) for k, v in grouped.items()}
        except Exception:
            logger.exception("Failed to compute monthly trends")

    return {
        "rows": total_rows,
        "monitored_states": monitored_states,
        "average_groundwater_level": avg_level,
        "critical_count": critical_count,
        "monthly_trends": monthly_trends,
        "columns": list(df.columns)
    }

# ========================= EXISTING ROUTES =========================

@app.get("/")
async def root():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}

@app.get("/summary")
async def get_summary():
    """
    Returns a small summary of the CSV dataset (monitored states, avg level, critical count, monthly trends).
    """
    df = read_csv_df()
    if df is None:
        return JSONResponse({"error": f"No {CSV_FILENAME} found on server. Upload via /upload or place in backend/data/."}, status_code=404)
    try:
        summary = build_summary_from_df(df)
        return summary
    except Exception as e:
        logger.exception("Error building summary")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/data")
async def get_data(limit: int = 1000, offset: int = 0):
    """
    Return rows as JSON list; use ?limit= and ?offset= for paging.
    """
    df = read_csv_df()
    if df is None:
        return {"count": 0, "data": []}
    try:
        total = len(df)
        df_slice = df.iloc[offset: offset + limit].fillna("").copy()
        data = df_slice.to_dict(orient="records")
        return {"count": total, "offset": offset, "limit": limit, "data": data}
    except Exception as e:
        logger.exception("Error returning data")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download")
async def download_csv():
    """
    Download the CSV file directly. Returns 404 if not present.
    """
    if not os.path.exists(CSV_PATH):
        raise HTTPException(status_code=404, detail="CSV file not found on server")
    return FileResponse(CSV_PATH, filename=CSV_FILENAME, media_type="text/csv")

@app.get("/geojson")
async def get_geojson():
    """
    If an india_districts.geojson is present in backend/data, return it; else 404.
    (Front-end map can fetch this at /geojson)
    """
    if not os.path.exists(GEOJSON_PATH):
        raise HTTPException(status_code=404, detail="GeoJSON not found on server")
    return FileResponse(GEOJSON_PATH, filename=GEOJSON_FILENAME, media_type="application/geo+json")

@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    """
    Upload CSV (multipart/form-data). Saves to backend/data/ingris_report.csv and returns updated summary.
    """
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

    # return new summary
    df = read_csv_df()
    summary = build_summary_from_df(df) if df is not None else {}
    return {"filename": file.filename, "saved_to": CSV_PATH, "summary": summary}

@app.get("/meta")
async def meta():
    df_exists = os.path.exists(CSV_PATH)
    geo_exists = os.path.exists(GEOJSON_PATH)
    versions = {}
    try:
        import sys
        versions["python"] = sys.version
        import pandas as pd
        versions["pandas"] = pd.__version__
    except Exception:
        versions["pandas"] = None
    return {"csv_present": df_exists, "geojson_present": geo_exists, "versions": versions}

# ========================= NEW API ROUTES FOR FRONTEND =========================

@app.get("/api/dashboard/overview")
async def get_dashboard_overview():
    """
    Dashboard overview endpoint that frontend expects.
    Maps to existing /summary endpoint functionality.
    """
    return await get_summary()

@app.get("/api/groundwater/levels")
async def get_groundwater_levels(limit: int = 1000, offset: int = 0):
    """
    Groundwater levels endpoint that frontend expects.
    Maps to existing /data endpoint functionality.
    """
    return await get_data(limit=limit, offset=offset)

@app.get("/api/dashboard/data")
async def get_dashboard_data(limit: int = 1000, offset: int = 0):
    """
    General dashboard data endpoint.
    Maps to existing /data endpoint functionality.
    """
    return await get_data(limit=limit, offset=offset)

@app.get("/api/map/geojson")
async def get_map_geojson():
    """
    Map GeoJSON endpoint that frontend might expect.
    Maps to existing /geojson endpoint.
    """
    return await get_geojson()

# ========================= STATIC FILE ROUTES =========================

@app.get("/manifest.json")
async def get_manifest():
    """Serve manifest.json if it exists in frontend/public"""
    manifest_path = os.path.join(BASE_DIR, "../frontend/public/manifest.json")
    if os.path.exists(manifest_path):
        return FileResponse(manifest_path, media_type="application/json")
    return JSONResponse({"error": "Manifest not found"}, status_code=404)

@app.get("/favicon.ico")
async def get_favicon():
    """Serve favicon.ico if it exists"""
    favicon_path = os.path.join(BASE_DIR, "../frontend/public/favicon.ico")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path, media_type="image/x-icon")
    return JSONResponse({"error": "Favicon not found"}, status_code=404)

@app.get("/robots.txt")
async def get_robots():
    """Serve robots.txt if it exists"""
    robots_path = os.path.join(BASE_DIR, "../frontend/public/robots.txt")
    if os.path.exists(robots_path):
        return FileResponse(robots_path, media_type="text/plain")
    return JSONResponse({"error": "Robots.txt not found"}, status_code=404)

# ========================= HEALTH CHECK =========================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "csv_loaded": os.path.exists(CSV_PATH),
        "geojson_loaded": os.path.exists(GEOJSON_PATH)
    }
