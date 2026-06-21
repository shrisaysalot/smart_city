import os
import json
import numpy as np
import pandas as pd

# Try imports; if libraries are still installing, these will be used at execution time.
try:
    import rasterio
    from rasterio.mask import mask
    import geopandas as gpd
    from shapely.geometry import shape
except ImportError:
    pass  # Allow loading during environment set up

def calculate_ndvi(nir_band, red_band):
    """
    Normalized Difference Vegetation Index (NDVI)
    Formula: (NIR - Red) / (NIR + Red)
    Sentinel-2: NIR = Band 8, Red = Band 4
    """
    denominator = nir_band + red_band
    # Prevent divide by zero
    denominator[denominator == 0] = 0.0001
    return (nir_band - red_band) / denominator

def calculate_ndbi(swir_band, nir_band):
    """
    Normalized Difference Built-up Index (NDBI)
    Formula: (SWIR - NIR) / (SWIR + NIR)
    Sentinel-2: SWIR = Band 11, NIR = Band 8
    """
    denominator = swir_band + nir_band
    denominator[denominator == 0] = 0.0001
    return (swir_band - nir_band) / denominator

def calculate_mndwi(green_band, swir_band):
    """
    Modified Normalized Difference Water Index (MNDWI)
    Formula: (Green - SWIR) / (Green + SWIR)
    Sentinel-2: Green = Band 3, SWIR = Band 11
    """
    denominator = green_band + swir_band
    denominator[denominator == 0] = 0.0001
    return (green_band - swir_band) / denominator

def extract_ward_indices(geojson_path, sentinel2_tif_paths=None):
    """
    Simulates geographic extraction of satellite indices for each ward.
    In a real implementation:
      1. Load ward boundaries GeoJSON with GeoPandas.
      2. Read Sentinel-2 TIFF raster bands (B3, B4, B8, B11) using Rasterio.
      3. For each ward polygon, mask/crop the raster bands.
      4. Calculate average NDVI, NDBI, MNDWI inside the polygon bounds.
    """
    print("--- Executing Satellite Image Preprocessing ---")
    print(f"Loading ward geometries from: {geojson_path}")
    
    with open(geojson_path, 'r') as f:
        wards_data = json.load(f)
        
    results = []
    
    # Check if Sentinel-2 raster files are available (real mode)
    if sentinel2_tif_paths and all(os.path.exists(p) for p in sentinel2_tif_paths.values()):
        print("Real Sentinel-2 raster files detected. Commencing Rasterio calculations...")
        # (This block demonstrates the actual production implementation)
        gdf = gpd.read_file(geojson_path)
        
        # Open bands
        with rasterio.open(sentinel2_tif_paths['B03']) as src_green, \
             rasterio.open(sentinel2_tif_paths['B04']) as src_red, \
             rasterio.open(sentinel2_tif_paths['B08']) as src_nir, \
             rasterio.open(sentinel2_tif_paths['B11']) as src_swir:
             
             for idx, row in gdf.iterrows():
                 geom = [row['geometry']]
                 
                 # Mask rasters with ward boundary
                 out_green, _ = mask(src_green, geom, crop=True, filled=False)
                 out_red, _ = mask(src_red, geom, crop=True, filled=False)
                 out_nir, _ = mask(src_nir, geom, crop=True, filled=False)
                 out_swir, _ = mask(src_swir, geom, crop=True, filled=False)
                 
                 # Calculate indices
                 ndvi_raster = calculate_ndvi(out_nir[0], out_red[0])
                 ndbi_raster = calculate_ndbi(out_swir[0], out_nir[0])
                 mndwi_raster = calculate_mndwi(out_green[0], out_swir[0])
                 
                 ward_id_val = row.get('ward_id') or row.get('WARD_NO')
                 results.append({
                     "ward_id": ward_id_val,
                     "ndvi": float(np.nanmean(ndvi_raster)),
                     "ndbi": float(np.nanmean(ndbi_raster)),
                     "mndwi": float(np.nanmean(mndwi_raster))
                 })
    else:
        print("No real satellite rasters found. Generating high-fidelity mock satellite indexes...")
        # Since this is a PoC, we generate highly plausible values:
        # NDVI (Vegetation) around 0.15 - 0.45
        # NDBI (Built-up) around 0.20 - 0.55 (typically inverse to NDVI)
        # MNDWI (Water Index) around -0.25 to 0.10
        np.random.seed(100)
        for feature in wards_data['features']:
            w_id = feature['properties'].get('ward_id') or feature['properties'].get('WARD_NO')
            # Safely parse numeric ward number
            try:
                if w_id.startswith('W'):
                    ward_num = int(w_id[1:])
                else:
                    ward_num = int(w_id)
            except Exception:
                ward_num = 1
            
            # Urban wards: high NDBI, low NDVI
            if ward_num in [3, 7, 12, 18]:
                ndvi = float(np.random.uniform(0.08, 0.18))
                ndbi = float(np.random.uniform(0.42, 0.58))
                mndwi = float(np.random.uniform(-0.35, -0.20))
            # Suburban/greener wards: high NDVI, low NDBI
            elif ward_num in [1, 5, 10, 15, 20]:
                ndvi = float(np.random.uniform(0.35, 0.52))
                ndbi = float(np.random.uniform(0.10, 0.22))
                mndwi = float(np.random.uniform(-0.15, 0.05))
            # Moderate wards
            else:
                ndvi = float(np.random.uniform(0.18, 0.35))
                ndbi = float(np.random.uniform(0.20, 0.42))
                mndwi = float(np.random.uniform(-0.25, -0.10))
                
            results.append({
                "ward_id": w_id,
                "ndvi": round(ndvi, 4),
                "ndbi": round(ndbi, 4),
                "mndwi": round(mndwi, 4)
            })
            
    df = pd.DataFrame(results)
    output_path = os.path.join(os.path.dirname(geojson_path), "precomputed_satellite_indices.csv")
    df.to_csv(output_path, index=False)
    print(f"Preprocessed index calculations saved successfully to: {output_path}")
    return results

if __name__ == '__main__':
    # Test execution
    geojson = r"c:\Users\shris\OneDrive\Desktop\smart_city\backend\fixtures\mock_wards.geojson"
    extract_ward_indices(geojson)
