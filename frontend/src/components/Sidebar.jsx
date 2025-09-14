import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  BarChart3, 
  MessageSquare, 
  Upload, 
  Download,
  Map,
  Settings,
  Database,
  TrendingUp,
  FileText,
  Info
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const Sidebar = ({ isOpen, onClose, currentView, setCurrentView }) => {
  const { translate } = useLanguage();

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      description: 'Overview and statistics'
    },
    {
      id: 'chat',
      label: 'AI Assistant',
      icon: MessageSquare,
      description: 'Chat with INGRES AI'
    }
  ];

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div
        animate={isOpen ? { x: 0 } : { x: '-100%' }}
        className="fixed left-0 top-0 h-full w-64 bg-white shadow-xl z-50 lg:static lg:translate-x-0 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">INGRES</h2>
              <p className="text-xs text-gray-600">MCP System</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  onClose();
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2 text-left rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                <div>
                  <p className="font-medium">{translate(item.label)}</p>
                  <p className="text-xs text-gray-500">{translate(item.description)}</p>
                </div>
              </button>
            );
          })}
        </nav>
      </motion.div>
    </>
  );
};

export default Sidebar;
