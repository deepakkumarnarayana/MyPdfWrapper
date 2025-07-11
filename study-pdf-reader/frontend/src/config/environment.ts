export const environment = {
  development: import.meta.env.MODE === 'development',
  production: import.meta.env.MODE === 'production',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  debug: import.meta.env.VITE_DEBUG === 'true',
};