// src/components/Charts.jsx
import React, { useEffect, useState, useMemo } from "react";
import { Line } from "react-chartjs-2";
import 'chart.js/auto';

/**
 * Charts component modes:
 * - mode="overview-trends" => used on Overview card: show TWO metrics simultaneously
 *     * Annual Extractable Ground water Resource (ham)_C
 *     * Total Ground Water Availability in the area (ham)_Fresh
 *   It reads `initialState` if provided and uses groundwaterData prop to compute district-level series.
 *
 * - mode="state-metric" => Charts page: shows a metric for a chosen state (dropdown) and a metric dropdown.
 *   It groups by district using groundwaterData and plots district-wise values.
 *
 * Props:
 * - mode (string)
 * - initialState (string)
 * - groundwaterData (array)  <-- REQUIRED for district-level calculations
 */
export default function Charts({ mode = "state-dual-trend", initialState = "", groundwaterData = [] }) {
  const [states, setStates] = useState([]);
  const [stateSel, setStateSel] = useState(initialState || "");
  const [metric, setMetric] = useState("Total Ground Water Availability in the area (ham)_Fresh");
  const [loading, setLoading] = useState(false);

  // metric options for Charts page
  const METRIC_OPTIONS = [
    { key: "Net Annual Ground Water Availability for Future Use (ham)_C", label: "Net avail. for future (ham)" },
    { key: "Rainfall (mm)_C", label: "Rainfall (mm)" },
    { key: "Quality Tagging_Major Parameter Present_C", label: "Quality issues (count/flag)" },
    { key: "Total Ground Water Availability in the area (ham)_Fresh", label: "Total Availability (ham)" }
  ];

  // Build list of states by reading groundwaterData if present, fallback to /api/states
  useEffect(() => {
    if (Array.isArray(groundwaterData) && groundwaterData.length > 0) {
      const list = Array.from(new Set(groundwaterData.map(r => (r.state || "").trim()).filter(Boolean))).sort();
      setStates(list);
      if (!stateSel && (initialState || list.length)) {
        setStateSel(initialState || list[0]);
      }
    } else {
      // fallback: fetch /api/states
      fetch("/api/states").then(r => r.json()).then(j => {
        const s = Array.isArray(j) ? j.map(x => x.state || x) : [];
        setStates(s);
        if (!stateSel && (initialState || s.length)) {
          setStateSel(initialState || s[0]);
        }
      }).catch(() => {});
    }
  }, [groundwaterData]);

  // Compute district aggregation for the chosen state and metric
  const districtRows = useMemo(() => {
    if (!stateSel) return [];
    // group rows in groundwaterData by district for this stateSel
    const rows = groundwaterData.filter(r => (r.state || "").toString().trim().toUpperCase() === (stateSel || "").toString().trim().toUpperCase());
    const map = new Map();
    rows.forEach(r => {
      const d = (r.district || "Unknown").toString().trim();
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(r);
    });
    const out = [];
    for (const [district, arr] of map.entries()) {
      out.push({ district, rows: arr });
    }
    // For each district, compute value for selected metric:
    // - For numeric metrics: sum
    // - For 'Quality' metric: count non-empty / truthy values
    return out.map(g => {
      const key = metric;
      let value = 0;
      if (key === "Quality Tagging_Major Parameter Present_C") {
        // count rows where quality tag is present / truthy
        value = g.rows.reduce((s, row) => {
          const v = row[key];
          if (v === undefined || v === null) return s;
          if (String(v).trim() === "") return s;
          // if numeric-looking
          const n = Number(String(v).replace(/,/g, '').trim());
          if (!Number.isNaN(n) && n > 0) return s + 1;
          // textual flag
          return s + 1;
        }, 0);
      } else {
        // numeric sum; try to coerce values
        value = g.rows.reduce((s, row) => {
          const v = row[key];
          if (v === undefined || v === null || v === "") return s;
          const n = Number(String(v).replace(/,/g, '').trim());
          return s + (Number.isFinite(n) ? n : 0);
        }, 0);
      }
      return {
        district: g.district,
        value
      };
    }).sort((a,b) => b.value - a.value); // sort descending by value
  }, [groundwaterData, stateSel, metric]);

  // Build chart data
  const chartData = useMemo(() => {
    if (!districtRows || districtRows.length === 0) return null;
    const labels = districtRows.map(r => r.district);
    const values = districtRows.map(r => r.value);
    return {
      labels,
      datasets: [
        {
          label: METRIC_OPTIONS.find(m => m.key === metric)?.label || metric,
          data: values,
          fill: false,
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 3
        }
      ]
    };
  }, [districtRows, metric]);

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false, // stop continuous replotting / anim loops
    plugins: {
      legend: { position: 'top' },
      tooltip: { mode: 'index', intersect: false }
    },
    interaction: {
      mode: 'nearest',
      intersect: false
    },
    onHover: (event, activeElements) => {
      // When hovering a datapoint, dispatch mapStateClick with the state to highlight map
      try {
        if (activeElements && activeElements.length > 0) {
          const idx = activeElements[0].index;
          const districtName = (chartData && chartData.labels && chartData.labels[idx]) ? chartData.labels[idx] : null;
          if (districtName && stateSel) {
            window.dispatchEvent(new CustomEvent('mapStateClick', { detail: { state: stateSel, district: districtName } }));
          }
        } else {
          // optionally, you can dispatch a "clear highlight" if you have that handled in map
          // window.dispatchEvent(new CustomEvent('mapStateHoverClear', {}));
        }
      } catch (e) {
        // swallow
      }
    },
    scales: {
      x: {
        ticks: { autoSkip: true, maxRotation: 0, minRotation: 0 }
      },
      y: { beginAtZero: true }
    }
  };

  // For overview-trends mode (on the overview card) we show TWO series:
  // Annual Extractable and Total Availability across districts (same code path but two datasets)
  const overviewChartData = useMemo(() => {
    if (!stateSel) return null;
    // use groundwaterData to aggregate per district for both keys
    const extractKey = "Annual Extractable Ground water Resource (ham)_C";
    const totalKey = "Total Ground Water Availability in the area (ham)_Fresh";
    const rows = groundwaterData.filter(r => (r.state || "").toString().trim().toUpperCase() === (stateSel || "").toString().trim().toUpperCase());
    const map = new Map();
    rows.forEach(r => {
      const d = (r.district || "Unknown").toString().trim();
      if (!map.has(d)) map.set(d, { extractSum: 0, totalSum: 0 });
      const entry = map.get(d);
      const ex = Number(String(r[extractKey] || "").replace(/,/g, ''));
      entry.extractSum += Number.isFinite(ex) ? ex : 0;
      const tot = Number(String(r[totalKey] || "").replace(/,/g, ''));
      entry.totalSum += Number.isFinite(tot) ? tot : 0;
      map.set(d, entry);
    });
    const labels = Array.from(map.keys());
    const extractable = labels.map(l => map.get(l).extractSum);
    const totalAvail = labels.map(l => map.get(l).totalSum);
    if (labels.length === 0) return null;
    return {
      labels,
      datasets: [
        {
          label: "Extractable (ham)",
          data: extractable,
          fill: false,
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 2,
        },
        {
          label: "Total Availability (ham)",
          data: totalAvail,
          fill: false,
          tension: 0.2,
          borderWidth: 2,
          borderDash: [6,3],
          pointRadius: 2,
        }
      ]
    };
  }, [groundwaterData, stateSel]);

  // UI: metric choices for Charts page
  const metricOptionsUI = METRIC_OPTIONS;

  return (
    <div style={{ padding: 8 }}>
      {mode === "state-metric" && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <label style={{ fontWeight: 600 }}>State</label>
            <select value={stateSel} onChange={(e) => setStateSel(e.target.value)}>
              <option value="">-- Select state --</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <label style={{ fontWeight: 600 }}>Metric</label>
            <select value={metric} onChange={(e) => setMetric(e.target.value)}>
              {metricOptionsUI.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
            </select>

            <div style={{ marginLeft: 'auto', fontSize: 13, color: '#666' }}>{districtRows.length} districts</div>
          </div>

          <div style={{ height: 420, background: '#fff', padding: 12, borderRadius: 6 }}>
            {chartData ? (
              <Line data={chartData} options={commonOptions} />
            ) : (
              <div style={{ padding: 24, color: '#666' }}>Select a state and metric to view district-wise values.</div>
            )}
          </div>
        </>
      )}

      {mode === "overview-trends" && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <label style={{ fontWeight: 600 }}>State</label>
            <select value={stateSel} onChange={(e) => setStateSel(e.target.value)}>
              <option value="">-- Select state --</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div style={{ marginLeft: 'auto', fontSize: 13, color: '#666' }}>{overviewChartData ? overviewChartData.labels.length + " districts" : ''}</div>
          </div>

          <div style={{ height: 360, background: '#fff', padding: 12, borderRadius: 6 }}>
            {overviewChartData ? (
              <Line data={overviewChartData} options={commonOptions} />
            ) : (
              <div style={{ padding: 24, color: '#666' }}>Select a state to view Extractable vs Total Availability.</div>
            )}
          </div>
        </>
      )}

      {/* fallback */}
      {mode !== "state-metric" && mode !== "overview-trends" && (
        <div style={{ padding: 12 }}>
          <div>No chart mode selected.</div>
        </div>
      )}
    </div>
  );
}
