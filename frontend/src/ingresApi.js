import axios from "axios";

// Support both REACT_APP_API_BASE and REACT_APP_API_URL env vars
const BASE =
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  (window._INGRES_API_BASE || "http://localhost:8000");

export async function getStatesOverview() {
  const res = await axios.get(`${BASE}/api/states`);
  return res.data;
}

export async function getStateAggregate(stateName) {
  const res = await axios.get(
    `${BASE}/api/state/${encodeURIComponent(stateName)}`
  );
  return res.data;
}

export async function getStateDistricts(stateName) {
  const res = await axios.get(
    `${BASE}/api/state/${encodeURIComponent(stateName)}/districts`
  );
  return res.data;
}

export async function getOverview() {
  const res = await axios.get(`${BASE}/api/overview`);
  return res.data;
}

export async function postChat(queryText) {
  // Always send JSON with { query: ... }
  const res = await axios.post(
    `${BASE}/api/chat`,
    { query: queryText },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data;
}

export async function getGeojson() {
  const res = await axios.get(`${BASE}/api/geojson`);
  return res.data;
}

