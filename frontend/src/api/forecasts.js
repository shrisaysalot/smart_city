import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getWards = async () => {
  try {
    const response = await apiClient.get('/api/wards/');
    return response.data;
  } catch (error) {
    console.error('Error fetching wards GeoJSON:', error);
    throw error;
  }
};

export const getCapacity = async () => {
  try {
    const response = await apiClient.get('/api/capacity/');
    return response.data;
  } catch (error) {
    console.error('Error fetching capacity details:', error);
    throw error;
  }
};

export const getForecast = async (wardId) => {
  try {
    const response = await apiClient.get(`/api/forecast/${wardId}/`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching forecast for ward ${wardId}:`, error);
    throw error;
  }
};
