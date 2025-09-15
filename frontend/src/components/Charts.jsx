// frontend/src/components/Charts.jsx
import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
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

const Charts = ({ data = [], onCreateChart }) => {
  const [chartType, setChartType] = useState('bar');
  const [selectedXField, setSelectedXField] = useState('');
  const [selectedYField, setSelectedYField] = useState('');
  const [groupByField, setGroupByField] = useState('');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const { translate } = useLanguage?.() || { translate: (s) => s };
  const { callTool } = useMCP?.() || {};

  // fields detection
  const availableFields = data.length > 0 ? Object.keys(data[0]) : [];
  const numericFields = availableFields.filter(field =>
    data.some(item => !isNaN(parseFloat(item[field])) && item[field] !== '')
  );
  const categoricalFields = availableFields.filter(field =>
    data.some(item => item[field] !== null && item[field] !== undefined)
  );

  useEffect(() => {
    if (data.length > 0 && !selectedXField) {
      const defaultX = categoricalFields.find(f => ['state', 'district', 'category', 'year'].includes(f)) || categoricalFields[0];
      const defaultY = numericFields.find(f => ['level', 'water_level', 'extraction', 'recharge'].includes(f)) || numericFields[0];
      setSelectedXField(defaultX || '');
      setSelectedYField(defaultY || '');
    }
  }, [data]);

  useEffect(() => {
    if (selectedXField && selectedYField && data.length > 0) generateChartData();
  }, [chartType, selectedXField, selectedYField, groupByField, data]);

  const generateChartData = () => {
    if (!selectedXField || !selectedYField || data.length === 0) return;
    setLoading(true);

    try {
      const processedData = data.filter(item =>
        item[selectedXField] !== null && item[selectedXField] !== undefined &&
        item[selectedYField] !== null && item[selectedYField] !== undefined
      );

      if (groupByField) {
        const grouped = processedData.reduce((acc, item) => {
          const g = item[groupByField] ?? 'Unknown';
          if (!acc[g]) acc[g] = [];
          acc[g].push(item);
          return acc;
        }, {});

        const traces = Object.keys(grouped).map(gk => {
          const group = grouped[gk];
          const x = group.map(it => it[selectedXField]);
          const y = group.map(it => Number(it[selectedYField]));
          if (chartType === 'line') {
            return { x, y, name: gk, type: 'scatter', mode: 'lines+markers' };
          }
          return { x, y, name: gk, type: 'bar' };
        });

        setChartData({
          data: traces,
          layout: {
            title: `${selectedYField} by ${selectedXField} (grouped)`,
            xaxis: { title: selectedXField },
            yaxis: { title: selectedYField },
            hovermode: 'closest'
          }
        });
      } else {
        if (chartType === 'bar') {
          // aggregate average by x
          const agg = processedData.reduce((acc, it) => {
            const k = it[selectedXField] ?? 'Unknown';
            if (!acc[k]) acc[k] = { sum: 0, count: 0 };
            acc[k].sum += Number(it[selectedYField]) || 0;
            acc[k].count += 1;
            return acc;
          }, {});
          const x = Object.keys(agg);
          const y = x.map(k => agg[k].sum / agg[k].count);
          setChartData({
            data: [{ x, y, type: 'bar', marker: { opacity: 0.85 } }],
            layout: { title: `Average ${selectedYField} by ${selectedXField}`, xaxis: { title: selectedXField }, yaxis: { title: `Average ${selectedYField}` }, hovermode: 'closest' }
          });
        } else if (chartType === 'line') {
          const x = processedData.map(it => it[selectedXField]);
          const y = processedData.map(it => Number(it[selectedYField]));
          setChartData({
            data: [{ x, y, type: 'scatter', mode: 'lines+markers' }],
            layout: { title: `${selectedYField} vs ${selectedXField}`, xaxis: { title: selectedXField }, yaxis: { title: selectedYField }, hovermode: 'closest' }
          });
        } else if (chartType === 'scatter') {
          const x = processedData.map(it => it[selectedXField]);
          const y = processedData.map(it => Number(it[selectedYField]));
          const text = processedData.map(it => `${it.district || ''} ${it.state || ''}`);
          setChartData({
            data: [{ x, y, text, mode: 'markers', type: 'scatter', marker: { size: 7, opacity: 0.8 } }],
            layout: { title: `${selectedYField} vs ${selectedXField}`, xaxis: { title: selectedXField }, yaxis: { title: selectedYField }, hovermode: 'closest' }
          });
        } else if (chartType === 'pie') {
          const category = categoricalFields.includes(selectedXField) ? selectedXField : categoricalFields[0] ?? 'category';
          const counts = processedData.reduce((acc, it) => { const k = it[category] ?? 'Unknown'; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
          setChartData({
            data: [{ labels: Object.keys(counts), values: Object.values(counts), type: 'pie' }],
            layout: { title: `Distribution of ${category}`, hovermode: 'closest' }
          });
        }
      }
    } catch (err) {
      console.error('generateChartData', err);
      toast.error('Chart generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePlotHover = (event) => {
    if (event.points && event.points.length > 0) {
      const p = event.points[0];
      setHoveredPoint({ x: p.x, y: p.y, data: p.data, pointIndex: p.pointIndex });
    }
  };

  const handlePlotUnhover = () => setHoveredPoint(null);

  const exportChart = () => {
    // Use Plotly.toImage (works in production bundle)
    const el = document.querySelector('.js-plotly-plot');
    if (!el) return toast.error('Nothing to export');
    Plotly.toImage(el, { format: 'png', width: 1200, height: 800 })
      .then((dataUrl) => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `ingres_chart_${chartType}_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success('Chart exported');
      })
      .catch((err) => {
        console.error('Export failed', err);
        toast.error('Export failed');
      });
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
        <p className="text-lg mb-2">No data available for charts</p>
        <p className="text-sm">Load some groundwater data to create visualizations</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Chart Type</label>
            <select value={chartType} onChange={(e) => setChartType(e.target.value)} className="w-full px-3 py-2 border rounded">
              {chartTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">X-Axis</label>
            <select value={selectedXField} onChange={(e) => setSelectedXField(e.target.value)} className="w-full px-3 py-2 border rounded">
              <option value="">Select field</option>
              {categoricalFields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Y-Axis</label>
            <select value={selectedYField} onChange={(e) => setSelectedYField(e.target.value)} className="w-full px-3 py-2 border rounded">
              <option value="">Select field</option>
              {numericFields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Group By (optional)</label>
            <select value={groupByField} onChange={(e) => setGroupByField(e.target.value)} className="w-full px-3 py-2 border rounded">
              <option value="">No grouping</option>
              {categoricalFields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button onClick={generateChartData} disabled={!selectedXField || !selectedYField} className="px-3 py-2 rounded bg-primary-600 text-white">Update</button>
            <button onClick={exportChart} disabled={!chartData} className="px-3 py-2 rounded bg-gray-600 text-white">Export</button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4">
        {loading && (
          <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 animate-spin" /></div>
        )}

        {chartData && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
            <Plot
              data={chartData.data}
              layout={{ ...chartData.layout, autosize: true, margin: { l: 60, r: 30, t: 60, b: 60 } }}
              config={{ displayModeBar: true, displaylogo: false, responsive: true }}
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
              <p>Click "Update" to generate the chart</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Charts;
