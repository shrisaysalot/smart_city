import os
import sys
from datetime import date
import pandas as pd

# Add parent directory of this file to PYTHONPATH
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Initialize Django
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from app.models import Ward, CapacityRecord, ForecastResult, ForecastTimeSeries

def run_stress_analysis():
    print("\n=== RUNNING STRESS ANALYSIS & GAP ASSESSMENT ===")
    
    # Target dates for horizons:
    # History ends Dec 2024.
    # 1 Year: Dec 2025
    # 5 Year: Dec 2029
    # 10 Year: Dec 2034
    horizons = {
        1: date(2025, 12, 1),
        5: date(2029, 12, 1),
        10: date(2034, 12, 1)
    }
    
    wards = Ward.objects.all()
    
    # Clear old results
    ForecastResult.objects.all().delete()
    
    results_to_save = []
    reporting_data = []
    
    for ward in wards:
        try:
            capacity = ward.capacity
        except CapacityRecord.DoesNotExist:
            print(f"Warning: Capacity record missing for Ward {ward.ward_id}. Skipping.")
            continue
            
        for yrs, target_date in horizons.items():
            try:
                forecast_point = ForecastTimeSeries.objects.get(ward=ward, date=target_date)
            except ForecastTimeSeries.DoesNotExist:
                print(f"Warning: Forecast missing for Ward {ward.ward_id} on {target_date}. Skipping.")
                continue
                
            # --- Water Demand Stress ---
            water_demand = forecast_point.water_forecast_liters_day
            water_capacity = capacity.water_supply_capacity_liters_day
            
            if water_capacity > 0:
                water_stress = water_demand / water_capacity
            else:
                water_stress = 10.0 # Extreme stress if capacity is 0
                
            water_gap = water_demand - water_capacity
            
            # Determine tier
            if water_stress < 0.70:
                water_tier = 'low'
            elif water_stress <= 0.90:
                water_tier = 'medium'
            else:
                water_tier = 'high'
                
            # Save water result
            results_to_save.append(
                ForecastResult(
                    ward=ward,
                    horizon_years=yrs,
                    utility_type='water',
                    forecasted_demand_liters_day=water_demand,
                    stress_score=water_stress,
                    stress_tier=water_tier
                )
            )
            
            # --- Sewage Demand Stress ---
            sewage_demand = forecast_point.sewage_forecast_liters_day
            sewage_capacity = capacity.stp_capacity_liters_day
            
            if sewage_capacity > 0:
                sewage_stress = sewage_demand / sewage_capacity
            else:
                sewage_stress = 10.0
                
            sewage_gap = sewage_demand - sewage_capacity
            
            # Determine tier
            if sewage_stress < 0.70:
                sewage_tier = 'low'
            elif sewage_stress <= 0.90:
                sewage_tier = 'medium'
            else:
                sewage_tier = 'high'
                
            # Save sewage result
            results_to_save.append(
                ForecastResult(
                    ward=ward,
                    horizon_years=yrs,
                    utility_type='sewage',
                    forecasted_demand_liters_day=sewage_demand,
                    stress_score=sewage_stress,
                    stress_tier=sewage_tier
                )
            )
            
            reporting_data.append({
                'ward_id': ward.ward_id,
                'ward_name': ward.ward_name,
                'horizon': f"{yrs} Yr",
                'water_demand_mld': round(water_demand / 1e6, 2),
                'water_capacity_mld': round(water_capacity / 1e6, 2),
                'water_gap_mld': round(water_gap / 1e6, 2),
                'water_stress': round(water_stress, 2),
                'water_tier': water_tier.upper(),
                'sewage_demand_mld': round(sewage_demand / 1e6, 2),
                'sewage_capacity_mld': round(sewage_capacity / 1e6, 2),
                'sewage_gap_mld': round(sewage_gap / 1e6, 2),
                'sewage_stress': round(sewage_stress, 2),
                'sewage_tier': sewage_tier.upper()
            })
            
    # Bulk create results in database
    ForecastResult.objects.bulk_create(results_to_save)
    print(f"Computed and saved {len(results_to_save)} stress metrics in database.")
    
    # 5. Output ranked intervention priority list
    df = pd.DataFrame(reporting_data)
    
    # Filter and rank for 5 Year Water horizon (Standard Planning Benchmark)
    print("\n=======================================================")
    print("5-YEAR WATER DEMAND PLANNING BENCHMARK (RANKED BY PRIORITY)")
    print("=======================================================")
    water_5yr = df[df['horizon'] == '5 Yr'].sort_values(by='water_stress', ascending=False)
    
    idx = 1
    for _, row in water_5yr.iterrows():
        status_flag = "[CRITICAL]" if row['water_stress'] > 0.9 else "[WARNING]" if row['water_stress'] >= 0.7 else "[NORMAL]"
        print(f"{idx:02d}. {row['ward_id']} - {row['ward_name']}: "
              f"Stress: {row['water_stress']:.2f} ({row['water_tier']}) | "
              f"Demand: {row['water_demand_mld']} MLD | Capacity: {row['water_capacity_mld']} MLD | "
              f"Gap: {row['water_gap_mld']:+0.2f} MLD | {status_flag}")
        idx += 1
        
    # Filter and rank for 5 Year Sewage horizon
    print("\n=======================================================")
    print("5-YEAR SEWAGE GENERATION PLANNING BENCHMARK (RANKED BY PRIORITY)")
    print("=======================================================")
    sewage_5yr = df[df['horizon'] == '5 Yr'].sort_values(by='sewage_stress', ascending=False)
    
    idx = 1
    for _, row in sewage_5yr.iterrows():
        status_flag = "[CRITICAL]" if row['sewage_stress'] > 0.9 else "[WARNING]" if row['sewage_stress'] >= 0.7 else "[NORMAL]"
        print(f"{idx:02d}. {row['ward_id']} - {row['ward_name']}: "
              f"Stress: {row['sewage_stress']:.2f} ({row['sewage_tier']}) | "
              f"Demand: {row['sewage_demand_mld']} MLD | Capacity: {row['sewage_capacity_mld']} MLD | "
              f"Gap: {row['sewage_gap_mld']:+0.2f} MLD | {status_flag}")
        idx += 1

if __name__ == '__main__':
    run_stress_analysis()
