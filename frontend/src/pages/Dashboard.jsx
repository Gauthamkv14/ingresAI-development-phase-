// frontend/src/pages/Dashboard.jsx
import React from "react";
import Charts from "../components/Charts";
import IndiaMap from "../components/IndiaMap";
import OverviewCards from "../components/OverviewCards";
import "../styles/dashboard.css";

export default function Dashboard() {
  return (
    <div className="dashboard-root">
      <header className="dashboard-header">
        <div className="title">
          <img src="/logo192.png" alt="logo" className="logo" />
          <div>
            <h1>INGRES Dashboard</h1>
            <div className="subtitle">AI-powered groundwater intelligence</div>
          </div>
        </div>
        <div className="search-area">
          <input className="global-search" placeholder="Search states, districts, water data..." />
        </div>
      </header>

      <main className="dashboard-main">
        <section className="left-col">
          <div className="card large">
            <h2>Interactive Groundwater Trends</h2>
            <Charts />
          </div>

          <div className="card large" style={{ marginTop: 20 }}>
            <h2>Interactive Groundwater Map</h2>
            <IndiaMap />
          </div>
        </section>

        <aside className="right-col">
          <div className="card">
            <h3>Map Legend</h3>
            <div className="legend-item"><span className="dot green" /> Good &gt; 15m</div>
            <div className="legend-item"><span className="dot yellow" /> Moderate 10-15m</div>
            <div className="legend-item"><span className="dot red" /> Critical &lt; 10m</div>
          </div>

          <OverviewCards />
        </aside>
      </main>
    </div>
  );
}
