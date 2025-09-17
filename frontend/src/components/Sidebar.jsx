import React from "react";
import "../styles/sidebar.css";

export default function Sidebar({ active, onNavigate, dark }) {
  const items = [
    { id: "overview", label: "Overview", emoji: "📊" },
    { id: "visualizations", label: "Visualizations", emoji: "📈" },
    { id: "live", label: "Live Monitoring", emoji: "🛰️" },
    { id: "chat", label: "AI Chat", emoji: "🤖" },
    { id: "settings", label: "Settings", emoji: "⚙️" },
  ];

  return (
    <aside className={`sidebar ${dark ? 'sidebar-dark' : ''}`}>
      <div className="sidebar-top">
        <div className="logo">INGRES AI Portal</div>
      </div>

      <nav className="sidebar-nav">
        {items.map(it => (
          <button
            key={it.id}
            className={`sidebar-item ${active === it.id ? "active" : ""}`}
            onClick={() => onNavigate(it.id)}
            title={it.label}
          >
            <span className="emoji">{it.emoji}</span>
            <span className="label">{it.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
