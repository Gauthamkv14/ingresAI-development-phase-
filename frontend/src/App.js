import React, { useState, useEffect } from 'react';
import './App.css';
import Chatbot from './components/Chatbot';

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [groundwaterData, setGroundwaterData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
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

  const renderTabContent = () => {
    switch(activeTab) {
      case 'overview':
        return (
          <div className="overview-content">
            {dashboardData && (
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">🏭</div>
                  <div className="stat-content">
                    <h3>{dashboardData.total_wells}</h3>
                    <p>Total Monitoring Wells</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📍</div>
                  <div className="stat-content">
                    <h3>{dashboardData.monitored_states}</h3>
                    <p>Monitored States</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">💧</div>
                  <div className="stat-content">
                    <h3>{dashboardData.average_groundwater_level}m</h3>
                    <p>Average Water Level</p>
                  </div>
                </div>
                <div className="stat-card critical">
                  <div className="stat-icon">⚠️</div>
                  <div className="stat-content">
                    <h3>{dashboardData.critical_areas}</h3>
                    <p>Critical Areas</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="data-table-container">
              <h3>Recent Groundwater Data</h3>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>State</th>
                      <th>District</th>
                      <th>Water Level (m)</th>
                      <th>Quality</th>
                      <th>Trend</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groundwaterData.map((item, index) => (
                      <tr key={index}>
                        <td>{item.state}</td>
                        <td>{item.district}</td>
                        <td>{item.level}</td>
                        <td>
                          <span className={`status-badge ${item.quality}`}>
                            {item.quality}
                          </span>
                        </td>
                        <td>
                          <span className={`trend-badge ${item.trend}`}>
                            {item.trend}
                          </span>
                        </td>
                        <td>{item.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      
      case 'chat':
        return <Chatbot />;
      
      case 'charts':
        return (
          <div className="charts-content">
            <h3>Data Visualization</h3>
            <p>Charts and graphs will be displayed here.</p>
            {/* Add chart components here */}
          </div>
        );
      
      case 'map':
        return (
          <div className="map-content">
            <h3>Geographic View</h3>
            <p>Interactive map will be displayed here.</p>
            {/* Add map component here */}
          </div>
        );
      
      case 'upload':
        return (
          <div className="upload-content">
            <h3>Data Upload</h3>
            <p>Upload your groundwater data files here.</p>
            {/* Add file upload component here */}
          </div>
        );
      
      default:
        return <div>Content not found</div>;
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1>INGRES Dashboard</h1>
            <p>AI-powered groundwater data analysis</p>
          </div>
          <div className="header-right">
            <div className="search-container">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search groundwater data..."
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch} disabled={loading}>
                {loading ? '...' : '🔍'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {searchResults && (
        <div className="search-results">
          <h3>Search Results for "{searchQuery}"</h3>
          <div className="results-grid">
            {searchResults.groundwater_data?.map((item, index) => (
              <div key={index} className="result-card">
                <h4>{item.district}, {item.state}</h4>
                <p>Level: {item.level}m</p>
                <p>Quality: {item.quality}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="main-content">
        <nav className="tab-navigation">
          <button 
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>
          <button 
            className={activeTab === 'chat' ? 'active' : ''}
            onClick={() => setActiveTab('chat')}
          >
            🤖 AI Chat
          </button>
          <button 
            className={activeTab === 'charts' ? 'active' : ''}
            onClick={() => setActiveTab('charts')}
          >
            📈 Charts
          </button>
          <button 
            className={activeTab === 'map' ? 'active' : ''}
            onClick={() => setActiveTab('map')}
          >
            🗺️ Map View
          </button>
          <button 
            className={activeTab === 'upload' ? 'active' : ''}
            onClick={() => setActiveTab('upload')}
          >
            📤 Data Upload
          </button>
        </nav>

        <div className="tab-content">
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
}

export default App;
