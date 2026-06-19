import json
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Ward, CapacityRecord, HistoricalUsage, ForecastTimeSeries, HAS_GIS
from .serializers import WardSerializer, CapacityRecordSerializer, HistoricalUsageSerializer, ForecastTimeSeriesSerializer

@api_view(['GET'])
def get_wards(request):
    """
    Returns GeoJSON FeatureCollection of wards with coordinates and pre-calculated stress metrics.
    """
    wards = Ward.objects.all()
    if HAS_GIS:
        serializer = WardSerializer(wards, many=True)
        return Response(serializer.data)
    else:
        # Construct standard GeoJSON manually from text-based storage
        features = []
        serializer = WardSerializer(wards, many=True)
        for data in serializer.data:
            geom_str = data.pop('geom_json', None)
            try:
                geom = json.loads(geom_str) if geom_str else None
            except Exception:
                geom = None
                
            features.append({
                "type": "Feature",
                "properties": data,
                "geometry": geom
            })
            
        return Response({
            "type": "FeatureCollection",
            "features": features
        })

@api_view(['GET'])
def get_capacities(request):
    """
    Returns current water supply and STP capacities for all wards.
    """
    capacities = CapacityRecord.objects.all()
    serializer = CapacityRecordSerializer(capacities, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def get_forecast_detail(request, ward_id):
    """
    Returns a unified historical and forecasted timeline for a specific ward.
    """
    try:
        ward = Ward.objects.get(ward_id=ward_id)
    except Ward.DoesNotExist:
        return Response({"detail": f"Ward '{ward_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

    # Retrieve history sorted by date
    history = HistoricalUsage.objects.filter(ward=ward).order_by('date')
    history_serializer = HistoricalUsageSerializer(history, many=True)

    # Retrieve future forecasts sorted by date
    forecast = ForecastTimeSeries.objects.filter(ward=ward).order_by('date')
    forecast_serializer = ForecastTimeSeriesSerializer(forecast, many=True)

    # Get capacity metrics
    try:
        cap = ward.capacity
        capacity_data = {
            "water_supply_capacity_liters_day": cap.water_supply_capacity_liters_day,
            "stp_capacity_liters_day": cap.stp_capacity_liters_day
        }
    except CapacityRecord.DoesNotExist:
        capacity_data = None

    return Response({
        "ward_id": ward.ward_id,
        "ward_name": ward.ward_name,
        "population": ward.population,
        "area_sqkm": ward.area_sqkm,
        "ndvi": ward.ndvi,
        "ndbi": ward.ndbi,
        "mndwi": ward.mndwi,
        "capacity": capacity_data,
        "history": history_serializer.data,
        "forecast": forecast_serializer.data
    })
