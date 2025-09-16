// src/components/IndiaMap.jsx
import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { getGeojson, getStatesOverview } from "../api/ingresApi";
import "leaflet/dist/leaflet.css";

export default function IndiaMap() {
  const [geojson, setGeojson] = useState(null);
  const [statesAgg, setStatesAgg] = useState({});

  useEffect(() => {
    getGeojson().then(g => setGeojson(g)).catch(e => console.warn("geojson missing", e));
    getStatesOverview().then(data => {
      const map = {};
      (data || []).forEach(s => map[s.state.toUpperCase()] = s);
      setStatesAgg(map);
    }).catch(e => console.warn("states overview failed", e));
  }, []);

  const style = (feature) => {
    const name = feature.properties?.ST_NM || feature.properties?.NAME || feature.properties?.STATE || "";
    const val = statesAgg[name.toUpperCase()]?.total_ground_water_ham || 0;
    let fillColor = "#f3f3f3";
    if (val > 1000000) fillColor = "#1a9850";
    else if (val > 200000) fillColor = "#fee08b";
    else if (val > 0) fillColor = "#d73027";
    return { fillColor, weight: 1, color: "#ccc", fillOpacity: 0.8 };
  };

  const onEachFeature = (feature, layer) => {
    const name = feature.properties?.ST_NM || feature.properties?.NAME || feature.properties?.STATE || "Unknown";
    const val = statesAgg[name.toUpperCase()]?.total_ground_water_ham;
    layer.bindPopup(`<b>${name}</b><br/>Total GW Availability (ham): ${val ? Number(val).toLocaleString() : "N/A"}`);
    layer.on({
      click: (e) => e.target._map.fitBounds(e.target.getBounds(), { maxZoom: 7 }),
      mouseover: (e) => e.target.setStyle({ weight:2, color: "#000" }),
      mouseout: (e) => e.target.setStyle({ weight:1, color: "#ccc" }),
    });
  };

  if (!geojson) return <div style={{ padding: 16 }}>Loading map (server must provide geojson)...</div>;

  return (
    <MapContainer style={{ height: 480 }} center={[22,80]} zoom={5}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <GeoJSON data={geojson} style={style} onEachFeature={onEachFeature} />
    </MapContainer>
  );
}
