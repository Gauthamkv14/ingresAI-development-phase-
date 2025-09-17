// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import IndiaMap from "../components/IndiaMap";
import Charts from "../components/Charts";
import "../styles/dashboard.css";
import { getOverview as fetchOverview } from "../api/ingresApi";
import ChatbotFloating from "../components/ChatbotFloating";

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(()=> {
    loadOverview();
  }, []);

  async function loadOverview(){
    setLoading(true);
    try {
      const o = await fetchOverview();
      setOverview(o);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard-wrapper">
      <div className="sidebar-left" />
      <div className="dashboard-header">
        <h1 className="dashboard-title">INGRES Dashboard</h1>
        <p className="dashboard-sub">AI-powered groundwater intelligence</p>

        <div className="search-holder">
          <input className="main-search" placeholder="Search states, districts, water data..." />
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="map-col">
          <div className="card">
            <h3>Interactive Groundwater Map</h3>
            <IndiaMap />
          </div>

          <div className="card trends-card">
            <h3>Trends</h3>
            <Charts small={false} />
          </div>
        </div>

        <aside className="quick-col">
          <div className="card">
            <h4>Live Overview</h4>
            {loading && <div>Loading...</div>}
            {overview && (
              <div className="overview-list">
                <div>Total points: <strong>{overview.total_points}</strong></div>
                <div>Safe: <strong>{overview.safe}</strong></div>
                <div>Moderate: <strong>{overview.moderate}</strong></div>
                <div>Critical: <strong>{overview.critical}</strong></div>
                <hr />
                <div>Avg GW level: <strong>{overview.average_groundwater_level ?? "—"}</strong></div>
                <div>Monitored states: <strong>{overview.monitored_states ?? "—"}</strong></div>
                <div>Critical areas: <strong>{overview.critical_count ?? "—"}</strong></div>
              </div>
            )}
          </div>

          <div className="card quick-stats">
            <h4>Quick Stats</h4>
            <div className="big-number">{overview?.total_points ?? "—"}</div>
            <div className="stat-list">
              <div>Avg GW level: <strong>{overview?.average_groundwater_level ?? "—"}</strong></div>
              <div>Monitored states: <strong>{overview?.monitored_states ?? "—"}</strong></div>
              <div>Critical areas: <strong>{overview?.critical_count ?? "—"}</strong></div>
            </div>
          </div>
        </aside>
      </div>

      <ChatbotFloating />
    </div>
  );
}
