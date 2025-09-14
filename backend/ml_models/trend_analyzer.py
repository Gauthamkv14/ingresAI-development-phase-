import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, r2_score
from scipy import stats
from typing import Dict, Any, List, Optional, Tuple
import logging
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
import seaborn as sns
import io
import base64

logger = logging.getLogger(__name__)

class TrendAnalyzer:
    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.trend_cache = {}
        
    def analyze_water_level_trends(
        self,
        data: List[Dict[str, Any]],
        region: Optional[str] = None,
        time_period: int = 5
    ) -> Dict[str, Any]:
        """Analyze water level trends over time"""
        
        try:
            if not data:
                return {
                    "success": False,
                    "error": "No data provided for trend analysis"
                }
            
            # Convert to DataFrame
            df = pd.DataFrame(data)
            
            # Validate required columns
            required_columns = ['year', 'water_level']
            missing_columns = [col for col in required_columns if col not in df.columns]
            
            if missing_columns:
                return {
                    "success": False,
                    "error": f"Missing required columns: {missing_columns}"
                }
            
            # Clean and filter data
            df = df.dropna(subset=['year', 'water_level'])
            df['year'] = pd.to_numeric(df['year'], errors='coerce')
            df['water_level'] = pd.to_numeric(df['water_level'], errors='coerce')
            df = df.dropna(subset=['year', 'water_level'])
            
            # Filter by time period
            current_year = datetime.now().year
            start_year = current_year - time_period
            df = df[df['year'] >= start_year]
            
            if len(df) < 3:
                return {
                    "success": False,
                    "error": f"Insufficient data points for trend analysis (need at least 3, got {len(df)})"
                }
            
            # Perform trend analysis
            trend_results = self._calculate_trends(df, region)
            
            # Statistical analysis
            stats_results = self._statistical_analysis(df)
            
            # Seasonal analysis if month data available
            seasonal_results = None
            if 'month' in df.columns:
                seasonal_results = self._seasonal_analysis(df)
            
            # Regional comparison if applicable
            regional_comparison = None
            if region and 'state' in df.columns:
                regional_comparison = self._regional_comparison(df, region)
            
            # Generate insights
            insights = self._generate_insights(trend_results, stats_results, seasonal_results)
            
            return {
                "success": True,
                "region": region,
                "time_period_years": time_period,
                "data_points": len(df),
                "year_range": f"{df['year'].min():.0f}-{df['year'].max():.0f}",
                "trend_analysis": trend_results,
                "statistical_analysis": stats_results,
                "seasonal_analysis": seasonal_results,
                "regional_comparison": regional_comparison,
                "insights": insights,
                "recommendations": self._generate_recommendations(trend_results, insights)
            }
            
        except Exception as e:
            logger.error(f"Trend analysis failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _calculate_trends(self, df: pd.DataFrame, region: Optional[str] = None) -> Dict[str, Any]:
        """Calculate various trend metrics"""
        
        # Overall trend
        X = df[['year']].values
        y = df['water_level'].values
        
        # Linear regression
        model = LinearRegression()
        model.fit(X, y)
        
        # Trend slope (meters per year)
        slope = model.coef_[0]
        intercept = model.intercept_
        r2 = model.score(X, y)
        
        # Statistical significance
        n = len(X)
        y_pred = model.predict(X)
        mse = mean_squared_error(y, y_pred)
        std_err = np.sqrt(mse / (n - 2))
        t_stat = slope / std_err
        p_value = 2 * (1 - stats.t.cdf(abs(t_stat), n - 2))
        
        # Trend classification
        if p_value < 0.05:
            if slope < -0.1:
                trend_category = "Significant Decline"
            elif slope > 0.1:
                trend_category = "Significant Rise"
            else:
                trend_category = "Stable"
        else:
            trend_category = "No Significant Trend"
        
        # Calculate trend over different periods
        trend_periods = {}
        for period in [1, 3, 5]:
            period_data = df[df['year'] >= df['year'].max() - period]
            if len(period_data) >= 2:
                period_slope = self._calculate_slope(period_data)
                trend_periods[f"{period}_year"] = {
                    "slope": period_slope,
                    "change": period_slope * period,
                    "data_points": len(period_data)
                }
        
        # Monthly trends if available
        monthly_trends = {}
        if 'month' in df.columns:
            for month in range(1, 13):
                month_data = df[df['month'] == month]
                if len(month_data) >= 3:
                    monthly_slope = self._calculate_slope(month_data)
                    monthly_trends[f"month_{month}"] = {
                        "slope": monthly_slope,
                        "data_points": len(month_data),
                        "avg_level": month_data['water_level'].mean()
                    }
        
        return {
            "overall_slope": round(slope, 4),
            "slope_units": "meters per year",
            "r_squared": round(r2, 3),
            "p_value": round(p_value, 6),
            "significance": "significant" if p_value < 0.05 else "not_significant",
            "trend_category": trend_category,
            "trend_periods": trend_periods,
            "monthly_trends": monthly_trends,
            "intercept": round(intercept, 2),
            "confidence_95": self._calculate_confidence_interval(slope, std_err),
            "projected_change_10_years": round(slope * 10, 2)
        }
    
    def _calculate_slope(self, data: pd.DataFrame) -> float:
        """Calculate slope for a subset of data"""
        if len(data) < 2:
            return 0.0
        
        X = data[['year']].values
        y = data['water_level'].values
        
        model = LinearRegression()
        model.fit(X, y)
        
        return round(model.coef_[0], 4)
    
    def _calculate_confidence_interval(self, slope: float, std_err: float) -> Tuple[float, float]:
        """Calculate 95% confidence interval for slope"""
        margin = 1.96 * std_err  # 95% confidence
        return (round(slope - margin, 4), round(slope + margin, 4))
    
    def _statistical_analysis(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Perform statistical analysis on water level data"""
        
        water_levels = df['water_level'].values
        
        # Descriptive statistics
        stats_dict = {
            "mean": round(np.mean(water_levels), 2),
            "median": round(np.median(water_levels), 2),
            "std_dev": round(np.std(water_levels), 2),
            "min": round(np.min(water_levels), 2),
            "max": round(np.max(water_levels), 2),
            "range": round(np.max(water_levels) - np.min(water_levels), 2),
            "quartiles": {
                "q1": round(np.percentile(water_levels, 25), 2),
                "q3": round(np.percentile(water_levels, 75), 2),
                "iqr": round(np.percentile(water_levels, 75) - np.percentile(water_levels, 25), 2)
            }
        }
        
        # Coefficient of variation
        cv = (stats_dict["std_dev"] / abs(stats_dict["mean"])) * 100
        stats_dict["coefficient_of_variation"] = round(cv, 2)
        
        # Variability assessment
        if cv < 10:
            variability = "Low"
        elif cv < 25:
            variability = "Moderate"
        else:
            variability = "High"
        
        stats_dict["variability_assessment"] = variability
        
        # Outlier detection using IQR method
        q1 = stats_dict["quartiles"]["q1"]
        q3 = stats_dict["quartiles"]["q3"]
        iqr = stats_dict["quartiles"]["iqr"]
        
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        outliers = water_levels[(water_levels < lower_bound) | (water_levels > upper_bound)]
        stats_dict["outliers"] = {
            "count": len(outliers),
            "percentage": round((len(outliers) / len(water_levels)) * 100, 1),
            "values": outliers.tolist()
        }
        
        # Normality test
        if len(water_levels) >= 8:
            shapiro_stat, shapiro_p = stats.shapiro(water_levels)
            stats_dict["normality_test"] = {
                "test": "Shapiro-Wilk",
                "statistic": round(shapiro_stat, 4),
                "p_value": round(shapiro_p, 6),
                "is_normal": shapiro_p > 0.05
            }
        
        return stats_dict
    
    def _seasonal_analysis(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze seasonal patterns in water levels"""
        
        if 'month' not in df.columns:
            return None
        
        # Monthly averages
        monthly_avg = df.groupby('month')['water_level'].agg(['mean', 'std', 'count']).round(2)
        monthly_stats = monthly_avg.to_dict('index')
        
        # Season mapping
        season_mapping = {
            12: 'Winter', 1: 'Winter', 2: 'Winter',
            3: 'Spring', 4: 'Spring', 5: 'Spring',
            6: 'Summer', 7: 'Summer', 8: 'Summer',
            9: 'Monsoon', 10: 'Monsoon', 11: 'Post-Monsoon'
        }
        
        df['season'] = df['month'].map(season_mapping)
        seasonal_stats = df.groupby('season')['water_level'].agg(['mean', 'std', 'count']).round(2)
        
        # Find peak and trough months
        peak_month = monthly_avg['mean'].idxmax()
        trough_month = monthly_avg['mean'].idxmin()
        
        seasonal_amplitude = monthly_avg['mean'].max() - monthly_avg['mean'].min()
        
        return {
            "monthly_statistics": monthly_stats,
            "seasonal_statistics": seasonal_stats.to_dict('index'),
            "peak_month": int(peak_month),
            "trough_month": int(trough_month),
            "seasonal_amplitude": round(seasonal_amplitude, 2),
            "seasonal_amplitude_units": "meters",
            "monsoon_impact": self._analyze_monsoon_impact(df)
        }
    
    def _analyze_monsoon_impact(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze monsoon impact on water levels"""
        
        # Pre-monsoon (March-May)
        pre_monsoon = df[df['month'].isin([3, 4, 5])]
        # Monsoon (June-September)
        monsoon = df[df['month'].isin([6, 7, 8, 9])]
        # Post-monsoon (October-November)
        post_monsoon = df[df['month'].isin([10, 11])]
        
        if len(pre_monsoon) == 0 or len(monsoon) == 0:
            return {"impact": "insufficient_data"}
        
        pre_monsoon_avg = pre_monsoon['water_level'].mean()
        monsoon_avg = monsoon['water_level'].mean()
        post_monsoon_avg = post_monsoon['water_level'].mean() if len(post_monsoon) > 0 else None
        
        # Calculate recharge (positive means water level rose)
        recharge_during_monsoon = monsoon_avg - pre_monsoon_avg
        
        impact_assessment = "high" if abs(recharge_during_monsoon) > 2 else "moderate" if abs(recharge_during_monsoon) > 0.5 else "low"
        
        return {
            "pre_monsoon_avg": round(pre_monsoon_avg, 2),
            "monsoon_avg": round(monsoon_avg, 2),
            "post_monsoon_avg": round(post_monsoon_avg, 2) if post_monsoon_avg else None,
            "recharge_during_monsoon": round(recharge_during_monsoon, 2),
            "impact_assessment": impact_assessment,
            "recharge_positive": recharge_during_monsoon > 0
        }
    
    def _regional_comparison(self, df: pd.DataFrame, target_region: str) -> Dict[str, Any]:
        """Compare target region with other regions"""
        
        if 'state' not in df.columns:
            return None
        
        # Regional statistics
        regional_stats = df.groupby('state')['water_level'].agg(['mean', 'std', 'count']).round(2)
        
        # Target region stats
        target_stats = regional_stats.loc[target_region] if target_region in regional_stats.index else None
        
        if target_stats is None:
            return {"error": f"Region {target_region} not found in data"}
        
        # National average
        national_avg = df['water_level'].mean()
        
        # Ranking
        ranking = regional_stats.sort_values('mean', ascending=False)
        target_rank = ranking.index.get_loc(target_region) + 1
        total_regions = len(ranking)
        
        # Comparison categories
        target_mean = target_stats['mean']
        if target_mean > national_avg + regional_stats['mean'].std():
            comparison = "Much better than average"
        elif target_mean > national_avg:
            comparison = "Better than average"
        elif target_mean < national_avg - regional_stats['mean'].std():
            comparison = "Much worse than average"
        elif target_mean < national_avg:
            comparison = "Worse than average"
        else:
            comparison = "Close to average"
        
        return {
            "target_region": target_region,
            "target_stats": target_stats.to_dict(),
            "national_average": round(national_avg, 2),
            "rank": f"{target_rank} out of {total_regions}",
            "comparison": comparison,
            "regional_rankings": ranking.to_dict('index'),
            "percentile": round(((total_regions - target_rank) / total_regions) * 100, 1)
        }
    
    def _generate_insights(self, trend_results: Dict, stats_results: Dict, seasonal_results: Dict = None) -> List[str]:
        """Generate human-readable insights from analysis"""
        
        insights = []
        
        # Trend insights
        slope = trend_results['overall_slope']
        significance = trend_results['significance']
        trend_category = trend_results['trend_category']
        
        if significance == 'significant':
            if slope < -0.1:
                insights.append(f"Water levels are declining significantly at {abs(slope):.2f} meters per year")
            elif slope > 0.1:
                insights.append(f"Water levels are rising significantly at {slope:.2f} meters per year")
            else:
                insights.append("Water levels are statistically stable with no significant trend")
        else:
            insights.append("No statistically significant trend detected in water levels")
        
        # Variability insights
        variability = stats_results['variability_assessment']
        cv = stats_results['coefficient_of_variation']
        
        if variability == "High":
            insights.append(f"Water levels show high variability (CV: {cv}%), indicating inconsistent conditions")
        elif variability == "Moderate":
            insights.append(f"Water levels show moderate variability (CV: {cv}%)")
        else:
            insights.append(f"Water levels are relatively stable (CV: {cv}%)")
        
        # Outlier insights
        outlier_percentage = stats_results['outliers']['percentage']
        if outlier_percentage > 10:
            insights.append(f"{outlier_percentage}% of measurements are outliers, suggesting data quality issues or extreme events")
        
        # Seasonal insights
        if seasonal_results:
            peak_month = seasonal_results['peak_month']
            trough_month = seasonal_results['trough_month']
            amplitude = seasonal_results['seasonal_amplitude']
            
            month_names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            
            insights.append(f"Seasonal variation of {amplitude:.1f}m with peak in {month_names[peak_month]} and lowest in {month_names[trough_month]}")
            
            monsoon_impact = seasonal_results.get('monsoon_impact', {})
            if monsoon_impact and 'recharge_during_monsoon' in monsoon_impact:
                recharge = monsoon_impact['recharge_during_monsoon']
                if recharge > 1:
                    insights.append(f"Strong monsoon recharge effect (+{recharge:.1f}m during monsoon)")
                elif recharge < -1:
                    insights.append(f"Concerning water level drop during monsoon ({recharge:.1f}m)")
        
        # Projection insights
        projected_change = trend_results['projected_change_10_years']
        if abs(projected_change) > 1:
            direction = "decline" if projected_change < 0 else "rise"
            insights.append(f"If current trend continues, expect {abs(projected_change):.1f}m {direction} over next 10 years")
        
        return insights
    
    def _generate_recommendations(self, trend_results: Dict, insights: List[str]) -> List[Dict[str, str]]:
        """Generate actionable recommendations based on analysis"""
        
        recommendations = []
        
        slope = trend_results['overall_slope']
        significance = trend_results['significance']
        
        # Trend-based recommendations
        if significance == 'significant' and slope < -0.2:
            recommendations.append({
                "priority": "high",
                "category": "conservation",
                "action": "Immediate water conservation measures required",
                "details": "Implement strict groundwater extraction limits and promote water-saving technologies"
            })
            
            recommendations.append({
                "priority": "high",
                "category": "recharge",
                "action": "Enhance artificial recharge programs",
                "details": "Construct check dams, recharge wells, and rainwater harvesting systems"
            })
        
        elif significance == 'significant' and slope < -0.05:
            recommendations.append({
                "priority": "medium",
                "category": "monitoring",
                "action": "Increase monitoring frequency",
                "details": "Monitor water levels more frequently to track changes and early warning"
            })
        
        # Variability-based recommendations
        if any("high variability" in insight.lower() for insight in insights):
            recommendations.append({
                "priority": "medium",
                "category": "data_quality",
                "action": "Improve data collection protocols",
                "details": "Standardize measurement procedures and increase measurement frequency"
            })
        
        # Seasonal recommendations
        if any("monsoon" in insight.lower() and "drop" in insight.lower() for insight in insights):
            recommendations.append({
                "priority": "high",
                "category": "infrastructure",
                "action": "Improve monsoon water capture",
                "details": "Build infrastructure to better capture and store monsoon precipitation"
            })
        
        # General recommendations
        recommendations.append({
            "priority": "low",
            "category": "planning",
            "action": "Long-term water resource planning",
            "details": "Develop comprehensive water management plans based on trend analysis"
        })
        
        return recommendations
