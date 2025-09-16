// frontend/src/components/SummaryChart.jsx
import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";

/**
 * SummaryChart:
 * - Accepts `state` (string) and `districts` (array or other shapes).
 * - If districts is not an array, we try to coerce/normalize it.
 */
export default function SummaryChart({ state, districts }) {
  const [plotData, setPlotData] = useState(null);

  useEffect(() => {
    const safeDistricts = Array.isArray(districts)
      ? districts
      : (districts && typeof districts === "object" ? Object.values(districts) : []);

    if (state && safeDistricts.length > 0) {
      const cols = [
        "Annual Extractable Ground water Resource (ham)_C",
        "Net Annual Ground Water Availability for Future Use (ham)_C",
        "Total Ground Water Availability in the area (ham)_Fresh",
        "Ground Water Extraction for all uses (ha.m)_Total_26"
      ];

      const labels = safeDistricts.map(d => (d && (d.district || d.DISTRICT || d.name)) || "Unknown");
      const traces = cols.map((c) => ({
        x: labels,
        y: safeDistricts.map(d => {
          const v = d && (d[c] !== undefined ? d[c] : (d[c.replace(/\s*\(.*\)/, '')] || 0));
          const num = Number(v);
          return Number.isFinite(num) ? num : 0;
        }),
        name: c,
        type: "bar",
      }));

      setPlotData({ traces, layout: { barmode: "group", title: `District breakdown for ${state}` } });
    } else {
      // fallback (no state/districts): simple empty layout
      setPlotData({ traces: [], layout: { title: state ? `No district data for ${state}` : "Select a state to see district breakdown" } });
    }
  }, [state, districts]);

  if (!plotData) return <div>Loading chart...</div>;

  return (
    <Plot
      data={plotData.traces}
      layout={{ ...plotData.layout, autosize: true, height: 360 }}
      config={{ responsive: true }}
    />
  );
}
