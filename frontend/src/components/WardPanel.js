import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { getForecast } from '../api/forecasts';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const WardPanel = ({ selectedWard, viewType, horizonYears, onClose, popGrowth = 1.0, urbanExpand = 1.0, user }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedWard) return;

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getForecast(selectedWard.ward_id);
        setData(result);
      } catch (err) {
        setError('Failed to fetch detailed forecast data.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [selectedWard]);

  if (!selectedWard) {
    return (
      <div className="ward-panel-empty">
        <div className="empty-state-content">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75h6m-6 4h6m-6 4h6m3 5.25H6.75A2.25 2.25 0 014.5 17.25V6.75A2.25 2.25 0 016.75 4.5h10.5a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0117.25 19.5z" />
          </svg>
          <h3>No Ward Selected</h3>
          <p>Click on any ward polygon in the map to analyze historical trends, satellite indices, and utility demand projections.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="ward-panel-loading">
        <div className="spinner"></div>
        <p>Loading forecasting pipeline results for {selectedWard.ward_name}...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="ward-panel-error">
        <p className="error-msg">{error || 'Data is unavailable'}</p>
        <button onClick={onClose} className="close-btn-error">Back to Dashboard</button>
      </div>
    );
  }

  // Formatting calculations (Convert Liters/Day to MLD - Million Liters per Day)
  const toMLD = (liters) => (liters ? (liters / 1000000).toFixed(2) : '0.00');

  const isWater = viewType === 'water';
  const capacityLiters = isWater 
    ? data.capacity?.water_supply_capacity_liters_day 
    : data.capacity?.stp_capacity_liters_day;
  
  const capacityMLD = toMLD(capacityLiters);

  // Extract last actual historical point
  const lastHistory = data.history[data.history.length - 1];
  const currentDemandLiters = isWater 
    ? lastHistory?.water_liters_day 
    : lastHistory?.sewage_liters_day;
  const currentDemandMLD = toMLD(currentDemandLiters);

  // Filter forecast timeline by selected time horizon
  // 1 year = 12 forecast points, 5 years = 60 forecast points, 10 years = 120 forecast points
  const forecastLimit = horizonYears * 12;
  const filteredForecast = data.forecast.slice(0, forecastLimit);
  
  const lastForecastPoint = filteredForecast[filteredForecast.length - 1];
  const targetDemandLiters = isWater 
    ? lastForecastPoint?.water_forecast_liters_day 
    : lastForecastPoint?.sewage_forecast_liters_day;
  const targetDemandMLD = toMLD(targetDemandLiters);

  const gapLiters = targetDemandLiters - capacityLiters;
  const gapMLD = toMLD(gapLiters);
  const stressRatio = targetDemandLiters / capacityLiters;
  const stressPercent = (stressRatio * 100).toFixed(1);

  // Determine stress tier
  let stressTier = 'Low';
  if (stressRatio > 0.9) {
    stressTier = 'High';
  } else if (stressRatio >= 0.7) {
    stressTier = 'Medium';
  }

  // --- Scenario Simulator calculations ---

  // --- Investment Estimator calculations (10-Year Horizon) ---
  const forecast10YLimit = 10 * 12;
  const filteredForecast10Y = data.forecast ? data.forecast.slice(0, forecast10YLimit) : [];
  const lastForecastPoint10Y = filteredForecast10Y.length ? filteredForecast10Y[filteredForecast10Y.length - 1] : null;

  const waterCapacity = (data.capacity?.water_supply_capacity_liters_day || 0) / 1000000;
  const stpCapacity = (data.capacity?.stp_capacity_liters_day || 0) / 1000000;

  const forecastedDemand10Y = lastForecastPoint10Y ? (lastForecastPoint10Y.water_forecast_liters_day / 1000000) : 0;
  const forecastedSewage10Y = lastForecastPoint10Y ? (lastForecastPoint10Y.sewage_forecast_liters_day / 1000000) : 0;

  const waterGap = Math.max(0, forecastedDemand10Y - waterCapacity);
  const sewerGap = Math.max(0, forecastedSewage10Y - stpCapacity);
  const waterCost = (waterGap * 2.5).toFixed(1);
  const sewerCost = (sewerGap * 3.2).toFixed(1);
  const totalCost = (parseFloat(waterCost) + parseFloat(sewerCost)).toFixed(1);
  const totalCostNum = parseFloat(totalCost);

  // Format the last forecast generated time
  const formattedDate = data?.forecast_generated_at
    ? new Date(data.forecast_generated_at).toLocaleString()
    : 'N/A';

  // --- Prepare Chart Data ---
  // Create unified timeline labels
  const historyLabels = data.history.map(item => {
    const d = new Date(item.date);
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  });

  const forecastLabels = filteredForecast.map(item => {
    const d = new Date(item.date);
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  });

  const chartLabels = [...historyLabels, ...forecastLabels];

  // Align data values
  const historyValues = data.history.map(item => 
    isWater ? item.water_liters_day / 1000000 : item.sewage_liters_day / 1000000
  );

  const forecastValues = filteredForecast.map(item => {
    const base = isWater ? item.water_forecast_liters_day / 1000000 : item.sewage_forecast_liters_day / 1000000;
    return base * popGrowth * urbanExpand;
  });

  // Connect actual history line to the start of forecast line
  const historyDataPoints = [...historyValues, ...Array(forecastLabels.length).fill(null)];
  const forecastDataPoints = [
    ...Array(historyValues.length - 1).fill(null),
    historyValues[historyValues.length - 1], // bridge point
    ...forecastValues
  ];

  const capacityDataPoints = Array(chartLabels.length).fill(parseFloat(capacityMLD));

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Historical Actual',
        data: historyDataPoints,
        borderColor: '#2563EB',
        backgroundColor: 'rgba(37, 99, 235, 0.03)',
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
      {
        label: `${horizonYears}-Yr Forecast`,
        data: forecastDataPoints,
        borderColor: '#D97706',
        backgroundColor: 'transparent',
        borderDash: [5, 3],
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
      {
        label: 'Design Capacity Limit',
        data: capacityDataPoints,
        borderColor: '#DC2626',
        borderWidth: 1.5,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false,
        tension: 0,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#4A5568',
          font: { family: 'Outfit', size: 11 },
          boxWidth: 12
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        padding: 10,
        backgroundColor: '#ffffff',
        titleColor: '#1A2332',
        bodyColor: '#4A5568',
        borderColor: 'rgba(0,0,0,0.08)',
        borderWidth: 1,
        titleFont: { family: 'Outfit', weight: 'bold' },
        bodyFont: { family: 'Inter' },
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(2) + ' MLD';
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: {
          color: '#4A5568',
          font: { size: 11 },
          maxTicksLimit: 12
        }
      },
      y: {
        title: {
          display: true,
          text: 'Quantity (MLD)',
          color: '#4A5568',
          font: { family: 'Outfit', size: 11 }
        },
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: { color: '#4A5568', font: { size: 11 } }
      }
    }
  };

  const headerBorderColor = stressTier === 'High' ? '#DC2626' : stressTier === 'Medium' ? '#D97706' : '#16A34A';

  return (
    <div className="ward-panel">
      <div className="ward-panel-header" style={{ borderLeft: `4px solid ${headerBorderColor}`, paddingLeft: '20px' }}>
        <div>
          <h2>{data.ward_name}</h2>
          <span className="ward-id-pill">{data.ward_id}</span>
        </div>
        <button className="close-panel-btn" onClick={onClose}>×</button>
      </div>

      <div className="ward-panel-scroll">
        {/* Ward Info Grid */}
        <div className="info-grid">
          <div className="info-card">
            <span className="info-label">Population (Proj)</span>
            <span className="info-value">{data.population.toLocaleString()}</span>
          </div>
          <div className="info-card">
            <span className="info-label">Area (Sq. Km)</span>
            <span className="info-value">{data.area_sqkm} km²</span>
          </div>
        </div>

        {/* Satellite Indices (Precomputed Sentinel-2 indices) */}
        <div className="indices-section">
          <h3>Satellite Indices (Sentinel-2 Reference)</h3>
          <div className="indices-grid">
            <div className="index-pill">
              <span className="idx-name">NDVI</span>
              <span className="idx-val veg" title="Normalized Difference Vegetation Index">{data.ndvi?.toFixed(3) || '0.245'}</span>
            </div>
            <div className="index-pill">
              <span className="idx-name">NDBI</span>
              <span className="idx-val built" title="Normalized Difference Built-up Index">{data.ndbi?.toFixed(3) || '0.382'}</span>
            </div>
            <div className="index-pill">
              <span className="idx-name">MNDWI</span>
              <span className="idx-val water" title="Modified Normalized Difference Water Index">{data.mndwi?.toFixed(3) || '-0.180'}</span>
            </div>
          </div>
        </div>

        {/* Demand & Capacity Cards */}
        <div className="metric-summary">
          <h3>{isWater ? 'Water Supply' : 'Sewerage Treatment'} Gap Analysis</h3>
          
          <div className="stress-progress-container" style={{
            marginBottom: '16px',
            fontFamily: 'Outfit, sans-serif'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              color: '#4A5568',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: '600'
            }}>
              <span>Stress Level</span>
              <span style={{
                color: stressTier === 'High' ? '#DC2626' : stressTier === 'Medium' ? '#D97706' : '#16A34A'
              }}>
                {stressPercent}% {stressTier.toUpperCase()}
              </span>
            </div>
            
            {/* Progress Bar Track */}
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.06)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              {/* Progress Bar Fill */}
              <div style={{
                width: `${Math.min(100, parseFloat(stressPercent))}%`,
                height: '100%',
                backgroundColor: stressTier === 'High' ? '#DC2626' : stressTier === 'Medium' ? '#D97706' : '#16A34A',
                borderRadius: '4px',
                transition: 'width 0.4s ease'
              }}></div>
            </div>
          </div>

          <div className="metric-row">
            <div className="metric-col">
              <span className="m-label">Current Demand (2024)</span>
              <span className="m-value">{currentDemandMLD} MLD</span>
            </div>
            <div className="metric-col">
              <span className="m-label">Infrastructure Capacity</span>
              <span className="m-value highlight">{capacityMLD} MLD</span>
            </div>
          </div>

          <div className="metric-row">
            <div className="metric-col">
              <span className="m-label">Forecasted Demand ({2024 + horizonYears})</span>
              <span className="m-value">{targetDemandMLD} MLD</span>
            </div>
            <div className="metric-col">
              <span className="m-label">Capacity Deficit / Surplus</span>
              <span className={`m-value ${gapLiters > 0 ? 'deficit' : 'surplus'}`}>
                {gapLiters > 0 ? `-${gapMLD} MLD` : `+${Math.abs(gapMLD).toFixed(2)} MLD`}
              </span>
            </div>
          </div>
        </div>

        {/* INVESTMENT ESTIMATOR */}
        <div style={{
          background: 'rgba(37,99,235,0.04)',
          border: '1px solid rgba(37,99,235,0.12)',
          borderRadius: '8px',
          padding: '12px',
          fontFamily: 'Outfit, sans-serif'
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#8A9AB0', letterSpacing: '0.1em', marginBottom: '8px' }}>
            INVESTMENT ESTIMATOR (10-Year Horizon)
          </div>
          {totalCostNum === 0 ? (
            <div style={{ color: '#16A34A', fontSize: '12px', fontWeight: '600', padding: '6px 0', textAlign: 'center' }}>
              No investment required at this horizon ✓
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#4A5568', marginBottom: '4px' }}>
                <span>Water Supply Upgrade</span>
                <span>₹{waterCost} Cr</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#4A5568', marginBottom: '6px' }}>
                <span>STP Upgrade</span>
                <span>₹{sewerCost} Cr</span>
              </div>
              <div style={{ borderTop: '1px dashed rgba(37,99,235,0.2)', margin: '6px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', color: '#2563EB' }}>
                <span>TOTAL ESTIMATED</span>
                <span>₹{totalCost} Cr</span>
              </div>
            </>
          )}
          <div style={{ fontSize: '9px', color: '#8A9AB0', marginTop: '8px', fontStyle: 'italic', borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: '6px', textAlign: 'center' }}>
            Est. based on CPHEEO norms &bull; For planning reference only
          </div>
        </div>


        {/* Time Series Chart Section (Always Visible) */}
        <div className="chart-container" style={{ minHeight: '220px' }}>
          <h3 style={{ marginTop: '12px' }}>Historical actuals & Prophet demand projection</h3>
          <div className="chart-wrapper" style={{ height: '220px', minHeight: '220px' }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Audit/Traceability Log Footer */}
        <div className="audit-log-section" style={{
          marginTop: '24px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-color)',
          fontSize: '10px',
          color: 'var(--text-muted)',
          fontFamily: 'Inter, sans-serif',
          lineHeight: '1.4'
        }}>
          <div><strong>Last forecast generated:</strong> {formattedDate}</div>
          <div style={{ marginTop: '2px' }}><strong>Model:</strong> Facebook Prophet | <strong>Data:</strong> Synthetic (PoC)</div>
        </div>
      </div>
    </div>
  );
};

export default WardPanel;
