import React from 'react';

const StressLegend = () => {
  return (
    <div className="stress-legend" style={{ zIndex: 998 }}>
      <h4>Stress Index</h4>
      <div className="legend-items">
        <div className="legend-item">
          <span className="legend-color high"></span>
          <span className="legend-label">High Stress (&gt;90%)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color medium"></span>
          <span className="legend-label">Medium Stress (70% – 90%)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color low"></span>
          <span className="legend-label">Low Stress (&lt;70%)</span>
        </div>
      </div>
      <div className="synthetic-badge">Real-Calibrated Estimates · Based on VMC/UN-Habitat City Statistics</div>
    </div>
  );
};

export default StressLegend;
