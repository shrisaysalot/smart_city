from django.db import models

# Detect GDAL presence to conditionally import spatial database fields
HAS_GIS = False
try:
    from django.contrib.gis.db import models as gis_models
    from django.contrib.gis.gdal import HAS_GDAL
    HAS_GIS = HAS_GDAL
except Exception:
    pass

class Ward(models.Model):
    ward_id = models.CharField(max_length=10, primary_key=True)
    ward_name = models.CharField(max_length=100)
    population = models.IntegerField()
    area_sqkm = models.FloatField()
    
    # Precomputed satellite indices (mocked)
    ndvi = models.FloatField(null=True, blank=True)
    ndbi = models.FloatField(null=True, blank=True)
    mndwi = models.FloatField(null=True, blank=True)

    if HAS_GIS:
        # Spatial boundary polygon (WGS84 EPSG:4326)
        geom = gis_models.PolygonField(srid=4326)
    else:
        # Fallback to text storage of coordinates/GeoJSON geometry for zero-config environments
        geom_json = models.TextField()

    def __str__(self):
        return f"{self.ward_name} ({self.ward_id})"

class CapacityRecord(models.Model):
    ward = models.OneToOneField(Ward, on_delete=models.CASCADE, related_name='capacity')
    water_supply_capacity_liters_day = models.FloatField()
    stp_capacity_liters_day = models.FloatField()

    def __str__(self):
        return f"Capacity for {self.ward.ward_name}"

class HistoricalUsage(models.Model):
    ward = models.ForeignKey(Ward, on_delete=models.CASCADE, related_name='historical_usages')
    date = models.DateField()
    water_liters_day = models.FloatField()
    sewage_liters_day = models.FloatField()

    class Meta:
        unique_together = ('ward', 'date')
        ordering = ['date']

    def __str__(self):
        return f"{self.ward.ward_id} Usage - {self.date}"

class ForecastResult(models.Model):
    # Summary of stress scores per horizon and utility type
    ward = models.ForeignKey(Ward, on_delete=models.CASCADE, related_name='forecast_results')
    horizon_years = models.IntegerField() # 1, 5, or 10
    utility_type = models.CharField(max_length=10) # 'water' or 'sewage'
    forecasted_demand_liters_day = models.FloatField()
    stress_score = models.FloatField()
    stress_tier = models.CharField(max_length=10) # 'low', 'medium', 'high'
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('ward', 'horizon_years', 'utility_type')

    def __str__(self):
        return f"{self.ward.ward_id} - {self.utility_type} {self.horizon_years}Yr Forecast"

class ForecastTimeSeries(models.Model):
    # Detailed future forecast points for line charts (monthly projection)
    ward = models.ForeignKey(Ward, on_delete=models.CASCADE, related_name='forecast_timeseries')
    date = models.DateField()
    water_forecast_liters_day = models.FloatField()
    sewage_forecast_liters_day = models.FloatField()

    class Meta:
        unique_together = ('ward', 'date')
        ordering = ['date']

    def __str__(self):
        return f"{self.ward.ward_id} Forecast - {self.date}"

from django.contrib.auth.models import User

class UserProfile(models.Model):
    ROLES = [
        ('admin', 'Admin'),
        ('planner', 'Planner'),
        ('engineer', 'Engineer'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=ROLES, default='planner')
    assigned_wards = models.JSONField(default=list, blank=True)  # for engineers: list of ward IDs they can see

    def __str__(self):
        return f"{self.user.username} ({self.role})"
