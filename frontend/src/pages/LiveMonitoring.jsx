// src/pages/LiveMonitoring.jsx
import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";

export default function LiveMonitoring() {
  const [states, setStates] = useState([]);
  const [selected, setSelected] = useState("");
  const [districts, setDistricts] = useState([]);

  useEffect(() => {
    fetch("/api/states")
      .then((r) => r.json())
      .then((data) => setStates(data.map((s) => s.state).sort()))
      .catch(() => setStates([]));
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/state/${encodeURIComponent(selected)}/districts`)
      .then((r) => r.json())
      .then((rows) => {
        // For live monitoring chart, pick three fields and show a line (per district)
        setDistricts(rows || []);
      })
      .catch(() => setDistricts([]));
  }, [selected]);

  // Prepare three-series line for live-monitoring (exclude Extraction(Total), use Unconfined aquifer etc if available)
  const seriesKeys = [
    "Annual Extractable Ground water Resource (ham)_C",
    "Net Annual Ground Water Availability for Future Use (ham)_C",
    "Total Ground Water Availability in the area (ham)_Fresh",
  ];

  const plotData = seriesKeys.map((k, i) => ({
    x: districts.map((d) => d.district),
    y: districts.map((d) => d[k] || 0),
    mode: "lines+markers",
    name:
      k === seriesKeys[0]
        ? "Annual Extractable"
        : k === seriesKeys[1]
        ? "Net Annual Available"
        : "Total Availability",
  }));

  return (
    <div className="live-page">
      <div className="page-header">
        <h2>Live Monitoring Data</h2>
        <div className="controls">
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">-- select state --</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button onClick={() => { if (selected) { /* refresh trigger */ setSelected(selected); } }}>Refresh</button>
          <span className="muted"> Hover points for details</span>
        </div>
      </div>

      <div className="card fullwidth">
        {districts.length ? (
          <Plot
            data={plotData}
            layout={{
              height: 420,
              margin: { t: 30, r: 20, l: 60, b: 140 },
              xaxis: { tickangle: -50 },
            }}
            config={{ displayModeBar: true }}
            style={{ width: "100%" }}
          />
        ) : (
          <div style={{ padding: 40 }}>Select a state to show live monitoring trends.</div>
        )}
      </div>
    </div>
  );
}
