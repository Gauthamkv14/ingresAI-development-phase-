// src/pages/LiveMonitoring.jsx
import React, { useEffect, useState } from 'react';

export default function LiveMonitoring() {
  const [states, setStates] = useState([]);
  const [sel, setSel] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/states').then(r => r.json()).then(j => { setStates(j || []); if (j && j.length) setSel(j[0].state); }).catch(() => setStates([]));
  }, []);

  useEffect(() => {
    if (!sel) return;
    fetch(`/api/state/${encodeURIComponent(sel)}`)
      .then(r => r.json())
      .then(j => setData(j))
      .catch(() => setData(null));
  }, [sel]);

  return (
    <div className="page">
      <h2>Live Monitoring Data</h2>
      <div className="card">
        <label>State</label>
        <select value={sel} onChange={(e) => setSel(e.target.value)}>
          {states.map(s => <option key={s.state} value={s.state}>{s.state}</option>)}
        </select>

        <div style={{ marginTop: 16 }}>
          <h4>Trends for {sel}</h4>
          <pre>{data ? JSON.stringify(data, null, 2) : 'Select a state to load trends.'}</pre>
        </div>
      </div>
    </div>
  );
}
