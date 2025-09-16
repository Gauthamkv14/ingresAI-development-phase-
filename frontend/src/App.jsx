import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import Chatbot from './components/Chatbot';
import FileUpload from './components/FileUpload';
import LanguageSelector from './components/LanguageSelector';
import Charts from './components/Charts';
import IndiaMap from './components/IndiaMap';
import Footer from './components/Footer';
import Papa from 'papaparse';
import "../styles/darkmode.css";

/**
 * App.jsx
 * Dashboard + dark mode persistence
 */

// ✅ Persistent dark mode default
const defaultDark = localStorage.getItem('dark') === 'true';

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [groundwaterData, setGroundwaterData] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [dark, setDark] = useState(defaultDark); // ✅ persistent state
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

  // ✅ apply dark mode to <body> and persist
  useEffect(() => {
    document.body.classList.toggle('dark', dark);
    localStorage.setItem('dark', dark);
  }, [dark]);

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

  const handleSearch = (q) => {
    const query = (q || searchQuery || '').trim();
    if (!query) {
      setSearchResults(null);
      return;
    }
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
      setActiveTab('map');
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

  const activeData = useMemo(() => {
    if (!searchResults) return groundwaterData;
    return searchResults.results || groundwaterData;
  }, [groundwaterData, searchResults]);

  const renderTabContent = () => {
    if (loading) return <div className="p-6">Loading data...</div>;
    if (error) return <div className="p-6 text-red-600">{error}</div>;

    switch (activeTab) {
      case 'overview':
        return (
          <div className="overview-wrapper space-y-6">
            {/* ... your overview JSX unchanged ... */}
          </div>
        );
      case 'map':
        return (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Interactive Map</h2>
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
              onClick={() => setDark(!dark)}
              className="px-3 py-2 rounded bg-gray-100 dark:bg-slate-700"
            >
              {dark ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        {/* nav bar unchanged */}
        {renderTabContent()}
      </main>

      <Footer />
    </div>
  );
}

export default App;
