// src/components/LiveMonitor.jsx
import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import 'chart.js/auto';

export default function LiveMonitor({ initialState = "" }) {
  const [states, setStates] = useState([]);
  const [stateSel, setStateSel] = useState(initialState || "");
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/states").then(r => r.json()).then(j => {
      const s = j.map(x => x.state || x);
      setStates(s);
      if (!stateSel && s.length) setStateSel(initialState || s[0]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!stateSel) return;
    setLoading(true);
    fetch(`/api/state/${encodeURIComponent(stateSel)}/metrics`).then(r => {
      if (!r.ok) throw new Error("failed metrics");
      return r.json();
    }).then(j => setMetrics(j)).catch(err => {
      console.error(err);
      setMetrics(null);
    }).finally(() => setLoading(false));
  }, [stateSel]);

  const buildChart = () => {
    if (!metrics) return null;
    const labels = [
      "Net avail future (ham)",
      "Rainfall (mm avg)",
      "Quality (count)",
      "Total Availability (ham)"
    ];
    const values = [
      metrics.net_avail_future_sum_ham || 0,
      metrics.rainfall_avg_mm || 0,
      metrics.saline_count || metrics.quality_count || 0,
      metrics.extractable_sum_ham || metrics.total_ground_water_ham || 0
    ];
    return { labels, values };
  };

  const chart = buildChart();

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div style={{ flex: 1 }}>
        <h3>Live Monitoring</h3>
        <div style={{ marginBottom: 12 }}>
          <select value={stateSel} onChange={(e) => setStateSel(e.target.value)}>
            <option value="">-- Select state --</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loading && <div>Loading metrics...</div>}

        {chart ? (
          <div style={{ background: "#fff", padding: 12, borderRadius: 8 }}>
            <Line data={{
              labels: chart.labels,
              datasets: [{ label: stateSel, data: chart.values, tension: 0.2 }]
            }} />
          </div>
        ) : <div style={{ background: "#fff", padding: 12, borderRadius: 8 }}>No metrics for selected state.</div>}
      </div>

      <aside style={{ width: 360 }}>
        <div style={{ background: "#fff", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <h4>Total Monitoring Wells</h4>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{metrics ? (metrics.wells_total ?? '—') : '—'}</div>
        </div>

        <div style={{ background: "#fff", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <h4>Monitored Districts</h4>
          <div style={{ fontSize: 22 }}>{metrics ? (metrics.num_districts ?? '—') : '—'}</div>
        </div>

        <div style={{ background: "#fff", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <h4>Avg Stage of Extraction (%)</h4>
          <div style={{ fontSize: 22 }}>{metrics ? (metrics.stage_extraction_pct_avg ?? '—') : '—'}</div>
        </div>

        <div style={{ background: "#fff", padding: 12, borderRadius: 8 }}>
          <h4>Critical Areas</h4>
          <div style={{ fontSize: 22, color: "crimson" }}>{metrics ? (metrics.critical_count ?? 0) : 0}</div>
        </div>
      </aside>
    </div>
  );
}
