import React from 'react';
import { motion } from 'framer-motion';

const SuggestedQuestions = ({ suggestions = [], onSuggestionClick }) => {
  if (suggestions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4"
    >
      <p className="text-sm text-gray-600 mb-3 font-medium">
        Suggested questions:
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <motion.button
            key={index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onSuggestionClick(suggestion)}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-primary-100 hover:text-primary-700 transition-colors"
          >
            {suggestion}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default SuggestedQuestions;
