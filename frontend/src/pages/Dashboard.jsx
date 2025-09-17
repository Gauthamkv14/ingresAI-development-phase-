// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import IndiaMap from '../components/IndiaMap.jsx';
import Charts from '../components/Charts.jsx';

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [selectedState, setSelectedState] = useState(null);

  useEffect(() => {
    fetch('/api/overview').then(r => r.json()).then(j => setOverview(j)).catch(() => setOverview(null));
  }, []);

  return (
    <div className="page dashboard-page">
      <div className="hero">
        <h1>INGRES Dashboard</h1>
        <p>AI-powered groundwater intelligence</p>
      </div>

      <div className="content-grid">
        <div className="left-col">
          <div className="card">
            <h3>Interactive Groundwater Map</h3>
            <IndiaMap
              onClickState={(s) => setSelectedState(s)}
              selectedState={selectedState}
            />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Trends {selectedState ? ` — ${selectedState}` : ''}</h3>
            <Charts stateName={selectedState} />
          </div>
        </div>

        <aside className="right-col">
          <div className="card">
            <h4>Live Overview</h4>
            <div className="stats">
              <div>Total points: <strong>{overview?.total_points ?? '—'}</strong></div>
              <div>Safe: <strong>{overview?.safe ?? '—'}</strong></div>
              <div>Moderate: <strong>{overview?.moderate ?? '—'}</strong></div>
              <div>Critical: <strong>{overview?.critical ?? '—'}</strong></div>
            </div>
          </div>

          <div className="card">
            <h4>Quick Stats</h4>
            <div className="big-num">{overview?.total_points ?? '—'}</div>
            <div className="big-label">MONITORING POINTS</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
