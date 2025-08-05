/**
 * Simple Environment Configuration
 * 
 * Just the essentials - no over-engineering!
 */

export const environment = {
  // Environment detection
  development: import.meta.env.MODE === 'development',
  production: import.meta.env.MODE === 'production',
  
  // API Configuration
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 
    (import.meta.env.DEV ? 'http://localhost:8000/api/v1' : '/api/v1'),
  
  // Basic settings
  debug: import.meta.env.VITE_DEBUG === 'true' || import.meta.env.MODE === 'development',
};

export default environment;