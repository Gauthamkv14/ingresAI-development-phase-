import React, { useState, useEffect } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-dist-min';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  TrendingUp, 
  Download,
  Settings,
  RefreshCw
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useMCP } from '../contexts/MCPContext';
import { toast } from 'react-toastify';

const Plot = createPlotlyComponent(Plotly);

const Charts = ({ data = [], onCreateChart }) => {
  const [chartType, setChartType] = useState('bar');
  const [selectedXField, setSelectedXField] = useState('');
  const [selectedYField, setSelectedYField] = useState('');
  const [groupByField, setGroupByField] = useState('');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const { translate } = useLanguage();
  const { callTool } = useMCP();

  // Get available fields from data
  const availableFields = data.length > 0 ? Object.keys(data[0]) : [];
  const numericFields = availableFields.filter(field => {
    return data.some(item => typeof item[field] === 'number' && !isNaN(item[field]));
  });
  const categoricalFields = availableFields.filter(field => {
    return data.some(item => typeof item[field] === 'string' || typeof item[field] === 'number');
  });

  useEffect(() => {
    if (data.length > 0 && !selectedXField) {
      // Auto-select reasonable defaults
      const defaultX = categoricalFields.find(field => 
        ['state', 'district', 'category', 'year'].includes(field)
      ) || categoricalFields[0];
      
      const defaultY = numericFields.find(field => 
        ['water_level', 'extraction', 'recharge'].includes(field)
      ) || numericFields[0];

      setSelectedXField(defaultX || '');
      setSelectedYField(defaultY || '');
    }
  }, [data]);

  useEffect(() => {
    if (selectedXField && selectedYField && data.length > 0) {
      generateChartData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, selectedXField, selectedYField, groupByField, data]);

  const generateChartData = () => {
    if (!selectedXField || !selectedYField || data.length === 0) return;

    setLoading(true);
    try {
      let processedData = [...data].filter(item => 
        item[selectedXField] !== null && 
        item[selectedXField] !== undefined &&
        item[selectedYField] !== null && 
        item[selectedYField] !== undefined
      );

      if (groupByField) {
        // Group data by the specified field
        const grouped = processedData.reduce((acc, item) => {
          const groupKey = item[groupByField];
          if (!acc[groupKey]) acc[groupKey] = [];
          acc[groupKey].push(item);
          return acc;
        }, {});

        const traces = Object.keys(grouped).map(groupKey => {
          const groupData = grouped[groupKey];
          
          if (chartType === 'bar') {
            const xValues = groupData.map(item => item[selectedXField]);
            const yValues = groupData.map(item => item[selectedYField]);
            
            return {
              x: xValues,
              y: yValues,
              name: groupKey,
              type: 'bar',
              hovertemplate: `<b>${selectedXField}:</b> %{x}<br>` +
                           `<b>${selectedYField}:</b> %{y}<br>` +
                           `<b>${groupByField}:</b> ${groupKey}<extra></extra>`
            };
          } else if (chartType === 'line') {
            const xValues = groupData.map(item => item[selectedXField]);
            const yValues = groupData.map(item => item[selectedYField]);
            
            return {
              x: xValues,
              y: yValues,
              name: groupKey,
              type: 'scatter',
              mode: 'lines+markers',
              hovertemplate: `<b>${selectedXField}:</b> %{x}<br>` +
                           `<b>${selectedYField}:</b> %{y}<br>` +
                           `<b>${groupByField}:</b> ${groupKey}<extra></extra>`
            };
          }
          return null;
        }).filter(Boolean);

        setChartData({
          data: traces,
          layout: {
            title: `${selectedYField} by ${selectedXField} (grouped by ${groupByField})`,
            xaxis: { title: selectedXField },
            yaxis: { title: selectedYField },
            hovermode: 'closest'
          }
        });
      } else {
        // Single trace
        if (chartType === 'bar') {
          // Aggregate data for bar chart
          const aggregated = processedData.reduce((acc, item) => {
            const key = item[selectedXField];
            if (!acc[key]) {
              acc[key] = { sum: 0, count: 0, items: [] };
            }
            acc[key].sum += parseFloat(item[selectedYField]) || 0;
            acc[key].count += 1;
            acc[key].items.push(item);
            return acc;
          }, {});

          const xValues = Object.keys(aggregated);
          const yValues = xValues.map(key => aggregated[key].sum / aggregated[key].count);
          
          setChartData({
            data: [{
              x: xValues,
              y: yValues,
              type: 'bar',
              marker: {
                color: '#3B82F6',
                opacity: 0.8
              },
              hovertemplate: `<b>${selectedXField}:</b> %{x}<br>` +
                           `<b>Average ${selectedYField}:</b> %{y:.2f}<br>` +
                           `<b>Data Points:</b> ${xValues.map(key => aggregated[key].count).join(', ')}<extra></extra>`
            }],
            layout: {
              title: `Average ${selectedYField} by ${selectedXField}`,
              xaxis: { title: selectedXField },
              yaxis: { title: `Average ${selectedYField}` },
              hovermode: 'closest'
            }
          });
        } else if (chartType === 'line') {
          const xValues = processedData.map(item => item[selectedXField]);
          const yValues = processedData.map(item => item[selectedYField]);
          
          setChartData({
            data: [{
              x: xValues,
              y: yValues,
              type: 'scatter',
              mode: 'lines+markers',
              marker: { color: '#3B82F6' },
              line: { color: '#3B82F6' },
              hovertemplate: `<b>${selectedXField}:</b> %{x}<br>` +
                           `<b>${selectedYField}:</b> %{y}<extra></extra>`
            }],
            layout: {
              title: `${selectedYField} vs ${selectedXField}`,
              xaxis: { title: selectedXField },
              yaxis: { title: selectedYField },
              hovermode: 'closest'
            }
          });
        } else if (chartType === 'scatter') {
          const xValues = processedData.map(item => item[selectedXField]);
          const yValues = processedData.map(item => item[selectedYField]);
          const textValues = processedData.map(item => 
            `${item.district || ''} ${item.state || ''}`
          );
          
          setChartData({
            data: [{
              x: xValues,
              y: yValues,
              text: textValues,
              type: 'scatter',
              mode: 'markers',
              marker: { 
                color: '#3B82F6',
                size: 8,
                opacity: 0.7
              },
              hovertemplate: `<b>${selectedXField}:</b> %{x}<br>` +
                           `<b>${selectedYField}:</b> %{y}<br>` +
                           `<b>Location:</b> %{text}<extra></extra>`
            }],
            layout: {
              title: `${selectedYField} vs ${selectedXField}`,
              xaxis: { title: selectedXField },
              yaxis: { title: selectedYField },
              hovermode: 'closest'
            }
          });
        } else if (chartType === 'pie') {
          // For pie chart, use categorical field for labels
          const categoryField = categoricalFields.includes(selectedXField) ? selectedXField : 'category';
          const counts = processedData.reduce((acc, item) => {
            const key = item[categoryField] || 'Unknown';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {});

          const labels = Object.keys(counts);
          const values = Object.values(counts);
          
          setChartData({
            data: [{
              labels: labels,
              values: values,
              type: 'pie',
              hovertemplate: `<b>%{label}:</b> %{value} records<br>` +
                           `<b>Percentage:</b> %{percent}<extra></extra>`
            }],
            layout: {
              title: `Distribution of ${categoryField}`,
              hovermode: 'closest'
            }
          });
        }
      }
    } catch (error) {
      console.error('Chart generation error:', error);
      toast.error('Failed to generate chart');
    } finally {
      setLoading(false);
    }
  };

  const handlePlotHover = (event) => {
    if (event.points && event.points.length > 0) {
      const point = event.points[0];
      setHoveredPoint({
        x: point.x,
        y: point.y,
        data: point.data,
        pointIndex: point.pointIndex
      });
    }
  };

  const handlePlotUnhover = () => {
    setHoveredPoint(null);
  };

  const exportChart = () => {
    if (chartData) {
      // Use Plotly's built-in export functionality
      const element = document.querySelector('.js-plotly-plot');
      if (element) {
        try {
          Plotly.downloadImage(element, {
            format: 'png',
            width: 1200,
            height: 800,
            filename: `ingres_chart_${chartType}_${Date.now()}`
          });
          toast.success('Chart exported successfully');
        } catch (error) {
          console.error('Export failed', error);
          toast.error('Failed to export chart');
        }
      } else {
        toast.error('Plot element not found');
      }
    }
  };

  const chartTypeOptions = [
    { value: 'bar', label: 'Bar Chart', icon: BarChart3 },
    { value: 'line', label: 'Line Chart', icon: LineChart },
    { value: 'scatter', label: 'Scatter Plot', icon: TrendingUp },
    { value: 'pie', label: 'Pie Chart', icon: PieChart }
  ];

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <BarChart3 className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg mb-2">{translate('No data available for charts')}</p>
        <p className="text-sm">{translate('Load some groundwater data to create visualizations')}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow">
      {/* Chart Controls */}
      <div className="p-4 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Chart Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {translate('Chart Type')}
            </label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {chartTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {translate(option.label)}
                </option>
              ))}
            </select>
          </div>

          {/* X-Axis Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {translate('X-Axis')}
            </label>
            <select
              value={selectedXField}
              onChange={(e) => setSelectedXField(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">{translate('Select field')}</option>
              {categoricalFields.map(field => (
                <option key={field} value={field}>
                  {field.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Y-Axis Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {translate('Y-Axis')}
            </label>
            <select
              value={selectedYField}
              onChange={(e) => setSelectedYField(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">{translate('Select field')}</option>
              {numericFields.map(field => (
                <option key={field} value={field}>
                  {field.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Group By Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {translate('Group By')} ({translate('Optional')})
            </label>
            <select
              value={groupByField}
              onChange={(e) => setGroupByField(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">{translate('No grouping')}</option>
              {categoricalFields.map(field => (
                <option key={field} value={field}>
                  {field.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-end gap-2">
            <button
              onClick={generateChartData}
              disabled={loading || !selectedXField || !selectedYField}
              className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {translate('Update')}
            </button>
            
            <button
              onClick={exportChart}
              disabled={!chartData}
              className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              {translate('Export')}
            </button>
          </div>
        </div>
      </div>

      {/* Chart Display */}
      <div className="flex-1 p-4">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        )}
        
        {chartData && !loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            <Plot
              data={chartData.data}
              layout={{
                ...chartData.layout,
                autosize: true,
                margin: { l: 60, r: 30, t: 60, b: 60 },
                font: { family: 'Inter, system-ui, sans-serif' },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                hovermode: 'closest'
              }}
              config={{
                displayModeBar: true,
                displaylogo: false,
                modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
                responsive: true
              }}
              style={{ width: '100%', height: '100%' }}
              onHover={handlePlotHover}
              onUnhover={handlePlotUnhover}
            />
          </motion.div>
        )}

        {!chartData && !loading && selectedXField && selectedYField && (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>{translate('Click "Update" to generate the chart')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Hover Details Panel */}
      {hoveredPoint && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border border-gray-200 max-w-sm"
        >
          <h4 className="font-semibold text-gray-900 mb-2">
            {translate('Data Point Details')}
          </h4>
          <div className="text-sm space-y-1">
            <div><strong>{selectedXField}:</strong> {hoveredPoint.x}</div>
            <div><strong>{selectedYField}:</strong> {hoveredPoint.y}</div>
            {groupByField && (
              <div><strong>{groupByField}:</strong> {hoveredPoint.data.name}</div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Charts;
