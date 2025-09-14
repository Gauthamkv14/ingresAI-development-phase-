import React from 'react';
import { 
  Menu, 
  Globe, 
  Settings, 
  User, 
  Bell,
  Search,
  HelpCircle
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';

const Header = ({ onMenuClick, currentView }) => {
  const { currentLanguage, changeLanguage, supportedLanguages } = useLanguage();
  const { sessionId, sessionStats } = useSession();

  const getViewTitle = (view) => {
    const titles = {
      dashboard: 'INGRES Dashboard',
      chat: 'AI Assistant Chat'
    };
    return titles[view] || 'INGRES MCP System';
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {getViewTitle(currentView)}
            </h1>
            <p className="text-sm text-gray-600">
              AI-powered groundwater data analysis
            </p>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="hidden md:flex items-center">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search groundwater data..."
                className="pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-64"
              />
            </div>
          </div>

          {/* Language Selector */}
          <div className="relative">
            <select
              value={currentLanguage}
              onChange={(e) => changeLanguage(e.target.value)}
              className="flex items-center space-x-2 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none bg-white pr-8"
            >
              {Object.entries(supportedLanguages).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
            <Globe className="w-4 h-4 absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Notifications */}
          <button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
          </button>

          {/* Help */}
          <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md">
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* User Menu */}
          <div className="relative">
            <button className="flex items-center space-x-2 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md">
              <User className="w-5 h-5" />
              <span className="hidden md:inline text-sm font-medium">
                Session: {sessionId?.slice(-8)}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Session Stats */}
      {sessionStats && (
        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded">
          <span>Queries: {sessionStats.totalQueries}</span>
          <span>•</span>
          <span>Files: {sessionStats.filesUploaded}</span>
          <span>•</span>
          <span>Active: {sessionStats.sessionDuration}</span>
        </div>
      )}
    </header>
  );
};

export default Header;
