// src/api/ingresApi.js
import axios from "axios";

const BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

export async function getStatesOverview() {
  const res = await axios.get(`${BASE}/api/states`);
  return res.data;
}

export async function getStateAggregate(stateName) {
  const res = await axios.get(`${BASE}/api/state/${encodeURIComponent(stateName)}`);
  return res.data;
}

export async function getStateDistricts(stateName) {
  const res = await axios.get(`${BASE}/api/state/${encodeURIComponent(stateName)}/districts`);
  return res.data;
}

export async function getOverview() {
  const res = await axios.get(`${BASE}/api/overview`);
  return res.data;
}

export async function postChat(queryText) {
  // backend expects JSON: { "query": "..." }
  const res = await axios.post(`${BASE}/api/chat`, { query: queryText });
  return res.data;
}

export async function getGeojson() {
  const res = await axios.get(`${BASE}/api/geojson`);
  return res.data;
}
