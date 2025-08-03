import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { environment } from '../config/environment';

// Create axios instance
const httpClient: AxiosInstance = axios.create({
  baseURL: environment.apiBaseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
httpClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
httpClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: any) => {
    const originalRequest = error.config;

    // Handle 401 unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Try to refresh token
      try {
        const refreshToken = localStorage.getItem('refresh-token');
        if (refreshToken) {
          const response = await axios.post<{ token: string }>(`${environment.apiBaseUrl}/auth/refresh`, {
            refreshToken,
          });
          
          const { token } = response.data;
          localStorage.setItem('auth-token', token);
          
          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return httpClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('auth-token');
        localStorage.removeItem('refresh-token');
        window.location.href = '/login';
      }
    }

    // Handle other errors
    return Promise.reject(error);
  }
);

export default httpClient;

// Utility functions for common HTTP operations
export const httpGet = <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
  httpClient.get<T>(url, config).then(response => response.data);

export const httpPost = <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
  httpClient.post<T>(url, data, config).then(response => response.data);

export const httpPut = <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
  httpClient.put<T>(url, data, config).then(response => response.data);

export const httpDelete = <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
  httpClient.delete<T>(url, config).then(response => response.data);

export { httpClient };
