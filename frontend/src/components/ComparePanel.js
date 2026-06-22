import React, { useState, useEffect } from 'react';
import { getForecast } from '../api/forecasts';

export default function ComparePanel({ wardA, wardB, viewType, horizonYears, onClose, onClear }) {
  const [dataA, setDataA] = useState(null);
  const [dataB, setDataB] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCompareData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [resA, resB] = await Promise.all([
          getForecast(wardA.ward_id),
          getForecast(wardB.ward_id)
        ]);
        setDataA(resA);
        setDataB(resB);
      } catch (err) {
        setError('Failed to fetch comparison data');
      } finally {
        setLoading(false);
      }
    };
    if (wardA?.ward_id && wardB?.ward_id) {
      fetchCompareData();
    }
  }, [wardA, wardB]);

  if (loading) {
    return (
      <div className="ward-panel-loading">
        <div className="spinner"></div>
        <p>Loading comparisons for Ward {wardA.ward_name} & Ward {wardB.ward_name}...</p>
      </div>
    );
  }

  if (error || !dataA || !dataB) {
    return (
      <div className="ward-panel-error">
        <p className="error-msg">{error || 'Data is unavailable'}</p>
        <button onClick={onClear} className="close-btn-error">Clear Comparison</button>
      </div>
    );
  }

  const isWater = viewType === 'water';

  // Helper formatting / parsing
  const toMLD = (liters) => (liters ? liters / 1000000 : 0);

  // Data A
  const popA = dataA.population || 0;
  const areaA = dataA.area_sqkm || 0;
  const capLitersA = isWater 
    ? dataA.capacity?.water_supply_capacity_liters_day 
    : dataA.capacity?.stp_capacity_liters_day;
  const capMLDA = toMLD(capLitersA);

  const lastHistA = dataA.history && dataA.history.length ? dataA.history[dataA.history.length - 1] : null;
  const currDemandLitersA = isWater ? lastHistA?.water_liters_day : lastHistA?.sewage_liters_day;
  const currDemandMLDA = toMLD(currDemandLitersA);

  const forecastLimit = horizonYears * 12;
  const filteredForecastA = dataA.forecast ? dataA.forecast.slice(0, forecastLimit) : [];
  const lastForeA = filteredForecastA.length ? filteredForecastA[filteredForecastA.length - 1] : null;
  const targetDemandLitersA = isWater ? lastForeA?.water_forecast_liters_day : lastForeA?.sewage_forecast_liters_day;
  const targetDemandMLDA = toMLD(targetDemandLitersA);

  const stressScoreA = capMLDA > 0 ? (targetDemandMLDA / capMLDA) * 100 : 0;

  // Data B
  const popB = dataB.population || 0;
  const areaB = dataB.area_sqkm || 0;
  const capLitersB = isWater 
    ? dataB.capacity?.water_supply_capacity_liters_day 
    : dataB.capacity?.stp_capacity_liters_day;
  const capMLDB = toMLD(capLitersB);

  const lastHistB = dataB.history && dataB.history.length ? dataB.history[dataB.history.length - 1] : null;
  const currDemandLitersB = isWater ? lastHistB?.water_liters_day : lastHistB?.sewage_liters_day;
  const currDemandMLDB = toMLD(currDemandLitersB);

  const filteredForecastB = dataB.forecast ? dataB.forecast.slice(0, forecastLimit) : [];
  const lastForeB = filteredForecastB.length ? filteredForecastB[filteredForecastB.length - 1] : null;
  const targetDemandLitersB = isWater ? lastForeB?.water_forecast_liters_day : lastForeB?.sewage_forecast_liters_day;
  const targetDemandMLDB = toMLD(targetDemandLitersB);

  const stressScoreB = capMLDB > 0 ? (targetDemandMLDB / capMLDB) * 100 : 0;

  // Highlights worse (red) and better (green)
  // Higher population/demand/stress = worse
  // Higher capacity/area = better
  const compareVal = (valA, valB, higherIsBetter = false) => {
    if (valA === valB) return { styleA: {}, styleB: {} };
    const aIsBetter = higherIsBetter ? valA > valB : valA < valB;
    return {
      styleA: { color: aIsBetter ? '#16A34A' : '#DC2626', fontWeight: 'bold' },
      styleB: { color: aIsBetter ? '#DC2626' : '#16A34A', fontWeight: 'bold' }
    };
  };

  const popCompare = compareVal(popA, popB, false); // Less population is less load -> better
  const areaCompare = compareVal(areaA, areaB, true); // Larger area is better
  const currDemandCompare = compareVal(currDemandMLDA, currDemandMLDB, false); // Less demand is better
  const capCompare = compareVal(capMLDA, capMLDB, true); // Higher capacity is better
  const stressCompare = compareVal(stressScoreA, stressScoreB, false); // Lower stress is better
  const forecastCompare = compareVal(targetDemandMLDA, targetDemandMLDB, false); // Lower forecast demand is better

  return (
    <div className="ward-panel" style={{ background: '#FFFFFF' }}>
      <div className="ward-panel-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '4px solid #7C3AED' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <h2 style={{ fontSize: '15px' }}>⚖ Ward Comparison</h2>
          <button className="close-panel-btn" onClick={onClose}>✕</button>
        </div>
        <button
          onClick={onClear}
          style={{
            alignSelf: 'flex-start',
            background: 'rgba(124, 58, 237, 0.08)',
            color: '#7C3AED',
            border: '1px solid rgba(124, 58, 237, 0.2)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Clear Comparison
        </button>
      </div>

      <div className="ward-panel-scroll" style={{ padding: '16px' }}>
        {/* Header columns info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px', marginBottom: '12px', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#8A9AB0' }}>METRIC</span>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#1A2332', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={dataA.ward_name}>
              {dataA.ward_name}
            </div>
            <span style={{ fontSize: '9px', color: '#8A9AB0', background: '#F1F5F9', padding: '1px 4px', borderRadius: '4px' }}>W-{dataA.ward_id}</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#1A2332', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={dataB.ward_name}>
              {dataB.ward_name}
            </div>
            <span style={{ fontSize: '9px', color: '#8A9AB0', background: '#F1F5F9', padding: '1px 4px', borderRadius: '4px' }}>W-{dataB.ward_id}</span>
          </div>
        </div>

        {/* Rows */}
        {[
          { label: 'Population', valA: popA.toLocaleString(), valB: popB.toLocaleString(), styleA: popCompare.styleA, styleB: popCompare.styleB },
          { label: 'Area', valA: `${areaA.toFixed(2)} km²`, valB: `${areaB.toFixed(2)} km²`, styleA: areaCompare.styleA, styleB: areaCompare.styleB },
          { label: 'Current Demand', valA: `${currDemandMLDA.toFixed(2)} MLD`, valB: `${currDemandMLDB.toFixed(2)} MLD`, styleA: currDemandCompare.styleA, styleB: currDemandCompare.styleB },
          { label: 'Capacity', valA: `${capMLDA.toFixed(2)} MLD`, valB: `${capMLDB.toFixed(2)} MLD`, styleA: capCompare.styleA, styleB: capCompare.styleB },
          { label: 'Stress Score', valA: `${stressScoreA.toFixed(1)}%`, valB: `${stressScoreB.toFixed(1)}%`, styleA: stressCompare.styleA, styleB: stressCompare.styleB },
          { label: 'Forecast Demand', valA: `${targetDemandMLDA.toFixed(2)} MLD`, valB: `${targetDemandMLDB.toFixed(2)} MLD`, styleA: forecastCompare.styleA, styleB: forecastCompare.styleB },
        ].map((row, idx) => (
          <div
            key={idx}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr 1fr',
              gap: '8px',
              padding: '10px 0',
              borderBottom: '1px solid rgba(0,0,0,0.04)',
              alignItems: 'center'
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#4A5568' }}>{row.label}</span>
            <span style={{ fontSize: '12px', textAlign: 'center', ...row.styleA }}>{row.valA}</span>
            <span style={{ fontSize: '12px', textAlign: 'center', ...row.styleB }}>{row.valB}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
