// src/App.jsx
import React, { useState, useEffect } from "react";
import './styles/dashboard.css';

import Chatbot from './components/Chatbot';
import LanguageSelector from './components/LanguageSelector';
import Charts from './components/Charts';
import IndiaMap from './components/IndiaMap';
import Footer from './components/Footer';
import ChatbotFloating from './components/ChatbotFloating';
import LiveMonitor from './pages/LiveMonitoring';
import Papa from 'papaparse';

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [groundwaterData, setGroundwaterData] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  // to sync clicked state from map to Charts/LiveMonitor
  const [lastMapClick, setLastMapClick] = useState(null);

  // helpers
  const find = (row, candidates = []) => {
    for (const c of candidates) {
      if (row[c] !== undefined && row[c] !== '') return row[c];
    }
    return undefined;
  };
  const toFloat = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : null;
  };
  const toInt = (v) => {
    const f = toFloat(v);
    return f === null ? 0 : Math.round(f);
  };

  useEffect(() => {
    loadCSV();
  }, []);

  // listen for floating button to open chat
  useEffect(() => {
    const handler = () => setActiveTab('chat');
    window.addEventListener('openChat', handler);
    return () => window.removeEventListener('openChat', handler);
  }, []);

  // listen for state click on map
  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail || {};
      if (detail.state) {
        setLastMapClick(detail);
        setActiveTab('charts'); // open charts tab by default
      }
    };
    window.addEventListener('mapStateClick', handler);
    return () => window.removeEventListener('mapStateClick', handler);
  }, []);

  const loadCSV = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/data/ingris_report.csv');
      if (!res.ok) throw new Error('CSV not found at /data/ingris_report.csv');
      const text = await res.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

      const normalizedRows = parsed.data.map((rawRow) => {
        const row = { ...rawRow };

        const district = find(row, [
          'district', 'District', 'DISTRICT', 'district_name', 'District Name', 'DISTRICT_NAME'
        ]) || '';

        const state = find(row, ['state', 'State', 'STATE', 'region', 'Region']) || '';

        const levelRaw = find(row, ['level', 'Level', 'water_level', 'Water Level', 'level_m', 'LEVEL_M']);
        const level = toFloat(levelRaw);

        const wellsRaw = find(row, ['wells', 'WELLS', 'Wells', 'num_wells', 'No_of_wells']);
        const wells = toInt(wellsRaw);

        const dateRaw = find(row, ['date', 'Date', 'measurement_date', 'Measurement Date', 'timestamp']);
        let date = null;
        if (dateRaw) {
          const d = new Date(dateRaw);
          if (!Number.isNaN(d.getTime())) date = d.toISOString();
        }

        return {
          ...row,
          district: String(district).trim(),
          state: String(state).trim(),
          level,
          wells,
          date
        };
      });

      setGroundwaterData(normalizedRows);

      // compute monthly trend from 'level' only if present
      const withLevel = normalizedRows.filter(r => r.level !== null && r.level !== undefined);
      const avg =
        withLevel.length > 0
          ? (withLevel.reduce((s, r) => s + (r.level || 0), 0) / withLevel.length)
          : null;

      const monthlyTrends = {};
      normalizedRows.forEach(r => {
        if (!r.date) return;
        const d = new Date(r.date);
        if (Number.isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyTrends[key]) monthlyTrends[key] = { sum: 0, count: 0 };
        if (r.level !== null && r.level !== undefined) {
          monthlyTrends[key].sum += r.level;
          monthlyTrends[key].count += 1;
        }
      });
      const monthly = Object.keys(monthlyTrends).sort().map(k => ({
        month: k,
        avgLevel: monthlyTrends[k].count ? +(monthlyTrends[k].sum / monthlyTrends[k].count).toFixed(2) : null
      }));

      const summary = {
        monitored_states: new Set(normalizedRows.map(r => r.state).filter(Boolean)).size,
        // remove showing "Avg GW level" globally — keep null so UI won't show '-'
        average_groundwater_level: null,
        critical_count: normalizedRows.filter(r => r.level !== null && r.level < 10).length,
        monthly_trends: monthly,
        total_points: normalizedRows.length
      };

      setDashboardData(summary);
    } catch (err) {
      console.error('Failed to load CSV', err);
      setError('Failed to load CSV: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    try {
      const csv = Papa.unparse(groundwaterData);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'groundwater_data_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = (q) => {
    const query = (q || searchQuery || '').trim();
    if (!query) {
      setSearchResults(null);
      return;
    }
    const qLower = query.toLowerCase();
    const res = groundwaterData.filter(r =>
      (r.district && r.district.toLowerCase().includes(qLower)) ||
      (r.state && r.state.toLowerCase().includes(qLower))
    );
    setSearchResults({ type: 'text', count: res.length, results: res });
    setActiveTab('map');
  };

  const activeData = React.useMemo(() => {
    if (!searchResults) return groundwaterData;
    return searchResults.results || groundwaterData;
  }, [groundwaterData, searchResults]);

  const renderTabContent = () => {
    if (loading) return <div className="p-6">Loading data...</div>;
    if (error) return <div className="p-6 text-red-600">{error}</div>;

    switch (activeTab) {
      case 'overview':
        return (
          <div className="overview-wrapper">
            <div className="dashboard-grid">
              <div className="map-col">
                <div className="card map-card">
                  <h3>Interactive Groundwater Map</h3>
                  <IndiaMap data={groundwaterData} />
                </div>

                <div className="card trends-card">
                  <h3>Trends</h3>
                  {/* Trends: show both Extractable and Total Availability for selected state (if any).
                      Pass the clicked state via `initialState`. */}
                  <Charts
                    mode="overview-trends"
                    initialState={lastMapClick?.state || ""}
                    groundwaterData={groundwaterData}
                  />
                </div>
              </div>

              <aside className="quick-col">
                <div className="card overview-card">
                  <h4>Live Overview</h4>
                  <div className="overview-list">
                    <div>Total points: <strong>{dashboardData?.total_points ?? '-'}</strong></div>
                    <div>Safe: <strong>{dashboardData ? (dashboardData.total_points - dashboardData.critical_count - 0) : '-'}</strong></div>
                    <div>Moderate: <strong>{'-'}</strong></div>
                    <div>Critical: <strong>{dashboardData?.critical_count ?? '-'}</strong></div>
                    <hr />
                    <div>Monitored states: <strong>{dashboardData?.monitored_states ?? '—'}</strong></div>
                    <div>Critical areas: <strong>{dashboardData?.critical_count ?? '—'}</strong></div>
                  </div>
                </div>

                <div className="card quick-stats">
                  <h4>Quick Stats</h4>
                  <div className="big-number">{dashboardData?.total_points ?? '—'}</div>
                  <div className="stat-list">
                    <div>Monitored states: <strong>{dashboardData?.monitored_states ?? '—'}</strong></div>
                    <div>Critical areas: <strong>{dashboardData?.critical_count ?? '—'}</strong></div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        );

      case 'map':
        return (
          <div>
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Interactive Map</h2>
              <div className="flex gap-2">
                <button onClick={() => setSearchResults(null)} className="btn">Show all</button>
              </div>
            </div>
            <IndiaMap data={activeData} />
          </div>
        );

      case 'charts':
        return (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Charts & Analytics</h2>
            {/* Charts page: pass groundwaterData for district metric computation */}
            <Charts
              mode="state-metric"
              initialState={lastMapClick?.state || ""}
              groundwaterData={groundwaterData}
            />
          </div>
        );

      case 'live':
        return <LiveMonitor initialState={lastMapClick?.state || ""} />;

      case 'chat':
        return <Chatbot />;

      default:
        return <div>Content not found</div>;
    }
  };

  return (
    <div className="App min-h-screen bg-gray-50 text-slate-900">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-left">
            <div className="brand">
              <div className="brand-logo">💧</div>
              <div className="brand-text">
                <div className="brand-title">INGRES AI Portal</div>
                <div className="brand-sub">AI-powered groundwater intelligence</div>
              </div>
            </div>
          </div>

          <div className="header-center">
            <h1 className="dashboard-title">INGRES Dashboard</h1>
          </div>

          <div className="header-right">
            <div className="search-area">
              <input
                className="main-search"
                placeholder="Search states, districts, water data..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              />
              <button className="btn btn-export" onClick={handleExportCSV}>Export CSV</button>
            </div>

            <div className="header-controls">
              <LanguageSelector selectedLanguage={selectedLanguage} onLanguageChange={setSelectedLanguage} />
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <nav className="page-tabs">
          <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
          <button className={`tab ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>Map</button>
          <button className={`tab ${activeTab === 'charts' ? 'active' : ''}`} onClick={() => setActiveTab('charts')}>Charts</button>
          <button className={`tab ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>Live Monitoring</button>
          <button className={`tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>Chat</button>
        </nav>

        <div className="content-area">
          {renderTabContent()}
        </div>
      </main>

      <Footer />
      <ChatbotFloating />
    </div>
  );
}

export default App;
