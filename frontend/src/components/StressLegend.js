import React from 'react';

const StressLegend = () => {
  return (
    <div className="stress-legend">
      <h4>Stress Index</h4>
      <div className="legend-items">
        <div className="legend-item">
          <span className="legend-color high"></span>
          <span className="legend-label">High Stress (&gt;90% capacity)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color medium"></span>
          <span className="legend-label">Medium Stress (70% - 90%)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color low"></span>
          <span className="legend-label">Low Stress (&lt;70%)</span>
        </div>
      </div>
      <div className="synthetic-badge">Synthetic Data Mode</div>
    </div>
  );
};

export default StressLegend;
