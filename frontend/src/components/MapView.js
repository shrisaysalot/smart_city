import React from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const MapView = ({ wardsGeojson, selectedWard, onSelectWard, viewType, horizonYears }) => {
  // Center coordinates for Vijayawada, Andhra Pradesh
  const mapCenter = [16.506, 80.648];
  const defaultZoom = 12;

  // Choropleth color coding based on stress ratio
  const getStyle = (feature) => {
    const stressData = feature.properties?.stress_data;
    const isSelected = selectedWard && selectedWard.ward_id === feature.properties.ward_id;

    if (!stressData) {
      return {
        fillColor: '#9ca3af',
        weight: isSelected ? 3 : 1.5,
        opacity: 1,
        color: isSelected ? '#3b82f6' : '#374151',
        fillOpacity: 0.4,
      };
    }

    const scoreInfo = stressData[viewType]?.[horizonYears.toString()];
    const score = scoreInfo ? scoreInfo.score : 0;

    let fillColor = '#10b981'; // Green (Low stress < 70%)
    if (score > 0.9) {
      fillColor = '#ef4444'; // Red (High stress > 90%)
    } else if (score >= 0.7) {
      fillColor = '#f59e0b'; // Orange/Amber (Medium stress 70% - 90%)
    }

    return {
      fillColor: fillColor,
      weight: isSelected ? 3 : 1.5,
      opacity: 1,
      color: isSelected ? '#3b82f6' : '#1f2937',
      fillOpacity: isSelected ? 0.8 : 0.55,
    };
  };

  const onEachFeature = (feature, layer) => {
    const props = feature.properties;
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
    let stressColor = '#10b981';
    if (score > 0.9) {
      stressColor = '#ef4444';
    } else if (score >= 0.7) {
      stressColor = '#f59e0b';
    }
    const stressTier = scoreInfo && scoreInfo.tier
      ? scoreInfo.tier.charAt(0).toUpperCase() + scoreInfo.tier.slice(1).toLowerCase()
      : 'Unknown';
    const demand = demandMLD;

    layer.bindTooltip(`
      <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:10px 14px;font-family:inherit;min-width:180px">
        <div style="font-size:13px;font-weight:600;color:#f1f5f9;margin-bottom:6px">${wardName}</div>
        <div style="font-size:11px;color:#64748b;margin-bottom:2px">Stress Level</div>
        <div style="font-size:13px;color:${stressColor};font-weight:500">${stressPercent}% ${stressTier}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;margin-bottom:2px">Projected Demand</div>
        <div style="font-size:13px;color:#f1f5f9">${demand} MLD</div>
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
        {/* Modern dark cartographic basemap */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        
        {wardsGeojson && (
          <GeoJSON
            // The unique key forces Leaflet to re-draw and re-color the layer
            // when the view style inputs (metric, horizon, selection) change.
            key={`${viewType}-${horizonYears}-${selectedWard ? selectedWard.ward_id : 'none'}`}
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
