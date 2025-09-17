// src/components/IndiaMap.jsx
import React, { useEffect, useRef, useState } from 'react';

/**
 * IndiaMap.jsx (lazy)
 * - Dynamically imports react-leaflet components to avoid bundling them in initial page load.
 * - Falls back to a lightweight message while the map library loads.
 *
 * Props:
 *  - onHoverState(name)
 *  - onClickState(name)
 *  - selectedState (string)
 */

export default function IndiaMap({ onHoverState = () => {}, onClickState = () => {}, selectedState = null }) {
  const [leafletReady, setLeafletReady] = useState(false);
  const [MapComponents, setMapComponents] = useState(null);
  const [geo, setGeo] = useState(null);
  const compMounted = useRef(true);

  useEffect(() => {
    compMounted.current = true;
    return () => { compMounted.current = false; };
  }, []);

  // lazy-import react-leaflet and its CSS-only once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // dynamic import of react-leaflet
        const mod = await import('react-leaflet');
        // don't import Leaflet CSS here (already imported globally by index)
        if (cancelled || !compMounted.current) return;

        setMapComponents({
          MapContainer: mod.MapContainer,
          TileLayer: mod.TileLayer,
          GeoJSON: mod.GeoJSON
        });
        setLeafletReady(true);
      } catch (err) {
        console.error('Failed to load react-leaflet', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // fetch geojson (server endpoint)
  useEffect(() => {
    let cancelled = false;
    fetch('/api/geojson')
      .then(r => {
        if (!r.ok) throw new Error('geojson not available');
        return r.json();
      })
      .then(j => { if (!cancelled && compMounted.current) setGeo(j); })
      .catch(() => { if (!cancelled && compMounted.current) setGeo(null); });
    return () => { cancelled = true; };
  }, []);

  if (!leafletReady || !MapComponents) {
    // lightweight placeholder while leaflet code loads (avoids render-block)
    return (
      <div style={{ width: '100%', height: 460, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'rgba(0,0,0,0.03)' }}>
        <div style={{ padding: 12, color: 'var(--muted, #666)' }}>Loading interactive map…</div>
      </div>
    );
  }

  const { MapContainer, TileLayer, GeoJSON } = MapComponents;

  const styleFeature = (feature) => {
    const name = feature?.properties?.ST_NM || feature?.properties?.STATE || '';
    const sel = selectedState && name && name.toUpperCase() === selectedState.toUpperCase();
    return {
      color: '#222',
      weight: sel ? 2.5 : 1,
      fillOpacity: sel ? 0.12 : 0.02,
      fillColor: sel ? '#7a3cff' : '#ffffff',
      dashArray: ''
    };
  };

  const onEachFeature = (feature, layer) => {
    const name = feature?.properties?.ST_NM || feature?.properties?.STATE || 'Unknown';
    layer.on({
      mouseover: () => {
        try { layer.setStyle({ weight: 2.5, color: '#333' }); } catch (e) {}
        onHoverState(name);
      },
      mouseout: () => {
        try { layer.setStyle({ weight: 1, color: '#222' }); } catch (e) {}
        onHoverState(null);
      },
      click: () => onClickState(name)
    });
    try { layer.bindTooltip(name, { sticky: true }); } catch (e) {}
  };

  return (
    <div style={{ width: '100%', height: 460 }}>
      <MapContainer center={[22.5, 80]} zoom={5} style={{ height: '100%', borderRadius: 10 }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
        {geo && <GeoJSON data={geo} style={styleFeature} onEachFeature={onEachFeature} />}
      </MapContainer>
    </div>
  );
}
