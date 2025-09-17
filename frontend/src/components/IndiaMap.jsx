// src/components/IndiaMap.jsx
import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function IndiaMap({ data = [] }) {
  const mapRef = useRef(null);
  const mapDivRef = useRef(null);
  const [geo, setGeo] = useState(null);

  useEffect(() => {
    fetch("/api/geojson").then(r => {
      if (!r.ok) throw new Error("geojson not found");
      return r.json();
    }).then(j => setGeo(j)).catch(() => setGeo(null));
  }, []);

  useEffect(() => {
    if (!mapDivRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    const map = L.map(mapDivRef.current, { center: [22.0, 79.0], zoom: 5 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    mapRef.current = map;

    if (geo && geo.features) {
      const geoLayer = L.geoJSON(geo, {
        style: (feature) => ({ color: "#333", weight: 1, fillOpacity: 0.2 }),
        onEachFeature: (feature, layer) => {
          layer.on('click', async (ev) => {
            const props = feature.properties || {};
            const stateName = props.STATE || props.state || props.NAME || props.name || props.st_nm || props.ST_NM || props.st_nm_e || props.ST_NM_E;
            if (stateName) {
              try {
                const metricsResp = await fetch(`/api/state/${encodeURIComponent(stateName)}/metrics`);
                const metrics = metricsResp.ok ? await metricsResp.json() : null;
                const districtsResp = await fetch(`/api/state/${encodeURIComponent(stateName)}/districts`);
                const districts = districtsResp.ok ? await districtsResp.json() : null;
                // dispatch event for the rest of the UI
                window.dispatchEvent(new CustomEvent('mapStateClick', { detail: { state: stateName, metrics, districts } }));
              } catch (e) {
                console.error("state click fetch failed", e);
              }
            } else {
              console.warn("state name not found in feature properties", props);
            }
            // visual highlight flicker
            layer.setStyle({ fillOpacity: 0.65, weight: 2, color: "#7c3aed" });
            setTimeout(() => {
              layer.setStyle({ fillOpacity: 0.2, weight: 1, color: "#333" });
            }, 2500);
          });

          layer.on('mouseover', () => {
            layer.setStyle({ fillOpacity: 0.35 });
          });
          layer.on('mouseout', () => {
            layer.setStyle({ fillOpacity: 0.2 });
          });
        }
      }).addTo(map);
      try {
        map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
      } catch (e) {
        // ignore
      }
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [geo]);

  return <div ref={mapDivRef} style={{ width: "100%", height: 520 }} />;
}
