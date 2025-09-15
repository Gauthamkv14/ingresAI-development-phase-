import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import Chatbot from './components/Chatbot';
import FileUpload from './components/FileUpload';
import LanguageSelector from './components/LanguageSelector';
import Charts from './components/Charts';
import IndiaMap from './components/IndiaMap';
import Footer from './components/Footer';
import Papa from 'papaparse';

/**
 * App.jsx
 * Responsibilities:
 *  - load CSV from /data/ingris_report.csv (public folder)
 *  - normalize common column names and coerce numeric fields
 *  - provide dashboard summary, search, export and tab navigation
 *  - toggle dark mode (adds 'dark' class to <html>)
 */

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [groundwaterData, setGroundwaterData] = useState([]); // normalized rows
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  // small helper to find possible column names
  const find = (row, candidates = []) => {
    for (const c of candidates) {
      if (row[c] !== undefined && row[c] !== '') return row[c];
    }
    return undefined;
  };

  // parse numeric safely
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
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    // load CSV on mount
    loadCSV();
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
        // normalize typical column names
        const row = { ...rawRow };

        // district
        const district = find(row, [
          'district', 'District', 'DISTRICT', 'district_name', 'District Name', 'DISTRICT_NAME'
        ]) || '';

        // state
        const state = find(row, ['state', 'State', 'STATE', 'region', 'Region']) || '';

        // level: many CSVs call it 'level', 'water_level', 'Water Level', etc.
        const levelRaw = find(row, ['level', 'Level', 'water_level', 'Water Level', 'level_m', 'LEVEL_M']);
        const level = toFloat(levelRaw);

        // wells
        const wellsRaw = find(row, ['wells', 'WELLS', 'Wells', 'num_wells', 'No_of_wells']);
        const wells = toInt(wellsRaw);

        // date
        const dateRaw = find(row, ['date', 'Date', 'measurement_date', 'Measurement Date', 'timestamp']);
        let date = null;
        if (dateRaw) {
          const d = new Date(dateRaw);
          if (!Number.isNaN(d.getTime())) date = d.toISOString();
        }

        // other fields stay as-is
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

      // build dashboard summary
      const withLevel = normalizedRows.filter(r => r.level !== null && r.level !== undefined);
      const avg =
        withLevel.length > 0
          ? (withLevel.reduce((s, r) => s + (r.level || 0), 0) / withLevel.length)
          : null;

      // monthly trend aggregation (if date exists)
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
        average_groundwater_level: avg !== null ? +avg.toFixed(2) : null,
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

  // export the currently loaded/normalized data
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
      setError('Export failed: ' + err.message);
    }
  };

  // simple client-side search (by district/state or numeric comparisons like "level<10")
  const handleSearch = (q) => {
    const query = (q || searchQuery || '').trim();
    if (!query) {
      setSearchResults(null);
      return;
    }

    // pattern: level<10, level>12, wells>=5, or plain text search
    const comparison = query.match(/^(level|wells)\s*(<=|>=|<|>|=)\s*(\d+(\.\d+)?)$/i);
    if (comparison) {
      const field = comparison[1].toLowerCase();
      const op = comparison[2];
      const num = parseFloat(comparison[3]);
      const res = groundwaterData.filter(r => {
        const val = r[field];
        if (val === null || val === undefined) return false;
        switch (op) {
          case '<': return val < num;
          case '>': return val > num;
          case '<=': return val <= num;
          case '>=': return val >= num;
          case '=': return val === num;
          default: return false;
        }
      });
      setSearchResults({ type: 'filter', count: res.length, results: res });
      setActiveTab('map'); // switch to map so user sees results
      return;
    }

    // free-text search: match district or state (case-insensitive)
    const qLower = query.toLowerCase();
    const res = groundwaterData.filter(r =>
      (r.district && r.district.toLowerCase().includes(qLower)) ||
      (r.state && r.state.toLowerCase().includes(qLower))
    );
    setSearchResults({ type: 'text', count: res.length, results: res });
    setActiveTab('map');
  };

  // memoized data for charts or map (optionally pre-filtered if search applied)
  const activeData = useMemo(() => {
    if (!searchResults) return groundwaterData;
    return searchResults.results || groundwaterData;
  }, [groundwaterData, searchResults]);

  // render content for tabs
  const renderTabContent = () => {
    if (loading) return <div className="p-6">Loading data...</div>;
    if (error) return <div className="p-6 text-red-600">{error}</div>;

    switch (activeTab) {
      case 'overview':
        return (
          <div className="overview-wrapper space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="card">
                  <IndiaMap data={groundwaterData} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="card p-4">
                  <h3 className="text-xl font-semibold">Live Data Overview</h3>
                  <div className="mt-3 space-y-2">
                    <div>Monitored states: <strong>{dashboardData?.monitored_states ?? '-'}</strong></div>
                    <div>Average level: <strong>{dashboardData?.average_groundwater_level ?? '-' } m</strong></div>
                    <div>Critical areas (&lt;10m): <strong>{dashboardData?.critical_count ?? 0}</strong></div>
                    <div>Total monitoring points: <strong>{dashboardData?.total_points ?? 0}</strong></div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={handleExportCSV} className="btn">Export CSV</button>
                    <button onClick={() => { setActiveTab('charts'); }} className="btn btn-secondary">Open Charts</button>
                  </div>
                </div>

                <div className="card p-4">
                  <h4 className="font-semibold mb-2">Quick Search</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search district/state or e.g. 'level<10'"
                      className="input"
                    />
                    <button onClick={() => handleSearch(searchQuery)} className="btn">Search</button>
                  </div>

                  {searchResults && (
                    <div className="mt-3 text-sm">
                      <div>Results: <strong>{searchResults.count}</strong></div>
                      <div>
                        <button onClick={() => { setSearchResults(null); setSearchQuery(''); }} className="text-sm underline mt-2">Clear search</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="card p-4">
                  <h4 className="font-semibold">Mini Chart</h4>
                  <div className="mt-2">
                    <Charts data={dashboardData?.monthly_trends?.map(m => ({ month: m.month, level: m.avgLevel })) || []} />
                  </div>
                </div>
              </div>
            </div>

            {/* table or list */}
            <div className="card">
              <h3 className="p-4 text-lg font-semibold">Recent Monitoring Points</h3>
              <div className="p-4 overflow-auto">
                <table className="min-w-full text-left">
                  <thead>
                    <tr>
                      <th>District</th>
                      <th>State</th>
                      <th>Level (m)</th>
                      <th>Wells</th>
                      <th>Last Measurement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groundwaterData.slice(0, 20).map((r, idx) => (
                      <tr key={idx} className="border-t">
                        <td>{r.district}</td>
                        <td>{r.state}</td>
                        <td>{r.level ?? '-'}</td>
                        <td>{r.wells ?? 0}</td>
                        <td>{r.date ? new Date(r.date).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
            <Charts data={groundwaterData} />
          </div>
        );

      case 'chat':
        return <Chatbot />;

      case 'upload':
        return <FileUpload onUploadComplete={() => loadCSV()} />;

      default:
        return <div>Content not found</div>;
    }
  };

  return (
    <div className="App min-h-screen bg-gray-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <header className="app-header p-4 border-b bg-white dark:bg-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-lg font-bold">INGRES AI Portal</div>
            <LanguageSelector selectedLanguage={selectedLanguage} onLanguageChange={setSelectedLanguage} />
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm mr-2">Theme</div>
            <button
              onClick={() => setDarkMode(d => !d)}
              className="px-3 py-2 rounded bg-gray-100 dark:bg-slate-700"
            >
              {darkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        <nav className="mb-6 flex gap-2">
          <button className={`px-3 py-2 rounded ${activeTab === 'overview' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800'}`} onClick={() => setActiveTab('overview')}>Overview</button>
          <button className={`px-3 py-2 rounded ${activeTab === 'map' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800'}`} onClick={() => setActiveTab('map')}>Map</button>
          <button className={`px-3 py-2 rounded ${activeTab === 'charts' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800'}`} onClick={() => setActiveTab('charts')}>Charts</button>
          <button className={`px-3 py-2 rounded ${activeTab === 'chat' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800'}`} onClick={() => setActiveTab('chat')}>Chat</button>
          <button className={`px-3 py-2 rounded ${activeTab === 'upload' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800'}`} onClick={() => setActiveTab('upload')}>Upload</button>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={handleExportCSV} className="px-3 py-2 rounded bg-green-600 text-white">Export CSV</button>
          </div>
        </nav>

        {renderTabContent()}
      </main>

      <Footer />
    </div>
  );
}

export default App;
