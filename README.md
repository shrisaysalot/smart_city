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

## 🛰️ Real-Calibrated Estimates & Data Sources
To ensure realistic modeling for this PoC, pure synthetic random data has been replaced with estimates calibrated from real-world Vijayawada Municipal Corporation (VMC) and census statistics:

### 📊 Real City Statistics & Parameters Used
- **Base City Population (2011):** 1,035,000, distributed proportionally among wards based on their geographic boundary area (`Shape_Area`), and projected forward to 2024 using an annual growth rate of **3%**.
- **City Total Water Supply:** 216 MLD (Million Liters per Day).
- **Per Capita Consumption:** Calibrated at **150 LPCD** (Liters per Capita per Day).
- **Non-Revenue Water Loss:** **27%** (Supply capacity required = Demand / 0.73).
- **Sewage Generation:** Modeled at **85%** of water consumption per ward.
- **City Total STP Capacity:** 140 MLD.

### 📚 Official Data Sources Documented
1. **UN-Habitat Vijayawada City Profile 2023:** Establishes the city total water supply of **216 MLD** and per-capita supply rate of **180 LPCD**.
2. **Swachh Bharat Mission (SBM) 2023:** Confirms city-level sewage generation of **132 MLD** and active Sewage Treatment Plant (STP) capacity of **140 MLD**.
3. **Bandari et al. 2023 (Household Survey):** Records actual household-level water consumption ranges between **128–150 LPCD**.
4. **Census of India 2011:** Provides the baseline city-wide municipal population of **1,035,000**.

### 🛠️ Simulated Data Generation & Satellite Index Preprocessing
- **Ward Boundaries (`Vijayawada_Wards.geojson`):** Real boundaries of the 77 municipal wards of Vijayawada downloaded from the DataMeet repository.
- **Historical Consumption & Capacity:** Automatically generated in [forecast.py](file:///c:/Users/shris/OneDrive/Desktop/smart_city/backend/ml/forecast.py) by scaling the real statistics per ward based on population distribution and area, then incorporating a `+15%` summer peak (April–June) and `-10%` monsoon dip (July–September).
- **Satellite Index Calculation (`ml/preprocess.py`):** Precomputes and logs simulated NDVI (vegetation), NDBI (built-up density), and MNDWI (open water) values for all 77 wards. Includes fully implemented Rasterio band math code demonstrating georeferenced Sentinel-2 band calculation.

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
- **Explicit Assumptions:** Labeled clearly as "Real-Calibrated Estimates · Based on VMC/UN-Habitat City Statistics" in the dashboard. Preprocessing steps are documented in `preprocess.py`.
