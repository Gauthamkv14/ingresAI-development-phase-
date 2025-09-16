// src/pages/Dashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import IndiaMap from "../components/IndiaMap";
import Plot from "react-plotly.js";

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [states, setStates] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedState, setSelectedState] = useState(null);
  const [districtData, setDistrictData] = useState([]);
  const trendsRef = useRef(null);

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then(setOverview)
      .catch(() => setOverview(null));

    fetch("/api/states")
      .then((r) => r.json())
      .then((data) => setStates(data.map((s) => s.state).sort()))
      .catch(() => setStates([]));
  }, []);

  useEffect(() => {
    if (!selectedState) return;
    fetch(`/api/state/${encodeURIComponent(selectedState)}/districts`)
      .then((r) => r.json())
      .then((rows) => {
        // filter out "Extraction (Total)" series later on plotting
        setDistrictData(rows || []);
        // scroll trends into view
        setTimeout(() => trendsRef.current?.scrollIntoView({ behavior: "smooth" }), 240);
      })
      .catch(() => setDistrictData([]));
  }, [selectedState]);

  function onSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // if the user typed a state name, set it
    const found = states.find((s) => s.toLowerCase() === q.toLowerCase());
    if (found) {
      setSelectedState(found);
    } else {
      // fallback: try fuzzy partial match
      const partial = states.find((s) => s.toLowerCase().includes(q.toLowerCase()));
      if (partial) setSelectedState(partial);
    }
  }

  // Prepare plot data for district breakdown (exclude Extraction(Total))
  const seriesCols = [
    "Annual Extractable Ground water Resource (ham)_C",
    "Net Annual Ground Water Availability for Future Use (ham)_C",
    "Total Ground Water Availability in the area (ham)_Fresh",
  ];

  const plotData = seriesCols.map((col, idx) => ({
    x: districtData.map((d) => d.district),
    y: districtData.map((d) => (d[col] || 0)),
    type: "bar",
    name:
      col === seriesCols[0]
        ? "Annual Extractable"
        : col === seriesCols[1]
        ? "Net Annual Available"
        : "Total Availability (Fresh)",
  }));

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-title">
          <h1>INGRES Dashboard</h1>
          <p className="subtitle">AI-powered groundwater intelligence</p>
        </div>
        <div className="dashboard-search">
          <form onSubmit={onSearch} style={{ width: "100%" }}>
            <input
              className="search-input"
              placeholder="Search states, districts, water data..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search"
            />
            <button className="hidden-submit" type="submit" aria-hidden />
          </form>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="map-and-quick">
          <div className="map-panel">
            <h3>Interactive Groundwater Map</h3>
            <div className="map-wrapper">
              <IndiaMap
                highlightState={selectedState}
                onFeatureClick={(stateName) => setSelectedState(stateName)}
              />
            </div>
          </div>

          <aside className="quick-panel">
            <div className="card small">
              <h4>Live Overview</h4>
              <div className="live-values">
                <div>Total points: {overview?.total_points ?? "—"}</div>
                <div>Safe: {overview?.safe ?? "—"}</div>
                <div>Moderate: {overview?.moderate ?? "—"}</div>
                <div>Critical: {overview?.critical ?? "—"}</div>
              </div>
            </div>

            <div className="card big">
              <h4>Quick Stats</h4>
              <div className="big-metric">{overview?.total_points ?? "—"}</div>
              <div className="label">MONITORING POINTS</div>
              <div className="big-metric">{overview?.critical ?? "—"}</div>
              <div className="label">CRITICAL AREAS</div>
            </div>
          </aside>
        </section>

        <section className="trends-panel" ref={trendsRef}>
          <div className="card fullwidth">
            <h3>Trends</h3>
            <p className="muted">
              {selectedState ? `District breakdown for ${selectedState}` : "Select a state to see district breakdown"}
            </p>

            {selectedState && districtData.length > 0 ? (
              <Plot
                data={plotData}
                layout={{
                  barmode: "group",
                  margin: { t: 40, r: 20, l: 60, b: 140 },
                  height: 340,
                  legend: { orientation: "h", y: -0.2 },
                  xaxis: { tickangle: -50 },
                }}
                config={{ displayModeBar: true }}
                style={{ width: "100%" }}
              />
            ) : (
              <div style={{ padding: 50, color: "#555" }}>
                Select a state (via search or map) to load district trends.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
