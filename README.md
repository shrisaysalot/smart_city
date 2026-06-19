# Smart Utility Demand Forecasting System for AP ULBs

An AI-enabled decision-support dashboard designed for Andhra Pradesh Urban Local Bodies (ULBs) to forecast ward-level water supply demand and sewerage generation. Using historical usage records, satellite indicators, and demographic patterns, this system identifies utility stress zones to guide municipal infrastructure planning.

---

## 🏛️ Problem Statement & Goal
Rapid urbanization in Andhra Pradesh's municipal corporations creates massive stress on utilities. Municipal engineers lack tools to predict ward-level demand bottlenecks. 

This hackathon project delivers a Proof of Concept (PoC) GIS dashboard centered on **Vijayawada Municipal Corporation**. It models consumption growth, computes satellite indicators, trains time-series forecasting models (Prophet), conducts gap analyses against physical capacities, and visualizes the results on an interactive map.

---

## 🛠️ Technology Stack
- **Frontend:** React, React-Leaflet (Leaflet GIS mapping), Chart.js (via `react-chartjs-2`), Axios, Vanilla CSS.
- **Backend:** Django, Django REST Framework. PostgreSQL with PostGIS (using GeoDjango) with a dynamic local SQLite fallback.
- **Data Science / ML:**
  - `prophet` - Time-series forecasting.
  - `geopandas` & `shapely` - Spatial geometry extraction and overlay joins.
  - `rasterio` - Georeferenced Sentinel-2 raster index computations.
  - `pandas` & `numpy` - Data processing.

---

## 🛰️ Synthetic Data & Satellite Simulation
To ensure absolute offline runnability for this PoC:
- **Ward Boundaries (`mock_wards.geojson`):** Contains ~20 synthetic ward polygons representing coordinates in Vijayawada (`16.506, 80.648`).
- **Utility Consumption (`mock_usage.csv`):** Emulates 84 months of actual monthly consumption (2018–2024) factoring in annual population growth (2.5%) and seasonal peaks (summer peaks).
- **Infrastructure Capacities (`mock_capacity.json`):** Sets physical benchmarks for each ward's water supply and sewage treatment plant (STP).
- **Satellite Index Calculation (`ml/preprocess.py`):** Precomputes and logs simulated NDVI (vegetation), NDBI (built-up density), and MNDWI (open water) values for the wards. It also contains fully implemented Rasterio band math code demonstrating Sentinel-2 image extraction.

---

## 📊 Evaluation Criteria Mapping

### 1. Forecasting Accuracy
- **Model:** Separate Facebook Prophet time-series models are fit per ward for both water and sewerage utilities.
- **Horizon:** Generates high-fidelity forecasts 1 year, 5 years, and 10 years into the future.
- **Seasonality:** Accommodates annual trend changes and seasonal oscillations. Negative predictions are automatically clipped to prevent impossible values.

### 2. Geospatial Intelligence
- **Basemap:** Implements a premium, high-contrast dark cartographic basemap.
- **Choropleth Visuals:** Leaflet polygons are color-coded based on the stress score of the selected horizon, updating dynamically.
- **Metadata Bindings:** Hover tooltips display the ward population, names, and real-time stress scores.

### 3. Infrastructure Gap Identification
- **Stress Formulation:** Calculates `stress_score = forecasted_demand / capacity`.
- **Tiers:** Wards are grouped into High Stress (Red, >90%), Medium Stress (Orange, 70% - 90%), and Low Stress (Green, <70%).
- **Reference Overlays:** The Chart.js side-panel overlays a horizontal line representing physical design capacity against the forecasted utility line, providing an instant visual of when demand will exceed capacity.
- **Ranked Priority list:** The backend ML script output automatically ranks all 20 wards by priority for intervention based on five-year horizons.

### 4. Scalability
- **Hybrid Backend Architecture:** Implements a fallback mode. If GDAL is not installed, it falls back to a standard database serialization where GeoJSON is manually constructed. When GDAL is present, it uses GeoDjango with PostgreSQL/PostGIS.
- **Optimized Data Pipeline:** Utilizes bulk insertion for database imports.

### 5. Usability
- **Premium UX Theme:** High-end dark theme design using glassmorphism components (`backdrop-filter: blur(12px)`), harmonization of Outfit/Inter font families, custom legends, and reactive button clicks.
- **Domain Metrics:** Converted raw bytes/liters to Million Liters per Day (MLD) for professional municipal planning metrics.
- **Clean Side Panel:** Sidebar collapses when closed and loads detailed charts with loader states.

### 6. Integration Readiness
- **REST Endpoints:** Exposes DRF routes:
  - `GET /api/wards/`: Exposes standard GeoJSON FeatureCollection containing all properties and pre-calculated multi-horizon stress matrices.
  - `GET /api/forecast/<ward_id>/`: Exposes a merged history + forecast array.
  - `GET /api/capacity/`: Exposes capacities.

### 7. Transparency / Auditability
- **No Placeholders:** Every file is fully functional.
- **Explicit Assumptions:** Labeled clearly as "Synthetic Data Mode" in the dashboard. Preprocessing steps are documented in `preprocess.py`.
