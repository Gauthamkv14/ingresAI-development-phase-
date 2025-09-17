// src/components/Charts.jsx
import React, { useEffect, useState, useRef } from 'react';

/**
 * Charts.jsx
 * - Lazy-loads react-plotly.js to avoid pulling plotly into the initial bundle.
 * - Accepts `stateName` prop. If none, shows a friendly message.
 */

export default function Charts({ stateName }) {
  const [PlotComp, setPlotComp] = useState(null); // holds the Plot component after dynamic import
  const [districts, setDistricts] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // load district-level data for the selected state
  useEffect(() => {
    if (!stateName) {
      setDistricts([]);
      return;
    }

    setLoadingData(true);
    fetch(`/api/state/${encodeURIComponent(stateName)}/districts`)
      .then((r) => {
        if (!r.ok) throw new Error('State districts not found');
        return r.json();
      })
      .then((j) => {
        if (!mounted.current) return;
        setDistricts(j || []);
      })
      .catch(() => {
        if (!mounted.current) return;
        setDistricts([]);
      })
      .finally(() => { if (mounted.current) setLoadingData(false); });
  }, [stateName]);

  // lazy-load Plot only when we have a state selected and the chart will be shown
  useEffect(() => {
    if (!stateName) return;
    // if already loaded, skip
    if (PlotComp) return;

    let cancelled = false;

    // dynamic import of react-plotly.js
    import('react-plotly.js').then((mod) => {
      if (cancelled) return;
      // mod.default is the Plot component
      setPlotComp(() => mod.default || mod);
    }).catch((err) => {
      console.error('Failed to load plotly component', err);
    });

    return () => { cancelled = true; };
  }, [stateName, PlotComp]);

  if (!stateName) {
    return <div style={{ padding: 12, color: 'var(--muted, #666)' }}>Select a state (click a state on the map) to show district trends.</div>;
  }

  if (loadingData) {
    return <div style={{ padding: 12 }}>Loading district trends...</div>;
  }

  // prepare the series (exclude Extraction(Total) per your requirement)
  const colA = "Annual Extractable Ground water Resource (ham)_C";
  const colB = "Net Annual Ground Water Availability for Future Use (ham)_C";
  const colC = "Total Ground Water Availability in the area (ham)_Fresh";

  const labels = districts.map(d => d.district || '—');
  const a = districts.map(d => d[colA] || 0);
  const b = districts.map(d => d[colB] || 0);
  const c = districts.map(d => d[colC] || 0);

  // determine dark mode (we rely on html.dark toggle used by app)
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  // fallback: if Plot component hasn't loaded yet, show a small placeholder
  if (!PlotComp) {
    return <div style={{ padding: 12 }}>Preparing charts…</div>;
  }

  // safe guard for empty data
  if (!labels.length) {
    return <div style={{ padding: 12 }}>No district data found for {stateName}.</div>;
  }

  const layout = {
    barmode: 'group',
    height: 380,
    margin: { t: 30, b: 140, l: 40, r: 10 },
    plot_bgcolor: isDark ? '#0b0e12' : '#fff',
    paper_bgcolor: isDark ? '#0b0e12' : '#fff',
    font: { color: isDark ? '#fff' : '#111' },
    xaxis: { tickangle: -45, tickfont: { size: 11 } }
  };

  const data = [
    { x: labels, y: a, type: 'bar', name: 'Annual Extractable' },
    { x: labels, y: b, type: 'bar', name: 'Net Annual Available' },
    { x: labels, y: c, type: 'bar', name: 'Total Availability (Fresh)' }
  ];

  const Plot = PlotComp;

  return (
    <div style={{ width: '100%' }}>
      <Plot
        data={data}
        layout={layout}
        useResizeHandler={true}
        style={{ width: '100%' }}
        config={{ responsive: true, displaylogo: false }}
      />
    </div>
  );
}
