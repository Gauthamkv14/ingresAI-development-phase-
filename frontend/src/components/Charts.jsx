// src/components/Charts.jsx
import React, { useEffect, useState } from "react";

/*
  This component lazy-imports react-plotly.js (client-side only).
  Props:
    - small (bool) : render small sparkline
    - stateName (string) : for LiveMonitoring to fetch state district data
    - metric (string) : which metric to plot for LiveMonitoring
    - districts (array) : optional district-level rows (for Visualizations)
*/

function BasicPlaceholder({ text }) {
  return <div style={{ padding: 24 }}>{text}</div>;
}

export default function Charts({ small = true, stateName, metric, districts }) {
  const [Plot, setPlot] = useState(null);
  const [plotReady, setPlotReady] = useState(false);
  const [plotData, setPlotData] = useState(null);

  useEffect(() => {
    // lazy load Plotly only on client
    let mounted = true;
    (async () => {
      if (typeof window === "undefined") return;
      const mod = await import("react-plotly.js");
      if (!mounted) return;
      setPlot(() => mod.default);
      setPlotReady(true);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    // Build data depending on props
    if (districts && Array.isArray(districts)) {
      // districts: array of { district, ...AGG_COLS }
      // we'll plot first three meaningful series (Annual Extractable, Net Annual, Total Availability)
      const x = districts.map(d => d.district);
      const a = districts.map(d => d["Annual Extractable Ground water Resource (ham)_C"] ?? 0);
      const b = districts.map(d => d["Net Annual Ground Water Availability for Future Use (ham)_C"] ?? 0);
      const c = districts.map(d => d["Total Ground Water Availability in the area (ham)_Fresh"] ?? 0);
      setPlotData({
        layout: { margin: { t: 20 }, height: small ? 160 : 360, showlegend: !small },
        data: [
          { x, y: a, name: "Annual Extractable", type: "bar" },
          { x, y: b, name: "Net Annual Available", type: "bar" },
          { x, y: c, name: "Total Availability (Fresh)", type: "bar" },
        ],
      });
      return;
    }

    if (stateName) {
      // request state districts and plot metric
      (async () => {
        try {
          const r = await fetch(`/api/state/${encodeURIComponent(stateName)}/districts`);
          if (!r.ok) { setPlotData(null); return; }
          const rows = await r.json();
          const x = rows.map(rw => rw.district);
          const y = rows.map(rw => rw[metric] ?? 0);
          setPlotData({
            layout: { margin: { t: 20 }, height: 360, showlegend: false, xaxis: { tickangle: -45 } },
            data: [{ x, y, type: "scatter", mode: "lines+markers", name: metric }],
          });
        } catch (err) {
          console.error(err);
          setPlotData(null);
        }
      })();
      return;
    }

    // default / small scrappy monthly trend demo (from dashboard summary)
    setPlotData({
      layout: { margin: { t: 20 }, height: small ? 140 : 260, showlegend: false },
      data: [
        { x: ["A","B","C","D"], y: [0,0,0,0], type: "scatter", mode: "lines+markers" }
      ]
    });
  }, [stateName, metric, districts, small]);

  if (!plotReady) return <BasicPlaceholder text="Loading chart..." />;

  if (!Plot || !plotData) return <BasicPlaceholder text="No data to display." />;

  return (
    <div>
      <Plot
        data={plotData.data}
        layout={plotData.layout}
        style={{ width: "100%" }}
        useResizeHandler={true}
      />
    </div>
  );
}
