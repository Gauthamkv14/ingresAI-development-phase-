import React, { useState, useEffect } from 'react';
import './App.css';
import Chatbot from './components/Chatbot';
import FileUpload from './components/FileUpload';
import LanguageSelector from './components/LanguageSelector';
import Charts from './components/Charts';
import Footer from './components/Footer';

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [groundwaterData, setGroundwaterData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [hoveredPoint, setHoveredPoint] = useState(null);

  useEffect(() => {
    loadDashboardData();
    loadGroundwaterData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/overview');
      if (!response.ok) throw new Error('Failed to load dashboard data');
      const data = await response.json();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data: ' + err.message);
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadGroundwaterData = async () => {
    try {
      const response = await fetch('/api/groundwater/levels');
      if (!response.ok) throw new Error('Failed to load groundwater data');
      const result = await response.json();
      setGroundwaterData(result.data || []);
    } catch (err) {
      console.error('Groundwater data error:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setLoading(true);
      const searchUrl = '/api/search?q=' + encodeURIComponent(searchQuery);
      const response = await fetch(searchUrl);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      setSearchResults(data);
      setError(null);
    } catch (err) {
      setError('Search failed: ' + err.message);
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/groundwater/export');
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'groundwater_data.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Export failed: ' + err.message);
    }
  };

  const getStatusClass = (level) => {
    if (level < 10) return 'critical';
    if (level > 15) return 'good';
    return 'moderate';
  };

  const getTrendIcon = (trend) => {
    if (trend === 'improving') return '📈';
    if (trend === 'declining') return '📉';
    return '➡️';
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'N/A';
    }
  };

  const renderMapPoints = () => {
    if (!groundwaterData || groundwaterData.length === 0) return null;

    return groundwaterData.map((location, index) => {
      const baseX = 200;
      const baseY = 150;
      const offsetX = (index % 5) * 80;
      const offsetY = Math.floor(index / 5) * 60;
      const randomX = Math.random() * 40;
      const randomY = Math.random() * 30;
      
      const x = baseX + offsetX + randomX;
      const y = baseY + offsetY + randomY;
      const status = getStatusClass(location.level);
      const isHovered = hoveredPoint === 'map-' + index;
      
      return (
        <g key={index}>
          <circle
            cx={x}
            cy={y}
            r={isHovered ? 12 : 8}
            className={'map-point ' + status}
            onMouseEnter={() => setHoveredPoint('map-' + index)}
            onMouseLeave={() => setHoveredPoint(null)}
            style={{ cursor: 'pointer' }}
          />
          {isHovered && (
            <g>
              <rect
                x={x - 80}
                y={y - 60}
                width="160"
                height="50"
                rx="8"
                fill="rgba(0, 0, 0, 0.9)"
                stroke="white"
              />
              <text x={x} y={y - 35} textAnchor="middle" fill="white" fontSize="12" fontWeight="600">
                {location.district + ', ' + location.state}
              </text>
              <text x={x} y={y - 20} textAnchor="middle" fill="#67eeaa" fontSize="11">
                {'Level: ' + location.level + 'm | ' + location.quality}
              </text>
            </g>
          )}
        </g>
      );
    });
  };

  const renderOverviewTab = () => {
    return (
      <div className="overview-content">
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Loading dashboard data...</p>
          </div>
        )}
        
        {dashboardData && (
          <>
            <div className="hero-stats">
              <div className="hero-card primary">
                <div className="hero-icon">🌊</div>
                <div className="hero-content">
                  <h2>{dashboardData.monitored_states}</h2>
                  <p>States Monitored</p>
                  <span className="hero-subtitle">Real-time coverage</span>
                </div>
              </div>
              
              <div className="hero-card success">
                <div className="hero-icon">💧</div>
                <div className="hero-content">
                  <h2>{dashboardData.average_groundwater_level}m</h2>
                  <p>Average Water Level</p>
                  <span className="hero-subtitle">National average</span>
                </div>
              </div>
              
              <div className="hero-card danger">
                <div className="hero-icon">⚠️</div>
                <div className="hero-content">
                  <h2>{dashboardData.critical_count}</h2>
                  <p>Critical Areas</p>
                  <span className="hero-subtitle">Need attention</span>
                </div>
              </div>
              
              <div className="hero-card info">
                <div className="hero-icon">📊</div>
                <div className="hero-content">
                  <button onClick={handleExportCSV} className="hero-export-btn">
                    📥 Export Data
                  </button>
                  <p>Download CSV</p>
                  <span className="hero-subtitle">Full dataset</span>
                </div>
              </div>
            </div>

            {dashboardData.critical_areas && dashboardData.critical_areas.length > 0 && (
              <div className="critical-areas-advanced">
                <div className="section-header">
                  <h2>🚨 Critical Areas Dashboard</h2>
                  <div className="alert-badge">
                    <span className="pulse-dot"></span>
                    LIVE MONITORING
                  </div>
                </div>
                
                <div className="critical-grid">
                  {dashboardData.critical_areas.map((area, index) => (
                    <div key={index} className="critical-card-advanced">
                      <div className="card-header">
                        <div className="location-info">
                          <h3>{area.district}</h3>
                          <span className="state-tag">{area.state}</span>
                        </div>
                        <div className="severity-indicator critical">
                          <span className="severity-icon">🔴</span>
                          CRITICAL
                        </div>
                      </div>
                      
                      <div className="metrics-row">
                        <div className="metric">
                          <span className="metric-value">{area.level}m</span>
                          <span className="metric-label">Water Level</span>
                        </div>
                        <div className="metric">
                          <span className={'metric-value ' + area.trend}>{area.trend}</span>
                          <span className="metric-label">Trend</span>
                        </div>
                        <div className="metric">
                          <span className="metric-value">{area.wells}</span>
                          <span className="metric-label">Wells</span>
                        </div>
                      </div>
                      
                      <div className="action-buttons">
                        <button className="action-btn primary">View Details</button>
                        <button className="action-btn secondary">Alert Settings</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="charts-dashboard">
              <div className="section-header">
                <h2>📈 Water Level Analytics</h2>
                <div className="chart-controls">
                  <select className="chart-selector">
                    <option>Monthly Trends</option>
                    <option>Seasonal Patterns</option>
                    <option>State Comparison</option>
                  </select>
                </div>
              </div>
              
              <div className="chart-container-advanced">
                <Charts data={dashboardData.monthly_trends} type="advanced" />
              </div>
            </div>

            {dashboardData.states_summary && (
              <div className="states-dashboard">
                <div className="section-header">
                  <h2>🗺️ State Performance Matrix</h2>
                  <div className="performance-legend">
                    <span className="legend-item good">🟢 Good</span>
                    <span className="legend-item moderate">🟡 Moderate</span>
                    <span className="legend-item poor">🟠 Poor</span>
                    <span className="legend-item critical">🔴 Critical</span>
                  </div>
                </div>
                
                <div className="states-grid-advanced">
                  {dashboardData.states_summary.map((state, index) => (
                    <div key={index} className={'state-card-advanced ' + state.status}>
                      <div className="state-header-advanced">
                        <h3>{state.name}</h3>
                        <span className={'status-badge-advanced ' + state.status}>
                          {state.status.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="state-metrics-grid">
                        <div className="metric-box">
                          <span className="metric-number">{state.districts}</span>
                          <span className="metric-title">Districts</span>
                        </div>
                        <div className="metric-box">
                          <span className="metric-number">{state.wells}</span>
                          <span className="metric-title">Wells</span>
                        </div>
                        <div className="metric-box">
                          <span className="metric-number">{state.avg_level}m</span>
                          <span className="metric-title">Avg Level</span>
                        </div>
                      </div>
                      
                      <div className="performance-indicators">
                        <div className="indicator-row">
                          <span className="indicator critical">🔴 {state.critical_districts || 0}</span>
                          <span className="indicator improving">🟢 {state.improving_districts || 0}</span>
                          <span className="indicator stable">🔵 {state.stable_districts || 0}</span>
                        </div>
                      </div>
                      
                      <div className="state-actions">
                        <button className="state-btn">View Details</button>
                        <button className="state-btn secondary">Reports</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dashboardData.data_citations && (
              <div className="citations-advanced">
                <div className="section-header">
                  <h2>📚 Data Sources & Authenticity</h2>
                  <div className="data-quality-badge">
                    <span className="quality-icon">✅</span>
                    VERIFIED DATA
                  </div>
                </div>
                
                <div className="citations-grid">
                  {dashboardData.data_citations.primary_sources && dashboardData.data_citations.primary_sources.map((source, index) => (
                    <div key={index} className="citation-card">
                      <div className="citation-icon">🏛️</div>
                      <div className="citation-content">
                        <h4>{source.name}</h4>
                        <span className="citation-type">{source.type}</span>
                        <p>Official government data source</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="data-quality-info">
                  <div className="quality-metric">
                    <span className="quality-label">Last Updated:</span>
                    <span className="quality-value">
                      {formatDate(dashboardData.data_citations.last_updated)}
                    </span>
                  </div>
                  <div className="quality-metric">
                    <span className="quality-label">Accuracy:</span>
                    <span className="quality-value">{dashboardData.data_citations.accuracy || 'N/A'}</span>
                  </div>
                  <div className="quality-metric">
                    <span className="quality-label">Methodology:</span>
                    <span className="quality-value">{dashboardData.data_citations.methodology || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        
        <div className="data-table-advanced">
          <div className="table-header-advanced">
            <h3>📊 Live Monitoring Data</h3>
            <div className="table-actions">
              <button onClick={handleExportCSV} className="table-action-btn">
                📊 Export CSV
              </button>
              <button className="table-action-btn secondary" onClick={loadGroundwaterData}>
                🔄 Refresh Data
              </button>
            </div>
          </div>
          
          <div className="table-container-advanced">
            <table className="data-table-enhanced">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Water Level</th>
                  <th>Quality Status</th>
                  <th>Trend</th>
                  <th>Wells</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groundwaterData.map((item, index) => (
                  <tr key={index} className="table-row-enhanced">
                    <td>
                      <div className="location-cell">
                        <strong>{item.district}</strong>
                        <span className="state-subtitle">{item.state}</span>
                      </div>
                    </td>
                    <td>
                      <div className={'level-indicator ' + getStatusClass(item.level)}>
                        {item.level}m
                      </div>
                    </td>
                    <td>
                      <span className={'status-pill ' + item.quality}>
                        {item.quality}
                      </span>
                    </td>
                    <td>
                      <span className={'trend-pill ' + item.trend}>
                        {getTrendIcon(item.trend)} {item.trend}
                      </span>
                    </td>
                    <td className="wells-count">{item.wells}</td>
                    <td className="date-cell">{item.date}</td>
                    <td>
                      <button className="mini-btn">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderMapTab = () => {
    const criticalCount = groundwaterData.filter(item => item.level < 10).length;
    
    return (
      <div className="map-content-advanced">
        <div className="section-header">
          <h2>🗺️ Interactive Groundwater Map</h2>
          <div className="map-controls">
            <select className="map-selector">
              <option>Water Levels</option>
              <option>Quality Status</option>
              <option>Trend Analysis</option>
            </select>
            <button className="map-refresh-btn" onClick={loadGroundwaterData}>
              🔄 Refresh Data
            </button>
          </div>
        </div>
        
        <div className="map-container">
          <div className="map-visualization">
            <div className="india-map-container">
              <svg viewBox="0 0 800 600" className="india-map-svg">
                <path
                  d="M200,100 L600,100 L650,200 L600,500 L200,480 L150,300 Z"
                  fill="#f8f9fa"
                  stroke="#dee2e6"
                  strokeWidth="2"
                />
                {renderMapPoints()}
              </svg>
            </div>
            
            <div className="map-legend-advanced">
              <h4>Map Legend</h4>
              <div className="legend-items">
                <div className="legend-item">
                  <div className="legend-circle good"></div>
                  <span>Good (&gt;15m)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-circle moderate"></div>
                  <span>Moderate (10-15m)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-circle critical"></div>
                  <span>Critical (&lt;10m)</span>
                </div>
              </div>
              
              <div className="map-stats">
                <div className="map-stat">
                  <span className="stat-number">{groundwaterData.length}</span>
                  <span className="stat-label">Monitoring Points</span>
                </div>
                <div className="map-stat">
                  <span className="stat-number">{criticalCount}</span>
                  <span className="stat-label">Critical Areas</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch(activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'chat':
        return <Chatbot />;
      case 'charts':
        return (
          <div className="charts-content-advanced">
            <Charts />
          </div>
        );
      case 'map':
        return renderMapTab();
      case 'upload':
        return <FileUpload />;
      default:
        return <div>Content not found</div>;
    }
  };

  const tabConfig = [
    { id: 'overview', label: '📊 Overview', icon: '📊' },
    { id: 'chat', label: '🤖 AI Chat', icon: '🤖' },
    { id: 'charts', label: '📈 Analytics', icon: '📈' },
    { id: 'map', label: '🗺️ Map View', icon: '🗺️' },
    { id: 'upload', label: '📤 Data Upload', icon: '📤' }
  ];

  return (
    <div className="App">
      <header className="app-header-advanced">
        <div className="header-background"></div>
        <div className="header-content">
          <div className="header-left">
            <div className="logo-container">
              <div className="logo-icon">🌊</div>
              <div className="logo-text">
                <h1>INGRES Dashboard</h1>
                <p>AI-powered groundwater intelligence</p>
              </div>
            </div>
          </div>
          <div className="header-right">
            <LanguageSelector 
              selectedLanguage={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
            />
            <div className="search-container-advanced">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search states, districts, water data..."
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="search-input-advanced"
              />
              <button onClick={handleSearch} disabled={loading} className="search-btn-advanced">
                {loading ? '⏳' : '🔍'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="error-banner-advanced">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{error}</span>
            <button onClick={() => setError(null)} className="error-close">×</button>
          </div>
        </div>
      )}

      {searchResults && (
        <div className="search-results-advanced">
          <div className="search-header">
            <h3>🔍 Search Results for "{searchQuery}"</h3>
            <span className="search-count">{searchResults.total_results} results found</span>
          </div>
          
          <div className="results-grid-advanced">
            {searchResults.groundwater_data && searchResults.groundwater_data.map((item, index) => (
              <div key={index} className="result-card-advanced">
                <div className="result-header">
                  <h4>{item.district + ', ' + item.state}</h4>
                  <span className={'result-status ' + item.quality}>{item.quality}</span>
                </div>
                <div className="result-metrics">
                  <div className="result-metric">
                    <span className="metric-label">Level:</span>
                    <span className="metric-value">{item.level}m</span>
                  </div>
                  <div className="result-metric">
                    <span className="metric-label">Trend:</span>
                    <span className="metric-value">{item.trend}</span>
                  </div>
                  <div className="result-metric">
                    <span className="metric-label">Wells:</span>
                    <span className="metric-value">{item.wells}</span>
                  </div>
                </div>
              </div>
            ))}
            
            {searchResults.states && searchResults.states.map((state, index) => (
              <div key={index} className="result-card-advanced state-result">
                <div className="result-header">
                  <h4>📍 {state.name}</h4>
                  <span className={'result-status ' + state.status}>{state.status}</span>
                </div>
                <div className="result-metrics">
                  <div className="result-metric">
                    <span className="metric-label">Avg Level:</span>
                    <span className="metric-value">{state.avg_level}m</span>
                  </div>
                  <div className="result-metric">
                    <span className="metric-label">Districts:</span>
                    <span className="metric-value">{state.districts}</span>
                  </div>
                  <div className="result-metric">
                    <span className="metric-label">Wells:</span>
                    <span className="metric-value">{state.wells}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="main-content">
        <nav className="tab-navigation-advanced">
          {tabConfig.map(tab => {
            const labelParts = tab.label.split(' ');
            const labelText = labelParts.slice(1).join(' ');
            
            return (
              <button 
                key={tab.id}
                className={'nav-btn-advanced ' + (activeTab === tab.id ? 'active' : '')}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="nav-icon">{tab.icon}</span>
                <span className="nav-label">{labelText}</span>
              </button>
            );
          })}
        </nav>

        <div className="tab-content-advanced">
          {renderTabContent()}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default App;
