import React, { useState, useEffect } from 'react';
import './Charts.css';

const Charts = ({ data, type }) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [activeChart, setActiveChart] = useState('monthly');

  useEffect(() => {
    if (data) {
      setChartData(data);
    } else {
      loadChartData();
    }
  }, [data]);

  const loadChartData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/charts/trends');
      if (response.ok) {
        const result = await response.json();
        setChartData(result.trend_data || []);
      }
    } catch (error) {
      console.error('Chart data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderInteractiveLineChart = (data) => {
    if (!data || data.length === 0) return null;

    // Process data for monthly chart
    const months = data.map(item => item.month_name || item.month);
    const levels = data.map(item => item.average_level || item.level);
    
    const maxLevel = Math.max(...levels);
    const minLevel = Math.min(...levels);
    const range = maxLevel - minLevel || 1;

    const chartWidth = 600;
    const chartHeight = 300;
    const padding = 60;

    return (
      <div className="interactive-chart-container">
        <div className="chart-header">
          <h3>📈 Interactive Water Level Analysis</h3>
          <div className="chart-type-selector">
            <button 
              className={activeChart === 'monthly' ? 'active' : ''}
              onClick={() => setActiveChart('monthly')}
            >
              Monthly Trends
            </button>
            <button 
              className={activeChart === 'seasonal' ? 'active' : ''}
              onClick={() => setActiveChart('seasonal')}
            >
              Seasonal Pattern
            </button>
          </div>
        </div>
        
        <div className="chart-wrapper">
          <svg 
            viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
            className="interactive-chart-svg"
            onMouseLeave={() => setHoveredPoint(null)}
          >
            {/* Grid lines */}
            {[0, 1, 2, 3, 4].map(i => (
              <g key={i}>
                <line
                  x1={padding}
                  y1={padding + (i * (chartHeight - 2 * padding) / 4)}
                  x2={chartWidth - padding}
                  y2={padding + (i * (chartHeight - 2 * padding) / 4)}
                  stroke="#e9ecef"
                  strokeWidth="1"
                  strokeDasharray="5,5"
                />
                <text
                  x={padding - 10}
                  y={padding + (i * (chartHeight - 2 * padding) / 4) + 5}
                  textAnchor="end"
                  className="chart-axis-label"
                >
                  {(maxLevel - (i * range / 4)).toFixed(1)}m
                </text>
              </g>
            ))}
            
            {/* X-axis labels */}
            {months.slice(0, 6).map((month, index) => (
              <text
                key={index}
                x={padding + (index * (chartWidth - 2 * padding) / 5)}
                y={chartHeight - padding + 20}
                textAnchor="middle"
                className="chart-axis-label"
              >
                {month}
              </text>
            ))}
            
            {/* Data line with gradient */}
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#667eea" />
                <stop offset="100%" stopColor="#764ba2" />
              </linearGradient>
              <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#667eea" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#667eea" stopOpacity="0" />
              </linearGradient>
            </defs>
            
            {/* Area under curve */}
            <path
              d={`M ${padding} ${chartHeight - padding} ${levels.slice(0, 6).map((level, index) => {
                const x = padding + (index * (chartWidth - 2 * padding) / 5);
                const y = chartHeight - padding - ((level - minLevel) / range) * (chartHeight - 2 * padding);
                return `L ${x} ${y}`;
              }).join(' ')} L ${padding + (5 * (chartWidth - 2 * padding) / 5)} ${chartHeight - padding} Z`}
              fill="url(#areaGradient)"
            />
            
            {/* Main data line */}
            <polyline
              points={levels.slice(0, 6).map((level, index) => {
                const x = padding + (index * (chartWidth - 2 * padding) / 5);
                const y = chartHeight - padding - ((level - minLevel) / range) * (chartHeight - 2 * padding);
                return `${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            
            {/* Interactive data points */}
            {levels.slice(0, 6).map((level, index) => {
              const x = padding + (index * (chartWidth - 2 * padding) / 5);
              const y = chartHeight - padding - ((level - minLevel) / range) * (chartHeight - 2 * padding);
              const isHovered = hoveredPoint === index;
              
              return (
                <g key={index}>
                  {/* Hover area */}
                  <circle
                    cx={x}
                    cy={y}
                    r={20}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint(index)}
                  />
                  
                  {/* Data point */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? 8 : 6}
                    fill={isHovered ? "#764ba2" : "#667eea"}
                    stroke="white"
                    strokeWidth="3"
                    className="data-point"
                    style={{ 
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      filter: isHovered ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' : 'none'
                    }}
                  />
                  
                  {/* Hover tooltip */}
                  {isHovered && (
                    <g>
                      <rect
                        x={x - 60}
                        y={y - 80}
                        width="120"
                        height="60"
                        rx="8"
                        fill="rgba(0, 0, 0, 0.9)"
                        stroke="rgba(255, 255, 255, 0.2)"
                      />
                      <text
                        x={x}
                        y={y - 55}
                        textAnchor="middle"
                        fill="white"
                        fontSize="12"
                        fontWeight="600"
                      >
                        {months[index]}
                      </text>
                      <text
                        x={x}
                        y={y - 40}
                        textAnchor="middle"
                        fill="#67eea"
                        fontSize="14"
                        fontWeight="700"
                      >
                        {level.toFixed(1)}m
                      </text>
                      <text
                        x={x}
                        y={y - 25}
                        textAnchor="middle"
                        fill="#ccc"
                        fontSize="10"
                      >
                        Water Level
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
          
          {/* Chart Legend */}
          <div className="chart-legend">
            <div className="legend-item">
              <div className="legend-color" style={{ background: 'linear-gradient(90deg, #667eea, #764ba2)' }}></div>
              <span>Average Water Level (meters)</span>
            </div>
            <div className="legend-stats">
              <span>Max: {maxLevel.toFixed(1)}m</span>
              <span>Min: {minLevel.toFixed(1)}m</span>
              <span>Range: {range.toFixed(1)}m</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStateComparisonChart = () => {
    const stateData = [
      { name: 'Maharashtra', level: 12.1, status: 'moderate' },
      { name: 'Gujarat', level: 16.6, status: 'good' },
      { name: 'Rajasthan', level: 25.5, status: 'poor' },
      { name: 'Karnataka', level: 17.9, status: 'good' },
      { name: 'Tamil Nadu', level: 9.3, status: 'critical' },
    ];

    const maxLevel = Math.max(...stateData.map(s => s.level));

    return (
      <div className="state-comparison-chart">
        <h3>🗺️ State-wise Water Level Comparison</h3>
        <div className="bar-chart-container">
          {stateData.map((state, index) => (
            <div 
              key={index} 
              className="bar-item"
              onMouseEnter={() => setHoveredPoint(`state-${index}`)}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <div className="bar-container">
                <div 
                  className={`bar ${state.status}`}
                  style={{ 
                    height: `${(state.level / maxLevel) * 200}px`,
                    transform: hoveredPoint === `state-${index}` ? 'scaleY(1.1)' : 'scaleY(1)'
                  }}
                >
                  {hoveredPoint === `state-${index}` && (
                    <div className="bar-tooltip">
                      <div className="tooltip-content">
                        <strong>{state.name}</strong>
                        <span>{state.level}m depth</span>
                        <span className={`status ${state.status}`}>{state.status}</span>
                      </div>
                    </div>
                  )}
                </div>
                <span className="bar-value">{state.level}m</span>
              </div>
              <span className="bar-label">{state.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTrendAnalysisChart = () => {
    const trendData = [
      { category: 'Improving', count: 6, color: '#28a745' },
      { category: 'Stable', count: 8, color: '#007bff' },
      { category: 'Declining', count: 4, color: '#dc3545' },
    ];

    const total = trendData.reduce((sum, item) => sum + item.count, 0);
    let cumulativePercentage = 0;

    return (
      <div className="trend-analysis-chart">
        <h3>📊 Trend Distribution Analysis</h3>
        <div className="donut-chart-container">
          <svg viewBox="0 0 200 200" className="donut-chart">
            {trendData.map((item, index) => {
              const percentage = (item.count / total) * 100;
              const startAngle = (cumulativePercentage / 100) * 360;
              const endAngle = ((cumulativePercentage + percentage) / 100) * 360;
              
              const startAngleRad = (startAngle - 90) * (Math.PI / 180);
              const endAngleRad = (endAngle - 90) * (Math.PI / 180);
              
              const largeArcFlag = percentage > 50 ? 1 : 0;
              
              const x1 = 100 + 70 * Math.cos(startAngleRad);
              const y1 = 100 + 70 * Math.sin(startAngleRad);
              const x2 = 100 + 70 * Math.cos(endAngleRad);
              const y2 = 100 + 70 * Math.sin(endAngleRad);
              
              const pathData = `M 100 100 L ${x1} ${y1} A 70 70 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
              
              cumulativePercentage += percentage;
              
              return (
                <path
                  key={index}
                  d={pathData}
                  fill={item.color}
                  stroke="white"
                  strokeWidth="2"
                  style={{ 
                    cursor: 'pointer',
                    opacity: hoveredPoint === `trend-${index}` ? 0.8 : 1,
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={() => setHoveredPoint(`trend-${index}`)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              );
            })}
            
            {/* Center circle */}
            <circle cx="100" cy="100" r="35" fill="white" stroke="#e9ecef" strokeWidth="2" />
            <text x="100" y="95" textAnchor="middle" className="donut-center-text">Total</text>
            <text x="100" y="110" textAnchor="middle" className="donut-center-number">{total}</text>
          </svg>
          
          <div className="donut-legend">
            {trendData.map((item, index) => (
              <div 
                key={index} 
                className={`donut-legend-item ${hoveredPoint === `trend-${index}` ? 'highlighted' : ''}`}
                onMouseEnter={() => setHoveredPoint(`trend-${index}`)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <div className="legend-dot" style={{ backgroundColor: item.color }}></div>
                <span className="legend-text">{item.category}</span>
                <span className="legend-count">{item.count}</span>
                <span className="legend-percentage">({((item.count / total) * 100).toFixed(1)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="charts-loading-advanced">
        <div className="loading-spinner-charts"></div>
        <p>Loading interactive charts...</p>
      </div>
    );
  }

  return (
    <div className="charts-container-advanced">
      <div className="charts-header">
        <h2>📊 Advanced Analytics Dashboard</h2>
        <p>Interactive data visualization with real-time insights</p>
      </div>
      
      <div className="charts-grid-advanced">
        {type === 'advanced' ? renderInteractiveLineChart(chartData) : (
          <>
            {renderInteractiveLineChart(chartData)}
            {renderStateComparisonChart()}
            {renderTrendAnalysisChart()}
          </>
        )}
      </div>
    </div>
  );
};

export default Charts;
