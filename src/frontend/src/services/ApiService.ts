/**
 * Simple Centralized API Service
 * 
 * Exactly what you requested: "centralized network file to make calls"
 * Eliminates duplicate code for HTTP/axios calls by centralizing headers and methods.
 * 
 * Following 2024-2025 best practices with security improvements:
 * - Single axios instance with centralized configuration
 * - Production-ready security (HTTPS enforcement, secure headers)
 * - Simple service layer without over-engineering
 * - Direct usage in components for maximum simplicity
 * 
 * @version 1.1.0 - Security Enhanced
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { environment } from '../config/environment';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    const baseURL = environment.apiBaseUrl;
    
    // Security: Enforce HTTPS in production
    if (environment.production && !baseURL.startsWith('https://')) {
      throw new Error('HTTPS required in production environment');
    }

    // Create centralized axios instance with secure configuration
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      withCredentials: true, // Enable httpOnly cookies (more secure than localStorage)
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest', // CSRF protection
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - keeping simple but secure
    this.client.interceptors.request.use((config) => {
      // For development, still support localStorage tokens
      // In production, rely on httpOnly cookies sent automatically
      if (environment.development) {
        const token = localStorage.getItem('auth-token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });

    // Response interceptor with secure error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Security: Sanitize error messages
        const status = error.response?.status;
        
        if (status === 401) {
          // Clear any dev tokens and handle auth
          if (environment.development) {
            localStorage.removeItem('auth-token');
          }
          // In production, httpOnly cookies are cleared by server
        }
        
        // Return sanitized error
        const sanitizedError = {
          status,
          message: this.getSafeErrorMessage(status),
          timestamp: new Date().toISOString()
        };
        
        return Promise.reject(sanitizedError);
      }
    );
  }

  private getSafeErrorMessage(status?: number): string {
    // Security: Only return safe, user-friendly messages
    const safeMessages: Record<number, string> = {
      400: 'Invalid request',
      401: 'Authentication required',
      403: 'Access denied',
      404: 'Resource not found',
      429: 'Too many requests',
      500: 'Server error'
    };
    
    return safeMessages[status || 500] || 'An error occurred';
  }

  private validateUrl(url: string): string {
    // Security: Prevent path traversal attacks
    if (url.includes('../') || url.includes('..\\')) {
      throw new Error('Invalid URL path');
    }
    
    // Ensure URL starts with /
    if (!url.startsWith('/')) {
      url = '/' + url;
    }
    
    return url;
  }

  // ==================== HTTP METHODS ====================

  /**
   * GET request - returns data directly (no need for .data)
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const validatedUrl = this.validateUrl(url);
    const response = await this.client.get<T>(validatedUrl, config);
    return response.data;
  }

  /**
   * POST request - returns data directly (no need for .data)
   */
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const validatedUrl = this.validateUrl(url);
    const response = await this.client.post<T>(validatedUrl, data, config);
    return response.data;
  }

  /**
   * PUT request - returns data directly (no need for .data)
   */
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const validatedUrl = this.validateUrl(url);
    const response = await this.client.put<T>(validatedUrl, data, config);
    return response.data;
  }

  /**
   * PATCH request - returns data directly (no need for .data)
   */
  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const validatedUrl = this.validateUrl(url);
    const response = await this.client.patch<T>(validatedUrl, data, config);
    return response.data;
  }

  /**
   * DELETE request - returns data directly (no need for .data)
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const validatedUrl = this.validateUrl(url);
    const response = await this.client.delete<T>(validatedUrl, config);
    return response.data;
  }

  /**
   * HEAD request - returns response data directly
   */
  async head<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const validatedUrl = this.validateUrl(url);
    const response = await this.client.head<T>(validatedUrl, config);
    return response.data;
  }

  /**
   * Secure file upload helper with validation
   */
  async postFormData<T>(
    url: string, 
    formData: FormData,
    options?: {
      maxSize?: number;
      allowedTypes?: string[];
    }
  ): Promise<T> {
    const validatedUrl = this.validateUrl(url);
    
    // Security: Validate file uploads
    this.validateFileUpload(formData, options);
    
    const response = await this.client.post<T>(validatedUrl, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      maxContentLength: options?.maxSize || 50 * 1024 * 1024, // 50MB default
      maxBodyLength: options?.maxSize || 50 * 1024 * 1024,
    });
    return response.data;
  }

  private validateFileUpload(formData: FormData, options?: any): void {
    const allowedTypes = options?.allowedTypes || ['application/pdf'];
    const maxSize = options?.maxSize || 50 * 1024 * 1024; // 50MB
    
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        if (!allowedTypes.includes(value.type)) {
          throw new Error(`File type ${value.type} not allowed`);
        }
        if (value.size > maxSize) {
          throw new Error('File size exceeds limit');
        }
      }
    }
  }

  // ==================== AUTH HELPERS ====================
  // Note: In production, use httpOnly cookies instead of localStorage

  /**
   * Set authentication token (dev only - use httpOnly cookies in production)
   */
  setAuthToken(token: string): void {
    if (environment.development) {
      localStorage.setItem('auth-token', token);
    } else {
      console.warn('Use httpOnly cookies for authentication in production');
    }
  }

  /**
   * Clear authentication token (dev only)
   */
  clearAuthToken(): void {
    if (environment.development) {
      localStorage.removeItem('auth-token');
    }
    // In production, server should clear httpOnly cookies
  }

  /**
   * Get current auth token (dev only)
   */
  getAuthToken(): string | null {
    if (environment.development) {
      return localStorage.getItem('auth-token');
    }
    return null; // httpOnly cookies not accessible via JS
  }
}

// Export singleton instance for use throughout the app
export const apiService = new ApiService();
export default apiService;