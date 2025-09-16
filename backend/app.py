# backend/app.py
import os
import time
import json
import re
from typing import Dict, List, Any
from difflib import get_close_matches

import pandas as pd
from fastapi import FastAPI, HTTPException, Request
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

AGG_COLS = [
    "Annual Extractable Ground water Resource (ham)_C",
    "Net Annual Ground Water Availability for Future Use (ham)_C",
    "Total Ground Water Availability in Unconfined Aquifier (ham)_Fr",
    "Total Ground Water Availability in the area (ham)_Fresh",
]

app = FastAPI(title="IngresAI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for development; change in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_local_cache = {}
redis_client = None

# Try connect to Redis (non-fatal)
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
    global df, states_list, geojson_data, normalized_to_canonical
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

    # canonicalize column names commonly present in this CSV
    if 'STATE' not in df.columns and 'State/UT' in df.columns:
        df.rename(columns={'State/UT': 'STATE'}, inplace=True)
    if 'DISTRICT' not in df.columns and 'District' in df.columns:
        df.rename(columns={'District': 'DISTRICT'}, inplace=True)

    # ensure strings and strip whitespace
    if 'STATE' in df.columns:
        df['STATE'] = df['STATE'].astype(str).str.strip()
    if 'DISTRICT' in df.columns:
        df['DISTRICT'] = df['DISTRICT'].astype(str).str.strip()

    # filter out empty/nan-like states
    df = df[df['STATE'].notna() & (df['STATE'].astype(str).str.strip() != '')]

    # Build a canonical mapping and normalized keys to match text user input robustly
    states_unique = sorted(df['STATE'].dropna().unique().tolist())

    def normalize_key(name: str) -> str:
        # Uppercase and remove non-alphanumeric (including spaces)
        if not isinstance(name, str): return ""
        return re.sub(r'[^A-Z0-9]', '', name.upper())

    normalized_to_canonical = {}
    for s in states_unique:
        key = normalize_key(str(s))
        normalized_to_canonical[key] = s  # keep original string as canonical display

    # store states_list (canonical)
    states_list = [normalized_to_canonical[k] for k in sorted(normalized_to_canonical.keys())]

    print(f"[INFO] CSV loaded: {len(df)} rows, {len(states_list)} states")

    # geojson
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


def normalize_text_key(s: str) -> str:
    if not s:
        return ""
    return re.sub(r'[^A-Z0-9]', '', s.upper())


def find_state_in_text(text: str) -> str:
    if not text:
        return None
    # normalize user text and check if any canonical key is substring
    tkey = normalize_text_key(text)
    # direct substring match (handles multi-word inputs)
    for nkey, canon in normalized_to_canonical.items():
        if nkey in tkey:
            return canon
    # token fuzzy match - try tokens against normalized keys with difflib
    tokens = [re.sub(r'[^A-Za-z0-9]', '', tok).upper() for tok in text.split() if len(tok) > 2]
    keys = list(normalized_to_canonical.keys())
    for tok in tokens:
        matches = get_close_matches(tok, keys, n=1, cutoff=0.8)
        if matches:
            return normalized_to_canonical[matches[0]]
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


@app.post("/api/chat")
async def chat_endpoint(request: Request):
    # The backend will accept JSON payloads (query/message/text) or form body or raw string
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

    # accept several key names
    query = None
    if isinstance(payload, dict):
        for key in ("query", "message", "text", "q"):
            if key in payload:
                query = payload.get(key)
                break

    if not query:
        raw = await request.body()
        try:
            raw_s = raw.decode('utf-8').strip()
            if raw_s:
                query = raw_s
        except Exception:
            query = None

    if not query:
        raise HTTPException(status_code=422, detail="No 'query' provided in request body. Send JSON: {\"query\":\"...\"}")

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
            "explanation": f"Sum of '{field}' across all districts in {state} is {value:.2f} ham."
        }

    if any(k in str(query).lower() for k in ["list states", "what states", "states available", "which states"]):
        return {"intent": "list_states", "states": states_list}
    return {"intent": "none", "answer": "Could not detect a state. Try: 'Show me Tamil Nadu groundwater data'."}


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
    vals = pd.to_numeric(df.get(field, pd.Series([0]*len(df))), errors='coerce').fillna(0)
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
