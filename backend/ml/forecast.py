import os
import sys
import json
import csv
import pandas as pd
import numpy as np
from datetime import datetime, date
import warnings

# Suppress Pyarrow, Prophet, and other runtime warnings
warnings.filterwarnings('ignore')

# Add parent directory of this file to PYTHONPATH
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Initialize Django
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from app.models import Ward, CapacityRecord, HistoricalUsage, ForecastTimeSeries, HAS_GIS

if HAS_GIS:
    from django.contrib.gis.geos import GEOSGeometry

from ml.preprocess import extract_ward_indices

# Disable Prophet logging to keep output clean
import logging
logging.getLogger('prophet').setLevel(logging.WARNING)
logging.getLogger('cmdstanpy').setLevel(logging.WARNING)

# Lazy import of Prophet to avoid import failures before install completes
def get_prophet():
    from prophet import Prophet
    return Prophet

def populate_database():
    """
    Loads mock fixtures and populates the database with basic records.
    """
    print("\n=== POPULATING DATABASE ===")
    
    fixtures_dir = r"c:\Users\shris\OneDrive\Desktop\smart_city\backend\fixtures"
    geojson_path = os.path.join(fixtures_dir, "Vijayawada_Wards.geojson")
    
    # 1. Populating Wards
    print("Populating Wards from GeoJSON...")
    with open(geojson_path, 'r') as f:
        wards_data = json.load(f)
        
    # Calculate total Shape_Area to distribute population proportionally
    total_area = sum(feature['properties'].get('Shape_Area', 0.0) for feature in wards_data['features'])
    if total_area == 0:
        total_area = 1.0 # fallback
        
    created_wards = []
    
    for feature in wards_data['features']:
        props = feature['properties']
        geom_json = feature['geometry']
        
        ward_id = props.get('ward_id') or props.get('WARD_NO')
        ward_name = props.get('ward_name') or f"Ward {props.get('WARD_NO')}"
        
        # Distribute 2011 city population (1,035,000) proportionally by Shape_Area
        shape_area = props.get('Shape_Area', 0.0)
        ward_area_ratio = shape_area / total_area
        ward_pop_2011 = 1035000 * ward_area_ratio
        
        # Grow at 3% per year from 2011 to 2024 (13 years)
        population = int(ward_pop_2011 * (1.03 ** 13))
        
        area_sqkm = props.get('area_sqkm')
        if area_sqkm is None:
            # Shape_Area is in decimal degrees. Convert to sq km.
            area_sqkm = round(shape_area * 11840, 3)
            
        defaults = {
            'ward_name': ward_name,
            'population': population,
            'area_sqkm': area_sqkm,
        }
        
        if HAS_GIS:
            geom = GEOSGeometry(json.dumps(geom_json))
            defaults['geom'] = geom
        else:
            defaults['geom_json'] = json.dumps(geom_json)
            
        ward, created = Ward.objects.update_or_create(
            ward_id=ward_id,
            defaults=defaults
        )
        created_wards.append(ward)

    # 2. Extracting & Populating Satellite Indices
    print("Extracting and populating satellite indices...")
    indices = extract_ward_indices(geojson_path)
    for ind in indices:
        Ward.objects.filter(ward_id=ind['ward_id']).update(
            ndvi=ind['ndvi'],
            ndbi=ind['ndbi'],
            mndwi=ind['mndwi']
        )
    print("  Satellite indices updated.")

    # 3. Populating Capacity Records & 4. Populating Historical Usage
    print("Generating and Populating capacities & historical usage based on real statistics...")
    
    # Clear old capacities and usages
    CapacityRecord.objects.all().delete()
    HistoricalUsage.objects.all().delete()
    
    usage_records = []
    import random
    
    for i, ward in enumerate(created_wards):
        # Base population at 2024
        population_2024 = ward.population
        
        # Calculate 2024 average water demand (150 LPCD)
        ward_demand_2024_liters = population_2024 * 150
        sewage_2024_liters = ward_demand_2024_liters * 0.85
        
        # 1. Capacity Record
        # Water supply capacity = (ward_demand_2024 / 0.73) * headroom (20% average, vary per ward, non-revenue water loss: 27%)
        random.seed(int(ward.ward_id))
        water_headroom = random.uniform(0.85, 1.45)
        water_capacity = (ward_demand_2024_liters / 0.73) * water_headroom
        
        # STP capacity = sewage_2024 * 1.1 for most wards, but make 20% of wards already at or over capacity (<1.0)
        if i % 5 == 0:
            stp_headroom = random.uniform(0.80, 0.98)
        else:
            stp_headroom = random.uniform(1.05, 1.15)
            
        stp_capacity = sewage_2024_liters * stp_headroom
        
        CapacityRecord.objects.create(
            ward=ward,
            water_supply_capacity_liters_day=water_capacity,
            stp_capacity_liters_day=stp_capacity
        )
        
        # 2. Historical Usage (2018-2024 monthly)
        for year in range(2018, 2025):
            # Scale population back by 3% annually for previous years
            pop_year = int(population_2024 / (1.03 ** (2024 - year)))
            
            for month in range(1, 13):
                date_val = date(year, month, 1)
                base_demand_liters = pop_year * 150
                
                # Seasonal variation: +15% in summer (April-June), -10% in monsoon (July-Sept)
                if month in [4, 5, 6]:
                    season_factor = 1.15
                elif month in [7, 8, 9]:
                    season_factor = 0.90
                else:
                    season_factor = 1.0
                    
                # Random noise (±3%)
                noise = random.uniform(-0.03, 0.03)
                
                water_liters = base_demand_liters * season_factor * (1.0 + noise)
                sewage_liters = water_liters * 0.85
                
                usage_records.append(
                    HistoricalUsage(
                        ward=ward,
                        date=date_val,
                        water_liters_day=water_liters,
                        sewage_liters_day=sewage_liters
                    )
                )
                
    # Bulk create historical usage records
    HistoricalUsage.objects.bulk_create(usage_records)
    print(f"  Successfully generated and loaded {len(created_wards)} capacity records.")
    print(f"  Successfully loaded {len(usage_records)} historical usage records.")

def train_and_predict():
    """
    Fits Prophet forecasting models for each ward (Water & Sewage)
    and populates ForecastTimeSeries in the DB.
    """
    print("\n=== RUNNING PROPHET FORECAST PIPELINE ===")
    
    wards = Ward.objects.all()
    Prophet = get_prophet()
    
    # Clean old forecasts
    ForecastTimeSeries.objects.all().delete()
    
    forecast_points_to_save = []
    
    for i, ward in enumerate(wards):
        print(f"[{i+1}/{len(wards)}] Fitting Prophet models for Ward {ward.ward_id} ({ward.ward_name})...")
        
        # Load history
        history = HistoricalUsage.objects.filter(ward=ward).order_by('date')
        history_df = pd.DataFrame(list(history.values('date', 'water_liters_day', 'sewage_liters_day')))
        
        if history_df.empty:
            print(f"  No history found for Ward {ward.ward_id}. Skipping.")
            continue
            
        history_df['ds'] = pd.to_datetime(history_df['date'])
        
        # 1. Forecast Water Demand
        df_water = history_df[['ds', 'water_liters_day']].rename(columns={'water_liters_day': 'y'})
        m_water = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=False,
            daily_seasonality=False,
            interval_width=0.95
        )
        m_water.fit(df_water)
        
        # 120 periods (10 years) monthly forecast, starting 2025-01-01
        future_water = m_water.make_future_dataframe(periods=120, freq='MS')
        # Filter for only future records (after 2024-12-01)
        future_water = future_water[future_water['ds'] > '2024-12-01']
        forecast_water = m_water.predict(future_water)
        
        # 2. Forecast Sewage Demand
        df_sewage = history_df[['ds', 'sewage_liters_day']].rename(columns={'sewage_liters_day': 'y'})
        m_sewage = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=False,
            daily_seasonality=False,
            interval_width=0.95
        )
        m_sewage.fit(df_sewage)
        
        future_sewage = m_sewage.make_future_dataframe(periods=120, freq='MS')
        future_sewage = future_sewage[future_sewage['ds'] > '2024-12-01']
        forecast_sewage = m_sewage.predict(future_sewage)
        
        # Combine and store forecast time series
        # Map values by date
        forecast_water.set_index('ds', inplace=True)
        forecast_sewage.set_index('ds', inplace=True)
        
        all_future_dates = forecast_water.index
        for dt in all_future_dates:
            dt_date = dt.to_pydatetime().date()
            
            # Extract yhat predictions (prevent negative values via clip)
            water_pred = max(0.0, float(forecast_water.loc[dt, 'yhat']))
            sewage_pred = max(0.0, float(forecast_sewage.loc[dt, 'yhat']))
            
            forecast_points_to_save.append(
                ForecastTimeSeries(
                    ward=ward,
                    date=dt_date,
                    water_forecast_liters_day=water_pred,
                    sewage_forecast_liters_day=sewage_pred
                )
            )
            
    # Bulk save to DB
    ForecastTimeSeries.objects.bulk_create(forecast_points_to_save)
    print(f"\nSuccessfully stored {len(forecast_points_to_save)} forecasted data points.")
    
    # Run stress analysis
    from ml.stress import run_stress_analysis
    run_stress_analysis()

if __name__ == '__main__':
    populate_database()
    train_and_predict()
