# backend/app.py
import os
import time
import json
from typing import Dict, List
from difflib import get_close_matches

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Redis optional
try:
    import redis
except Exception:
    redis = None

# Defaults (can be overridden by env)
ENV_INGRIS_CSV = os.environ.get("INGRIS_CSV", "")
ENV_GEOJSON = os.environ.get("INGRIS_GEOJSON", "")
REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
REDIS_DB = int(os.environ.get("REDIS_DB", 0))

# columns used exactly as in CSV
AGG_COLS = [
    "Annual Extractable Ground water Resource (ham)_C",
    "Net Annual Ground Water Availability for Future Use (ham)_C",
    "Total Ground Water Availability in Unconfined Aquifier (ham)_Fr",
    "Total Ground Water Availability in the area (ham)_Fresh",
]

app = FastAPI(title="IngresAI Backend (updated startup)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_local_cache = {}
redis_client = None

# Try to connect to redis (non-fatal). If redis package missing or host unreachable, fallback silently.
if redis:
    for attempt in range(3):
        try:
            redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, socket_connect_timeout=3)
            if redis_client.ping():
                print(f"[INFO] Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
                break
        except Exception as e:
            print(f"[WARN] Redis connection attempt {attempt+1} failed: {e}")
            time.sleep(1)
    else:
        print("[WARN] Redis unreachable — using in-memory cache fallback.")
else:
    print("[WARN] redis-py not installed; Redis disabled (in-memory cache will be used).")


def cache_set(key: str, value, ttl: int = 3600):
    if redis_client:
        try:
            redis_client.setex(key, ttl, json.dumps(value, default=str))
            return
        except Exception:
            pass
    _local_cache[key] = (time.time() + ttl, value)


def cache_get(key: str):
    if redis_client:
        try:
            raw = redis_client.get(key)
            if raw:
                return json.loads(raw)
            return None
        except Exception:
            pass
    entry = _local_cache.get(key)
    if not entry:
        return None
    expiry, value = entry
    if time.time() > expiry:
        del _local_cache[key]
        return None
    return value


def find_existing_file_candidates() -> Dict[str, str]:
    """
    Try multiple candidate paths for CSV and geojson and return the first found.
    """
    root = os.path.abspath(os.getcwd())
    # Build list of candidate CSV paths
    candidates = []
    # explicit env path first
    if ENV_INGRIS_CSV:
        candidates.append(ENV_INGRIS_CSV)
    # common locations relative to working directory and repository layout
    candidates += [
        os.path.join(root, "data", "ingris_report.csv"),
        os.path.join(root, "backend", "data", "ingris_report.csv"),
        os.path.join(root, "backend", "ingris_report.csv"),
        os.path.join(root, "ingris_report.csv"),
        os.path.join(root, "..", "data", "ingris_report.csv"),
    ]
    # dedupe but preserve order
    seen = set()
    csv_candidates = []
    for p in candidates:
        if p not in seen:
            seen.add(p)
            csv_candidates.append(p)

    # GEOJSON candidates
    geo_candidates = []
    if ENV_GEOJSON:
        geo_candidates.append(ENV_GEOJSON)
    geo_candidates += [
        os.path.join(root, "data", "india_districts.geojson"),
        os.path.join(root, "backend", "data", "india_districts.geojson"),
        os.path.join(root, "data", "india_states.geojson"),
        os.path.join(root, "backend", "data", "india_districts.geojson"),
        os.path.join(root, "india_districts.geojson"),
    ]
    geo_seen = set()
    geo_candidates_unique = []
    for p in geo_candidates:
        if p not in geo_seen:
            geo_seen.add(p)
            geo_candidates_unique.append(p)

    return {"csv": csv_candidates, "geo": geo_candidates_unique}


@app.on_event("startup")
def startup_load_files():
    """
    Load CSV and geojson; if not found, raise an informative error listing tried paths.
    """
    global df, states_list, geojson_data
    candidates = find_existing_file_candidates()
    csv_path = None
    for p in candidates["csv"]:
        if p and os.path.exists(p):
            csv_path = p
            break
    if not csv_path:
        # informative error listing checked paths
        msg = (
            "CSV file not found. Checked the following locations:\n" +
            "\n".join(candidates["csv"]) +
            "\n\nTo fix: place ingris_report.csv in one of these paths OR set environment variable INGRIS_CSV to the absolute path.\n"
            "Example (PowerShell): $env:INGRIS_CSV='C:\\full\\path\\to\\ingris_report.csv'; uvicorn app:app --reload\n"
            "Or (Linux/macOS): export INGRIS_CSV=/full/path/ingris_report.csv; uvicorn app:app --reload\n"
        )
        print("[ERROR]", msg)
        raise RuntimeError(msg)

    # load the CSV
    print(f"[INFO] Loading CSV from: {csv_path}")
    df = pd.read_csv(csv_path, low_memory=False)
    df.columns = [c.strip() for c in df.columns]
    # try rename possible variant columns
    if 'STATE' not in df.columns and 'State/UT' in df.columns:
        df.rename(columns={'State/UT': 'STATE'}, inplace=True)
    if 'DISTRICT' not in df.columns and 'District' in df.columns:
        df.rename(columns={'District': 'DISTRICT'}, inplace=True)
    if 'STATE' in df.columns:
        df['STATE'] = df['STATE'].astype(str).str.strip()
    if 'DISTRICT' in df.columns:
        df['DISTRICT'] = df['DISTRICT'].astype(str).str.strip()
    states_list = sorted(df['STATE'].dropna().unique().tolist())
    print(f"[INFO] CSV loaded: {len(df)} rows, {len(states_list)} unique states.")

    # geojson optional
    geojson_data = None
    geo_path = None
    for p in candidates["geo"]:
        if p and os.path.exists(p):
            geo_path = p
            break
    if geo_path:
        try:
            with open(geo_path, 'r', encoding='utf-8') as fh:
                geojson_data = json.load(fh)
            print(f"[INFO] GeoJSON loaded from: {geo_path}")
        except Exception as e:
            print(f"[WARN] Failed to load geojson at {geo_path}: {e}")
            geojson_data = None
    else:
        print("[WARN] GeoJSON not found in checked locations; /api/geojson will return 404.")


def find_state_in_text(text: str) -> str:
    text_up = text.upper()
    for st in states_list:
        if st.upper() in text_up:
            return st
    tokens = [t.strip() for t in text.split() if len(t) > 2]
    for t in tokens:
        matches = get_close_matches(t.upper(), [s.upper() for s in states_list], n=1, cutoff=0.8)
        if matches:
            idx = [s.upper() for s in states_list].index(matches[0])
            return states_list[idx]
    return None


def aggregate_state(state_name: str) -> Dict:
    key = f"agg_state::{state_name}"
    cached = cache_get(key)
    if cached:
        return cached
    sub = df[df['STATE'].str.upper() == state_name.upper()]
    if sub.empty:
        raise KeyError("State not found")
    aggs = {}
    for col in AGG_COLS:
        if col in sub.columns:
            aggs[col] = float(pd.to_numeric(sub[col], errors='coerce').fillna(0.0).sum())
        else:
            aggs[col] = None
    aggs['num_districts'] = int(sub['DISTRICT'].nunique()) if 'DISTRICT' in sub.columns else int(sub.shape[0])
    aggs['state'] = state_name
    cache_set(key, aggs, ttl=3600)
    return aggs


def aggregate_state_districts(state_name: str) -> List[Dict]:
    key = f"agg_state_districts::{state_name}"
    cached = cache_get(key)
    if cached:
        return cached
    sub = df[df['STATE'].str.upper() == state_name.upper()]
    if sub.empty:
        raise KeyError("State not found")
    group = sub.groupby('DISTRICT')
    rows = []
    for district, g in group:
        entry = {'district': district}
        for col in AGG_COLS:
            if col in g.columns:
                entry[col] = float(pd.to_numeric(g[col], errors='coerce').fillna(0.0).sum())
            else:
                entry[col] = None
        rows.append(entry)
    cache_set(key, rows, ttl=3600)
    return rows


class ChatRequest(BaseModel):
    query: str


@app.post("/api/chat")
def chat(req: ChatRequest):
    text = req.query.strip()
    state = find_state_in_text(text)
    if state:
        try:
            ag = aggregate_state(state)
        except KeyError:
            raise HTTPException(status_code=404, detail="State not found")
        field = "Total Ground Water Availability in the area (ham)_Fresh"
        value = ag.get(field, 0.0)
        return {
            "intent": "state_aggregate",
            "state": state,
            "field": field,
            "value": value,
            "num_districts": ag.get("num_districts"),
            "explanation": f"Sum of '{field}' across all districts in {state} is {value:.2f} ham."
        }

    if any(k in text.lower() for k in ["list states", "what states", "states available", "which states"]):
        return {"intent": "list_states", "states": states_list}
    return {"intent": "none", "answer": "I couldn't find a state in your question. Try: 'Show me Tamil Nadu groundwater data'."}


@app.get("/api/states")
def get_states():
    key = "states_overview"
    cached = cache_get(key)
    if cached:
        return cached
    out = []
    for st in states_list:
        try:
            ag = aggregate_state(st)
            out.append({
                "state": st,
                "total_ground_water_ham": ag.get("Total Ground Water Availability in the area (ham)_Fresh", 0.0),
                "num_districts": ag.get("num_districts", 0)
            })
        except Exception:
            continue
    cache_set(key, out, ttl=3600)
    return out


@app.get("/api/state/{state_name}")
def state_aggregate(state_name: str):
    try:
        return aggregate_state(state_name)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"State {state_name} not found")


@app.get("/api/state/{state_name}/districts")
def state_districts(state_name: str):
    try:
        return aggregate_state_districts(state_name)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"State {state_name} not found")


@app.get("/api/overview")
def overview():
    key = "overview"
    cached = cache_get(key)
    if cached:
        return cached
    total_points = int(df.shape[0])
    field = "Total Ground Water Availability in the area (ham)_Fresh"
    vals = pd.to_numeric(df[field], errors='coerce').fillna(0)
    safe = int((vals > 15000).sum())
    moderate = int(((vals > 10000) & (vals <= 15000)).sum())
    critical = int((vals <= 10000).sum())
    out = {"total_points": total_points, "safe": safe, "moderate": moderate, "critical": critical}
    cache_set(key, out, ttl=300)
    return out


@app.get("/api/geojson")
def get_geojson():
    if 'geojson_data' in globals() and geojson_data:
        return geojson_data
    raise HTTPException(status_code=404, detail="GeoJSON not available on server")
