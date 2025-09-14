import { useState, useCallback } from 'react';
import { useMCP } from './useMCP';
import { toast } from 'react-toastify';

export const useCharts = () => {
  const [charts, setCharts] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const { callTool } = useMCP();

  const createChart = useCallback(async (data, options = {}) => {
    const {
      chartType = 'bar',
      title = 'Chart',
      xField = null,
      yField = null
    } = options;

    if (!data || data.length === 0) {
      toast.error('No data provided for chart creation');
      return null;
    }

    setIsCreating(true);

    try {
      const response = await callTool('create_interactive_chart', {
        data,
        chart_type: chartType,
        title,
        x_field: xField,
        y_field: yField
      });

      if (response.success) {
        const newChart = {
          id: Date.now(),
          ...response,
          createdAt: new Date()
        };
        
        setCharts(prev => [...prev, newChart]);
        return newChart;
      } else {
        toast.error('Failed to create chart');
        return null;
      }
    } catch (error) {
      toast.error('Chart creation error');
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [callTool]);

  const createDashboard = useCallback(async (data) => {
    setIsCreating(true);

    try {
      const response = await callTool('create_trend_dashboard', { data });

      if (response.success) {
        const newDashboard = {
          id: Date.now(),
          type: 'dashboard',
          ...response,
          createdAt: new Date()
        };
        
        setCharts(prev => [...prev, newDashboard]);
        return newDashboard;
      } else {
        toast.error('Failed to create dashboard');
        return null;
      }
    } catch (error) {
      toast.error('Dashboard creation error');
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [callTool]);

  const createMap = useCallback(async (data) => {
    setIsCreating(true);

    try {
      const response = await callTool('create_dashboard_map', { data });

      if (response.success) {
        const newMap = {
          id: Date.now(),
          type: 'map',
          ...response,
          createdAt: new Date()
        };
        
        setCharts(prev => [...prev, newMap]);
        return newMap;
      } else {
        toast.error('Failed to create map');
        return null;
      }
    } catch (error) {
      toast.error('Map creation error');
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [callTool]);

  const deleteChart = useCallback((chartId) => {
    setCharts(prev => prev.filter(chart => chart.id !== chartId));
  }, []);

  const clearCharts = useCallback(() => {
    setCharts([]);
  }, []);

  return {
    charts,
    isCreating,
    createChart,
    createDashboard,
    createMap,
    deleteChart,
    clearCharts
  };
};

export default useCharts;
