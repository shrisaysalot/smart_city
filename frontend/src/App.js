import React, { useState, useEffect, useRef } from 'react';
import { getWards, getForecast } from './api/forecasts';
import MapView from './components/MapView';
import WardPanel from './components/WardPanel';
import ComparePanel from './components/ComparePanel';
import LoginPage from './components/LoginPage';
import 'leaflet/dist/leaflet.css';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [wardsGeojson, setWardsGeojson] = useState(null);
  const [selectedWard, setSelectedWard] = useState(null);
  const [viewType, setViewType] = useState('water'); // 'water' or 'sewage'
  const [horizonYears, setHorizonYears] = useState(5); // 1, 5, 10 years
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [compareMode, setCompareMode] = useState(false);
  const [compareWards, setCompareWards] = useState([]);

  const [popGrowth, setPopGrowth] = useState(1.0);
  const [urbanExpansion, setUrbanExpansion] = useState(1.0);
  const [wardForecast, setWardForecast] = useState(null);

  const [simPos, setSimPos] = useState({ x: 24, y: 24 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [minimized, setMinimized] = useState(false);
  const simRef = useRef(null);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };
  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error('Failed to parse saved user:', err);
        localStorage.removeItem('user');
      }
    }
  }, []);

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
    if (compareMode) {
      if (compareWards.length === 0 || compareWards.length === 2) {
        setCompareWards([wardProperties]);
        setSelectedWard(wardProperties);
      } else if (compareWards.length === 1) {
        if (compareWards[0].ward_id !== wardProperties.ward_id) {
          setCompareWards([compareWards[0], wardProperties]);
        }
      }
    } else {
      setSelectedWard(wardProperties);
    }
  };

  const handleClosePanel = () => {
    setSelectedWard(null);
    setCompareWards([]);
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
  const tierColor = tier === 'HIGH' ? '#DC2626' : tier === 'MEDIUM' ? '#D97706' : '#16A34A';

  if (!user) return <LoginPage onLogin={handleLogin} />;

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
          {user && (
            <div style={{
              background: user.role === 'admin' ? '#DC2626' : user.role === 'planner' ? '#2563EB' : '#0D9488',
              color: 'white', borderRadius: '6px', padding: '3px 10px',
              fontSize: '11px', fontWeight: 600
            }}>
              {user.role.toUpperCase()}
            </div>
          )}
          <span className="live-indicator">POC ACTIVE</span>
        </div>
      </header>



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
              {/* Collapsible Left Control Sidebar */}
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '12px',
                bottom: '12px',
                width: sidebarOpen ? '220px' : '44px',
                background: 'rgba(255,255,255,0.97)',
                backdropFilter: 'blur(8px)',
                borderRadius: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                border: '1px solid rgba(0,0,0,0.08)',
                zIndex: 500,
                transition: 'width 0.25s ease',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}>
                {/* Toggle button at top */}
                <div
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: sidebarOpen ? 'flex-end' : 'center',
                    padding: '12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    flexShrink: 0,
                  }}
                >
                  <span style={{fontSize: '14px', color: '#4A5568'}}>
                    {sidebarOpen ? '◀' : '▶'}
                  </span>
                  {sidebarOpen && (
                    <span style={{fontSize: '11px', fontWeight: 700, color: '#2563EB', letterSpacing: '0.08em', marginRight: 'auto', marginLeft: '8px'}}>
                      CONTROLS
                    </span>
                  )}
                </div>

                {/* Sidebar content — only visible when open */}
                {sidebarOpen && (
                  <div style={{padding: '16px', overflowY: 'auto', flex: 1}}>
                    {/* Section 1: Analysis Target */}
                    <div style={{marginBottom: '20px'}}>
                      <div style={{fontSize:'10px', fontWeight:700, color:'#8A9AB0', letterSpacing:'0.1em', marginBottom:'10px'}}>ANALYSIS TARGET</div>
                      {['Water Supply Demand', 'Sewerage Generation'].map(opt => {
                        const val = opt === 'Water Supply Demand' ? 'water' : 'sewage';
                        return (
                          <button key={opt} onClick={() => setViewType(val)} style={{
                            width:'100%', textAlign:'left', padding:'8px 12px',
                            marginBottom:'6px', borderRadius:'8px', fontSize:'12px',
                            fontWeight: viewType === val ? 600 : 400,
                            background: viewType === val ? '#2563EB' : 'transparent',
                            color: viewType === val ? '#FFFFFF' : '#4A5568',
                            border: `1px solid ${viewType === val ? '#2563EB' : 'rgba(0,0,0,0.08)'}`,
                            cursor:'pointer', transition:'all 0.15s ease'
                          }}>{opt}</button>
                        );
                      })}
                    </div>

                    <div style={{borderTop:'1px solid rgba(0,0,0,0.08)', marginBottom:'16px'}}></div>

                    {/* Section 2: Planning Horizon */}
                    <div style={{marginBottom: '20px'}}>
                      <div style={{fontSize:'10px', fontWeight:700, color:'#8A9AB0', letterSpacing:'0.1em', marginBottom:'10px'}}>PLANNING HORIZON</div>
                      {[{label:'1 Year (Short-Term)', val:1},{label:'5 Years (Mid-Term)', val:5},{label:'10 Years (Long-Term)', val:10}].map(opt => (
                        <button key={opt.val} onClick={() => setHorizonYears(opt.val)} style={{
                          width:'100%', textAlign:'left', padding:'8px 12px',
                          marginBottom:'6px', borderRadius:'8px', fontSize:'12px',
                          fontWeight: horizonYears === opt.val ? 600 : 400,
                          background: horizonYears === opt.val ? '#0D9488' : 'transparent',
                          color: horizonYears === opt.val ? '#FFFFFF' : '#4A5568',
                          border: `1px solid ${horizonYears === opt.val ? '#0D9488' : 'rgba(0,0,0,0.08)'}`,
                          cursor:'pointer', transition:'all 0.15s ease'
                        }}>{opt.label}</button>
                      ))}
                    </div>

                    <div style={{borderTop:'1px solid rgba(0,0,0,0.08)', marginBottom:'16px'}}></div>

                    {/* Compare Wards Toggle */}
                    <div style={{marginBottom:'20px'}}>
                      <div style={{fontSize:'10px', fontWeight:700, color:'#8A9AB0', letterSpacing:'0.1em', marginBottom:'10px'}}>COMPARE MODE</div>
                      <button
                        onClick={() => { setCompareMode(!compareMode); setCompareWards([]); }}
                        style={{
                          width:'100%', padding:'8px 12px', borderRadius:'8px', fontSize:'12px',
                          fontWeight: compareMode ? 600 : 400,
                          background: compareMode ? '#7C3AED' : 'transparent',
                          color: compareMode ? '#FFFFFF' : '#4A5568',
                          border: `1px solid ${compareMode ? '#7C3AED' : 'rgba(0,0,0,0.08)'}`,
                          cursor:'pointer'
                        }}
                      >
                        {compareMode ? '✕ Exit Compare' : '⚖ Compare 2 Wards'}
                      </button>
                      {compareMode && (
                        <div style={{fontSize:'10px', color:'#8A9AB0', marginTop:'6px', fontStyle:'italic'}}>
                          Click any two wards on the map to compare
                        </div>
                      )}
                    </div>

                    <div style={{borderTop:'1px solid rgba(0,0,0,0.08)', marginBottom:'16px'}}></div>

                    {/* Section 3: Stress Index */}
                    <div style={{marginBottom: '20px'}}>
                      <div style={{fontSize:'10px', fontWeight:700, color:'#8A9AB0', letterSpacing:'0.1em', marginBottom:'10px'}}>STRESS INDEX</div>
                      {[
                        {color:'#DC2626', label:'High Stress', sub:'>90% capacity'},
                        {color:'#D97706', label:'Medium Stress', sub:'70–90%'},
                        {color:'#16A34A', label:'Low Stress', sub:'<70%'},
                      ].map(item => (
                        <div key={item.label} style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px'}}>
                          <div style={{width:'10px', height:'10px', borderRadius:'2px', background:item.color, flexShrink:0}}></div>
                          <div>
                            <div style={{fontSize:'11px', fontWeight:600, color:'#1A2332'}}>{item.label}</div>
                            <div style={{fontSize:'10px', color:'#8A9AB0'}}>{item.sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{borderTop:'1px solid rgba(0,0,0,0.08)', marginBottom:'16px'}}></div>

                    {/* Section 4: User info + role */}
                    <div style={{marginTop:'auto'}}>
                      <div style={{fontSize:'10px', fontWeight:700, color:'#8A9AB0', letterSpacing:'0.1em', marginBottom:'8px'}}>LOGGED IN AS</div>
                      <div style={{fontSize:'12px', fontWeight:600, color:'#1A2332'}}>{user?.name}</div>
                      <div style={{fontSize:'11px', color:'#8A9AB0', marginBottom:'10px'}}>{user?.role}</div>
                      <button onClick={handleLogout} style={{
                        width:'100%', padding:'7px', borderRadius:'8px', fontSize:'11px',
                        background:'transparent', color:'#DC2626',
                        border:'1px solid rgba(220,38,38,0.3)', cursor:'pointer'
                      }}>Sign Out</button>
                    </div>

                    {/* Section 5: Placeholder for judge's future controls */}
                    <div style={{marginTop:'16px', paddingTop:'16px', borderTop:'1px solid rgba(0,0,0,0.08)'}}>
                      <div style={{fontSize:'10px', color:'#8A9AB0', letterSpacing:'0.08em', marginBottom:'6px'}}>ADDITIONAL FILTERS</div>
                      <div style={{fontSize:'11px', color:'#CBD5E0', fontStyle:'italic'}}>More controls coming soon...</div>
                    </div>
                  </div>
                )}

                {/* Collapsed state: show icon hints */}
                {!sidebarOpen && (
                  <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'16px', padding:'16px 0', marginTop:'8px'}}>
                    <span title="Analysis Target" style={{fontSize:'16px', cursor:'pointer'}} onClick={() => setSidebarOpen(true)}>💧</span>
                    <span title="Planning Horizon" style={{fontSize:'16px', cursor:'pointer'}} onClick={() => setSidebarOpen(true)}>📅</span>
                    <span title="Stress Index" style={{fontSize:'16px', cursor:'pointer'}} onClick={() => setSidebarOpen(true)}>⚠️</span>
                  </div>
                )}
              </div>
              <MapView 
                wardsGeojson={wardsGeojson} 
                selectedWard={selectedWard}
                onSelectWard={handleSelectWard}
                viewType={viewType}
                horizonYears={horizonYears}
                user={user}
              />
            </div>
            
            <aside className="sidebar-panel">
              {compareMode && compareWards.length === 2 ? (
                <ComparePanel
                  wardA={compareWards[0]}
                  wardB={compareWards[1]}
                  viewType={viewType}
                  horizonYears={horizonYears}
                  onClose={() => {
                    setCompareWards([]);
                    setSelectedWard(null);
                  }}
                  onClear={() => {
                    setCompareWards([]);
                    setSelectedWard(null);
                  }}
                />
              ) : (
                <WardPanel 
                  selectedWard={selectedWard}
                  viewType={viewType}
                  horizonYears={horizonYears}
                  onClose={handleClosePanel}
                  popGrowth={popGrowth}
                  urbanExpand={urbanExpansion}
                  user={user}
                />
              )}
            </aside>
          </div>
        )}
      </main>

      {/* Scenario Simulator Floating Window */}
      {user?.role !== 'planner' && (
        <div ref={simRef} style={{
        position: 'fixed',
        bottom: `${simPos.y}px`,
        right: `${simPos.x}px`,
        width: '280px',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '12px',
        zIndex: 1000,
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
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
            borderBottom: minimized ? 'none' : '1px solid rgba(0,0,0,0.06)',
            cursor:'grab', borderRadius: minimized ? '12px' : '12px 12px 0 0',
            background:'rgba(37,99,235,0.08)'
          }}
        >
          <span style={{fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', color:'#2563EB'}}>
            ⚡ SCENARIO SIMULATOR
          </span>
          <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
            <span style={{fontSize:'10px', color:'#4A5568'}}>Ward {selectedWard?.ward_name ?? '—'}</span>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setMinimized(!minimized)}
              style={{
                background:'rgba(0,0,0,0.04)', border:'1px solid rgba(0,0,0,0.08)',
                borderRadius:'4px', color:'#4A5568', fontSize:'11px',
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
              <div style={{textAlign:'center', padding:'12px 0', fontSize:'11px', color:'#8A9AB0'}}>
                Select a ward on the map to simulate impact
              </div>
            ) : (
              <>
                {/* Population Growth Slider */}
                <div style={{marginBottom:'12px'}}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'4px'}}>
                    <span style={{fontSize:'10px', color:'#4A5568'}}>Population Growth</span>
                    <span style={{fontSize:'11px', fontWeight:600, color:'#2563EB'}}>{popGrowth.toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.5" max="2.0" step="0.1" value={popGrowth}
                    onChange={e => setPopGrowth(parseFloat(e.target.value))}
                    style={{width:'100%', accentColor:'#2563EB', height:'4px'}} />
                </div>

                {/* Urban Expansion Slider */}
                <div style={{marginBottom:'14px'}}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'4px'}}>
                    <span style={{fontSize:'10px', color:'#4A5568'}}>Urban Expansion</span>
                    <span style={{fontSize:'11px', fontWeight:600, color:'#D97706'}}>{urbanExpansion.toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.5" max="2.0" step="0.1" value={urbanExpansion}
                    onChange={e => setUrbanExpansion(parseFloat(e.target.value))}
                    style={{width:'100%', accentColor:'#D97706', height:'4px'}} />
                </div>

                {/* Divider */}
                <div style={{borderTop:'1px solid rgba(0,0,0,0.06)', marginBottom:'12px'}}></div>

                {/* Impact metrics in a 2x2 grid */}
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px'}}>
                  <div style={{background:'rgba(0,0,0,0.03)', borderRadius:'8px', padding:'8px'}}>
                    <div style={{fontSize:'9px', color:'#8A9AB0', marginBottom:'2px'}}>ADJ. DEMAND</div>
                    <div style={{fontSize:'14px', fontWeight:600, color:'#1A2332'}}>{adjDemand} MLD</div>
                  </div>
                  <div style={{background:'rgba(0,0,0,0.03)', borderRadius:'8px', padding:'8px'}}>
                    <div style={{fontSize:'9px', color:'#8A9AB0', marginBottom:'2px'}}>DEFICIT / SURPLUS</div>
                    <div style={{fontSize:'14px', fontWeight:600, color: parseFloat(adjDeficit) >= 0 ? '#16A34A' : '#DC2626'}}>
                      {parseFloat(adjDeficit) >= 0 ? '+' : ''}{adjDeficit} MLD
                    </div>
                  </div>
                </div>

                {/* Stress bar full width */}
                <div>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'4px'}}>
                    <span style={{fontSize:'9px', color:'#4A5568'}}>ADJ. STRESS LEVEL</span>
                    <span style={{fontSize:'11px', fontWeight:700, color:tierColor}}>{adjStress}% {tier}</span>
                  </div>
                  <div style={{background:'rgba(0,0,0,0.06)', borderRadius:'4px', height:'6px', overflow:'hidden'}}>
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
      )}
    </div>
  );
}

export default App;
