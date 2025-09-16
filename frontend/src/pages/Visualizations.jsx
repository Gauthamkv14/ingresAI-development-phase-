// src/pages/Visualizations.jsx
import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";

const SERIES = [
  { key: "Annual Extractable Ground water Resource (ham)_C", label: "Annual Extractable" },
  { key: "Net Annual Ground Water Availability for Future Use (ham)_C", label: "Net Annual Available" },
  { key: "Total Ground Water Availability in the area (ham)_Fresh", label: "Total Availability (Fresh)" },
];

export default function Visualizations() {
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
      .then((rows) => setDistricts(rows || []))
      .catch(() => setDistricts([]));
  }, [selected]);

  function downloadCSV() {
    if (!selected) return;
    fetch(`/api/state/${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then((data) => {
        // Build CSV from districts fetch instead (since state endpoint returns aggregates)
        fetch(`/api/state/${encodeURIComponent(selected)}/districts`)
          .then((r) => r.json())
          .then((rows) => {
            const cols = ["district", ...SERIES.map((s) => s.key)];
            const csv = [
              cols.join(","),
              ...rows.map((row) =>
                cols.map((c) => (`"${(row[c] ?? "").toString().replace(/"/g, '""')}"`)).join(",")
              ),
            ].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${selected}_districts.csv`;
            a.click();
            URL.revokeObjectURL(url);
          });
      })
      .catch(() => alert("Failed to prepare CSV"));
  }

  // Build grouped bars
  const plotData = SERIES.map((s) => ({
    x: districts.map((d) => d.district),
    y: districts.map((d) => (d[s.key] || 0)),
    name: s.label,
    type: "bar",
  }));

  return (
    <div className="visualizations-page">
      <div className="page-header">
        <h2>Visualizations</h2>
        <div className="controls">
          <label htmlFor="state-select">State</label>
          <select
            id="state-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="select-state"
          >
            <option value="">-- select state --</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button onClick={downloadCSV} disabled={!selected} className="btn">
            Download CSV
          </button>
        </div>
      </div>

      <div className="card fullwidth">
        <h3>District breakdown — {selected || "Select state"}</h3>
        {districts.length ? (
          <Plot
            data={plotData}
            layout={{
              barmode: "group",
              margin: { t: 40, r: 20, l: 60, b: 140 },
              height: 420,
              xaxis: { tickangle: -45 },
            }}
            config={{ displayModeBar: true }}
            style={{ width: "100%" }}
          />
        ) : (
          <div style={{ padding: 40 }}>Select a state to load district trends.</div>
        )}
      </div>
    </div>
  );
}
