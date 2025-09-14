import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const SessionContext = createContext();

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

export const SessionProvider = ({ children }) => {
  const [sessionId, setSessionId] = useState(null);
  const [sessionData, setSessionData] = useState({
    startTime: null,
    totalQueries: 0,
    filesUploaded: 0,
    lastActivity: null
  });
  const [sessionStats, setSessionStats] = useState(null);

  useEffect(() => {
    initializeSession();
    
    // Update session activity periodically
    const interval = setInterval(updateSessionStats, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const initializeSession = () => {
    // Check for existing session in localStorage
    let existingSessionId = localStorage.getItem('ingres-session-id');
    let existingSessionData = localStorage.getItem('ingres-session-data');

    if (existingSessionId && existingSessionData) {
      try {
        const parsedData = JSON.parse(existingSessionData);
        // Check if session is still valid (less than 24 hours old)
        const sessionAge = Date.now() - new Date(parsedData.startTime).getTime();
        if (sessionAge < 24 * 60 * 60 * 1000) { // 24 hours
          setSessionId(existingSessionId);
          setSessionData({
            ...parsedData,
            lastActivity: new Date()
          });
          updateSessionStats();
          return;
        }
      } catch (error) {
        console.warn('Failed to parse existing session data:', error);
      }
    }

    // Create new session
    createNewSession();
  };

  const createNewSession = () => {
    const newSessionId = uuidv4();
    const newSessionData = {
      startTime: new Date(),
      totalQueries: 0,
      filesUploaded: 0,
      lastActivity: new Date()
    };

    setSessionId(newSessionId);
    setSessionData(newSessionData);
    
    // Save to localStorage
    localStorage.setItem('ingres-session-id', newSessionId);
    localStorage.setItem('ingres-session-data', JSON.stringify(newSessionData));
    
    updateSessionStats();
  };

  const updateSessionStats = () => {
    if (!sessionData.startTime) return;

    const now = new Date();
    const startTime = new Date(sessionData.startTime);
    const duration = now.getTime() - startTime.getTime();
    
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    let durationString;
    if (hours > 0) {
      durationString = `${hours}h ${minutes}m`;
    } else {
      durationString = `${minutes}m`;
    }

    setSessionStats({
      sessionDuration: durationString,
      totalQueries: sessionData.totalQueries,
      filesUploaded: sessionData.filesUploaded,
      lastActivity: sessionData.lastActivity
    });
  };

  const incrementQueries = () => {
    const updatedData = {
      ...sessionData,
      totalQueries: sessionData.totalQueries + 1,
      lastActivity: new Date()
    };
    
    setSessionData(updatedData);
    localStorage.setItem('ingres-session-data', JSON.stringify(updatedData));
    updateSessionStats();
  };

  const incrementFilesUploaded = () => {
    const updatedData = {
      ...sessionData,
      filesUploaded: sessionData.filesUploaded + 1,
      lastActivity: new Date()
    };
    
    setSessionData(updatedData);
    localStorage.setItem('ingres-session-data', JSON.stringify(updatedData));
    updateSessionStats();
  };

  const updateLastActivity = () => {
    const updatedData = {
      ...sessionData,
      lastActivity: new Date()
    };
    
    setSessionData(updatedData);
    localStorage.setItem('ingres-session-data', JSON.stringify(updatedData));
  };

  const endSession = () => {
    localStorage.removeItem('ingres-session-id');
    localStorage.removeItem('ingres-session-data');
    setSessionId(null);
    setSessionData({
      startTime: null,
      totalQueries: 0,
      filesUploaded: 0,
      lastActivity: null
    });
    setSessionStats(null);
  };

  const value = {
    sessionId,
    sessionData,
    sessionStats,
    createNewSession,
    incrementQueries,
    incrementFilesUploaded,
    updateLastActivity,
    endSession
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};
