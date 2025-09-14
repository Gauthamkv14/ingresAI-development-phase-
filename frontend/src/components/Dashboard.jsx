import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, 
  LineChart, 
  MapPin, 
  TrendingUp, 
  TrendingDown,
  Droplets,
  AlertTriangle,
  CheckCircle,
  Upload,
  Download
} from 'lucide-react';
import Charts from './Charts';
import MapVisualization from './MapVisualization';
import FileUpload from './FileUpload';
import DataSummaryCard from './DataSummaryCard';
import { useMCP } from '../contexts/MCPContext';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'react-toastify';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const { callTool } = useMCP();
  const { currentLanguage, translate } = useLanguage();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load initial groundwater data
      const response = await callTool('get_groundwater_levels', {
        year: '2024'
      });
      
      if (response.success) {
        setDashboardData(response);
        
        // Generate summary statistics
        const summaryData = generateSummaryStats(response.data);
        setDashboardData(prev => ({
          ...prev,
          summary: summaryData
        }));
      } else {
        toast.error('Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Dashboard data loading error:', error);
      toast.error('Error loading dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const generateSummaryStats = (data) => {
    if (!data || data.length === 0) return null;

    const validWaterLevels = data.filter(d => d.water_level !== null && d.water_level !== undefined);
    const categoryCount = data.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});

    return {
      totalRecords: data.length,
      averageWaterLevel: validWaterLevels.length > 0 
        ? validWaterLevels.reduce((sum, d) => sum + d.water_level, 0) / validWaterLevels.length 
        : 0,
      statesCount: new Set(data.map(d => d.state)).size,
      districtsCount: new Set(data.map(d => d.district)).size,
      categoryDistribution: categoryCount,
      criticalAreas: data.filter(d => ['Critical', 'Over-Exploited'].includes(d.category)).length,
      safeAreas: data.filter(d => d.category === 'Safe').length
    };
  };

  const handleStateChange = async (state) => {
    setSelectedState(state);
    setSelectedDistrict('');
    
    if (state) {
      try {
        const response = await callTool('get_groundwater_levels', {
          state: state,
          year: '2024'
        });
        
        if (response.success) {
          setDashboardData(response);
        }
      } catch (error) {
        toast.error('Failed to load state data');
      }
    } else {
      loadDashboardData();
    }
  };

  const createVisualization = async (chartType) => {
    if (!dashboardData?.data) {
      toast.warning('No data available for visualization');
      return;
    }

    try {
      const response = await callTool('create_interactive_chart', {
        data: dashboardData.data,
        chart_type: chartType,
        title: `Groundwater ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`,
        x_field: 'district',
        y_field: 'water_level'
      });

      if (response.success) {
        // Open chart in new tab or modal
        const chartWindow = window.open('', '_blank');
        chartWindow.document.write(response.chart_html);
        chartWindow.document.close();
      } else {
        toast.error('Failed to create visualization');
      }
    } catch (error) {
      toast.error('Error creating visualization');
    }
  };

  const exportData = async (format = 'csv') => {
    try {
      const response = await callTool('download_data', {
        filters: selectedState ? { state: selectedState } : {},
        format: format
      });

      if (response.success) {
        // Create download link
        const blob = new Blob([response.content], { 
          type: response.content_type 
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = response.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast.success(`Data exported as ${format.toUpperCase()}`);
      } else {
        toast.error('Failed to export data');
      }
    } catch (error) {
      toast.error('Error exporting data');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const summary = dashboardData?.summary;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Dashboard Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {translate('INGRES Dashboard')}
            </h1>
            <p className="text-gray-600 mt-1">
              {translate('Comprehensive groundwater monitoring and analysis')}
            </p>
          </div>
          
          <div className="flex items-center gap-4 mt-4 lg:mt-0">
            {/* State Selector */}
            <select
              value={selectedState}
              onChange={(e) => handleStateChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">{translate('All States')}</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Gujarat">Gujarat</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Tamil Nadu">Tamil Nadu</option>
              <option value="Rajasthan">Rajasthan</option>
              {/* Add more states */}
            </select>

            {/* Export Button */}
            <button
              onClick={() => exportData('csv')}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              {translate('Export')}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="p-6 bg-white border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <DataSummaryCard
              title={translate('Total Records')}
              value={summary.totalRecords.toLocaleString()}
              icon={<BarChart className="w-6 h-6" />}
              color="blue"
            />
            <DataSummaryCard
              title={translate('Average Water Level')}
              value={`${summary.averageWaterLevel.toFixed(2)}m`}
              icon={<Droplets className="w-6 h-6" />}
              color="cyan"
            />
            <DataSummaryCard
              title={translate('Critical Areas')}
              value={summary.criticalAreas}
              icon={<AlertTriangle className="w-6 h-6" />}
              color="red"
              trend={summary.criticalAreas > summary.safeAreas ? 'down' : 'up'}
            />
            <DataSummaryCard
              title={translate('Safe Areas')}
              value={summary.safeAreas}
              icon={<CheckCircle className="w-6 h-6" />}
              color="green"
              trend="up"
            />
          </div>
        </div>
      )}

      {/* Main Content Tabs */}
      <div className="flex-1 flex flex-col">
        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart },
              { id: 'charts', label: 'Charts', icon: LineChart },
              { id: 'map', label: 'Map View', icon: MapPin },
              { id: 'upload', label: 'Data Upload', icon: Upload }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
                >
                  <Icon className="w-4 h-4" />
                  {translate(tab.label)}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-6">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                {/* Category Distribution */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    {translate('Groundwater Category Distribution')}
                  </h3>
                  {summary?.categoryDistribution && (
                    <div className="space-y-3">
                      {Object.entries(summary.categoryDistribution).map(([category, count]) => (
                        <div key={category} className="flex items-center justify-between">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            category === 'Safe' ? 'bg-green-100 text-green-800' :
                            category === 'Semi-Critical' ? 'bg-yellow-100 text-yellow-800' :
                            category === 'Critical' ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {translate(category)}
                          </span>
                          <span className="text-sm text-gray-600">{count} areas</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    {translate('Quick Actions')}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => createVisualization('bar')}
                      className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <BarChart className="w-8 h-8 text-primary-600 mb-2" />
                      <span className="text-sm font-medium">{translate('Bar Chart')}</span>
                    </button>
                    <button
                      onClick={() => createVisualization('line')}
                      className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <LineChart className="w-8 h-8 text-primary-600 mb-2" />
                      <span className="text-sm font-medium">{translate('Line Chart')}</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('map')}
                      className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <MapPin className="w-8 h-8 text-primary-600 mb-2" />
                      <span className="text-sm font-medium">{translate('Map View')}</span>
                    </button>
                    <button
                      onClick={() => exportData('json')}
                      className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Download className="w-8 h-8 text-primary-600 mb-2" />
                      <span className="text-sm font-medium">{translate('Export JSON')}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'charts' && (
              <Charts 
                data={dashboardData?.data || []}
                onCreateChart={createVisualization}
              />
            )}

            {activeTab === 'map' && (
              <MapVisualization 
                data={dashboardData?.data || []}
              />
            )}

            {activeTab === 'upload' && (
              <FileUpload 
                onUploadSuccess={loadDashboardData}
              />
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
