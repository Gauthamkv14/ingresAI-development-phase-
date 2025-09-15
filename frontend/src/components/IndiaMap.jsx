import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * IndiaMap component
 * Props:
 *  - data: array of objects parsed from CSV (should contain state and district and level/wells)
 *  - geojsonUrl (optional): URL to the districts GeoJSON (relative path: '/data/india_districts.geojson')
 */
const IndiaMap = ({ data = [], geojsonUrl = '/data/india_districts.geojson' }) => {
  const [geoJson, setGeoJson] = useState(null);
  const [districtMetrics, setDistrictMetrics] = useState({});
  const [unmatched, setUnmatched] = useState(new Set());

  // Normalize function: lowercase, trim, remove punctuation and common tokens
  const normalize = (s) => {
    if (!s && s !== 0) return '';
    return String(s)
      .toLowerCase()
      .replace(/\b(dist|district|dt|d\.t\.)\b/g, '')
      .replace(/[^\w\s]/g, '') // remove punctuation
      .replace(/\s+/g, ' ')
      .trim();
  };

  useEffect(() => {
    // Aggregate CSV data by normalized district
    const agg = {};
    (data || []).forEach(row => {
      const districtRaw = row.district || row.DISTRICT || row.District || row['District Name'] || '';
      const district = normalize(districtRaw);
      if (!district) return;

      if (!agg[district]) agg[district] = { sumLevel: 0, count: 0, wells: 0, rows: [] };
      const levelCandidates = [
        row.level,
        row.water_level,
        row['Water Level'],
        row['level_m'],
        row.LEVEL
      ];
      const level = parseFloat(levelCandidates.find(x => x !== undefined && x !== '') || 0) || 0;
      const wells = parseInt(row.wells || row.WELLS || row.Wells || 0) || 0;

      agg[district].sumLevel += level;
      agg[district].count += 1;
      agg[district].wells += wells;
      agg[district].rows.push(row);
    });

    const metrics = {};
    Object.keys(agg).forEach(d => {
      metrics[d] = {
        avgLevel: agg[d].count ? (agg[d].sumLevel / agg[d].count) : null,
        wells: agg[d].wells,
        count: agg[d].count
      };
    });

    setDistrictMetrics(metrics);
  }, [data]);

  useEffect(() => {
    fetch(geojsonUrl)
      .then(res => {
        if (!res.ok) throw new Error('GeoJSON not found at ' + geojsonUrl);
        return res.json();
      })
      .then(j => {
        setGeoJson(j);
      })
      .catch(err => {
        console.error('Failed to load geojson', err);
        setGeoJson(null);
      });
  }, [geojsonUrl]);

  // helper color mapping
  const getColor = (avg) => {
    if (avg === null || avg === undefined) return '#e2e8f0'; // no data - light grey
    if (avg > 15) return '#16a34a'; // green
    if (avg >= 10) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  if (!geoJson) {
    return <div className="p-4">Loading map (geojson)...</div>;
  }

  // Build a quick set of district names in geojson (normalized) to detect unmatched csv districts
  useEffect(() => {
    const geoNames = new Set();
    if (geoJson && geoJson.features) {
      geoJson.features.forEach(f => {
        const raw = f.properties && (f.properties.district || f.properties.name || f.properties.NAME || f.properties.DISTRICT) || '';
        const n = normalize(raw);
        if (n) geoNames.add(n);
      });
    }
    // find CSV districts not in geojson
    const notMatched = new Set();
    Object.keys(districtMetrics).forEach(d => {
      if (!geoNames.has(d)) notMatched.add(d);
    });

    setUnmatched(notMatched);
    if (notMatched.size > 0) {
      console.warn('Unmatched CSV district names (normalized). You may need a mapping file to match them to geojson properties:', Array.from(notMatched).slice(0,50));
    }
  }, [geoJson, districtMetrics]);

  const styleFeature = (feature) => {
    const rawName = feature.properties && (feature.properties.district || feature.properties.name || feature.properties.NAME || feature.properties.DISTRICT) || '';
    const key = normalize(rawName);
    const metric = districtMetrics[key];
    const avg = metric ? metric.avgLevel : null;
    return {
      weight: 1,
      color: '#cbd5e1',
      fillColor: getColor(avg),
      fillOpacity: avg !== null ? 0.85 : 0.15
    };
  };

  const onEachFeature = (feature, layer) => {
    const rawName = feature.properties && (feature.properties.district || feature.properties.name || feature.properties.NAME || feature.properties.DISTRICT) || '';
    const key = normalize(rawName);
    const metric = districtMetrics[key];
    const avg = metric && metric.avgLevel !== null ? metric.avgLevel.toFixed(2) + ' m' : 'No data';
    const wells = metric ? metric.wells : 'N/A';
    const count = metric ? metric.count : 0;

    const popupHtml = `
      <div style="font-weight:600">${rawName}</div>
      <div>Average Groundwater Level: <strong>${avg}</strong></div>
      <div>Wells counted: <strong>${wells}</strong></div>
      <div>Data points: <strong>${count}</strong></div>
    `;
    layer.bindPopup(popupHtml);

    layer.on({
      mouseover: () => {
        layer.openPopup();
        layer.setStyle({ weight: 2, color: '#111827' });
      },
      mouseout: () => {
        layer.closePopup();
        layer.setStyle({ weight: 1, color: '#cbd5e1' });
      }
    });
  };

  // center of India
  const center = [22.5, 80.5];
  const zoom = 5;

  return (
    <div className="rounded-lg overflow-hidden shadow bg-white dark:bg-slate-800">
      <MapContainer center={center} zoom={zoom} style={{ height: 520, width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON data={geoJson} style={styleFeature} onEachFeature={onEachFeature} />
      </MapContainer>

      <div className="p-3 bg-white dark:bg-slate-800">
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2"><span style={{width:12,height:12,background:'#16a34a',display:'inline-block',borderRadius:6}} /> Good (&gt;15m)</div>
          <div className="flex items-center gap-2"><span style={{width:12,height:12,background:'#f59e0b',display:'inline-block',borderRadius:6}} /> Moderate (10-15m)</div>
          <div className="flex items-center gap-2"><span style={{width:12,height:12,background:'#ef4444',display:'inline-block',borderRadius:6}} /> Critical (&lt;10m)</div>
        </div>

        {unmatched.size > 0 && (
          <div className="mt-3 text-sm text-yellow-700 dark:text-yellow-300">
            Warning: {unmatched.size} district names from CSV didn't match the GeoJSON. Check console for examples and consider adding a mapping.
          </div>
        )}
      </div>
    </div>
  );
};

export default IndiaMap;
