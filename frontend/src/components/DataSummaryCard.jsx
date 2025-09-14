import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

const DataSummaryCard = ({ 
  title, 
  value, 
  icon, 
  color = 'blue', 
  trend = null,
  change = null,
  description = null
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200'
  };

  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
          
          {change && trend && (
            <div className={`flex items-center space-x-1 mt-2 text-sm ${trendColors[trend]}`}>
              {trend === 'up' ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>{change}</span>
            </div>
          )}
        </div>
        
        <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
};

export default DataSummaryCard;
