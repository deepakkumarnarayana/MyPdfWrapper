/**
 * Simple Centralized API Service
 * 
 * Exactly what you requested: "centralized network file to make calls"
 * Eliminates duplicate code for HTTP/axios calls by centralizing headers and methods.
 * 
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    // Create centralized axios instance with common configuration
    this.client = axios.create({
      baseURL: '/api/v1',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Add auth token to requests if available
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth-token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle response errors globally
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('auth-token');
          // Redirect to login if needed
        }
        return Promise.reject(error);
      }
    );
  }

  // ==================== HTTP METHODS ====================

  async get<T>(url: string): Promise<T> {
    const response = await this.client.get<T>(url);
    return response.data;
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }

  // File upload helper
  async postFormData<T>(url: string, formData: FormData): Promise<T> {
    const response = await this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Set auth token
  setAuthToken(token: string): void {
    localStorage.setItem('auth-token', token);
  }

  // Clear auth token
  clearAuthToken(): void {
    localStorage.removeItem('auth-token');
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;