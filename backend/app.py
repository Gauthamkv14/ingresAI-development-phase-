# backend/app.py
import os
import time
import json
import re
from typing import Dict, List, Any
from difflib import get_close_matches

import pandas as pd
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

# optional redis
try:
    import redis
except Exception:
    redis = None

ENV_INGRIS_CSV = os.environ.get("INGRIS_CSV", "")
ENV_GEOJSON = os.environ.get("INGRIS_GEOJSON", "")
REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
REDIS_DB = int(os.environ.get("REDIS_DB", 0))

# Aggregation column names - preserve from CSV
AGG_COLS = [
    "Annual Extractable Ground water Resource (ham)_C",
    "Net Annual Ground Water Availability for Future Use (ham)_C",
    "Total Ground Water Availability in Unconfined Aquifier (ham)_Fr",
    "Total Ground Water Availability in the area (ham)_Fresh",
]

# Metric columns for metrics endpoint - adjust if your CSV uses different names
METRIC_COLS = {
    "rainfall": "Rainfall (mm)_C",
    "annual_recharge": "Annual Ground water Recharge (ham)_C",
    "extractable": "Annual Extractable Ground water Resource (ham)_C",
    "extraction_total": "Ground Water Extraction for all uses (ha.m)_Total_26",
    "stage_extraction_pct": "Stage of Ground Water Extraction (%)_C",
    "net_avail_future": "Net Annual Ground Water Availability for Future Use (ham)_C",
    "quality_tag": "Quality Tagging_Major Parameter Present_C",
    # you may have 'Saline' columns -- include typical names present in CSV
    "saline_cols": ["Saline", "Salinity", "Saline_2"]
}

app = FastAPI(title="IngresAI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev. In production, restrict to your frontend origin.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_local_cache = {}
redis_client = None

if redis:
    for attempt in range(3):
        try:
            redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, socket_connect_timeout=3)
            if redis_client.ping():
                print(f"[INFO] Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
                break
        except Exception as e:
            print(f"[WARN] Redis attempt {attempt+1} failed: {e}")
            time.sleep(1)
    else:
        print("[WARN] Redis unreachable - using in-memory cache.")
else:
    print("[WARN] redis library not installed; skipping Redis (in-memory cache will be used).")


def cache_set(key: str, value: Any, ttl: int = 3600):
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


def find_existing_file_candidates() -> Dict[str, List[str]]:
    root = os.path.abspath(os.getcwd())
    csv_candidates = []
    if ENV_INGRIS_CSV:
        csv_candidates.append(ENV_INGRIS_CSV)
    csv_candidates += [
        os.path.join(root, "data", "ingris_report.csv"),
        os.path.join(root, "backend", "data", "ingris_report.csv"),
        os.path.join(root, "backend", "ingris_report.csv"),
        os.path.join(root, "ingris_report.csv"),
        os.path.join(root, "..", "data", "ingris_report.csv"),
    ]
    seen = set(); csv_list = []
    for p in csv_candidates:
        if p and p not in seen:
            seen.add(p); csv_list.append(p)

    geo_candidates = []
    if ENV_GEOJSON:
        geo_candidates.append(ENV_GEOJSON)
    geo_candidates += [
        os.path.join(root, "data", "india_districts.geojson"),
        os.path.join(root, "backend", "data", "india_districts.geojson"),
        os.path.join(root, "data", "india_states.geojson"),
        os.path.join(root, "backend", "data", "india_states.geojson"),
        os.path.join(root, "india_districts.geojson"),
    ]
    seeng = set(); geo_list = []
    for p in geo_candidates:
        if p and p not in seeng:
            seeng.add(p); geo_list.append(p)

    return {"csv": csv_list, "geo": geo_list}


@app.on_event("startup")
def startup_load_files():
    global df, states_list, geojson_data, normalized_map, csv_path
    candidates = find_existing_file_candidates()
    csv_path = None
    for p in candidates["csv"]:
        if p and os.path.exists(p):
            csv_path = p
            break
    if not csv_path:
        msg = "CSV file not found. Checked:\n" + "\n".join(candidates["csv"]) + \
              "\nSet INGRIS_CSV env var to the CSV's absolute path or place it in one of the above locations."
        print("[ERROR]", msg)
        raise RuntimeError(msg)

    print(f"[INFO] Loading CSV from: {csv_path}")
    df = pd.read_csv(csv_path, low_memory=False)
    df.columns = [c.strip() for c in df.columns]

    # Common renames if present
    if 'State/UT' in df.columns and 'STATE' not in df.columns:
        df.rename(columns={'State/UT': 'STATE'}, inplace=True)
    if 'District' in df.columns and 'DISTRICT' not in df.columns:
        df.rename(columns={'District': 'DISTRICT'}, inplace=True)
    if 'STATE' in df.columns:
        df['STATE'] = df['STATE'].astype(str).str.strip()
    if 'DISTRICT' in df.columns:
        df['DISTRICT'] = df['DISTRICT'].astype(str).str.strip()

    states_list = sorted(df['STATE'].dropna().unique().tolist())
    print(f"[INFO] CSV loaded: {len(df)} rows, {len(states_list)} states")

    # Build normalized map for fuzzy matching (normalized_name -> canonical)
    def normalize(s: str) -> str:
        return re.sub(r'[^A-Z0-9]', '', s.upper())
    normalized_map = { normalize(s): s for s in states_list }

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
            print("[WARN] Failed to load geojson:", e)
            geojson_data = None
    else:
        print("[WARN] GeoJSON not found; map endpoint will return 404.")


def normalize_text(s: str) -> str:
    if not s:
        return ""
    return re.sub(r'[^A-Z0-9]', '', s.upper())


def find_state_in_text(text: str) -> str:
    if not text:
        return None
    tnorm = normalize_text(text)
    for nname, canon in normalized_map.items():
        if nname in tnorm:
            return canon
    tokens = [re.sub(r'[^A-Za-z0-9]', '', tok).upper() for tok in text.split() if len(tok) > 2]
    state_norms = list(normalized_map.keys())
    for token in tokens:
        matches = get_close_matches(token, state_norms, n=1, cutoff=0.8)
        if matches:
            return normalized_map[matches[0]]
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
    rows = []
    for district, g in sub.groupby('DISTRICT'):
        entry = {'district': district}
        for col in AGG_COLS:
            entry[col] = float(pd.to_numeric(g[col], errors='coerce').fillna(0.0).sum()) if col in g.columns else None
        rows.append(entry)
    cache_set(key, rows, ttl=3600)
    return rows


def compute_overview() -> Dict:
    key = "overview_v2"
    cached = cache_get(key)
    if cached:
        return cached
    total_points = int(df.shape[0])
    # choose a field that reflects availability for "safe/moderate/critical" like you had earlier
    field = "Total Ground Water Availability in the area (ham)_Fresh"
    if field not in df.columns:
        # fallback: use first AGG_COLS existing
        for c in AGG_COLS:
            if c in df.columns:
                field = c
                break
    vals = pd.to_numeric(df[field], errors='coerce').fillna(0)
    safe = int((vals > 15000).sum())
    moderate = int(((vals > 10000) & (vals <= 15000)).sum())
    critical = int((vals <= 10000).sum())
    # average groundwater level: try "Stage of Ground Water Extraction (%)_C" as a rough indicator
    avg_level = None
    if "Stage of Ground Water Extraction (%)_C" in df.columns:
        try:
            avg_level = float(pd.to_numeric(df["Stage of Ground Water Extraction (%)_C"], errors='coerce').dropna().mean())
        except Exception:
            avg_level = None
    monitored_states = int(df['STATE'].nunique()) if 'STATE' in df.columns else 0
    critical_count = int((pd.to_numeric(df.get("Stage of Ground Water Extraction (%)_C", 0), errors='coerce').fillna(0) > 70).sum())
    out = {
        "total_points": total_points,
        "safe": safe,
        "moderate": moderate,
        "critical": critical,
        "avg_groundwater_level": round(avg_level, 2) if avg_level is not None else None,
        "monitored_states": monitored_states,
        "critical_count": critical_count
    }
    cache_set(key, out, ttl=300)
    return out


@app.post("/api/chat")
async def chat_endpoint(request: Request):
    payload = {}
    try:
        payload = await request.json()
        if not isinstance(payload, dict):
            payload = {}
    except Exception:
        try:
            form = await request.form()
            payload = dict(form)
        except Exception:
            payload = {}
    query = None
    if 'query' in payload:
        query = payload.get('query')
    elif 'message' in payload:
        query = payload.get('message')
    elif 'text' in payload:
        query = payload.get('text')
    elif 'q' in payload:
        query = payload.get('q')
    else:
        raw = await request.body()
        try:
            raw_s = raw.decode('utf-8').strip()
            if raw_s:
                query = raw_s
        except Exception:
            query = None
    if not query:
        raise HTTPException(status_code=422, detail="No 'query' provided in request body.")
    # Very simple NLU: look for state name, or requests for lists/metrics
    state = find_state_in_text(str(query))
    if state:
        ag = aggregate_state(state)
        field = "Total Ground Water Availability in the area (ham)_Fresh"
        value = ag.get(field, 0.0)
        return {
            "intent": "state_aggregate",
            "state": state,
            "field": field,
            "value": value,
            "num_districts": ag.get("num_districts"),
            "explanation": f"Sum of '{field}' across all districts in {state} is {value:.2f} ham.",
            "aggregates": ag
        }
    if any(k in str(query).lower() for k in ["list states", "what states", "states available", "which states"]):
        return {"intent": "list_states", "states": states_list}
    # else generic
    return {"intent": "none", "answer": "Could not detect a state. Try: 'Show me Karnataka groundwater data'."}


@app.get("/api/states")
def get_states():
    key = "states_overview_v2"
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


@app.get("/api/state/{state_name}/metrics")
def state_metrics(state_name: str):
    """
    Return aggregated metrics useful for plotting on frontend:
      - rainfall average
      - annual_recharge sum
      - extractable sum
      - extraction_total sum
      - stage_extraction_pct average
      - net_avail_future sum
      - saline_count (rows where saline column indicates presence)
    """
    key = f"metrics::{state_name}"
    cached = cache_get(key)
    if cached:
        return cached
    sub = df[df['STATE'].str.upper() == state_name.upper()]
    if sub.empty:
        raise HTTPException(status_code=404, detail=f"State {state_name} not found")
    def safe_sum(col):
        if col in sub.columns:
            return float(pd.to_numeric(sub[col], errors='coerce').fillna(0.0).sum())
        return None
    def safe_mean(col):
        if col in sub.columns:
            vals = pd.to_numeric(sub[col], errors='coerce').dropna()
            if len(vals) == 0: return None
            return float(vals.mean())
        return None
    # rainfall average (mm)
    rainfall_col = METRIC_COLS.get("rainfall")
    rainfall_avg = safe_mean(rainfall_col) if rainfall_col else None
    # annual recharge sum
    recharge_col = METRIC_COLS.get("annual_recharge")
    recharge_sum = safe_sum(recharge_col) if recharge_col else None
    # extractable sum
    extractable_col = METRIC_COLS.get("extractable")
    extractable_sum = safe_sum(extractable_col) if extractable_col else None
    # extraction total
    extraction_col = METRIC_COLS.get("extraction_total")
    extraction_sum = safe_sum(extraction_col) if extraction_col else None
    # stage extraction average
    stage_avg = safe_mean(METRIC_COLS.get("stage_extraction_pct"))
    # net available future sum
    net_future_sum = safe_sum(METRIC_COLS.get("net_avail_future"))
    # saline detection - count rows where any saline-like column > 0 or text contains saline
    saline_count = 0
    saline_candidates = METRIC_COLS.get("saline_cols", [])
    for _, row in sub.iterrows():
        found = False
        for sc in saline_candidates:
            if sc in sub.columns:
                v = row.get(sc)
                try:
                    if pd.notna(v) and float(v) > 0:
                        found = True; break
                except Exception:
                    # string indicator?
                    if isinstance(v, str) and v.strip().lower() in ("yes", "saline", "true"):
                        found = True; break
        if found:
            saline_count += 1
    out = {
        "state": state_name,
        "rainfall_avg_mm": rainfall_avg,
        "annual_recharge_sum_ham": recharge_sum,
        "extractable_sum_ham": extractable_sum,
        "extraction_sum_ham": extraction_sum,
        "stage_extraction_pct_avg": stage_avg,
        "net_avail_future_sum_ham": net_future_sum,
        "saline_count": saline_count,
        "num_districts": int(sub['DISTRICT'].nunique()) if 'DISTRICT' in sub.columns else int(sub.shape[0])
    }
    cache_set(key, out, ttl=3600)
    return out


@app.get("/api/overview")
def overview():
    return compute_overview()


@app.get("/api/geojson")
def get_geojson():
    if 'geojson_data' in globals() and geojson_data:
        return geojson_data
    raise HTTPException(status_code=404, detail="GeoJSON not available on server")


@app.get("/api/download")
def download_csv():
    if 'csv_path' in globals() and csv_path and os.path.exists(csv_path):
        return FileResponse(csv_path, media_type="text/csv", filename=os.path.basename(csv_path))
    raise HTTPException(status_code=404, detail="CSV not available for download.")
