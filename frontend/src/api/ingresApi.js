// src/api/ingresApi.jsx
export async function postChat(query) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error("chat failed");
  return res.json();
}

export async function getGeoJSON() {
  const r = await fetch("/api/geojson");
  if (!r.ok) throw new Error("no geojson");
  return r.json();
}

export async function getStates() {
  const r = await fetch("/api/states");
  if (!r.ok) throw new Error("no states");
  return r.json();
}

export async function getStateDistricts(state) {
  const r = await fetch(`/api/state/${encodeURIComponent(state)}/districts`);
  if (!r.ok) throw new Error("state not found");
  return r.json();
}

export async function getOverview() {
  const r = await fetch(`/api/overview`);
  if (!r.ok) throw new Error("overview failed");
  return r.json();
}

export async function getStatesOverview(){
  const res = await fetch("/api/states");
  if (!res.ok) throw new Error("states fetch failed");
  return res.json();
}
