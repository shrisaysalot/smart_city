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
        color: isSelected ? '#ffffff' : '#374151',
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
      weight: isSelected ? 3.5 : 1.5,
      opacity: 1,
      color: isSelected ? '#ffffff' : '#1f2937',
      fillOpacity: isSelected ? 0.8 : 0.55,
    };
  };

  const onEachFeature = (feature, layer) => {
    const props = feature.properties;
    const stressData = props?.stress_data;
    const scoreInfo = stressData?.[viewType]?.[horizonYears.toString()];
    const scoreVal = scoreInfo ? (scoreInfo.score * 100).toFixed(1) : '0.0';
    const tier = scoreInfo ? scoreInfo.tier.toUpperCase() : 'UNKNOWN';

    // Hover effect
    layer.on({
      mouseover: (e) => {
        const l = e.target;
        l.setStyle({
          fillOpacity: 0.85,
          weight: selectedWard && selectedWard.ward_id === props.ward_id ? 3.5 : 2.5,
          color: selectedWard && selectedWard.ward_id === props.ward_id ? '#ffffff' : '#f3f4f6'
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

    // Dynamic label bindings
    layer.bindTooltip(
      `<strong>${props.ward_name}</strong><br/>
       Pop: ${props.population.toLocaleString()}<br/>
       Stress Score: ${scoreVal}% (${tier})`,
      { sticky: true, className: 'map-tooltip' }
    );
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
