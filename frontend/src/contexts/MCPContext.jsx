import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useSession } from './SessionContext';

const MCPContext = createContext();

export const useMCP = () => {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error('useMCP must be used within an MCPProvider');
  }
  return context;
};

export const MCPProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState({
    server: 'unknown',
    database: 'unknown',
    apis: 'unknown'
  });

  const { incrementQueries, updateLastActivity } = useSession();

  useEffect(() => {
    checkServerHealth();
    
    // Check server health every 5 minutes
    const interval = setInterval(checkServerHealth, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const checkServerHealth = async () => {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setIsConnected(true);
        setServerStatus({
          server: 'online',
          database: 'connected', 
          apis: 'active'
        });
      } else {
        throw new Error('Server health check failed');
      }
    } catch (error) {
      setIsConnected(false);
      setServerStatus({
        server: 'offline',
        database: 'disconnected',
        apis: 'inactive'
      });
      console.warn('Server health check failed:', error);
    }
  };

  const callTool = async (toolName, parameters = {}) => {
    setIsLoading(true);
    updateLastActivity();

    try {
      const response = await fetch('/api/mcp/call-tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: toolName,
          parameters: parameters
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Increment query counter for statistical purposes
      incrementQueries();
      
      return data;
    } catch (error) {
      console.error(`MCP Tool call failed for ${toolName}:`, error);
      toast.error(`Failed to execute ${toolName}: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        tool: toolName
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Specialized helper methods for common operations
  const getGroundwaterData = async (filters = {}) => {
    return await callTool('get_groundwater_levels', filters);
  };

  const searchData = async (query, filters = {}) => {
    return await callTool('search_comprehensive_data', { query, filters });
  };

  const queryRAG = async (question, sessionId, language = 'en') => {
    return await callTool('rag_query', { question, session_id: sessionId, language });
  };

  const predictWaterLevels = async (state, district, months = 6) => {
    return await callTool('predict_water_levels', { 
      state, 
      district, 
      prediction_months: months 
    });
  };

  const createChart = async (data, chartType = 'bar', title = 'Chart') => {
    return await callTool('create_interactive_chart', {
      data,
      chart_type: chartType,
      title
    });
  };

  const uploadFile = async (fileContent, filename, userInfo = '') => {
    return await callTool('upload_csv_data', {
      file_content: fileContent,
      filename,
      user_info: userInfo
    });
  };

  const downloadData = async (filters = {}, format = 'csv') => {
    return await callTool('download_data', { filters, format });
  };

  const translateText = async (text, targetLanguage, sourceLanguage = 'en') => {
    return await callTool('translate_text', {
      text,
      target_language: targetLanguage,
      source_language: sourceLanguage
    });
  };

  const analyzeTrends = async (region = null, years = 5) => {
    return await callTool('analyze_trends', { region, years });
  };

  const trainModel = async (region = null) => {
    return await callTool('train_prediction_model', { region });
  };

  // Batch operations
  const batchCallTools = async (toolCalls) => {
    const results = [];
    
    for (const { tool, parameters } of toolCalls) {
      try {
        const result = await callTool(tool, parameters);
        results.push({ tool, success: true, result });
      } catch (error) {
        results.push({ tool, success: false, error: error.message });
      }
    }
    
    return results;
  };

  // Connection management
  const reconnect = async () => {
    setIsLoading(true);
    try {
      await checkServerHealth();
      if (isConnected) {
        toast.success('Reconnected to server');
      } else {
        toast.error('Failed to reconnect to server');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    // Connection state
    isConnected,
    isLoading,
    serverStatus,
    
    // Core methods
    callTool,
    checkServerHealth,
    reconnect,
    batchCallTools,
    
    // Helper methods for common operations
    getGroundwaterData,
    searchData,
    queryRAG,
    predictWaterLevels,
    createChart,
    uploadFile,
    downloadData,
    translateText,
    analyzeTrends,
    trainModel
  };

  return (
    <MCPContext.Provider value={value}>
      {children}
    </MCPContext.Provider>
  );
};
