import os
import sys
import json
import csv
import pandas as pd
import numpy as np
from datetime import datetime
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
    capacity_path = os.path.join(fixtures_dir, "mock_capacity.json")
    usage_path = os.path.join(fixtures_dir, "mock_usage.csv")
    
    # 1. Populating Wards
    print("Populating Wards from GeoJSON...")
    with open(geojson_path, 'r') as f:
        wards_data = json.load(f)
        
    for feature in wards_data['features']:
        props = feature['properties']
        geom_json = feature['geometry']
        
        ward_id = props.get('ward_id') or props.get('WARD_NO')
        ward_name = props.get('ward_name') or f"Ward {props.get('WARD_NO')}"
        
        population = props.get('population')
        if population is None:
            import random
            random.seed(int(props.get('WARD_NO', 1)))
            population = random.randint(15000, 45000)
            
        area_sqkm = props.get('area_sqkm')
        if area_sqkm is None:
            # Shape_Area is in decimal degrees. Convert to sq km.
            area_sqkm = round(props.get('Shape_Area', 0.0) * 11840, 3)
            
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

    # Create mapping from mock ward IDs (W01-W20) to real wards
    all_wards = list(Ward.objects.all().order_by('ward_id'))
    mock_to_real_map = {}
    for i, ward in enumerate(all_wards):
        mock_id = f"W{(i % 20) + 1:02d}"
        if mock_id not in mock_to_real_map:
            mock_to_real_map[mock_id] = []
        mock_to_real_map[mock_id].append(ward)

    # 3. Populating Capacity Records
    print("Populating Infrastructure Capacities...")
    with open(capacity_path, 'r') as f:
        capacity_data = json.load(f)
        
    for cap in capacity_data:
        mock_id = cap['ward_id']
        target_wards = mock_to_real_map.get(mock_id, [])
        for ward in target_wards:
            CapacityRecord.objects.update_or_create(
                ward=ward,
                defaults={
                    'water_supply_capacity_liters_day': cap['water_supply_capacity_liters_day'],
                    'stp_capacity_liters_day': cap['stp_capacity_liters_day']
                }
            )
    print("  Capacity records updated.")

    # 4. Populating Historical Usage
    print("Populating Historical Usage (this may take a few seconds)...")
    usage_records = []
    with open(usage_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            mock_id = row['ward_id']
            target_wards = mock_to_real_map.get(mock_id, [])
            date_val = datetime.strptime(row['date'], "%Y-%m-%d").date()
            for ward in target_wards:
                usage_records.append(
                    HistoricalUsage(
                        ward=ward,
                        date=date_val,
                        water_liters_day=float(row['water_liters_day']),
                        sewage_liters_day=float(row['sewage_liters_day'])
                    )
                )
            
    # Bulk create to make it super fast
    HistoricalUsage.objects.all().delete()
    HistoricalUsage.objects.bulk_create(usage_records)
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
