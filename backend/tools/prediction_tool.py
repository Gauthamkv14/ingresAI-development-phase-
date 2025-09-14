import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
import joblib
import os
from typing import Dict, Any, List
from config import Config
from database.postgis_manager import PostGISManager
import logging
from datetime import datetime, timedelta

class WaterLevelPredictor:
    def __init__(self):
        self.config = Config()
        self.db_manager = PostGISManager()
        self.models = {}
        self.scalers = {}
        self.label_encoders = {}
        self.model_path = os.path.join(self.config.DATA_FOLDER, "models")
        os.makedirs(self.model_path, exist_ok=True)
        
    async def train_prediction_model(self, region: str = None) -> Dict[str, Any]:
        """Train ML models for water level prediction"""
        try:
            # Fetch historical data
            filters = {}
            if region:
                filters['state'] = region
            
            historical_data = self.db_manager.query_groundwater_data(filters, limit=5000)
            
            if len(historical_data) < 100:
                return {
                    "success": False,
                    "error": f"Insufficient data for training (need at least 100 records, got {len(historical_data)})",
                    "recommendation": "Collect more historical data before training"
                }
            
            # Prepare features
            df = pd.DataFrame(historical_data)
            features_df = self._prepare_features(df)
            
            if features_df.empty:
                return {
                    "success": False,
                    "error": "Feature preparation failed - no valid features extracted"
                }
            
            # Prepare target variable
            target = features_df['water_level'].dropna()
            features = features_df.drop(['water_level'], axis=1)
            
            # Handle missing values and encode categorical variables
            features = self._preprocess_features(features, fit=True)
            
            # Align features and target
            common_index = features.index.intersection(target.index)
            X = features.loc[common_index]
            y = target.loc[common_index]
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=None
            )
            
            # Train multiple models
            models = {
                'random_forest': RandomForestRegressor(n_estimators=100, random_state=42),
                'gradient_boosting': GradientBoostingRegressor(n_estimators=100, random_state=42)
            }
            
            model_performance = {}
            
            for model_name, model in models.items():
                # Train model
                model.fit(X_train, y_train)
                
                # Evaluate
                y_pred = model.predict(X_test)
                mse = mean_squared_error(y_test, y_pred)
                r2 = r2_score(y_test, y_pred)
                
                model_performance[model_name] = {
                    'mse': mse,
                    'rmse': np.sqrt(mse),
                    'r2_score': r2,
                    'model': model
                }
                
                # Save model
                model_file = os.path.join(self.model_path, f"{model_name}_{region or 'national'}.joblib")
                joblib.dump(model, model_file)
            
            # Select best model
            best_model_name = min(model_performance.keys(), key=lambda x: model_performance[x]['mse'])
            self.models[region or 'national'] = model_performance[best_model_name]['model']
            
            return {
                "success": True,
                "region": region or "national",
                "training_data_size": len(historical_data),
                "feature_count": X.shape[1],
                "model_performance": {k: {
                    'mse': v['mse'],
                    'rmse': v['rmse'],  
                    'r2_score': v['r2_score']
                } for k, v in model_performance.items()},
                "best_model": best_model_name,
                "feature_importance": self._get_feature_importance(
                    self.models[region or 'national'], 
                    X.columns
                ),
                "training_date": datetime.now().isoformat()
            }
            
        except Exception as e:
            logging.error(f"Model training failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Prepare features for ML model"""
        try:
            # Select relevant columns
            feature_columns = ['state', 'district', 'year', 'month', 'latitude', 'longitude', 
                             'category', 'water_level']
            
            # Keep only available columns
            available_columns = [col for col in feature_columns if col in df.columns]
            features_df = df[available_columns].copy()
            
            # Add derived features
            if 'year' in features_df.columns and 'month' in features_df.columns:
                features_df['season'] = features_df['month'].apply(self._get_season)
                features_df['year_month'] = features_df['year'] * 100 + features_df['month'].fillna(1)
            
            # Add lag features if sufficient data
            if len(features_df) > 50:
                features_df = features_df.sort_values(['state', 'district', 'year', 'month'])
                features_df['water_level_lag1'] = features_df.groupby(['state', 'district'])['water_level'].shift(1)
                features_df['water_level_lag2'] = features_df.groupby(['state', 'district'])['water_level'].shift(2)
            
            return features_df
            
        except Exception as e:
            logging.error(f"Feature preparation failed: {e}")
            return pd.DataFrame()
    
    def _preprocess_features(self, features_df: pd.DataFrame, fit: bool = False) -> pd.DataFrame:
        """Preprocess features for model training/prediction"""
        try:
            processed_df = features_df.copy()
            
            # Handle categorical variables
            categorical_columns = ['state', 'district', 'category', 'season']
            for col in categorical_columns:
                if col in processed_df.columns:
                    if fit:
                        le = LabelEncoder()
                        processed_df[col] = le.fit_transform(processed_df[col].fillna('Unknown'))
                        self.label_encoders[col] = le
                    else:
                        if col in self.label_encoders:
                            # Handle unseen categories
                            unique_values = set(processed_df[col].fillna('Unknown'))
                            known_values = set(self.label_encoders[col].classes_)
                            
                            # Map unknown values to a default
                            processed_df[col] = processed_df[col].fillna('Unknown')
                            processed_df.loc[~processed_df[col].isin(known_values), col] = 'Unknown'
                            
                            processed_df[col] = self.label_encoders[col].transform(processed_df[col])
            
            # Handle numerical features
            numerical_columns = ['year', 'month', 'latitude', 'longitude', 'year_month', 
                               'water_level_lag1', 'water_level_lag2']
            for col in numerical_columns:
                if col in processed_df.columns:
                    processed_df[col] = processed_df[col].fillna(processed_df[col].mean())
            
            # Scale numerical features
            if fit:
                scaler = StandardScaler()
                numerical_cols = [col for col in numerical_columns if col in processed_df.columns]
                if numerical_cols:
                    processed_df[numerical_cols] = scaler.fit_transform(processed_df[numerical_cols])
                    self.scalers['numerical'] = scaler
            else:
                if 'numerical' in self.scalers:
                    numerical_cols = [col for col in numerical_columns if col in processed_df.columns]
                    if numerical_cols:
                        processed_df[numerical_cols] = self.scalers['numerical'].transform(processed_df[numerical_cols])
            
            return processed_df
            
        except Exception as e:
            logging.error(f"Feature preprocessing failed: {e}")
            return features_df
    
    def _get_season(self, month: int) -> str:
        """Convert month to season"""
        if month in [12, 1, 2]:
            return 'winter'
        elif month in [3, 4, 5]:
            return 'summer'
        elif month in [6, 7, 8, 9]:
            return 'monsoon'
        elif month in [10, 11]:
            return 'post_monsoon'
        else:
            return 'unknown'
    
    def _get_feature_importance(self, model, feature_names: List[str]) -> Dict[str, float]:
        """Get feature importance from trained model"""
        try:
            if hasattr(model, 'feature_importances_'):
                importance_dict = dict(zip(feature_names, model.feature_importances_))
                # Sort by importance
                return dict(sorted(importance_dict.items(), key=lambda x: x[1], reverse=True))
            else:
                return {}
        except Exception:
            return {}
    
    async def predict_water_levels(self, 
                                 state: str, 
                                 district: str,
                                 prediction_months: int = 6) -> Dict[str, Any]:
        """Predict future water levels"""
        try:
            # Load or train model for the region
            model_key = state
            if model_key not in self.models:
                # Try to load saved model
                model_file = os.path.join(self.model_path, f"random_forest_{state}.joblib")
                if os.path.exists(model_file):
                    self.models[model_key] = joblib.load(model_file)
                else:
                    # Train new model
                    training_result = await self.train_prediction_model(state)
                    if not training_result["success"]:
                        return training_result
            
            # Get recent data for prediction
            recent_data = self.db_manager.query_groundwater_data({
                'state': state,
                'district': district
            }, limit=50)
            
            if not recent_data:
                return {
                    "success": False,
                    "error": f"No historical data available for {district}, {state}"
                }
            
            # Prepare prediction features
            current_date = datetime.now()
            predictions = []
            
            for i in range(prediction_months):
                future_date = current_date + timedelta(days=30 * i)  # Approximate monthly intervals
                
                # Create feature vector
                feature_data = {
                    'state': state,
                    'district': district,
                    'year': future_date.year,
                    'month': future_date.month,
                    'latitude': recent_data[0].get('latitude'),
                    'longitude': recent_data[0].get('longitude'),
                    'category': recent_data[0].get('category', 'Unknown'),
                    'season': self._get_season(future_date.month)
                }
                
                # Add lag features from recent data
                if len(recent_data) > 0:
                    feature_data['water_level_lag1'] = recent_data[0].get('water_level')
                if len(recent_data) > 1:
                    feature_data['water_level_lag2'] = recent_data[1].get('water_level')
                
                feature_data['year_month'] = future_date.year * 100 + future_date.month
                
                # Convert to DataFrame and preprocess
                feature_df = pd.DataFrame([feature_data])
                processed_features = self._preprocess_features(feature_df, fit=False)
                
                # Make prediction
                predicted_level = self.models[model_key].predict(processed_features)[0]
                
                # Calculate confidence interval (simplified)
                confidence_interval = self._calculate_confidence_interval(
                    predicted_level, recent_data
                )
                
                predictions.append({
                    'date': future_date.strftime('%Y-%m-%d'),
                    'year': future_date.year,
                    'month': future_date.month,
                    'predicted_water_level': round(predicted_level, 2),
                    'confidence_lower': round(confidence_interval[0], 2),
                    'confidence_upper': round(confidence_interval[1], 2),
                    'prediction_quality': self._assess_prediction_quality(predicted_level, recent_data)
                })
            
            # Generate insights
            insights = self._generate_prediction_insights(predictions, recent_data)
            
            return {
                "success": True,
                "location": f"{district}, {state}",
                "prediction_period": f"{prediction_months} months",
                "predictions": predictions,
                "insights": insights,
                "model_info": {
                    "model_type": "Random Forest Regressor",
                    "training_region": state,
                    "historical_data_points": len(recent_data)
                },
                "disclaimer": "Predictions are based on historical data and should be used as guidance only. Actual water levels may vary due to weather, policy changes, and other factors.",
                "citation": f"Prediction generated by INGRES ML Model based on CGWB historical data - {datetime.now().strftime('%Y-%m-%d')}"
            }
            
        except Exception as e:
            logging.error(f"Water level prediction failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _calculate_confidence_interval(self, prediction: float, historical_data: list) -> tuple:
        """Calculate simple confidence interval for prediction"""
        if not historical_data:
            return (prediction - 2, prediction + 2)
        
        # Calculate standard deviation from historical data
        water_levels = [d.get('water_level', 0) for d in historical_data if d.get('water_level')]
        if not water_levels:
            return (prediction - 2, prediction + 2)
        
        std_dev = np.std(water_levels)
        margin = 1.96 * std_dev  # 95% confidence interval
        
        return (prediction - margin, prediction + margin)
    
    def _assess_prediction_quality(self, prediction: float, historical_data: list) -> str:
        """Assess quality of individual prediction"""
        if not historical_data:
            return "low"
        
        recent_levels = [d.get('water_level', 0) for d in historical_data[:5] if d.get('water_level')]
        if not recent_levels:
            return "low"
        
        # Check if prediction is within reasonable range of recent data
        recent_avg = np.mean(recent_levels)
        recent_std = np.std(recent_levels)
        
        if abs(prediction - recent_avg) <= 2 * recent_std:
            return "high"
        elif abs(prediction - recent_avg) <= 3 * recent_std:
            return "medium"
        else:
            return "low"
    
    def _generate_prediction_insights(self, predictions: list, historical_data: list) -> list:
        """Generate insights from predictions"""
        insights = []
        
        if not predictions:
            return insights
        
        # Trend analysis
        levels = [p['predicted_water_level'] for p in predictions]
        if len(levels) > 1:
            if levels[-1] > levels[0]:
                insights.append({
                    "type": "trend",
                    "message": f"Water levels are predicted to rise by {abs(levels[-1] - levels[0]):.2f}m over the prediction period",
                    "impact": "positive"
                })
            elif levels[-1] < levels[0]:
                insights.append({
                    "type": "trend", 
                    "message": f"Water levels are predicted to decline by {abs(levels[-1] - levels[0]):.2f}m over the prediction period",
                    "impact": "negative"
                })
        
        # Seasonal patterns
        monsoon_predictions = [p for p in predictions if p['month'] in [6, 7, 8, 9]]
        if monsoon_predictions:
            avg_monsoon_level = np.mean([p['predicted_water_level'] for p in monsoon_predictions])
            insights.append({
                "type": "seasonal",
                "message": f"During monsoon months, average water level is predicted to be {avg_monsoon_level:.2f}m",
                "impact": "informational"
            })
        
        # Risk assessment
        critical_predictions = [p for p in predictions if p['predicted_water_level'] < -20]
        if critical_predictions:
            insights.append({
                "type": "risk",
                "message": f"Critical water levels (below -20m) predicted for {len(critical_predictions)} months",
                "impact": "negative"
            })
        
        return insights

    async def analyze_trends(self, region: str = None, years: int = 5) -> Dict[str, Any]:
        """Analyze long-term trends in groundwater data"""
        try:
            # Get historical data
            filters = {}
            if region:
                filters['state'] = region
            
            historical_data = self.db_manager.query_groundwater_data(filters, limit=10000)
            
            if not historical_data:
                return {
                    "success": False,
                    "error": f"No historical data available for trend analysis in {region or 'national'} region"
                }
            
            df = pd.DataFrame(historical_data)
            
            # Annual trends
            annual_trends = df.groupby('year').agg({
                'water_level': ['mean', 'median', 'std', 'count']
            }).round(2)
            
            # Seasonal trends
            df['season'] = df['month'].apply(self._get_season)
            seasonal_trends = df.groupby('season').agg({
                'water_level': ['mean', 'median', 'std', 'count']
            }).round(2)
            
            # Regional trends (if national analysis)
            regional_trends = {}
            if not region:
                regional_trends = df.groupby('state').agg({
                    'water_level': ['mean', 'median', 'std', 'count']
                }).round(2).to_dict()
            
            # Trend analysis
            trend_analysis = self._perform_trend_analysis(df)
            
            return {
                "success": True,
                "region": region or "national",
                "analysis_period": f"Last {years} years",
                "data_points": len(historical_data),
                "annual_trends": annual_trends.to_dict(),
                "seasonal_trends": seasonal_trends.to_dict(),
                "regional_trends": regional_trends,
                "trend_analysis": trend_analysis,
                "citation": f"Trend analysis based on CGWB historical data - {datetime.now().strftime('%Y-%m-%d')}"
            }
            
        except Exception as e:
            logging.error(f"Trend analysis failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _perform_trend_analysis(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Perform statistical trend analysis"""
        try:
            # Overall trend (linear regression)
            from scipy import stats
            
            df_clean = df.dropna(subset=['water_level', 'year'])
            if len(df_clean) < 10:
                return {"error": "Insufficient data for trend analysis"}
            
            # Linear regression on annual data
            annual_means = df_clean.groupby('year')['water_level'].mean()
            years = annual_means.index.values
            levels = annual_means.values
            
            slope, intercept, r_value, p_value, std_err = stats.linregress(years, levels)
            
            # Trend classification
            if p_value < 0.05:  # Statistically significant
                if slope > 0.1:
                    trend_type = "Rising"
                    trend_significance = "significant_increase"
                elif slope < -0.1:
                    trend_type = "Declining"
                    trend_significance = "significant_decrease"
                else:
                    trend_type = "Stable"
                    trend_significance = "stable"
            else:
                trend_type = "No clear trend"
                trend_significance = "not_significant"
            
            # Variability analysis
            cv = (df_clean['water_level'].std() / df_clean['water_level'].mean()) * 100
            
            return {
                "overall_trend": trend_type,
                "slope": round(slope, 4),
                "r_squared": round(r_value**2, 4),
                "p_value": round(p_value, 4),
                "significance": trend_significance,
                "coefficient_of_variation": round(cv, 2),
                "interpretation": self._interpret_trend(slope, r_value**2, p_value, cv)
            }
            
        except Exception as e:
            logging.error(f"Statistical trend analysis failed: {e}")
            return {"error": str(e)}
    
    def _interpret_trend(self, slope: float, r_squared: float, p_value: float, cv: float) -> str:
        """Interpret trend analysis results"""
        interpretation_parts = []
        
        # Trend direction and strength
        if p_value < 0.05:
            if slope > 0.1:
                interpretation_parts.append(f"Water levels are rising at {slope:.3f}m per year")
            elif slope < -0.1:
                interpretation_parts.append(f"Water levels are declining at {abs(slope):.3f}m per year")
            else:
                interpretation_parts.append("Water levels are relatively stable")
        else:
            interpretation_parts.append("No statistically significant trend detected")
        
        # Trend reliability
        if r_squared > 0.7:
            interpretation_parts.append("The trend is highly reliable")
        elif r_squared > 0.4:
            interpretation_parts.append("The trend is moderately reliable")
        else:
            interpretation_parts.append("The trend has low reliability due to high variability")
        
        # Variability assessment
        if cv > 50:
            interpretation_parts.append("High variability in water levels indicates complex hydro-geological conditions")
        elif cv > 25:
            interpretation_parts.append("Moderate variability in water levels")
        else:
            interpretation_parts.append("Low variability indicates stable hydrological conditions")
        
        return ". ".join(interpretation_parts) + "."
