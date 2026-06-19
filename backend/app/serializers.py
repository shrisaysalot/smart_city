from rest_framework import serializers
from .models import Ward, CapacityRecord, ForecastResult, HistoricalUsage, ForecastTimeSeries, HAS_GIS

def get_ward_stress_data(obj):
    results = ForecastResult.objects.filter(ward=obj)
    data = {
        "water": {},
        "sewage": {}
    }
    for r in results:
        data[r.utility_type][str(r.horizon_years)] = {
            "score": round(r.stress_score, 3),
            "tier": r.stress_tier,
            "demand": round(r.forecasted_demand_liters_day, 1)
        }
    return data

def get_ward_capacity_data(obj):
    try:
        cap = obj.capacity
        return {
            "water_capacity": cap.water_supply_capacity_liters_day,
            "sewage_capacity": cap.stp_capacity_liters_day
        }
    except CapacityRecord.DoesNotExist:
        return None

if HAS_GIS:
    from rest_framework_gis.serializers import GeoFeatureModelSerializer
    
    class WardSerializer(GeoFeatureModelSerializer):
        stress_data = serializers.SerializerMethodField()
        capacity = serializers.SerializerMethodField()

        class Meta:
            model = Ward
            geo_field = 'geom'
            fields = ('ward_id', 'ward_name', 'population', 'area_sqkm', 'ndvi', 'ndbi', 'mndwi', 'stress_data', 'capacity')

        def get_stress_data(self, obj):
            return get_ward_stress_data(obj)

        def get_capacity(self, obj):
            return get_ward_capacity_data(obj)
else:
    class WardSerializer(serializers.ModelSerializer):
        stress_data = serializers.SerializerMethodField()
        capacity = serializers.SerializerMethodField()

        class Meta:
            model = Ward
            fields = ('ward_id', 'ward_name', 'population', 'area_sqkm', 'ndvi', 'ndbi', 'mndwi', 'stress_data', 'capacity', 'geom_json')

        def get_stress_data(self, obj):
            return get_ward_stress_data(obj)

        def get_capacity(self, obj):
            return get_ward_capacity_data(obj)

class CapacityRecordSerializer(serializers.ModelSerializer):
    ward_name = serializers.ReadOnlyField(source='ward.ward_name')

    class Meta:
        model = CapacityRecord
        fields = ('id', 'ward', 'ward_name', 'water_supply_capacity_liters_day', 'stp_capacity_liters_day')

class HistoricalUsageSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistoricalUsage
        fields = ('date', 'water_liters_day', 'sewage_liters_day')

class ForecastTimeSeriesSerializer(serializers.ModelSerializer):
    class Meta:
        model = ForecastTimeSeries
        fields = ('date', 'water_forecast_liters_day', 'sewage_forecast_liters_day')
