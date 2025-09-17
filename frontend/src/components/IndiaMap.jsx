// src/components/IndiaMap.jsx
import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import 'leaflet/dist/leaflet.css';

/**
 * IndiaMap
 * - uses /api/geojson for shapes
 * - clicking any district highlights the entire state outline (not the district)
 * - dispatches window events for other components:
 *    - window.dispatchEvent(new CustomEvent('mapStateClick', { detail: { state: stateName, district } }));
 */
export default function IndiaMap({ data = [] }) {
  const [geojson, setGeojson] = useState(null);
  const layersRef = useRef([]); // store each created layer here
  const mapRef = useRef(null);

  useEffect(() => {
    fetch('/api/geojson').then(r => {
      if (!r.ok) throw new Error('geojson not available');
      return r.json();
    }).then(j => {
      setGeojson(j);
    }).catch(err => {
      console.warn('Could not load /api/geojson:', err);
      setGeojson(null);
    });
  }, []);

  const getFeatureStateName = (feature) => {
    const p = feature.properties || {};
    // common keys
    return p.STATE || p.st_nm || p.ST_NAME || p.STATE_NAME || p.state || p.NAME || p.NAME_1 || p.DISTRICT || p.DIST_NAME || null;
  };

  const defaultStyle = { weight: 1, color: '#222', fillColor: '#ffffff00', fillOpacity: 0.25 };
  const highlightStyle = { weight: 2.6, color: '#6b46ff', fillColor: '#efe7ff', fillOpacity: 0.55 };

  // Called for each feature to attach handlers and keep a ref
  const onEachFeature = (feature, layer) => {
    // store layer reference (for searching/highlighting later)
    layersRef.current.push({ feature, layer });

    const stateName = (getFeatureStateName(feature) || 'Unknown').toString();

    layer.on({
      mouseover: () => {
        // highlight temporarily
        layer.setStyle({ weight: 2, color: '#8b5cf6', fillOpacity: 0.45 });
        layer.bringToFront && layer.bringToFront();
      },
      mouseout: () => {
        // reset to default unless whole-state is selected (we handle selection via mapStateClick event)
        layer.setStyle(defaultStyle);
      },
      click: () => {
        // When a district is clicked, highlight entire state (all features matching the state's name)
        const stateKey = stateName.toString().trim();
        if (!stateKey) return;

        // iterate layers and style those whose state matches stateKey
        layersRef.current.forEach(({ feature: f, layer: ly }) => {
          const n = (getFeatureStateName(f) || '').toString().trim();
          if (n && (n.toUpperCase() === stateKey.toUpperCase() || stateKey.toUpperCase().includes(n.toUpperCase()) || n.toUpperCase().includes(stateKey.toUpperCase()))) {
            try { ly.setStyle(highlightStyle); ly.bringToFront && ly.bringToFront(); } catch (e) {}
          } else {
            try { ly.setStyle(defaultStyle); } catch (e) {}
          }
        });

        // pan/fit to the matched layers bounds
        try {
          const matchedLayers = layersRef.current.filter(({ feature: f }) => {
            const n = (getFeatureStateName(f) || '').toString().trim();
            return n && (n.toUpperCase() === stateKey.toUpperCase() || stateKey.toUpperCase().includes(n.toUpperCase()) || n.toUpperCase().includes(stateKey.toUpperCase()));
          }).map(x => x.layer);
          if (matchedLayers.length > 0) {
            let groupBounds = null;
            matchedLayers.forEach(l => {
              try {
                const b = l.getBounds();
                if (!groupBounds) groupBounds = b;
                else groupBounds = groupBounds.extend(b);
              } catch (err) {}
            });
            if (groupBounds && mapRef.current) {
              mapRef.current.fitBounds(groupBounds, { maxZoom: 8, animate: true });
            }
          }
        } catch (err) { /* ignore */ }

        // dispatch global event with state and district
        const districtName = (feature.properties && (feature.properties.DISTRICT || feature.properties.dist_name || feature.properties.name || feature.properties.DIST_NAME)) || null;
        window.dispatchEvent(new CustomEvent('mapStateClick', { detail: { state: stateKey, district: districtName } }));
      }
    });

    // bind a tooltip
    const label = getFeatureStateName(feature) || (feature.properties && (feature.properties.NAME || feature.properties.DISTRICT) ) || 'Unknown';
    layer.bindTooltip(String(label), { sticky: true, direction: 'auto' });

    // ensure style initially
    try { layer.setStyle(defaultStyle); } catch (e) {}
  };

  // Listen for external highlight requests (so Charts hover can highlight state)
  useEffect(() => {
    const handleExternal = (ev) => {
      const detail = ev.detail || {};
      const target = (detail.state || detail.district || '').toString().trim();
      if (!target) return;
      layersRef.current.forEach(({ feature: f, layer: ly }) => {
        const n = (getFeatureStateName(f) || '').toString().trim();
        if (n && (n.toUpperCase() === target.toUpperCase() || target.toUpperCase().includes(n.toUpperCase()) || n.toUpperCase().includes(target.toUpperCase()))) {
          try { ly.setStyle(highlightStyle); ly.bringToFront && ly.bringToFront(); } catch(e) {}
        } else {
          try { ly.setStyle(defaultStyle); } catch(e) {}
        }
      });
    };
    window.addEventListener('mapStateClick', handleExternal);
    return () => window.removeEventListener('mapStateClick', handleExternal);
  }, []);

  return (
    <div style={{ width: '100%', height: 520 }}>
      <MapContainer center={[22.5, 80]} zoom={5} style={{ height: '100%', width: '100%' }} whenCreated={m => mapRef.current = m}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {geojson && (
          <GeoJSON
            data={geojson}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  );
}
