import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import pandas as pd
import numpy as np
import base64
import io
from typing import Dict, Any, List
from config import Config
import logging
import json

class VisualizationTool:
    def __init__(self):
        self.config = Config()
        
    async def create_interactive_chart(self, 
                                     data: List[Dict], 
                                     chart_type: str = "bar",
                                     title: str = "Groundwater Data Visualization",
                                     x_field: str = None,
                                     y_field: str = None) -> Dict[str, Any]:
        """Create interactive charts with hover details"""
        try:
            if not data:
                return {
                    "success": False,
                    "error": "No data provided for visualization"
                }
            
            df = pd.DataFrame(data)
            
            # Auto-detect fields if not provided
            if not x_field:
                x_field = df.select_dtypes(include=['object']).columns[0] if not df.select_dtypes(include=['object']).empty else df.columns[0]
            if not y_field:
                numeric_cols = df.select_dtypes(include=['number']).columns
                y_field = numeric_cols[0] if not numeric_cols.empty else df.columns[1] if len(df.columns) > 1 else df.columns[0]
            
            # Create visualization based on chart type
            if chart_type == "bar":
                fig = self._create_bar_chart(df, x_field, y_field, title)
            elif chart_type == "line":
                fig = self._create_line_chart(df, x_field, y_field, title)
            elif chart_type == "scatter":
                fig = self._create_scatter_plot(df, x_field, y_field, title)
            elif chart_type == "heatmap":
                fig = self._create_heatmap(df, title)
            elif chart_type == "box":
                fig = self._create_box_plot(df, x_field, y_field, title)
            else:
                fig = self._create_bar_chart(df, x_field, y_field, title)
            
            # Enhance with interactive features
            fig = self._add_interactive_features(fig, df)
            
            # Convert to HTML
            html_content = fig.to_html(
                include_plotlyjs='cdn',
                div_id="chart-container",
                config={
                    'displayModeBar': True,
                    'displaylogo': False,
                    'modeBarButtonsToRemove': ['pan2d', 'lasso2d']
                }
            )
            
            return {
                "success": True,
                "chart_type": chart_type,
                "chart_html": html_content,
                "chart_json": json.loads(fig.to_json()),
                "title": title,
                "data_points": len(data),
                "x_field": x_field,
                "y_field": y_field,
                "interactive_features": ["hover_details", "zoom", "pan", "select", "download"]
            }
            
        except Exception as e:
            logging.error(f"Chart creation failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _create_bar_chart(self, df: pd.DataFrame, x_field: str, y_field: str, title: str) -> go.Figure:
        """Create interactive bar chart"""
        fig = px.bar(
            df, 
            x=x_field, 
            y=y_field,
            title=title,
            hover_data=[col for col in df.columns if col not in [x_field, y_field]]
        )
        
        # Customize layout
        fig.update_layout(
            xaxis_title=x_field.replace('_', ' ').title(),
            yaxis_title=y_field.replace('_', ' ').title(),
            hovermode='x unified'
        )
        
        return fig
    
    def _create_line_chart(self, df: pd.DataFrame, x_field: str, y_field: str, title: str) -> go.Figure:
        """Create interactive line chart"""
        fig = px.line(
            df, 
            x=x_field, 
            y=y_field,
            title=title,
            hover_data=[col for col in df.columns if col not in [x_field, y_field]],
            markers=True
        )
        
        fig.update_layout(
            xaxis_title=x_field.replace('_', ' ').title(),
            yaxis_title=y_field.replace('_', ' ').title(),
            hovermode='x unified'
        )
        
        return fig
    
    def _create_scatter_plot(self, df: pd.DataFrame, x_field: str, y_field: str, title: str) -> go.Figure:
        """Create interactive scatter plot"""
        # Use color coding if categorical data available
        color_field = None
        for col in df.columns:
            if col not in [x_field, y_field] and df[col].dtype == 'object':
                color_field = col
                break
        
        fig = px.scatter(
            df,
            x=x_field,
            y=y_field,
            color=color_field,
            title=title,
            hover_data=[col for col in df.columns if col not in [x_field, y_field, color_field]]
        )
        
        fig.update_layout(
            xaxis_title=x_field.replace('_', ' ').title(),
            yaxis_title=y_field.replace('_', ' ').title()
        )
        
        return fig
    
    def _create_heatmap(self, df: pd.DataFrame, title: str) -> go.Figure:
        """Create correlation heatmap for numeric data"""
        numeric_df = df.select_dtypes(include=['number'])
        
        if numeric_df.empty:
            # Fallback to simple heatmap
            fig = go.Figure(data=go.Heatmap(z=[[1]]))
        else:
            correlation_matrix = numeric_df.corr()
            
            fig = go.Figure(data=go.Heatmap(
                z=correlation_matrix.values,
                x=correlation_matrix.columns,
                y=correlation_matrix.columns,
                colorscale='RdBu',
                zmid=0
            ))
        
        fig.update_layout(title=f"{title} - Correlation Matrix")
        return fig
    
    def _create_box_plot(self, df: pd.DataFrame, x_field: str, y_field: str, title: str) -> go.Figure:
        """Create box plot for distribution analysis"""
        fig = px.box(
            df,
            x=x_field,
            y=y_field,
            title=title,
            hover_data=[col for col in df.columns if col not in [x_field, y_field]]
        )
        
        fig.update_layout(
            xaxis_title=x_field.replace('_', ' ').title(),
            yaxis_title=y_field.replace('_', ' ').title()
        )
        
        return fig
    
    def _add_interactive_features(self, fig: go.Figure, df: pd.DataFrame) -> go.Figure:
        """Add interactive features to charts"""
        # Update hover template for better information display
        fig.update_traces(
            hovertemplate="<b>%{x}</b><br>" +
                         "%{y}<br>" +
                         "<extra></extra>"
        )
        
        # Add custom styling
        fig.update_layout(
            plot_bgcolor='rgba(0,0,0,0)',
            paper_bgcolor='rgba(0,0,0,0)',
            font=dict(size=12),
            title_font_size=16,
            hoverlabel=dict(
                bgcolor="white",
                font_size=12,
                font_family="Arial"
            )
        )
        
        return fig
    
    async def create_dashboard_map(self, data: List[Dict]) -> Dict[str, Any]:
        """Create interactive map with groundwater data points"""
        try:
            if not data:
                return {
                    "success": False,
                    "error": "No location data provided"
                }
            
            df = pd.DataFrame(data)
            
            # Filter data with valid coordinates
            valid_coords = df.dropna(subset=['latitude', 'longitude'])
            
            if valid_coords.empty:
                return {
                    "success": False,
                    "error": "No valid coordinates found in data"
                }
            
            # Create map
            fig = px.scatter_mapbox(
                valid_coords,
                lat="latitude",
                lon="longitude",
                color="water_level" if "water_level" in valid_coords.columns else None,
                size="water_level" if "water_level" in valid_coords.columns else None,
                hover_name="district" if "district" in valid_coords.columns else None,
                hover_data={
                    col: True for col in valid_coords.columns 
                    if col not in ['latitude', 'longitude']
                },
                color_continuous_scale="RdBu_r",
                mapbox_style="open-street-map",
                title="Groundwater Levels Across India",
                zoom=4,
                center={"lat": 20.5937, "lon": 78.9629}  # Center of India
            )
            
            # Update layout for better interaction
            fig.update_layout(
                mapbox_style="open-street-map",
                height=600,
                margin={"r":0,"t":30,"l":0,"b":0}
            )
            
            # Add custom hover information
            fig.update_traces(
                hovertemplate="<b>%{hovertext}</b><br>" +
                             "Latitude: %{lat}<br>" +
                             "Longitude: %{lon}<br>" +
                             "Water Level: %{marker.color}<br>" +
                             "<extra></extra>"
            )
            
            html_content = fig.to_html(
                include_plotlyjs='cdn',
                div_id="map-container",
                config={'displayModeBar': True}
            )
            
            return {
                "success": True,
                "map_html": html_content,
                "map_json": json.loads(fig.to_json()),
                "data_points": len(valid_coords),
                "map_center": {"lat": 20.5937, "lon": 78.9629},
                "features": ["hover_details", "zoom", "pan", "layer_toggle"]
            }
            
        except Exception as e:
            logging.error(f"Map creation failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def create_trend_dashboard(self, data: List[Dict]) -> Dict[str, Any]:
        """Create comprehensive trend analysis dashboard"""
        try:
            df = pd.DataFrame(data)
            
            if 'year' not in df.columns or 'water_level' not in df.columns:
                return {
                    "success": False,
                    "error": "Year and water_level columns required for trend analysis"
                }
            
            # Create subplot figure
            fig = make_subplots(
                rows=2, cols=2,
                subplot_titles=('Annual Trends', 'State-wise Distribution', 
                               'Seasonal Patterns', 'Category Distribution'),
                specs=[[{"secondary_y": False}, {"secondary_y": False}],
                       [{"secondary_y": False}, {"type": "pie"}]]
            )
            
            # Annual trends
            annual_data = df.groupby('year')['water_level'].agg(['mean', 'count']).reset_index()
            fig.add_trace(
                go.Scatter(x=annual_data['year'], y=annual_data['mean'], 
                          mode='lines+markers', name='Average Water Level'),
                row=1, col=1
            )
            
            # State-wise distribution (top 10)
            if 'state' in df.columns:
                state_data = df.groupby('state')['water_level'].mean().sort_values(ascending=False).head(10)
                fig.add_trace(
                    go.Bar(x=state_data.index, y=state_data.values, name='State Average'),
                    row=1, col=2
                )
            
            # Seasonal patterns
            if 'month' in df.columns:
                df['season'] = df['month'].apply(self._get_season)
                seasonal_data = df.groupby('season')['water_level'].mean()
                fig.add_trace(
                    go.Bar(x=seasonal_data.index, y=seasonal_data.values, name='Seasonal Average'),
                    row=2, col=1
                )
            
            # Category distribution
            if 'category' in df.columns:
                category_counts = df['category'].value_counts()
                fig.add_trace(
                    go.Pie(labels=category_counts.index, values=category_counts.values, name="Categories"),
                    row=2, col=2
                )
            
            # Update layout
            fig.update_layout(
                height=800,
                title_text="Groundwater Trends Dashboard",
                showlegend=True
            )
            
            html_content = fig.to_html(
                include_plotlyjs='cdn',
                div_id="dashboard-container"
            )
            
            return {
                "success": True,
                "dashboard_html": html_content,
                "dashboard_json": json.loads(fig.to_json()),
                "analysis_summary": {
                    "total_data_points": len(df),
                    "year_range": f"{df['year'].min()}-{df['year'].max()}" if 'year' in df.columns else "N/A",
                    "states_covered": df['state'].nunique() if 'state' in df.columns else 0,
                    "average_water_level": round(df['water_level'].mean(), 2)
                }
            }
            
        except Exception as e:
            logging.error(f"Dashboard creation failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _get_season(self, month: int) -> str:
        """Convert month to season for Indian context"""
        if month in [12, 1, 2]:
            return 'Winter'
        elif month in [3, 4, 5]:
            return 'Summer'
        elif month in [6, 7, 8, 9]:
            return 'Monsoon'
        elif month in [10, 11]:
            return 'Post-Monsoon'
        else:
            return 'Unknown'
    
    async def export_chart_data(self, data: List[Dict], format: str = "csv") -> Dict[str, Any]:
        """Export chart data in various formats"""
        try:
            df = pd.DataFrame(data)
            
            if format.lower() == "csv":
                csv_buffer = io.StringIO()
                df.to_csv(csv_buffer, index=False)
                return {
                    "success": True,
                    "format": "csv",
                    "content": csv_buffer.getvalue(),
                    "filename": f"groundwater_data_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.csv"
                }
            
            elif format.lower() == "json":
                return {
                    "success": True,
                    "format": "json",
                    "content": df.to_json(orient='records', indent=2),
                    "filename": f"groundwater_data_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.json"
                }
            
            else:
                return {
                    "success": False,
                    "error": f"Format '{format}' not supported. Available: csv, json"
                }
                
        except Exception as e:
            logging.error(f"Data export failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }

