// src/App.js
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Visualizations from "./pages/Visualizations";
import LiveMonitoring from "./pages/LiveMonitoring";
import Sidebar from "./components/Sidebar";
import Footer from "./components/Footer";
import "./styles/main.css";

export default function App() {
  return (
    <div className="app-root">
      <Sidebar />
      <div className="app-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/visualizations" element={<Visualizations />} />
          <Route path="/live-monitoring" element={<LiveMonitoring />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
      </div>
    </div>
  );
}
