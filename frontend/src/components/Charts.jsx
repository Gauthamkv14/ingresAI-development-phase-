// src/components/Charts.jsx
import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { getStatesOverview, getStateAggregate } from "../api/ingresApi";
import { defaultChartOptions } from "../utils/charts"; // keep the utils file I gave earlier

const METRIC_LABELS = [
  "Annual Extractable Ground water Resource (ham)_C",
  "Net Annual Ground Water Availability for Future Use (ham)_C",
  "Total Ground Water Availability in Unconfined Aquifier (ham)_Fr",
  "Total Ground Water Availability in the area (ham)_Fresh",
];

export default function Charts() {
  const [states, setStates] = useState([]);
  const [selected, setSelected] = useState("");
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getStatesOverview().then((s) => {
      setStates(s || []);
      if (s && s.length) setSelected(s[0].state);
    }).catch((e) => {
      console.error("Failed to load states overview", e);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    getStateAggregate(selected).then((data) => {
      const values = METRIC_LABELS.map(l => Number(data[l] || 0));
      setChartData({
        labels: METRIC_LABELS.map(l => l.replace(/\s*\(.*\)$/, "")),
        datasets: [{
          label: `${selected} groundwater (ham)`,
          data: values,
          fill: false,
          tension: 0.25,
          pointRadius: 6,
        }]
      });
    }).catch(err => {
      console.error("State aggregate load failed", err);
      setChartData(null);
    }).finally(() => setLoading(false));
  }, [selected]);

  return (
    <div>
      <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:12 }}>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {states.map(s => <option key={s.state} value={s.state}>{s.state}</option>)}
        </select>
        <button onClick={() => { if (selected) setSelected(selected); }}>Refresh</button>
        <div style={{ marginLeft:"auto", color:"#666" }}>
          {loading ? "Loading..." : chartData ? "Hover points for details" : "Select a state"}
        </div>
      </div>

      <div style={{ height: 320 }}>
        {chartData ? <Line data={chartData} options={defaultChartOptions} /> : <div>No data</div>}
      </div>
    </div>
  );
}
