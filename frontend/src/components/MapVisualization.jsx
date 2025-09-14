import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import { motion } from 'framer-motion';
import { 
  MapPin, 
  Layers, 
  Filter, 
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'react-toastify';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const MapVisualization = ({ data = [] }) => {
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]); // Center of India
  const [mapZoom, setMapZoom] = useState(5);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedState, setSelectedState] = useState('all');
  const [filteredData, setFilteredData] = useState([]);
  const [layerType, setLayerType] = useState('markers');
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const [showLegend, setShowLegend] = useState(true);
  
  const mapRef = useRef();
  const { translate } = useLanguage();

  // Filter data with valid coordinates
  const validData = data.filter(item => 
    item.latitude && 
    item.longitude && 
    !isNaN(item.latitude) && 
    !isNaN(item.longitude) &&
    item.latitude >= 8 && item.latitude <= 37 && // India bounds
    item.longitude >= 68 && item.longitude <= 97
  );

  useEffect(() => {
    applyFilters();
  }, [validData, selectedCategory, selectedState]);

  const applyFilters = () => {
    let filtered = [...validData];

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    if (selectedState !== 'all') {
      filtered = filtered.filter(item => item.state === selectedState);
    }

    setFilteredData(filtered);
  };

  const getMarkerColor = (category, waterLevel) => {
    // Color based on groundwater category
    switch (category) {
      case 'Safe': return '#22C55E'; // Green
      case 'Semi-Critical': return '#F59E0B'; // Yellow
      case 'Critical': return '#EF4444'; // Red
      case 'Over-Exploited': return '#DC2626'; // Dark Red
      default: return '#6B7280'; // Gray
    }
  };

  const getMarkerSize = (waterLevel) => {
    if (!waterLevel) return 8;
    
    // Size based on water level depth (deeper = smaller)
    const absLevel = Math.abs(waterLevel);
    if (absLevel < 5) return 12;
    if (absLevel < 15) return 10;
    if (absLevel < 30) return 8;
    return 6;
  };

  const getUniqueStates = () => {
    const states = [...new Set(validData.map(item => item.state))].filter(Boolean);
    return states.sort();
  };

  const getUniqueCategories = () => {
    const categories = [...new Set(validData.map(item => item.category))].filter(Boolean);
    return categories.sort();
  };

  const handleMarkerClick = (item) => {
    setMapCenter([item.latitude, item.longitude]);
    setMapZoom(8);
    setHoveredMarker(item);
  };

  const resetView = () => {
    setMapCenter([20.5937, 78.9629]);
    setMapZoom(5);
    setHoveredMarker(null);
  };

  const exportMapData = () => {
    const csvData = filteredData.map(item => ({
      state: item.state,
      district: item.district,
      latitude: item.latitude,
      longitude: item.longitude,
      water_level: item.water_level,
      category: item.category,
      year: item.year
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `groundwater_map_data_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('Map data exported successfully');
  };

  const renderMarkers = () => {
    if (layerType === 'heatmap') {
      // For heatmap, we'd need a different library like react-leaflet-heatmap-layer
      // For now, we'll use circle markers with varying opacity
      return filteredData.map((item, index) => (
        <CircleMarker
          key={`heatmap-${index}`}
          center={[item.latitude, item.longitude]}
          radius={getMarkerSize(item.water_level)}
          fillColor={getMarkerColor(item.category, item.water_level)}
          color="white"
          weight={1}
          opacity={0.8}
          fillOpacity={0.6}
          eventHandlers={{
            click: () => handleMarkerClick(item),
            mouseover: () => setHoveredMarker(item),
            mouseout: () => setHoveredMarker(null)
          }}
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-semibold text-lg mb-2">
                {item.district}, {item.state}
              </h3>
              <div className="space-y-1 text-sm">
                <div><strong>Water Level:</strong> {item.water_level?.toFixed(2) || 'N/A'} m</div>
                <div><strong>Category:</strong> 
                  <span className={`ml-1 px-2 py-1 rounded-full text-xs ${
                    item.category === 'Safe' ? 'bg-green-100 text-green-800' :
                    item.category === 'Semi-Critical' ? 'bg-yellow-100 text-yellow-800' :
                    item.category === 'Critical' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {item.category}
                  </span>
                </div>
                <div><strong>Year:</strong> {item.year}</div>
                <div><strong>Unique ID:</strong> {item.unique_district_id}</div>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ));
    }

    return filteredData.map((item, index) => (
      <Marker
        key={`marker-${index}`}
        position={[item.latitude, item.longitude]}
        eventHandlers={{
          click: () => handleMarkerClick(item)
        }}
      >
        <Popup>
          <div className="p-2">
            <h3 className="font-semibold text-lg mb-2">
              {item.district}, {item.state}
            </h3>
            <div className="space-y-1 text-sm">
              <div><strong>Water Level:</strong> {item.water_level?.toFixed(2) || 'N/A'} m</div>
              <div><strong>Category:</strong> 
                <span className={`ml-1 px-2 py-1 rounded-full text-xs ${
                  item.category === 'Safe' ? 'bg-green-100 text-green-800' :
                  item.category === 'Semi-Critical' ? 'bg-yellow-100 text-yellow-800' :
                  item.category === 'Critical' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {item.category}
                </span>
              </div>
              <div><strong>Year:</strong> {item.year}</div>
              <div><strong>Coordinates:</strong> {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</div>
            </div>
          </div>
        </Popup>
      </Marker>
    ));
  };

  const renderLegend = () => {
    if (!showLegend) return null;

    const categories = [
      { name: 'Safe', color: '#22C55E', description: '≤70% extraction' },
      { name: 'Semi-Critical', color: '#F59E0B', description: '70-90% extraction' },
      { name: 'Critical', color: '#EF4444', description: '90-100% extraction' },
      { name: 'Over-Exploited', color: '#DC2626', description: '>100% extraction' }
    ];

    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg border border-gray-200 z-[1000]"
        style={{ maxWidth: '200px' }}
      >
        <h4 className="font-semibold text-sm mb-3">{translate('Groundwater Categories')}</h4>
        <div className="space-y-2">
          {categories.map(category => (
            <div key={category.name} className="flex items-center text-xs">
              <div 
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: category.color }}
              />
              <div>
                <div className="font-medium">{category.name}</div>
                <div className="text-gray-600">{category.description}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
          <div><strong>Total Points:</strong> {filteredData.length}</div>
        </div>
      </motion.div>
    );
  };

  if (validData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-center text-gray-500">
          <MapPin className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">{translate('No location data available')}</p>
          <p className="text-sm">{translate('Load groundwater data with coordinates to view on map')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow overflow-hidden">
      {/* Map Controls */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-wrap items-center gap-4">
          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">{translate('All States')}</option>
              {getUniqueStates().map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">{translate('All Categories')}</option>
              {getUniqueCategories().map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Layer Type */}
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gray-600" />
            <select
              value={layerType}
              onChange={(e) => setLayerType(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="markers">{translate('Markers')}</option>
              <option value="heatmap">{translate('Heat Map')}</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setShowLegend(!showLegend)}
              className={`px-3 py-2 text-sm border rounded-md transition-colors ${
                showLegend 
                  ? 'bg-primary-600 text-white border-primary-600' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {translate('Legend')}
            </button>

            <button
              onClick={resetView}
              className="p-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
              title={translate('Reset view')}
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={exportMapData}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Download className="w-4 h-4" />
              {translate('Export')}
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-3 flex items-center gap-6 text-sm text-gray-600">
          <span><strong>{filteredData.length}</strong> {translate('locations shown')}</span>
          {selectedState !== 'all' && (
            <span><strong>{selectedState}</strong> {translate('selected')}</span>
          )}
          {selectedCategory !== 'all' && (
            <span><strong>{selectedCategory}</strong> {translate('category')}</span>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <MapContainer
          ref={mapRef}
          center={mapCenter}
          zoom={mapZoom}
          className="h-full w-full"
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {renderMarkers()}
        </MapContainer>

        {/* Legend */}
        {renderLegend()}

        {/* Hovered Marker Info */}
        {hoveredMarker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bottom-4 left-4 bg-white p-4 rounded-lg shadow-lg border border-gray-200 z-[1000] max-w-xs"
          >
            <h4 className="font-semibold text-sm mb-2">
              {hoveredMarker.district}, {hoveredMarker.state}
            </h4>
            <div className="text-xs space-y-1">
              <div><strong>Water Level:</strong> {hoveredMarker.water_level?.toFixed(2) || 'N/A'} m</div>
              <div><strong>Category:</strong> {hoveredMarker.category}</div>
              <div><strong>Year:</strong> {hoveredMarker.year}</div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MapVisualization;
