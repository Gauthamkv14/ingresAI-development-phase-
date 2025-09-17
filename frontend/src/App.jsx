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

  // the state that Trends should display (selected via dropdown or map click)
  const [selectedTrendState, setSelectedTrendState] = useState('');

  // store last map click info if needed elsewhere
  const [lastMapClick, setLastMapClick] = useState(null);

  // ephemeral banner
  const [banner, setBanner] = useState({ show: false, text: '' });

  // helper to find CSV columns robustly
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

  // open chat floating button listener
  useEffect(() => {
    const handler = () => setActiveTab('chat');
    window.addEventListener('openChat', handler);
    return () => window.removeEventListener('openChat', handler);
  }, []);

  // map click -> resolve district -> find its state -> navigate to Trends in Overview
  useEffect(() => {
    const handler = (e) => {
      const detail = (e && e.detail) ? e.detail : {};
      const normalize = (s) => (s || '').toString().trim();

      // Build a set of known states (canonical values from CSV) for quick checking
      const statesList = Array.from(new Set(groundwaterData.map(r => (r.state || '').toString().trim()).filter(Boolean)));

      // Candidate district/name we received from the map (the map may put district in detail.name or detail.district)
      const districtCandidate = normalize(detail.district || detail.name || detail.label || detail.place || detail.feature || "");

      // Candidate state if map provided one
      const providedStateCandidate = normalize(detail.state || "");

      let resolvedState = null;

      // 1) If we have a districtCandidate, attempt to find the STATE by searching CSV rows (best effort)
      if (districtCandidate) {
        const dLow = districtCandidate.toLowerCase();

        // Try exact then contains then partial token match
        let match = groundwaterData.find(r => {
          const rD = normalize(r.district || r.DISTRICT || r.District || r['District Name'] || r['district_name']).toLowerCase();
          return rD && (rD === dLow);
        });

        if (!match) {
          match = groundwaterData.find(r => {
            const rD = normalize(r.district || r.DISTRICT || r.District || r['District Name'] || r['district_name']).toLowerCase();
            return rD && (rD.includes(dLow) || dLow.includes(rD));
          });
        }

        if (!match && districtCandidate.includes(' ')) {
          // Try fuzzy token match (some map labels may be 'Hassan district' or similar)
          const tokens = districtCandidate.split(/\s+/).map(t => t.toLowerCase()).filter(Boolean);
          for (const r of groundwaterData) {
            const rD = normalize(r.district || '').toLowerCase();
            if (!rD) continue;
            for (const t of tokens) {
              if (rD.includes(t) || t.includes(rD)) {
                match = r; break;
              }
            }
            if (match) break;
          }
        }

        if (match && match.state) {
          resolvedState = normalize(match.state);
          // Use the exact canonical state string from the row (preserve casing)
          resolvedState = match.state.toString().trim();
        }
      }

      // 2) If we didn't resolve via district, but map provided a state that matches our known states -> accept it
      if (!resolvedState && providedStateCandidate) {
        const pLow = providedStateCandidate.toLowerCase();
        // find canonical match from statesList
        const canon = statesList.find(s => s.toLowerCase() === pLow) || statesList.find(s => s.toLowerCase().includes(pLow) || pLow.includes(s.toLowerCase()));
        if (canon) resolvedState = canon;
        else resolvedState = providedStateCandidate; // last fallback - use as-is
      }

      // 3) final fallback: if districtCandidate itself equals a state (edge case), accept it
      if (!resolvedState && districtCandidate) {
        const p = statesList.find(s => s.toLowerCase() === districtCandidate.toLowerCase());
        if (p) resolvedState = p;
      }

      if (!resolvedState) {
        // nothing resolved — bail (do nothing)
        return;
      }

      // store last click (district + resolved state)
      setLastMapClick({ district: districtCandidate || null, state: resolvedState });

      // set selected trend state so Trends chart displays immediately
      setSelectedTrendState(resolvedState);

      // navigate to Overview (where Trends is)
      setActiveTab('overview');

      // show ephemeral banner with STATE name (uppercase)
      const bannerText = `Showing trends for ${resolvedState.toString().toUpperCase()}`;
      setBanner({ show: true, text: bannerText });
      setTimeout(() => setBanner(prev => ({ ...prev, fading: true })), 900);
      setTimeout(() => setBanner({ show: false, text: '' }), 1400);

      // scroll to trends card
      setTimeout(() => {
        const el = document.querySelector('.trends-card');
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 250);
    };

    window.addEventListener('mapStateClick', handler);
    return () => window.removeEventListener('mapStateClick', handler);
  }, [groundwaterData]);

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
    setActiveTab('charts');
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
                  {/* key forces remount so Charts will initialise properly when selectedTrendState changes */}
                  <Charts
                    key={`trends-${selectedTrendState || 'none'}`}
                    mode="overview-trends"
                    initialState={selectedTrendState}
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

      case 'charts':
        return (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Charts & Analytics</h2>
            <Charts
              mode="state-metric"
              initialState={selectedTrendState || ""}
              groundwaterData={groundwaterData}
            />
          </div>
        );

      case 'live':
        return <LiveMonitor initialState={selectedTrendState || ""} />;

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

      {/* ephemeral banner */}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          top: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          transition: 'opacity 300ms ease, transform 300ms ease',
          opacity: banner.show ? 1 : 0,
          pointerEvents: 'none'
        }}
      >
        <div style={{
          background: 'rgba(0,0,0,0.75)',
          color: '#fff',
          padding: '8px 14px',
          borderRadius: 999,
          boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
          fontWeight: 600
        }}>
          {banner.text}
        </div>
      </div>

      <main className="main-content">
        <nav className="page-tabs">
          <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
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
