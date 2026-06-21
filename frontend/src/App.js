import React, { useState, useEffect, useRef } from 'react';
import { getWards, getForecast } from './api/forecasts';
import MapView from './components/MapView';
import WardPanel from './components/WardPanel';
import StressLegend from './components/StressLegend';
import 'leaflet/dist/leaflet.css';
import './App.css';

function App() {
  const [wardsGeojson, setWardsGeojson] = useState(null);
  const [selectedWard, setSelectedWard] = useState(null);
  const [viewType, setViewType] = useState('water'); // 'water' or 'sewage'
  const [horizonYears, setHorizonYears] = useState(5); // 1, 5, 10 years
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [popGrowth, setPopGrowth] = useState(1.0);
  const [urbanExpansion, setUrbanExpansion] = useState(1.0);
  const [wardForecast, setWardForecast] = useState(null);

  const [simPos, setSimPos] = useState({ x: 24, y: 24 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [minimized, setMinimized] = useState(false);
  const simRef = useRef(null);

  const handleMouseDown = (e) => {
    setDragging(true);
    const rect = simRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: rect.bottom - e.clientY
    });
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragging) return;
      setSimPos({
        x: window.innerWidth - e.clientX - (280 - dragOffset.x),
        y: window.innerHeight - e.clientY - dragOffset.y
      });
    };
    const handleMouseUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, dragOffset]);

  useEffect(() => {
    setSimPos({
      x: selectedWard ? 390 : 24,
      y: 24
    });
  }, [selectedWard]);

  useEffect(() => {
    if (!selectedWard) {
      setWardForecast(null);
      return;
    }
    
    // Reset sliders when ward changes
    setPopGrowth(1.0);
    setUrbanExpansion(1.0);

    const fetchForecast = async () => {
      try {
        const data = await getForecast(selectedWard.ward_id);
        setWardForecast(data);
      } catch (err) {
        console.error('Error fetching detailed forecast:', err);
      }
    };

    fetchForecast();
  }, [selectedWard]);

  useEffect(() => {
    const fetchWards = async () => {
      try {
        setLoading(true);
        const data = await getWards();
        setWardsGeojson(data);
      } catch (err) {
        setError('Failed to fetch municipal ward GIS geometries. Please ensure the Django backend is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchWards();
  }, []);

  const handleSelectWard = (wardProperties) => {
    setSelectedWard(wardProperties);
  };

  const handleClosePanel = () => {
    setSelectedWard(null);
  };

  // Calculate stress counts dynamically based on current selections
  const getStressCounts = () => {
    let high = 0;
    let medium = 0;
    let low = 0;
    
    if (wardsGeojson && wardsGeojson.features) {
      wardsGeojson.features.forEach(feature => {
        const stressData = feature.properties?.stress_data;
        if (stressData) {
          const scoreInfo = stressData[viewType]?.[horizonYears.toString()];
          const score = scoreInfo ? scoreInfo.score : 0;
          if (score > 0.9) {
            high++;
          } else if (score >= 0.7) {
            medium++;
          } else {
            low++;
          }
        } else {
          low++;
        }
      });
    }
    return { high, medium, low };
  };

  const { high, medium, low } = getStressCounts();

  const isWater = viewType === 'water';
  let capacity = 0;
  let forecastedDemand = 0;
  
  if (selectedWard && wardForecast) {
    const capacityLiters = isWater 
      ? wardForecast.capacity?.water_supply_capacity_liters_day 
      : wardForecast.capacity?.stp_capacity_liters_day;
    capacity = capacityLiters ? capacityLiters / 1000000 : 0;

    const forecastLimit = horizonYears * 12;
    const filteredForecast = wardForecast.forecast ? wardForecast.forecast.slice(0, forecastLimit) : [];
    const lastForecastPoint = filteredForecast[filteredForecast.length - 1];
    const targetDemandLiters = isWater 
      ? lastForecastPoint?.water_forecast_liters_day 
      : lastForecastPoint?.sewage_forecast_liters_day;
    forecastedDemand = targetDemandLiters ? targetDemandLiters / 1000000 : 0;
  }

  const adjDemand = (forecastedDemand * popGrowth * urbanExpansion).toFixed(2);
  const adjDeficit = (capacity - adjDemand).toFixed(2);
  const adjStress = capacity > 0 ? ((adjDemand / capacity) * 100).toFixed(1) : '0.0';
  const tier = parseFloat(adjStress) > 90 ? 'HIGH' : parseFloat(adjStress) > 70 ? 'MEDIUM' : 'LOW';
  const tierColor = tier === 'HIGH' ? '#ef4444' : tier === 'MEDIUM' ? '#f59e0b' : '#22c55e';

  return (
    <div className="app-container">
      {/* Premium Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="logo-icon">ULB</div>
          <div>
            <h1>AP Smart Utility Demand Forecasting</h1>
            <p className="subtitle">AI-Enabled Decision Support System &bull; Vijayawada Municipal Corporation</p>
          </div>
        </div>
        <div className="header-status">
          <div className="stat-chip">77 Wards</div>
          <div className="stat-chip">216 MLD Supply</div>
          <div className="stat-chip">132 MLD Sewage</div>
          <span className="live-indicator">POC ACTIVE</span>
        </div>
      </header>

      {/* Control Console */}
      <section className="control-console">
        <div className="control-group">
          <label className="control-label">Analysis Target</label>
          <div className="toggle-container">
            <button 
              className={`toggle-btn ${viewType === 'water' ? 'active' : ''}`}
              onClick={() => setViewType('water')}
            >
              Water Supply Demand
            </button>
            <button 
              className={`toggle-btn ${viewType === 'sewage' ? 'active' : ''}`}
              onClick={() => setViewType('sewage')}
            >
              Sewerage Generation
            </button>
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">Planning Horizon</label>
          <div className="horizon-tabs">
            <button 
              className={`tab-btn ${horizonYears === 1 ? 'active' : ''}`}
              onClick={() => setHorizonYears(1)}
            >
              1 Year (Short-Term)
            </button>
            <button 
              className={`tab-btn ${horizonYears === 5 ? 'active' : ''}`}
              onClick={() => setHorizonYears(5)}
            >
              5 Years (Mid-Term)
            </button>
            <button 
              className={`tab-btn ${horizonYears === 10 ? 'active' : ''}`}
              onClick={() => setHorizonYears(10)}
            >
              10 Years (Long-Term)
            </button>
          </div>
        </div>
      </section>

      {/* City-wide summary bar */}
      {!loading && !error && wardsGeojson && (
        <div className="city-summary-bar">
          <div className="summary-item">
            <span className="summary-label">Total Wards:</span>
            <span className="summary-value">{wardsGeojson.features?.length || 77}</span>
          </div>
          <span className="summary-divider">|</span>
          <div className="summary-item">
            <span className="summary-label">High Stress:</span>
            <span className="summary-value high">{high}</span>
          </div>
          <span className="summary-divider">|</span>
          <div className="summary-item">
            <span className="summary-label">Medium Stress:</span>
            <span className="summary-value medium">{medium}</span>
          </div>
          <span className="summary-divider">|</span>
          <div className="summary-item">
            <span className="summary-label">Low Stress:</span>
            <span className="summary-value low">{low}</span>
          </div>
        </div>
      )}

      {/* Main Map & Panel Section */}
      <main className="main-content">
        {loading ? (
          <div className="full-screen-loader">
            <div className="spinner"></div>
            <p>Rendering GIS Layer & fetching ULB stress data...</p>
          </div>
        ) : error ? (
          <div className="full-screen-error">
            <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="#ef4444" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <h2>System Connection Error</h2>
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="retry-btn">Retry Connection</button>
          </div>
        ) : (
          <div className="dashboard-grid">
            <div className="map-panel">
              <MapView 
                wardsGeojson={wardsGeojson} 
                selectedWard={selectedWard}
                onSelectWard={handleSelectWard}
                viewType={viewType}
                horizonYears={horizonYears}
              />
              <StressLegend />
            </div>
            
            <aside className="sidebar-panel">
              <WardPanel 
                selectedWard={selectedWard}
                viewType={viewType}
                horizonYears={horizonYears}
                onClose={handleClosePanel}
                popGrowth={popGrowth}
                urbanExpand={urbanExpansion}
              />
            </aside>
          </div>
        )}
      </main>

      {/* Scenario Simulator Floating Window */}
      <div ref={simRef} style={{
        position: 'fixed',
        bottom: `${simPos.y}px`,
        right: `${simPos.x}px`,
        width: '280px',
        background: 'rgba(10,15,30,0.92)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(59,130,246,0.25)',
        borderRadius: '12px',
        zIndex: 1000,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        cursor: dragging ? 'grabbing' : 'default',
        userSelect: 'none'
      }}>
        {/* Header Drag Handle */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            marginBottom: minimized ? '0' : '14px',
            padding:'12px 16px',
            borderBottom: minimized ? 'none' : '1px solid rgba(255,255,255,0.06)',
            cursor:'grab', borderRadius: minimized ? '12px' : '12px 12px 0 0',
            background:'rgba(59,130,246,0.08)'
          }}
        >
          <span style={{fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', color:'#3b82f6'}}>
            ⚡ SCENARIO SIMULATOR
          </span>
          <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
            <span style={{fontSize:'10px', color:'#334155'}}>Ward {selectedWard?.ward_name ?? '—'}</span>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setMinimized(!minimized)}
              style={{
                background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:'4px', color:'#64748b', fontSize:'11px',
                padding:'2px 6px', cursor:'pointer', lineHeight:1
              }}
            >
              {minimized ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* Simulator Body */}
        {!minimized && (
          <div style={{padding:'12px 16px 16px'}}>
            {!selectedWard ? (
              <div style={{textAlign:'center', padding:'12px 0', fontSize:'11px', color:'#334155'}}>
                Select a ward on the map to simulate impact
              </div>
            ) : (
              <>
                {/* Population Growth Slider */}
                <div style={{marginBottom:'12px'}}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'4px'}}>
                    <span style={{fontSize:'10px', color:'#475569'}}>Population Growth</span>
                    <span style={{fontSize:'11px', fontWeight:600, color:'#3b82f6'}}>{popGrowth.toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.5" max="2.0" step="0.1" value={popGrowth}
                    onChange={e => setPopGrowth(parseFloat(e.target.value))}
                    style={{width:'100%', accentColor:'#3b82f6', height:'4px'}} />
                </div>

                {/* Urban Expansion Slider */}
                <div style={{marginBottom:'14px'}}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'4px'}}>
                    <span style={{fontSize:'10px', color:'#475569'}}>Urban Expansion</span>
                    <span style={{fontSize:'11px', fontWeight:600, color:'#f59e0b'}}>{urbanExpansion.toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.5" max="2.0" step="0.1" value={urbanExpansion}
                    onChange={e => setUrbanExpansion(parseFloat(e.target.value))}
                    style={{width:'100%', accentColor:'#f59e0b', height:'4px'}} />
                </div>

                {/* Divider */}
                <div style={{borderTop:'1px solid rgba(255,255,255,0.06)', marginBottom:'12px'}}></div>

                {/* Impact metrics in a 2x2 grid */}
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px'}}>
                  <div style={{background:'rgba(255,255,255,0.04)', borderRadius:'8px', padding:'8px'}}>
                    <div style={{fontSize:'9px', color:'#475569', marginBottom:'2px'}}>ADJ. DEMAND</div>
                    <div style={{fontSize:'14px', fontWeight:600, color:'#f1f5f9'}}>{adjDemand} MLD</div>
                  </div>
                  <div style={{background:'rgba(255,255,255,0.04)', borderRadius:'8px', padding:'8px'}}>
                    <div style={{fontSize:'9px', color:'#475569', marginBottom:'2px'}}>DEFICIT / SURPLUS</div>
                    <div style={{fontSize:'14px', fontWeight:600, color: parseFloat(adjDeficit) >= 0 ? '#22c55e' : '#ef4444'}}>
                      {parseFloat(adjDeficit) >= 0 ? '+' : ''}{adjDeficit} MLD
                    </div>
                  </div>
                </div>

                {/* Stress bar full width */}
                <div>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'4px'}}>
                    <span style={{fontSize:'9px', color:'#475569'}}>ADJ. STRESS LEVEL</span>
                    <span style={{fontSize:'11px', fontWeight:700, color:tierColor}}>{adjStress}% {tier}</span>
                  </div>
                  <div style={{background:'rgba(255,255,255,0.06)', borderRadius:'4px', height:'6px', overflow:'hidden'}}>
                    <div style={{
                      width:`${Math.min(parseFloat(adjStress),100)}%`, height:'100%',
                      background:tierColor, borderRadius:'4px',
                      transition:'width 0.3s ease'
                    }}></div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
