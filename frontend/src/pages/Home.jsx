// frontend/src/pages/Home.jsx
import React from "react";
import IndiaMap from "../components/IndiaMap";
import ChatWidget from "../components/ChatWidget";
import "../styles/home.css";

export default function Home() {
  return (
    <div className="home-page">
      <header className="home-hero">
        <div className="hero-left">
          <h1>INGRES Dashboard</h1>
          <p>AI-powered groundwater intelligence</p>
        </div>
        <div className="hero-search">
          <input placeholder="Search states, districts, water data..." />
        </div>
      </header>

      <section className="home-main">
        <h2>Interactive Groundwater Map</h2>
        <div className="map-card">
          <IndiaMap />
        </div>
      </section>

      <ChatWidget />
    </div>
  );
}
