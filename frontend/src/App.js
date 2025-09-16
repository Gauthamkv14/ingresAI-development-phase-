// frontend/src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import ChatInterface from "./components/ChatInterface";
import "./styles/app.css";

export default function App() {
  return (
    <Router>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-top">
            <div className="logo">INGRES AI Portal</div>
          </div>
          <nav className="sidebar-nav">
            <Link to="/" className="nav-item">Home</Link>
            <Link to="/dashboard" className="nav-item">Live Monitoring</Link>
            <Link to="/chat" className="nav-item">AI Chat</Link>
            <Link to="/visualizations" className="nav-item">Visualizations</Link>
            <Link to="/settings" className="nav-item">Settings</Link>
          </nav>
        </aside>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/chat" element={<ChatInterface />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
