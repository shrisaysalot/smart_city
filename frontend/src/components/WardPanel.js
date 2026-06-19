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

const WardPanel = ({ selectedWard, viewType, horizonYears, onClose }) => {
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
  let stressClass = 'tier-low';
  if (stressRatio > 0.9) {
    stressTier = 'High';
    stressClass = 'tier-high';
  } else if (stressRatio >= 0.7) {
    stressTier = 'Medium';
    stressClass = 'tier-medium';
  }

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

  const forecastValues = filteredForecast.map(item => 
    isWater ? item.water_forecast_liters_day / 1000000 : item.sewage_forecast_liters_day / 1000000
  );

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
        borderColor: isWater ? '#2563eb' : '#7c3aed',
        backgroundColor: isWater ? 'rgba(37, 99, 235, 0.1)' : 'rgba(124, 58, 237, 0.1)',
        fill: true,
        tension: 0.3,
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
      {
        label: `${horizonYears}-Yr Forecast`,
        data: forecastDataPoints,
        borderColor: isWater ? '#60a5fa' : '#c084fc',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.3,
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
      {
        label: 'Design Capacity Limit',
        data: capacityDataPoints,
        borderColor: '#ef4444',
        borderWidth: 2,
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
          color: '#e2e8f0',
          font: { family: 'Outfit', size: 11 },
          boxWidth: 12
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        padding: 10,
        backgroundColor: '#1f2937',
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
        grid: { color: 'rgba(75, 85, 99, 0.15)' },
        ticks: {
          color: '#9ca3af',
          font: { size: 9 },
          maxTicksLimit: 12
        }
      },
      y: {
        title: {
          display: true,
          text: 'Quantity (MLD)',
          color: '#9ca3af',
          font: { family: 'Outfit', size: 10 }
        },
        grid: { color: 'rgba(75, 85, 99, 0.15)' },
        ticks: { color: '#9ca3af', font: { size: 10 } }
      }
    }
  };

  return (
    <div className="ward-panel">
      <div className="ward-panel-header">
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
          
          <div className={`stress-badge ${stressClass}`}>
            <span className="stress-badge-title">Stress Level</span>
            <span className="stress-badge-value">{stressPercent}% ({stressTier})</span>
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

        {/* Time Series Chart */}
        <div className="chart-container">
          <h3>Historical actuals & Prophet demand projection</h3>
          <div className="chart-wrapper">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WardPanel;
