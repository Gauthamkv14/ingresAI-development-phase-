// src/App.jsx
import React from "react";
import "./App.css";
import Dashboard from "./pages/Dashboard";
import Visualizations from "./pages/Visualizations";
import LiveMonitoring from "./pages/LiveMonitoring";
import Chatbot from "./components/Chatbot";

export default function App() {
  // simple routing using hash for demo (keeps the app easy)
  const [route, setRoute] = React.useState(window.location.hash.replace("#","") || "overview");
  React.useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace("#","") || "overview");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="logo">INGRES AI Portal</div>
        <nav className="top-nav">
          <a href="#overview">Overview</a>
          <a href="#visualizations">Visualizations</a>
          <a href="#live">Live Monitoring</a>
          <a href="#chat">AI Chat</a>
        </nav>
      </header>

      <div className="app-layout">
        <aside className="left-sidebar">
          <div className="brand">INGRES AI Portal</div>
          <ul>
            <li><a href="#overview">Overview</a></li>
            <li><a href="#visualizations">Visualizations</a></li>
            <li><a href="#live">Live Monitoring</a></li>
            <li><a href="#chat">AI Chat</a></li>
            <li><a href="#settings">Settings</a></li>
          </ul>
        </aside>

        <main className="content-area">
          {route === "overview" && <Dashboard />}
          {route === "visualizations" && <Visualizations />}
          {route === "live" && <LiveMonitoring />}
          {route === "chat" && <Chatbot />}
        </main>
      </div>
    </div>
  );
}
