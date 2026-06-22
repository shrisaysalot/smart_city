import React from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const MapView = ({ wardsGeojson, selectedWard, onSelectWard, viewType, horizonYears, user }) => {
  // Center coordinates for Vijayawada, Andhra Pradesh
  const mapCenter = [16.506, 80.648];
  const defaultZoom = 12;

  // Choropleth color coding based on stress ratio
  const getStyle = (feature) => {
    if (user && user.role === 'engineer' && user.assigned_wards.length > 0) {
      if (!user.assigned_wards.includes(String(feature.properties.ward_id))) {
        return {
          fillColor: '#9ca3af',
          weight: 1.5,
          opacity: 0.3,
          color: '#FFFFFF',
          fillOpacity: 0.15,
        };
      }
    }
    const stressData = feature.properties?.stress_data;
    const isSelected = selectedWard && selectedWard.ward_id === feature.properties.ward_id;

    if (!stressData) {
      return {
        fillColor: '#9ca3af',
        weight: isSelected ? 3 : 1.5,
        opacity: 1,
        color: isSelected ? '#2563EB' : '#FFFFFF',
        fillOpacity: 0.55,
      };
    }

    const scoreInfo = stressData[viewType]?.[horizonYears.toString()];
    const score = scoreInfo ? scoreInfo.score : 0;

    let fillColor = '#16A34A'; // Green (Low stress < 70%)
    if (score > 0.9) {
      fillColor = '#DC2626'; // Red (High stress > 90%)
    } else if (score >= 0.7) {
      fillColor = '#D97706'; // Orange/Amber (Medium stress 70% - 90%)
    }

    return {
      fillColor: fillColor,
      weight: isSelected ? 3 : 1.5,
      opacity: 1,
      color: isSelected ? '#2563EB' : '#FFFFFF',
      fillOpacity: 0.55,
    };
  };

  const onEachFeature = (feature, layer) => {
    const props = feature.properties;
    const wardId = props.ward_id;

    if (user && user.role === 'engineer' && user.assigned_wards.length > 0) {
      if (!user.assigned_wards.includes(String(wardId))) {
        layer.setStyle({ fillOpacity: 0.15, opacity: 0.3 }); // fade out non-assigned wards
        layer.unbindTooltip();
        layer.on({
          click: () => {
            alert("Access restricted to your assigned wards");
          }
        });
        return; // don't add standard click and hover handlers
      }
    }

    const stressData = props?.stress_data;
    const scoreInfo = stressData?.[viewType]?.[horizonYears.toString()];
    const scoreVal = scoreInfo ? (scoreInfo.score * 100).toFixed(1) : '0.0';
    const demandLiters = scoreInfo ? scoreInfo.demand : 0;
    const demandMLD = (demandLiters / 1000000).toFixed(2);

    // Hover effect
    layer.on({
      mouseover: (e) => {
        const l = e.target;
        l.setStyle({
          fillOpacity: 0.85,
          weight: 2,
          color: '#ffffff'
        });
      },
      mouseout: (e) => {
        const l = e.target;
        // Revert style to default state
        l.setStyle(getStyle(feature));
      },
      click: () => {
        onSelectWard(props);
      },
    });

    const wardName = props.ward_name;
    const stressPercent = scoreVal;
    const score = scoreInfo ? scoreInfo.score : 0;
    let stressColor = '#16A34A';
    if (score > 0.9) {
      stressColor = '#DC2626';
    } else if (score >= 0.7) {
      stressColor = '#D97706';
    }
    const stressTier = scoreInfo && scoreInfo.tier
      ? scoreInfo.tier.charAt(0).toUpperCase() + scoreInfo.tier.slice(1).toLowerCase()
      : 'Unknown';
    const demand = demandMLD;

    layer.bindTooltip(`
      <div style="background:#ffffff;border:1px solid rgba(0,0,0,0.08);border-radius:8px;padding:10px 14px;font-family:inherit;min-width:180px;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
        <div style="font-size:13px;font-weight:600;color:#1A2332;margin-bottom:6px">${wardName}</div>
        <div style="font-size:11px;color:#8A9AB0;margin-bottom:2px">Stress Level</div>
        <div style="font-size:13px;color:${stressColor};font-weight:600">${stressPercent}% ${stressTier}</div>
        <div style="font-size:11px;color:#8A9AB0;margin-top:4px;margin-bottom:2px">Projected Demand</div>
        <div style="font-size:13px;color:#1A2332;font-weight:600">${demand} MLD</div>
      </div>
    `, { className: 'custom-tooltip', sticky: true, opacity: 1 });
  };

  return (
    <div className="map-view-container">
      <MapContainer
        center={mapCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        {/* Esri World Imagery satellite tiles */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
          maxZoom={19}
        />
        
        {/* CartoDB Light labels overlay */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        
        {wardsGeojson && (
          <GeoJSON
            // The unique key forces Leaflet to re-draw and re-color the layer
            // when the view style inputs (metric, horizon, selection, user) change.
            key={`${viewType}-${horizonYears}-${selectedWard ? selectedWard.ward_id : 'none'}-${user ? user.username : 'none'}`}
            data={wardsGeojson}
            style={getStyle}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default MapView;
