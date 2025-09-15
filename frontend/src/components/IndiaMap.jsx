// frontend/src/components/IndiaMap.jsx
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Simple helper to normalize names for matching
const normalize = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '').trim();

const Choropleth = ({ geojson, districtValues, onFeatureClick }) => {
  const map = useMap();

  // compute value range
  const vals = Object.values(districtValues || {}).map(v => Number(v)).filter(v => !Number.isNaN(v));
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 1;

  const getColor = (v) => {
    if (v == null || Number.isNaN(v)) return '#cccccc';
    const t = (v - min) / Math.max(1e-9, (max - min));
    // blue-green-red ramp
    const r = Math.round(255 * Math.min(1, Math.max(0, 2 * t - 0.2)));
    const g = Math.round(180 * (1 - Math.abs(t - 0.5) * 1.6));
    const b = Math.round(255 * Math.max(0, 1 - 2 * t));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const style = (feature) => {
    const name = normalize(feature.properties?.district || feature.properties?.DISTRICT || feature.properties?.NAME_2 || feature.properties?.name || '');
    const val = districtValues[name];
    return {
      fillColor: getColor(val),
      weight: 0.6,
      opacity: 1,
      color: '#444',
      fillOpacity: 0.8
    };
  };

  const onEachFeature = (feature, layer) => {
    const name = feature.properties?.district || feature.properties?.DISTRICT || feature.properties?.NAME_2 || feature.properties?.name || 'Unknown';
    const key = normalize(name);
    const val = districtValues[key];
    const popupHtml = `<div style="font-weight:600;">${name}</div><div>Avg level: ${val == null ? 'N/A' : val + ' m'}</div>`;
    layer.bindTooltip(popupHtml, { sticky: true });

    layer.on({
      click: () => {
        if (onFeatureClick) onFeatureClick(feature);
      },
      mouseover: (e) => { layer.setStyle({ weight: 1.5 }); },
      mouseout: (e) => { layer.setStyle({ weight: 0.6 }); }
    });
  };

  return <GeoJSON data={geojson} style={style} onEachFeature={onEachFeature} />;
};

const IndiaMap = ({ data = [], geojsonUrl = '/data/india_districts.geojson' }) => {
  const [geojson, setGeojson] = useState(null);
  const [districtValues, setDistrictValues] = useState({});

  useEffect(() => {
    // load geojson
    fetch(geojsonUrl)
      .then(res => {
        if (!res.ok) throw new Error('GeoJSON not found');
        return res.json();
      })
      .then(g => setGeojson(g))
      .catch(err => {
        console.error('GeoJSON load failed', err);
      });
  }, [geojsonUrl]);

  useEffect(() => {
    if (!data || data.length === 0) {
      setDistrictValues({});
      return;
    }
    // aggregate average level per district (normalize name)
    const mapAgg = {};
    data.forEach(row => {
      const d = normalize(row.district || row.DISTRICT || row.district_name);
      const level = row.level !== undefined && row.level !== '' ? Number(row.level) : NaN;
      if (Number.isNaN(level)) return;
      if (!mapAgg[d]) mapAgg[d] = { sum: 0, count: 0 };
      mapAgg[d].sum += level;
      mapAgg[d].count += 1;
    });
    const res = {};
    Object.keys(mapAgg).forEach(k => {
      res[k] = Number((mapAgg[k].sum / mapAgg[k].count).toFixed(2));
    });
    setDistrictValues(res);
  }, [data]);

  // initial view of India bounding box (rough)
  const center = [22.0, 79.0];
  const zoom = 5;

  return (
    <div className="india-map-component h-96 rounded shadow overflow-hidden">
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geojson && <Choropleth geojson={geojson} districtValues={districtValues} />}
      </MapContainer>
    </div>
  );
};

export default IndiaMap;
