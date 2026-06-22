from django.urls import path
from . import views

urlpatterns = [
    path('wards/', views.get_wards, name='wards-list'),
    path('forecast/<str:ward_id>/', views.get_forecast_detail, name='forecast-detail'),
    path('capacity/', views.get_capacities, name='capacity-list'),
    path('auth/login/', views.login_view),
    path('auth/logout/', views.logout_view),
    path('auth/me/', views.me_view),
]
