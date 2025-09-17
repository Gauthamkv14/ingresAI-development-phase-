// src/components/IndiaMap.jsx
import React, { useEffect, useRef, useState } from 'react';

/**
 * IndiaMap.jsx (lazy-loaded react-leaflet)
 *
 * Props:
 *  - onHoverState({ state, district })  // called on mouseover of a polygon
 *  - onClickState({ state, district })  // called on click of a polygon
 *  - selectedState (string|null)        // highlight state polygon by name (STATE or ST_NM)
 *  - selectedDistrict (string|null)     // highlight district polygon by name (DISTRICT or DIST_NAME)
 *
 * Notes:
 * - Expects geojson features to contain properties like: ST_NM, STATE, DISTRICT, DIST_NAME (common variants)
 * - Does lazy import of react-leaflet to reduce initial bundle size.
 */

export default function IndiaMap({
  onHoverState = () => {},
  onClickState = () => {},
  selectedState = null,
  selectedDistrict = null,
}) {
  const [leafletReady, setLeafletReady] = useState(false);
  const [MapComponents, setMapComponents] = useState(null);
  const [geo, setGeo] = useState(null);

  const geoRef = useRef(null);
  const mapRef = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // lazy import react-leaflet
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('react-leaflet');
        // only pick what we need
        if (cancelled || !mounted.current) return;
        setMapComponents({
          MapContainer: mod.MapContainer,
          TileLayer: mod.TileLayer,
          GeoJSON: mod.GeoJSON,
          useMap: mod.useMap,
        });
        setLeafletReady(true);
      } catch (err) {
        console.error('Failed to load react-leaflet', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // fetch geojson once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/geojson');
        if (!r.ok) throw new Error('geojson not available');
        const j = await r.json();
        if (!cancelled && mounted.current) setGeo(j);
      } catch (err) {
        console.warn('GeoJSON load failed:', err);
        if (!cancelled && mounted.current) setGeo(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // helper to normalize property retrieval
  const sprop = (props, ...candidates) => {
    for (const c of candidates) {
      if (props && (props[c] !== undefined) && props[c] !== null && String(props[c]).trim() !== '') {
        return String(props[c]).trim();
      }
    }
    return '';
  };

  // style for each feature depending on selection
  const styleFeature = (feature) => {
    const props = feature && feature.properties ? feature.properties : {};
    const stateName = (sprop(props, 'ST_NM', 'STATE') || '').toUpperCase();
    const districtName = (sprop(props, 'DISTRICT', 'DIST_NAME', 'DIST') || '').toUpperCase();

    const selState = selectedState ? selectedState.toUpperCase() : null;
    const selDistrict = selectedDistrict ? selectedDistrict.toUpperCase() : null;

    const isDistrictSelected = selDistrict && districtName && (districtName === selDistrict);
    const isStateSelected = selState && stateName && (stateName === selState || (isDistrictSelected && selState));

    return {
      color: isStateSelected ? '#2b2b2b' : '#3a3a3a',
      weight: isDistrictSelected ? 3.2 : (isStateSelected ? 2.4 : 0.9),
      fillOpacity: isDistrictSelected ? 0.22 : (isStateSelected ? 0.10 : 0.04),
      fillColor: isDistrictSelected ? '#FF6B9A' : (isStateSelected ? '#7B61FF' : '#ffffff'),
      dashArray: '',
      opacity: 1
    };
  };

  // onEachFeature: bind events and tooltip
  const onEachFeature = (feature, layer) => {
    const props = feature && feature.properties ? feature.properties : {};
    const stateName = sprop(props, 'ST_NM', 'STATE') || 'Unknown';
    const districtName = sprop(props, 'DISTRICT', 'DIST_NAME', 'DIST') || '';

    // safe handlers
    layer.on({
      mouseover: (e) => {
        try { layer.setStyle({ weight: 2.6, color: '#222' }); } catch (e) {}
        onHoverState({ state: stateName, district: districtName || null });
      },
      mouseout: (e) => {
        try { layer.setStyle(styleFeature(feature)); } catch (e) {}
        onHoverState(null);
      },
      click: (e) => {
        onClickState({ state: stateName, district: districtName || null });
      }
    });
    // tooltip if available
    try {
      const label = districtName ? `${districtName} — ${stateName}` : stateName;
      layer.bindTooltip(label, { sticky: true });
    } catch (e) {}
  };

  // update styles when selectedState or selectedDistrict change
  useEffect(() => {
    if (!geoRef.current) return;
    try {
      // geoRef.current is the GeoJSON layer instance (leaflet)
      const layer = geoRef.current;
      if (!layer || !layer.eachLayer) return;
      layer.eachLayer(l => {
        const f = l.feature;
        if (!f) return;
        try {
          l.setStyle(styleFeature(f));
        } catch (e) {}
      });
    } catch (err) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedState, selectedDistrict, geo, leafletReady]);

  if (!leafletReady || !MapComponents) {
    return (
      <div style={{
        width: '100%',
        height: 460,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        background: 'rgba(0,0,0,0.03)'
      }}>
        <div style={{ padding: 12, color: '#666' }}>Loading interactive map…</div>
      </div>
    );
  }

  const { MapContainer, TileLayer, GeoJSON } = MapComponents;

  return (
    <div style={{ width: '100%', height: 460 }}>
      <MapContainer
        center={[22.5, 80]}
        zoom={5}
        style={{ height: '100%', borderRadius: 10 }}
        whenCreated={(mapInstance) => { mapRef.current = mapInstance; }}
        preferCanvas={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />

        {geo && (
          <GeoJSON
            data={geo}
            style={styleFeature}
            onEachFeature={onEachFeature}
            ref={(g) => { geoRef.current = g && g.layer ? g.layer : g; }}
          />
        )}
      </MapContainer>
    </div>
  );
}
