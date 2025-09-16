// frontend/src/components/IndiaMap.jsx
import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { getGeojson, getStatesOverview } from "../ingresApi";
import "leaflet/dist/leaflet.css";

export default function IndiaMap() {
  const [geojson, setGeojson] = useState(null);
  const [statesAgg, setStatesAgg] = useState({});

  useEffect(() => {
    getGeojson().then((g) => setGeojson(g)).catch((e) => console.warn("geojson load failed:", e));
    getStatesOverview().then((data) => {
      const m = {};
      (data || []).forEach((s) => (m[s.state.toUpperCase()] = s));
      setStatesAgg(m);
    });
  }, []);

  if (!geojson) return <div style={{ padding: 16 }}>Loading map (server must provide /api/geojson)...</div>;

  const styleFn = (feature) => {
    const name = (feature.properties && (feature.properties.ST_NM || feature.properties.NAME || feature.properties.STATE)) || "";
    const val = statesAgg[name.toUpperCase()] ? statesAgg[name.toUpperCase()].total_ground_water_ham : 0;
    let fillColor = "#f3f3f3";
    if (val > 10000000) fillColor = "#1a9850";
    else if (val > 2000000) fillColor = "#fee08b";
    else if (val > 0) fillColor = "#d73027";
    return { fillColor, weight: 1, color: "#bbb", fillOpacity: 0.8 };
  };

  const onEach = (feature, layer) => {
    const name = (feature.properties && (feature.properties.ST_NM || feature.properties.NAME || feature.properties.STATE)) || "Unknown";
    const val = statesAgg[name.toUpperCase()] ? statesAgg[name.toUpperCase()].total_ground_water_ham : null;
    layer.bindPopup(`<b>${name}</b><br/>Total GW Availability (ham): ${val ? Number(val).toLocaleString() : "N/A"}`);
    layer.on({
      click: (e) => {
        e.target.openPopup();
        try { e.target._map.fitBounds(e.target.getBounds(), { maxZoom: 7 }); } catch {}
      },
      mouseover: (e) => e.target.setStyle({ weight: 2, color: "#333" }),
      mouseout: (e) => e.target.setStyle({ weight: 1, color: "#bbb" }),
    });
  };

  return (
    <div style={{ height: 480 }}>
      <MapContainer center={[22.0, 80.0]} zoom={5} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <GeoJSON data={geojson} style={styleFn} onEachFeature={onEach} />
      </MapContainer>
    </div>
  );
}
