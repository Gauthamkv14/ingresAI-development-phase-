import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split, cross_val_score, TimeSeriesSplit
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.preprocessing import StandardScaler, LabelEncoder
import joblib
import os
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, timedelta, date
import logging
from config import Config
from database.postgis_manager import PostGISManager
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

class WaterLevelPredictor:
    def __init__(self):
        self.config = Config()
        self.db_manager = PostGISManager()
        self.models = {}
        self.scalers = {}
        self.label_encoders = {}
        self.feature_columns = []
        self.model_path = os.path.join(self.config.DATA_FOLDER, "models")
        self.model_metadata = {}
        os.makedirs(self.model_path, exist_ok=True)
        
    async def train_prediction_model(self, region: str = None, model_type: str = 'random_forest') -> Dict[str, Any]:
        """Train ML models for water level prediction with comprehensive validation"""
        try:
            # Fetch historical data
            filters = {}
            if region:
                filters['state'] = region
            
            historical_data = self.db_manager.query_groundwater_data(filters, limit=10000)
            
            if len(historical_data) < 100:
                return {
                    "success": False,
                    "error": f"Insufficient data for training (need at least 100 records, got {len(historical_data)})",
                    "recommendation": "Collect more historical data before training"
                }
            
            logger.info(f"Training model with {len(historical_data)} records for region: {region or 'national'}")
            
            # Prepare features and target
            X, y, feature_names = self._prepare_features(historical_data)
            
            if X is None or len(X) < 50:
                return {
                    "success": False,
                    "error": "Feature preparation failed or insufficient valid data",
                    "data_size": len(historical_data)
                }
            
            # Split data chronologically for time series
            X_train, X_test, y_train, y_test = self._time_series_split(X, y, test_size=0.2)
            
            # Train multiple models and select best
            models = self._get_model_candidates(model_type)
            model_results = {}
            
            for name, model in models.items():
                try:
                    # Train model
                    model.fit(X_train, y_train)
                    
                    # Evaluate
                    y_pred = model.predict(X_test)
                    
                    # Calculate metrics
                    metrics = self._calculate_metrics(y_test, y_pred)
                    
                    # Cross-validation for more robust evaluation
                    cv_scores = self._cross_validate_model(model, X, y)
                    
                    model_results[name] = {
                        'model': model,
                        'metrics': metrics,
                        'cv_scores': cv_scores,
                        'feature_importance': self._get_feature_importance(model, feature_names)
                    }
                    
                    logger.info(f"Model {name}: R² = {metrics['r2']:.3f}, RMSE = {metrics['rmse']:.3f}")
                    
                except Exception as e:
                    logger.warning(f"Failed to train {name} model: {e}")
                    continue
            
            if not model_results:
                return {
                    "success": False,
                    "error": "All model training attempts failed"
                }
            
            # Select best model based on cross-validation R²
            best_model_name = max(model_results.keys(), 
                                key=lambda x: model_results[x]['cv_scores']['r2_mean'])
            
            best_model_info = model_results[best_model_name]
            best_model = best_model_info['model']
            
            # Save model and metadata
            model_key = region or 'national'
            self.models[model_key] = best_model
            self.feature_columns = feature_names
            
            # Save model to disk
            model_file = os.path.join(self.model_path, f"{best_model_name}_{model_key}.joblib")
            metadata_file = os.path.join(self.model_path, f"metadata_{model_key}.joblib")
            
            joblib.dump(best_model, model_file)
            
            # Save metadata
            metadata = {
                'model_type': best_model_name,
                'region': model_key,
                'feature_columns': feature_names,
                'training_data_size': len(historical_data),
                'training_date': datetime.now().isoformat(),
                'metrics': best_model_info['metrics'],
                'cv_scores': best_model_info['cv_scores'],
                'feature_importance': best_model_info['feature_importance'],
                'scalers': self.scalers,
                'label_encoders': self.label_encoders
            }
            
            joblib.dump(metadata, metadata_file)
            self.model_metadata[model_key] = metadata
            
            # Generate model interpretation
            interpretation = self._interpret_model(best_model_info, feature_names)
            
            return {
                "success": True,
                "model_key": model_key,
                "best_model": best_model_name,
                "training_data_size": len(historical_data),
                "feature_count": len(feature_names),
                "test_data_size": len(X_test),
                "metrics": best_model_info['metrics'],
                "cross_validation": best_model_info['cv_scores'],
                "feature_importance": best_model_info['feature_importance'],
                "model_comparison": {k: v['metrics'] for k, v in model_results.items()},
                "interpretation": interpretation,
                "training_completed": datetime.now().isoformat(),
                "model_file_saved": model_file
            }
            
        except Exception as e:
            logger.error(f"Model training failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _prepare_features(self, data: List[Dict]) -> Tuple[Optional[np.ndarray], Optional[np.ndarray], List[str]]:
        """Prepare features for ML model with comprehensive feature engineering"""
        try:
            df = pd.DataFrame(data)
            
            # Filter data with required columns
            required_columns = ['water_level', 'year']
            available_columns = [col for col in required_columns if col in df.columns]
            
            if len(available_columns) < 2:
                logger.error(f"Missing required columns. Need: {required_columns}, Have: {list(df.columns)}")
                return None, None, []
            
            # Remove rows with missing target variable
            df = df.dropna(subset=['water_level'])
            df = df[df['water_level'].notna()]
            
            # Convert data types
            numeric_columns = ['water_level', 'year', 'month', 'latitude', 'longitude']
            for col in numeric_columns:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
            
            # Feature engineering
            features_df = pd.DataFrame()
            
            # Time-based features
            if 'year' in df.columns:
                features_df['year'] = df['year']
                features_df['years_since_2000'] = df['year'] - 2000
                
            if 'month' in df.columns:
                df['month'] = df['month'].fillna(6)  # Default to June
                features_df['month'] = df['month']
                features_df['season'] = df['month'].apply(self._get_season_numeric)
                
                # Cyclical encoding for months
                features_df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
                features_df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)
            
            # Geographical features
            if 'latitude' in df.columns and df['latitude'].notna().sum() > 0:
                features_df['latitude'] = df['latitude'].fillna(df['latitude'].mean())
                
            if 'longitude' in df.columns and df['longitude'].notna().sum() > 0:
                features_df['longitude'] = df['longitude'].fillna(df['longitude'].mean())
                
            # Calculate derived geographical features
            if 'latitude' in features_df.columns and 'longitude' in features_df.columns:
                # Distance from geographical center of India
                india_center_lat, india_center_lon = 20.5937, 78.9629
                features_df['distance_from_center'] = np.sqrt(
                    (features_df['latitude'] - india_center_lat)**2 + 
                    (features_df['longitude'] - india_center_lon)**2
                )
            
            # Categorical features
            if 'state' in df.columns:
                features_df['state'] = df['state'].fillna('Unknown')
                
            if 'district' in df.columns:
                features_df['district'] = df['district'].fillna('Unknown')
                
            if 'category' in df.columns:
                features_df['category'] = df['category'].fillna('Unknown')
            
            # Encode categorical variables
            categorical_columns = ['state', 'district', 'category']
            for col in categorical_columns:
                if col in features_df.columns:
                    if col not in self.label_encoders:
                        self.label_encoders[col] = LabelEncoder()
                        features_df[f'{col}_encoded'] = self.label_encoders[col].fit_transform(features_df[col].astype(str))
                    else:
                        # Handle unseen categories
                        known_categories = set(self.label_encoders[col].classes_)
                        features_df[col] = features_df[col].apply(
                            lambda x: x if x in known_categories else 'Unknown'
                        )
                        features_df[f'{col}_encoded'] = self.label_encoders[col].transform(features_df[col].astype(str))
            
            # Lag features (if sufficient data)
            if len(features_df) > 50:
                # Sort by location and time
                sort_columns = ['year']
                if 'month' in features_df.columns:
                    sort_columns.append('month')
                if 'state' in features_df.columns and 'district' in features_df.columns:
                    sort_columns = ['state', 'district'] + sort_columns
                
                df_sorted = df.sort_values(sort_columns).reset_index(drop=True)
                
                # Create lag features
                for lag in [1, 2]:
                    lag_col = f'water_level_lag_{lag}'
                    if 'state' in df.columns and 'district' in df.columns:
                        features_df[lag_col] = df_sorted.groupby(['state', 'district'])['water_level'].shift(lag)
                    else:
                        features_df[lag_col] = df_sorted['water_level'].shift(lag)
            
            # Statistical features (rolling means, etc.)
            if len(features_df) > 10:
                # Rolling statistics
                window_sizes = [3, 5] if len(features_df) > 20 else [3]
                for window in window_sizes:
                    if len(features_df) > window:
                        rolling_mean = df['water_level'].rolling(window=window, min_periods=1).mean()
                        features_df[f'rolling_mean_{window}'] = rolling_mean
            
            # Remove categorical columns (keep encoded versions)
            features_df = features_df.drop(columns=['state', 'district', 'category'], errors='ignore')
            
            # Handle missing values
            features_df = features_df.fillna(features_df.mean())
            
            # Scale numerical features
            numerical_columns = [col for col in features_df.columns if 'encoded' not in col]
            if numerical_columns:
                if 'scaler' not in self.scalers:
                    self.scalers['scaler'] = StandardScaler()
                    features_df[numerical_columns] = self.scalers['scaler'].fit_transform(features_df[numerical_columns])
                else:
                    features_df[numerical_columns] = self.scalers['scaler'].transform(features_df[numerical_columns])
            
            # Prepare target variable
            target = df['water_level'].values
            
            # Remove rows where target is NaN
            valid_indices = ~np.isnan(target)
            X = features_df.iloc[valid_indices].values
            y = target[valid_indices]
            
            feature_names = features_df.columns.tolist()
            
            logger.info(f"Prepared {X.shape[0]} samples with {X.shape[1]} features")
            
            return X, y, feature_names
            
        except Exception as e:
            logger.error(f"Feature preparation failed: {e}")
            return None, None, []
    
    def _get_season_numeric(self, month: int) -> int:
        """Convert month to numeric season"""
        if month in [12, 1, 2]:
            return 0  # Winter
        elif month in [3, 4, 5]:
            return 1  # Summer
        elif month in [6, 7, 8, 9]:
            return 2  # Monsoon
        elif month in [10, 11]:
            return 3  # Post-monsoon
        else:
            return 1  # Default to summer
    
    def _time_series_split(self, X: np.ndarray, y: np.ndarray, test_size: float = 0.2) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Split data chronologically for time series"""
        split_index = int(len(X) * (1 - test_size))
        
        X_train = X[:split_index]
        X_test = X[split_index:]
        y_train = y[:split_index]
        y_test = y[split_index:]
        
        return X_train, X_test, y_train, y_test
    
    def _get_model_candidates(self, model_type: str) -> Dict[str, Any]:
        """Get candidate models for training"""
        models = {}
        
        if model_type == 'all' or model_type == 'random_forest':
            models['random_forest'] = RandomForestRegressor(
                n_estimators=100,
                max_depth=15,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1
            )
        
        if model_type == 'all' or model_type == 'gradient_boosting':
            models['gradient_boosting'] = GradientBoostingRegressor(
                n_estimators=100,
                learning_rate=0.1,
                max_depth=6,
                random_state=42
            )
        
        if model_type == 'all' or model_type == 'linear':
            models['linear_regression'] = LinearRegression()
        
        return models
    
    def _calculate_metrics(self, y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
        """Calculate comprehensive evaluation metrics"""
        mse = mean_squared_error(y_true, y_pred)
        rmse = np.sqrt(mse)
        mae = mean_absolute_error(y_true, y_pred)
        r2 = r2_score(y_true, y_pred)
        
        # Additional metrics
        mape = np.mean(np.abs((y_true - y_pred) / np.abs(y_true))) * 100
        
        # Prediction accuracy within certain ranges
        within_1m = np.mean(np.abs(y_true - y_pred) <= 1.0) * 100
        within_2m = np.mean(np.abs(y_true - y_pred) <= 2.0) * 100
        within_5m = np.mean(np.abs(y_true - y_pred) <= 5.0) * 100
        
        return {
            'mse': round(mse, 4),
            'rmse': round(rmse, 4),
            'mae': round(mae, 4),
            'r2': round(r2, 4),
            'mape': round(mape, 2),
            'within_1m_percent': round(within_1m, 1),
            'within_2m_percent': round(within_2m, 1),
            'within_5m_percent': round(within_5m, 1)
        }
    
    def _cross_validate_model(self, model, X: np.ndarray, y: np.ndarray) -> Dict[str, float]:
        """Perform time series cross-validation"""
        try:
            # Use TimeSeriesSplit for temporal data
            tscv = TimeSeriesSplit(n_splits=5)
            
            cv_scores = cross_val_score(model, X, y, cv=tscv, scoring='r2')
            cv_rmse = -cross_val_score(model, X, y, cv=tscv, scoring='neg_root_mean_squared_error')
            
            return {
                'r2_mean': round(cv_scores.mean(), 4),
                'r2_std': round(cv_scores.std(), 4),
                'rmse_mean': round(cv_rmse.mean(), 4),
                'rmse_std': round(cv_rmse.std(), 4),
                'cv_scores': cv_scores.tolist()
            }
        except Exception as e:
            logger.warning(f"Cross-validation failed: {e}")
            return {'r2_mean': 0.0, 'r2_std': 0.0, 'rmse_mean': 999.0, 'rmse_std': 0.0}
    
    def _get_feature_importance(self, model, feature_names: List[str]) -> Dict[str, float]:
        """Get feature importance from trained model"""
        try:
            if hasattr(model, 'feature_importances_'):
                importance = model.feature_importances_
                importance_dict = dict(zip(feature_names, importance))
                # Sort by importance
                return dict(sorted(importance_dict.items(), key=lambda x: x[1], reverse=True))
            elif hasattr(model, 'coef_'):
                # For linear models, use absolute coefficient values
                importance = np.abs(model.coef_)
                importance_dict = dict(zip(feature_names, importance))
                return dict(sorted(importance_dict.items(), key=lambda x: x[1], reverse=True))
            else:
                return {}
        except Exception as e:
            logger.warning(f"Failed to get feature importance: {e}")
            return {}
    
    def _interpret_model(self, model_info: Dict, feature_names: List[str]) -> Dict[str, Any]:
        """Generate model interpretation and insights"""
        feature_importance = model_info['feature_importance']
        metrics = model_info['metrics']
        
        interpretation = {
            "model_performance": self._interpret_performance(metrics),
            "key_factors": self._interpret_feature_importance(feature_importance),
            "reliability": self._assess_model_reliability(metrics),
            "usage_recommendations": self._generate_usage_recommendations(metrics)
        }
        
        return interpretation
    
    def _interpret_performance(self, metrics: Dict[str, float]) -> Dict[str, Any]:
        """Interpret model performance metrics"""
        r2 = metrics['r2']
        rmse = metrics['rmse']
        
        if r2 >= 0.8:
            performance = "Excellent"
        elif r2 >= 0.6:
            performance = "Good"
        elif r2 >= 0.4:
            performance = "Fair"
        else:
            performance = "Poor"
        
        return {
            "overall_rating": performance,
            "explanation": f"Model explains {r2*100:.1f}% of water level variance",
            "accuracy": f"Typical prediction error: ±{rmse:.1f} meters",
            "precision_1m": f"{metrics.get('within_1m_percent', 0):.1f}% predictions within 1m of actual",
            "precision_2m": f"{metrics.get('within_2m_percent', 0):.1f}% predictions within 2m of actual"
        }
    
    def _interpret_feature_importance(self, importance: Dict[str, float]) -> List[Dict[str, Any]]:
        """Interpret most important features"""
        top_features = list(importance.items())[:5]
        
        interpretations = []
        for feature, score in top_features:
            interpretation = {
                "feature": feature,
                "importance_score": round(score, 4),
                "description": self._get_feature_description(feature)
            }
            interpretations.append(interpretation)
        
        return interpretations
    
    def _get_feature_description(self, feature: str) -> str:
        """Get human-readable description of feature"""
        descriptions = {
            "year": "Year of measurement - captures long-term trends",
            "month": "Month of measurement - captures seasonal patterns",
            "season": "Season classification - monsoon/summer/winter effects",
            "latitude": "North-south location - climate and geology influence",
            "longitude": "East-west location - regional characteristics",
            "distance_from_center": "Distance from geographical center of India",
            "water_level_lag_1": "Previous year's water level - persistence effect",
            "water_level_lag_2": "Two years ago water level - long-term memory",
            "rolling_mean_3": "3-year average - smoothed trend indicator",
            "rolling_mean_5": "5-year average - long-term trend indicator",
            "state_encoded": "State location - regional policies and geology",
            "district_encoded": "District location - local management effects",
            "category_encoded": "Current groundwater category - management status"
        }
        
        return descriptions.get(feature, f"Feature related to {feature}")
    
    def _assess_model_reliability(self, metrics: Dict[str, float]) -> Dict[str, Any]:
        """Assess overall model reliability"""
        r2 = metrics['r2']
        rmse = metrics['rmse']
        
        reliability_score = 0
        
        # R² contribution
        if r2 >= 0.7:
            reliability_score += 40
        elif r2 >= 0.5:
            reliability_score += 25
        elif r2 >= 0.3:
            reliability_score += 15
        
        # RMSE contribution (assuming water levels typically range 0-50m)
        if rmse <= 2:
            reliability_score += 30
        elif rmse <= 5:
            reliability_score += 20
        elif rmse <= 10:
            reliability_score += 10
        
        # Precision contribution
        within_2m = metrics.get('within_2m_percent', 0)
        if within_2m >= 70:
            reliability_score += 30
        elif within_2m >= 50:
            reliability_score += 20
        elif within_2m >= 30:
            reliability_score += 10
        
        if reliability_score >= 80:
            reliability = "High"
        elif reliability_score >= 60:
            reliability = "Medium"
        else:
            reliability = "Low"
        
        return {
            "level": reliability,
            "score": reliability_score,
            "confidence_interval": f"±{rmse * 1.96:.1f}m at 95% confidence",
            "recommended_use": self._get_use_recommendation(reliability)
        }
    
    def _get_use_recommendation(self, reliability: str) -> str:
        """Get usage recommendation based on reliability"""
        recommendations = {
            "High": "Suitable for operational planning and decision making",
            "Medium": "Useful for trend analysis and rough estimates",
            "Low": "Use with caution, primarily for exploratory analysis"
        }
        return recommendations.get(reliability, "Use with extreme caution")
    
    def _generate_usage_recommendations(self, metrics: Dict[str, float]) -> List[str]:
        """Generate specific usage recommendations"""
        recommendations = []
        
        r2 = metrics['r2']
        rmse = metrics['rmse']
        
        if r2 >= 0.6:
            recommendations.append("Model is suitable for medium-term water level forecasting")
        else:
            recommendations.append("Model best used for understanding general trends rather than precise predictions")
        
        if rmse <= 3:
            recommendations.append("Predictions are accurate enough for operational use")
        elif rmse <= 8:
            recommendations.append("Predictions provide useful estimates but should be validated with ground observations")
        else:
            recommendations.append("Predictions have high uncertainty - use only for general trend indication")
        
        within_2m = metrics.get('within_2m_percent', 0)
        if within_2m >= 60:
            recommendations.append("Model demonstrates good accuracy for practical applications")
        else:
            recommendations.append("Consider collecting more training data to improve accuracy")
        
        recommendations.append("Regularly retrain model with new data to maintain accuracy")
        recommendations.append("Validate predictions against actual observations before making decisions")
        
        return recommendations

    async def predict_water_levels(self, 
                                 state: str, 
                                 district: str,
                                 prediction_months: int = 6,
                                 start_date: Optional[datetime] = None) -> Dict[str, Any]:
        """Predict future water levels with confidence intervals"""
        try:
            # Determine model to use
            model_key = state
            
            # Load model if not in memory
            if model_key not in self.models:
                success = await self._load_model(model_key)
                if not success:
                    # Try national model as fallback
                    model_key = 'national'
                    if model_key not in self.models:
                        success = await self._load_model(model_key)
                        if not success:
                            return {
                                "success": False,
                                "error": f"No trained model available for {state} or national level"
                            }
            
            # Get recent historical data for the location
            historical_data = self.db_manager.query_groundwater_data({
                'state': state,
                'district': district
            }, limit=100)
            
            if not historical_data:
                return {
                    "success": False,
                    "error": f"No historical data available for {district}, {state}"
                }
            
            # Generate predictions
            start_date = start_date or datetime.now()
            predictions = []
            
            for i in range(prediction_months):
                prediction_date = start_date + timedelta(days=30 * i)
                
                # Create feature vector for prediction
                feature_vector = self._create_prediction_features(
                    historical_data, state, district, prediction_date
                )
                
                if feature_vector is None:
                    continue
                
                # Make prediction
                predicted_level = self.models[model_key].predict([feature_vector])[0]
                
                # Calculate confidence interval
                confidence_interval = self._calculate_prediction_confidence(
                    predicted_level, historical_data, model_key
                )
                
                # Assess prediction quality
                quality = self._assess_prediction_quality(predicted_level, historical_data)
                
                predictions.append({
                    'date': prediction_date.strftime('%Y-%m-%d'),
                    'year': prediction_date.year,
                    'month': prediction_date.month,
                    'predicted_water_level': round(predicted_level, 2),
                    'confidence_lower': round(confidence_interval[0], 2),
                    'confidence_upper': round(confidence_interval[1], 2),
                    'prediction_quality': quality,
                    'season': self._get_season_name(prediction_date.month)
                })
            
            # Generate insights and recommendations
            insights = self._generate_prediction_insights(predictions, historical_data)
            recommendations = self._generate_prediction_recommendations(predictions, historical_data)
            
            # Get model metadata for transparency
            model_info = self.model_metadata.get(model_key, {})
            
            return {
                "success": True,
                "location": f"{district}, {state}",
                "prediction_period": f"{prediction_months} months",
                "predictions": predictions,
                "insights": insights,
                "recommendations": recommendations,
                "model_info": {
                    "model_type": model_info.get('model_type', 'Unknown'),
                    "training_date": model_info.get('training_date', 'Unknown'),
                    "model_performance": model_info.get('metrics', {}),
                    "model_key_used": model_key,
                    "historical_data_points": len(historical_data)
                },
                "data_sources": [item.get('data_source', 'Unknown') for item in historical_data[:3]],
                "prediction_generated": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Water level prediction failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _create_prediction_features(self, historical_data: List[Dict], state: str, district: str, prediction_date: datetime) -> Optional[np.ndarray]:
        """Create feature vector for a specific prediction"""
        try:
            # Get the most recent historical data point for reference
            recent_data = historical_data[0] if historical_data else {}
            
            # Create feature dictionary
            features = {}
            
            # Time features
            features['year'] = prediction_date.year
            features['years_since_2000'] = prediction_date.year - 2000
            features['month'] = prediction_date.month
            features['season'] = self._get_season_numeric(prediction_date.month)
            
            # Cyclical encoding
            features['month_sin'] = np.sin(2 * np.pi * prediction_date.month / 12)
            features['month_cos'] = np.cos(2 * np.pi * prediction_date.month / 12)
            
            # Geographical features
            features['latitude'] = recent_data.get('latitude', 20.5937)  # Default to center of India
            features['longitude'] = recent_data.get('longitude', 78.9629)
            
            # Distance from center
            india_center_lat, india_center_lon = 20.5937, 78.9629
            features['distance_from_center'] = np.sqrt(
                (features['latitude'] - india_center_lat)**2 + 
                (features['longitude'] - india_center_lon)**2
            )
            
            # Encoded categorical features
            if 'state' in self.label_encoders:
                try:
                    features['state_encoded'] = self.label_encoders['state'].transform([state])[0]
                except ValueError:
                    features['state_encoded'] = self.label_encoders['state'].transform(['Unknown'])[0]
            
            if 'district' in self.label_encoders:
                try:
                    features['district_encoded'] = self.label_encoders['district'].transform([district])[0]
                except ValueError:
                    features['district_encoded'] = self.label_encoders['district'].transform(['Unknown'])[0]
            
            if 'category' in self.label_encoders:
                category = recent_data.get('category', 'Unknown')
                try:
                    features['category_encoded'] = self.label_encoders['category'].transform([category])[0]
                except ValueError:
                    features['category_encoded'] = self.label_encoders['category'].transform(['Unknown'])[0]
            
            # Lag features (from historical data)
            if len(historical_data) >= 1:
                features['water_level_lag_1'] = historical_data[0].get('water_level', 0)
            if len(historical_data) >= 2:
                features['water_level_lag_2'] = historical_data[1].get('water_level', 0)
            
            # Rolling means (approximate from historical data)
            if len(historical_data) >= 3:
                recent_levels = [item.get('water_level', 0) for item in historical_data[:3]]
                features['rolling_mean_3'] = np.mean(recent_levels)
            
            if len(historical_data) >= 5:
                recent_levels = [item.get('water_level', 0) for item in historical_data[:5]]
                features['rolling_mean_5'] = np.mean(recent_levels)
            
            # Convert to array in the same order as training features
            feature_vector = []
            for feature_name in self.feature_columns:
                if feature_name in features:
                    feature_vector.append(features[feature_name])
                else:
                    feature_vector.append(0)  # Default value for missing features
            
            feature_vector = np.array(feature_vector)
            
            # Scale features if scaler is available
            if 'scaler' in self.scalers and len(feature_vector) > 0:
                # Find numerical feature indices (excluding encoded features)
                numerical_indices = [i for i, name in enumerate(self.feature_columns) if 'encoded' not in name]
                if numerical_indices:
                    feature_vector[numerical_indices] = self.scalers['scaler'].transform(
                        feature_vector[numerical_indices].reshape(1, -1)
                    ).flatten()
            
            return feature_vector
            
        except Exception as e:
            logger.error(f"Feature creation failed: {e}")
            return None
    
    def _calculate_prediction_confidence(self, prediction: float, historical_data: List[Dict], model_key: str) -> Tuple[float, float]:
        """Calculate confidence interval for prediction"""
        try:
            # Get model metrics for confidence calculation
            model_info = self.model_metadata.get(model_key, {})
            rmse = model_info.get('metrics', {}).get('rmse', 5.0)
            
            # Simple confidence interval (95%)
            confidence_range = 1.96 * rmse
            
            lower = prediction - confidence_range
            upper = prediction + confidence_range
            
            return (lower, upper)
            
        except Exception as e:
            logger.warning(f"Confidence calculation failed: {e}")
            return (prediction - 5, prediction + 5)  # Default ±5m
    
    def _assess_prediction_quality(self, prediction: float, historical_data: List[Dict]) -> str:
        """Assess the quality/reliability of a specific prediction"""
        try:
            if not historical_data:
                return "low"
            
            # Check consistency with historical data
            recent_levels = [item.get('water_level', 0) for item in historical_data[:5] if item.get('water_level')]
            
            if not recent_levels:
                return "low"
            
            avg_recent = np.mean(recent_levels)
            std_recent = np.std(recent_levels)
            
            # Quality based on deviation from recent average
            deviation = abs(prediction - avg_recent)
            
            if deviation <= std_recent:
                return "high"
            elif deviation <= 2 * std_recent:
                return "medium"
            else:
                return "low"
                
        except Exception as e:
            logger.warning(f"Quality assessment failed: {e}")
            return "medium"
    
    def _get_season_name(self, month: int) -> str:
        """Get season name from month"""
        season_names = {
            0: "Winter",
            1: "Summer", 
            2: "Monsoon",
            3: "Post-Monsoon"
        }
        return season_names.get(self._get_season_numeric(month), "Unknown")
    
    def _generate_prediction_insights(self, predictions: List[Dict], historical_data: List[Dict]) -> List[str]:
        """Generate insights from predictions"""
        insights = []
        
        if not predictions:
            return insights
        
        # Trend analysis
        levels = [p['predicted_water_level'] for p in predictions]
        if len(levels) > 1:
            start_level = levels[0]
            end_level = levels[-1]
            change = end_level - start_level
            
            if abs(change) > 1:
                direction = "decline" if change < 0 else "rise"
                insights.append(f"Predicted {direction} of {abs(change):.1f}m over the forecast period")
            else:
                insights.append("Water levels expected to remain relatively stable")
        
        # Seasonal patterns
        seasonal_levels = {}
        for p in predictions:
            season = p['season']
            if season not in seasonal_levels:
                seasonal_levels[season] = []
            seasonal_levels[season].append(p['predicted_water_level'])
        
        if len(seasonal_levels) > 1:
            season_avgs = {season: np.mean(levels) for season, levels in seasonal_levels.items()}
            max_season = max(season_avgs.keys(), key=lambda x: season_avgs[x])
            min_season = min(season_avgs.keys(), key=lambda x: season_avgs[x])
            
            if season_avgs[max_season] - season_avgs[min_season] > 1:
                insights.append(f"Highest levels expected in {max_season}, lowest in {min_season}")
        
        # Historical comparison
        if historical_data:
            recent_avg = np.mean([item.get('water_level', 0) for item in historical_data[:5] if item.get('water_level')])
            predicted_avg = np.mean(levels)
            
            if predicted_avg < recent_avg - 1:
                insights.append("Predictions suggest below-average water levels compared to recent history")
            elif predicted_avg > recent_avg + 1:
                insights.append("Predictions suggest above-average water levels compared to recent history")
        
        # Confidence assessment
        high_quality = sum(1 for p in predictions if p['prediction_quality'] == 'high')
        if high_quality / len(predictions) > 0.7:
            insights.append("Predictions have high confidence based on model performance")
        elif high_quality / len(predictions) < 0.3:
            insights.append("Predictions have lower confidence - use with caution")
        
        return insights
    
    def _generate_prediction_recommendations(self, predictions: List[Dict], historical_data: List[Dict]) -> List[Dict[str, str]]:
        """Generate actionable recommendations based on predictions"""
        recommendations = []
        
        if not predictions:
            return recommendations
        
        levels = [p['predicted_water_level'] for p in predictions]
        
        # Declining trend recommendations
        if levels[-1] < levels[0] - 2:
            recommendations.append({
                "priority": "high",
                "category": "conservation",
                "action": "Implement water conservation measures",
                "details": "Predicted declining trend requires immediate conservation action"
            })
        
        # Low water level recommendations
        if any(level < -20 for level in levels):  # Assuming -20m is concerning
            recommendations.append({
                "priority": "high",
                "category": "monitoring",
                "action": "Increase monitoring frequency",
                "details": "Predicted low water levels require closer monitoring"
            })
        
        # Seasonal management
        seasonal_levels = {}
        for p in predictions:
            season = p['season']
            if season not in seasonal_levels:
                seasonal_levels[season] = []
            seasonal_levels[season].append(p['predicted_water_level'])
        
        if 'Monsoon' in seasonal_levels and 'Summer' in seasonal_levels:
            monsoon_avg = np.mean(seasonal_levels['Monsoon'])
            summer_avg = np.mean(seasonal_levels['Summer'])
            
            if summer_avg < monsoon_avg - 3:
                recommendations.append({
                    "priority": "medium",
                    "category": "planning",
                    "action": "Plan for summer water stress",
                    "details": "Significant seasonal variation predicted - prepare for summer shortages"
                })
        
        # Model uncertainty recommendations
        low_quality = sum(1 for p in predictions if p['prediction_quality'] == 'low')
        if low_quality / len(predictions) > 0.5:
            recommendations.append({
                "priority": "medium",
                "category": "validation",
                "action": "Validate predictions with field observations",
                "details": "Model uncertainty is high - verify predictions with ground truth data"
            })
        
        # General recommendation
        recommendations.append({
            "priority": "low",
            "category": "planning",
            "action": "Use predictions for long-term planning",
            "details": "Incorporate predictions into water resource management plans"
        })
        
        return recommendations
    
    async def _load_model(self, model_key: str) -> bool:
        """Load saved model from disk"""
        try:
            model_file = os.path.join(self.model_path, f"random_forest_{model_key}.joblib")
            metadata_file = os.path.join(self.model_path, f"metadata_{model_key}.joblib")
            
            if os.path.exists(model_file) and os.path.exists(metadata_file):
                self.models[model_key] = joblib.load(model_file)
                metadata = joblib.load(metadata_file)
                
                self.model_metadata[model_key] = metadata
                self.feature_columns = metadata.get('feature_columns', [])
                self.scalers.update(metadata.get('scalers', {}))
                self.label_encoders.update(metadata.get('label_encoders', {}))
                
                logger.info(f"Loaded model for {model_key}")
                return True
            else:
                logger.warning(f"Model files not found for {model_key}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to load model {model_key}: {e}")
            return False
    
    def get_model_info(self, model_key: str = None) -> Dict[str, Any]:
        """Get information about available models"""
        if model_key:
            return self.model_metadata.get(model_key, {})
        else:
            return {
                "available_models": list(self.model_metadata.keys()),
                "models_in_memory": list(self.models.keys()),
                "model_details": self.model_metadata
            }
    
    def cleanup_old_models(self, days_old: int = 30) -> Dict[str, Any]:
        """Clean up old model files"""
        try:
            cutoff_date = datetime.now() - timedelta(days=days_old)
            removed_files = []
            
            for filename in os.listdir(self.model_path):
                if filename.endswith('.joblib'):
                    file_path = os.path.join(self.model_path, filename)
                    file_time = datetime.fromtimestamp(os.path.getctime(file_path))
                    
                    if file_time < cutoff_date:
                        os.remove(file_path)
                        removed_files.append(filename)
            
            return {
                "success": True,
                "removed_files": removed_files,
                "count": len(removed_files)
            }
            
        except Exception as e:
            logger.error(f"Model cleanup failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
