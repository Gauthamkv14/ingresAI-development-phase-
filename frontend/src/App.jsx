import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { LanguageProvider } from './contexts/LanguageContext';
import { SessionProvider } from './contexts/SessionContext';
import { MCPProvider } from './contexts/MCPContext';
import './index.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <Router>
      <LanguageProvider>
        <SessionProvider>
          <MCPProvider>
            <div className="flex h-screen bg-gray-50">
              {/* Sidebar */}
              <Sidebar 
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                currentView={currentView}
                setCurrentView={setCurrentView}
              />
              
              {/* Main Content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <Header 
                  onMenuClick={toggleSidebar}
                  currentView={currentView}
                />
                
                {/* Main Content Area */}
                <main className="flex-1 overflow-hidden">
                  <Routes>
                    <Route path="/" element={
                      currentView === 'dashboard' ? <Dashboard /> : <ChatInterface />
                    } />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/chat" element={<ChatInterface />} />
                  </Routes>
                </main>
              </div>
              
              {/* Toast Notifications */}
              <ToastContainer
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
              />
            </div>
          </MCPProvider>
        </SessionProvider>
      </LanguageProvider>
    </Router>
  );
}

export default App;
