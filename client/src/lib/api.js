import axios from 'axios';

// In dev: Vite proxy forwards /api → localhost:3001
// In production: VITE_API_URL points to the Render server URL
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('fp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
