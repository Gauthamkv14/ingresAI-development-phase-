// src/App.js
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Visualizations from './pages/Visualizations';
import LiveMonitoring from './pages/LiveMonitoring';
import ChatPage from './pages/ChatPage';
import Settings from './pages/Settings';
import Footer from './components/Footer';
import ChatbotFloating from './components/ChatbotFloating';
import './styles/index.css';
import './styles/footer.css';
import './styles/chatbotFloating.css';
import './styles/darkmode.css';

function App() {
  const defaultDark = localStorage.getItem('dark') === 'true';
  const [dark, setDark] = useState(defaultDark);
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('dark', dark);
  }, [dark]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <div className="brand" onClick={() => navigate('/')}>
            <span className="logo-emoji">💧</span>
            <div className="brand-text">
              <div className="brand-title">INGRES AI Portal</div>
              <div className="brand-sub">AI-powered groundwater intelligence</div>
            </div>
          </div>

          <div className="header-actions">
            <button
              className="theme-toggle"
              onClick={() => setDark(d => !d)}
              title="Toggle dark mode"
            >
              {dark ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <nav>
            <NavButton to="/">Overview</NavButton>
            <NavButton to="/visualizations">Visualizations</NavButton>
            <NavButton to="/monitoring">Live Monitoring</NavButton>
            <NavButton to="/chat">AI Chat</NavButton>
            <NavButton to="/settings">Settings</NavButton>
          </nav>
        </aside>

        <main className="main-area">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/visualizations" element={<Visualizations />} />
            <Route path="/monitoring" element={<LiveMonitoring />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <Footer />

      <ChatbotFloating />
    </div>
  );
}

function NavButton({ to, children }) {
  const navigate = useNavigate();
  const onClick = () => navigate(to);
  return (
    <button className="nav-btn" onClick={onClick}>
      {children}
    </button>
  );
}

export default App;
