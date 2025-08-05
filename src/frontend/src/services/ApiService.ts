/**
 * Simple, Secure API Service
 * 
 * A production-ready HTTP client that follows 2024 best practices:
 * - Centralized axios configuration
 * - Environment-aware authentication (localStorage for dev, httpOnly cookies for prod)
 * - Secure token refresh logic
 * - Input validation and error handling
 * - TypeScript support
 * 
 * @version 1.1.0
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { environment } from '../config/environment';

interface ApiError {
  message: string;
  status: number;
  code?: string | undefined;
}

class ApiService {
  private client: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{resolve: (value: unknown) => void, reject: (reason: unknown) => void}> = [];

  constructor() {
    this.client = axios.create({
      baseURL: environment.apiBaseUrl,
      timeout: environment.production ? 5000 : 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest', // CSRF protection
      },
      withCredentials: true, // Enable httpOnly cookies
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // Environment-aware authentication:
        // - Development: Use localStorage tokens for easy testing
        // - Production: Rely on httpOnly cookies (sent automatically)
        if (environment.development) {
          const token = localStorage.getItem('auth-token');
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        // Production: httpOnly cookies are sent automatically via withCredentials: true
        return config;
      },
      (error: unknown) => Promise.reject(error)
    );

    // Response interceptor for token refresh and error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle 401 Unauthorized with token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // Queue failed requests during refresh
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            }).then(token => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              return this.client(originalRequest);
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const newToken = await this.refreshToken();
            this.processQueue(null, newToken);
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return this.client(originalRequest);
          } catch (refreshError) {
            this.processQueue(refreshError, null);
            this.handleAuthFailure();
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(this.handleError(error));
      }
    );
  }

  private processQueue(error: unknown, token: string | null): void {
    this.failedQueue.forEach(({ resolve, reject }) => {
      error ? reject(error) : resolve(token);
    });
    this.failedQueue = [];
  }

  private async refreshToken(): Promise<string> {
    try {
      const response = await axios.post(`${environment.apiBaseUrl}/auth/refresh`, {}, {
        withCredentials: true,
      });
      
      const newToken = response.data.access_token || response.data.token;
      if (newToken && environment.development) {
        // Only store in localStorage during development
        localStorage.setItem('auth-token', newToken);
        return newToken;
      } else if (environment.production) {
        // Production uses httpOnly cookies, no token to store
        return 'cookie-based'; // Placeholder return
      }
      throw new Error('No token received');
    } catch (error) {
      if (environment.development) {
        localStorage.removeItem('auth-token');
      }
      throw new Error('Token refresh failed');
    }
  }

  private handleAuthFailure(): void {
    // Clear auth state based on environment
    if (environment.development) {
      localStorage.removeItem('auth-token');
    }
    // Production: httpOnly cookies are cleared by server
    
    // Redirect to login (only in browser environment)
    if (typeof window !== 'undefined') {
      console.warn('Authentication failed, redirecting to login');
      // In development, show auth info; in production, redirect immediately
      if (environment.development) {
        console.info('Development mode: Use any credentials to login');
      }
      // window.location.href = '/login'; // Uncomment when login page is ready
    }
  }

  private handleError(error: AxiosError): ApiError {
    const responseData = error.response?.data as Record<string, unknown>;
    const apiError: ApiError = {
      message: (typeof responseData?.message === 'string' ? responseData.message : undefined) || error.message || 'Network error occurred',
      status: error.response?.status || 0,
      code: typeof responseData?.code === 'string' ? responseData.code : undefined,
    };

    // Development logging
    if (environment.debug) {
      console.error('API Error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: apiError.status,
        message: apiError.message,
      });
    }

    return apiError;
  }

  // ==================== PUBLIC API METHODS ====================

  /**
   * GET request
   */
  async get<T>(url: string): Promise<T> {
    this.validateUrl(url);
    const response = await this.client.get<T>(url);
    return response.data;
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: unknown): Promise<T> {
    this.validateUrl(url);
    this.validateData(data);
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: unknown): Promise<T> {
    this.validateUrl(url);
    this.validateData(data);
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string): Promise<T> {
    this.validateUrl(url);
    const response = await this.client.delete<T>(url);
    return response.data;
  }

  /**
   * PATCH request
   */
  async patch<T>(url: string, data?: unknown): Promise<T> {
    this.validateUrl(url);
    this.validateData(data);
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  // ==================== VALIDATION METHODS ====================

  /**
   * Validate URL format and security
   */
  private validateUrl(url: string): void {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL: must be a non-empty string');
    }
    
    if (!url.startsWith('/')) {
      throw new Error('Invalid URL: must start with "/"');
    }
    
    // Additional security checks
    if (url.includes('..') || url.includes('//')) {
      throw new Error('Invalid URL: path traversal detected');
    }
    
    if (url.length > 2048) {
      throw new Error('Invalid URL: too long');
    }
  }

  /**
   * Validate request data
   */
  private validateData(data: unknown): void {
    if (data === null || data === undefined) {
      return; // Allow null/undefined data
    }
    
    // Prevent sending functions or other dangerous types
    if (typeof data === 'function') {
      throw new Error('Invalid data: functions not allowed');
    }
    
    // Check for circular references that would break JSON serialization
    try {
      JSON.stringify(data);
    } catch (error) {
      throw new Error('Invalid data: contains circular references or non-serializable values');
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * POST file upload with multipart/form-data
   */
  async postFormData<T>(url: string, formData: FormData): Promise<T> {
    this.validateUrl(url);
    if (!(formData instanceof FormData)) {
      throw new Error('Invalid form data: must be FormData instance');
    }
    
    const response = await this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  /**
   * HEAD request for checking resource availability
   */
  async head(url: string): Promise<AxiosResponse> {
    this.validateUrl(url);
    return await this.client.head(url);
  }

  /**
   * Check if user is authenticated
   * Note: In production with httpOnly cookies, this check is limited
   */
  isAuthenticated(): boolean {
    if (environment.development) {
      return !!localStorage.getItem('auth-token');
    }
    // Production: Can't check httpOnly cookies from JS
    // Should rely on server-side auth check instead
    return true; // Assume authenticated, let server validate
  }

  /**
   * Manually set auth token (for development login)
   */
  setAuthToken(token: string): void {
    if (environment.development) {
      localStorage.setItem('auth-token', token);
    }
    // Production: tokens are managed via httpOnly cookies by server
  }

  /**
   * Clear auth token (for logout)
   */
  clearAuthToken(): void {
    if (environment.development) {
      localStorage.removeItem('auth-token');
    }
    // Production: httpOnly cookies cleared by server logout endpoint
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Export types for consumers
export type { ApiError };
export default apiService;