import { useContext } from 'react';
import { MCPContext } from '../contexts/MCPContext';

// This is just a re-export for convenience
export const useMCP = () => {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error('useMCP must be used within an MCPProvider');
  }
  return context;
};

export default useMCP;
