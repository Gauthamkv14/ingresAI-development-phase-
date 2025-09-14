import React from 'react';
import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';

const TypingIndicator = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start mb-4"
    >
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        
        <div className="bg-white border border-gray-200 shadow-sm rounded-lg px-4 py-3">
          <div className="flex items-center space-x-1">
            <div className="flex space-x-1">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                className="w-2 h-2 bg-gray-400 rounded-full"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                className="w-2 h-2 bg-gray-400 rounded-full"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                className="w-2 h-2 bg-gray-400 rounded-full"
              />
            </div>
            <span className="text-xs text-gray-500 ml-2">AI is thinking...</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TypingIndicator;
