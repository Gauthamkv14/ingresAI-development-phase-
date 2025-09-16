// src/components/IndiaMap.jsx
import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from 'leaflet';


export default function IndiaMap({ highlightState, onFeatureClick }) {
  const [geojson, setGeojson] = useState(null);
  const geoRef = useRef(null);

  useEffect(() => {
    fetch("/api/geojson")
      .then((r) => r.json())
      .then((g) => setGeojson(g))
      .catch(() => setGeojson(null));
  }, []);

  useEffect(() => {
    if (!geoRef.current || !highlightState) return;
    // find feature with state name and set style (simple approach)
    const layer = geoRef.current;
    layer.eachLayer((l) => {
      const props = l.feature && l.feature.properties ? l.feature.properties : {};
      const name = (props.ST_NM || props.state || props.NAME || "").toString().toUpperCase();
      if (name.includes((highlightState || "").toUpperCase())) {
        l.setStyle({ weight: 3, color: "#ff6600", fillOpacity: 0.15 });
        try {
          l.bringToFront();
        } catch {}
      } else {
        l.setStyle({ weight: 1, color: "#333", fillOpacity: 0.05 });
      }
    });
  }, [highlightState, geojson]);

  function onEachFeature(feature, layer) {
    const props = feature.properties || {};
    const displayName = props.ST_NM || props.NAME || props.state || props.DISTRICT || "Unknown";
    const tooltip = displayName;
    layer.bindTooltip(tooltip);
    layer.on({
      click: () => {
        // if clicking a state polygon — attempt to inform parent
        const stateName = props.ST_NM || props.state || props.STATE;
        if (stateName && onFeatureClick) onFeatureClick(stateName);
      },
      mouseover: (e) => {
        layer.setStyle({ weight: 2, color: "#2a9df4", fillOpacity: 0.12 });
      },
      mouseout: (e) => {
        layer.setStyle({ weight: 1, color: "#333", fillOpacity: 0.05 });
      },
    });
  }

  return (
    <div className="india-map">
      <MapContainer center={[22.0, 80.0]} zoom={5} style={{ height: "420px", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geojson && (
          <GeoJSON data={geojson} onEachFeature={onEachFeature} ref={(r) => (geoRef.current = r)} />
        )}
      </MapContainer>
      {!geojson && <div style={{ padding: 20 }}>GeoJSON not loaded.</div>}
    </div>
  );
}
