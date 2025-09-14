import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Bot, 
  Copy, 
  ThumbsUp, 
  ThumbsDown, 
  BarChart3, 
  LineChart,
  Map,
  Download,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const MessageBubble = ({ 
  message, 
  onCreateVisualization, 
  onCopyText, 
  onProvideFeedback 
}) => {
  const [showSources, setShowSources] = useState(false);
  const { translate } = useLanguage();
  
  const isUser = message.type === 'user';
  
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderVisualization = (viz) => {
    return (
      <div className="mt-3 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-gray-900">
            {translate('Data Visualization')}
          </h4>
          <button
            onClick={() => {
              const newWindow = window.open();
              newWindow.document.write(viz.html);
              newWindow.document.close();
            }}
            className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1"
          >
            <ExternalLink className="w-4 h-4" />
            {translate('Open in new tab')}
          </button>
        </div>
        <div 
          className="w-full h-64 border rounded"
          dangerouslySetInnerHTML={{ __html: viz.html }}
        />
      </div>
    );
  };

  const renderSources = (sources) => {
    if (!sources || sources.length === 0) return null;

    return (
      <div className="mt-3">
        <button
          onClick={() => setShowSources(!showSources)}
          className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
        >
          <AlertCircle className="w-4 h-4" />
          {translate('Sources')} ({sources.length})
        </button>
        
        {showSources && (
          <div className="mt-2 space-y-2">
            {sources.map((source, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded text-xs">
                <div className="font-medium text-gray-900 mb-1">
                  {source.source_type || 'Data Source'}
                </div>
                <div className="text-gray-600 mb-2">
                  {source.content_preview}
                </div>
                <div className="text-gray-500 italic">
                  {source.citation}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderConfidenceScore = (confidence) => {
    if (confidence === undefined || confidence === null) return null;
    
    const confidencePercent = Math.round(confidence * 100);
    const confidenceColor = 
      confidence >= 0.8 ? 'text-green-600' :
      confidence >= 0.6 ? 'text-yellow-600' :
      'text-red-600';
    
    return (
      <div className="mt-2 text-xs text-gray-500">
        <span>Confidence: </span>
        <span className={confidenceColor}>{confidencePercent}%</span>
      </div>
    );
  };

  const renderActionButtons = () => {
    if (isUser) return null;

    return (
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => onCopyText(message.content)}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          title={translate('Copy message')}
        >
          <Copy className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => onProvideFeedback(message.id, 'up')}
          className="p-1 text-gray-400 hover:text-green-600 transition-colors"
          title={translate('Helpful')}
        >
          <ThumbsUp className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => onProvideFeedback(message.id, 'down')}
          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
          title={translate('Not helpful')}
        >
          <ThumbsDown className="w-4 h-4" />
        </button>

        {message.data && (
          <>
            <button
              onClick={() => onCreateVisualization(message, 'bar')}
              className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
              title={translate('Create bar chart')}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => onCreateVisualization(message, 'line')}
              className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
              title={translate('Create line chart')}
            >
              <LineChart className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => onCreateVisualization(message, 'map')}
              className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
              title={translate('Show on map')}
            >
              <Map className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    );
  };

  const renderSuggestions = (suggestions) => {
    if (!suggestions || suggestions.length === 0) return null;

    return (
      <div className="mt-3 space-y-2">
        <div className="text-sm text-gray-600 font-medium">
          {translate('Suggested follow-up questions:')}
        </div>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onCreateVisualization && onCreateVisualization(suggestion)}
              className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div className={`max-w-3xl w-full ${isUser ? 'flex-row-reverse' : 'flex-row'} flex gap-3`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 ${isUser ? 'ml-2' : 'mr-2'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-primary-600' : 'bg-gray-600'
          }`}>
            {isUser ? (
              <User className="w-5 h-5 text-white" />
            ) : (
              <Bot className="w-5 h-5 text-white" />
            )}
          </div>
        </div>

        {/* Message Content */}
        <div className={`flex-1 ${isUser ? 'text-right' : 'text-left'}`}>
          <div className={`inline-block max-w-full p-4 rounded-lg ${
            isUser 
              ? 'bg-primary-600 text-white' 
              : message.error 
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-white text-gray-900 border border-gray-200 shadow-sm'
          }`}>
            {/* File Upload Preview */}
            {message.file && (
              <div className="mb-2 p-2 bg-blue-100 rounded text-sm">
                <strong>Uploaded file:</strong> {message.file.name}
              </div>
            )}

            {/* Message Content */}
            <div className="whitespace-pre-wrap">{message.content}</div>
            
            {/* Visualization */}
            {message.visualization && renderVisualization(message.visualization)}
            
            {/* Citation */}
            {message.citation && (
              <div className="mt-2 pt-2 border-t border-gray-200 text-xs italic text-gray-600">
                {message.citation}
              </div>
            )}
            
            {/* Confidence Score */}
            {renderConfidenceScore(message.confidence)}
            
            {/* Timestamp */}
            <div className={`text-xs mt-2 ${
              isUser ? 'text-primary-200' : 'text-gray-500'
            }`}>
              {formatTimestamp(message.timestamp)}
            </div>
          </div>

          {/* Sources (outside bubble for bot messages) */}
          {!isUser && renderSources(message.sources)}
          
          {/* Action Buttons */}
          {renderActionButtons()}
          
          {/* Suggestions */}
          {!isUser && renderSuggestions(message.suggestions)}
        </div>
      </div>
    </motion.div>
  );
};

export default MessageBubble;
