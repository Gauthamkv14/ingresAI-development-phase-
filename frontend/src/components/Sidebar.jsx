// src/components/Sidebar.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import "./../styles/main.css";

export default function Sidebar() {
  return (
    <aside className="app-sidebar" aria-hidden={false}>
      <div className="sidebar-top">
        <div className="logo">💧 <strong>INGRES AI Portal</strong></div>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className="nav-item">
          <span className="nav-emoji">📊</span> Overview
        </NavLink>
        <NavLink to="/visualizations" className="nav-item">
          <span className="nav-emoji">📈</span> Visualizations
        </NavLink>
        <NavLink to="/live-monitoring" className="nav-item">
          <span className="nav-emoji">🛰️</span> Live Monitoring
        </NavLink>
        <NavLink to="/ai-chat" className="nav-item">
          <span className="nav-emoji">🤖</span> AI Chat
        </NavLink>
        <NavLink to="/settings" className="nav-item">
          <span className="nav-emoji">⚙️</span> Settings
        </NavLink>
      </nav>
    </aside>
  );
}
