import React, { useState, useEffect } from 'react';
import { getWards } from './api/forecasts';
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
              />
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
