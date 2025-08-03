import axios, { 
  AxiosInstance, 
  AxiosRequestConfig, 
  AxiosResponse, 
  AxiosError,
  CancelTokenSource 
} from 'axios';
import { environment } from '../config/environment';

// Types for enhanced functionality
interface RequestConfig extends AxiosRequestConfig {
  useCache?: boolean;
  cacheTime?: number;
  retries?: number;
  retryDelay?: number;
  dedupe?: boolean;
  skipAuth?: boolean;
  onUploadProgress?: (progress: number) => void;
  onDownloadProgress?: (progress: number) => void;
}

interface CachedResponse<T = any> {
  data: T;
  timestamp: number;
  expiry: number;
}

interface RequestQueueItem {
  config: RequestConfig;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

// Enhanced HTTP Client Class
class EnhancedHttpClient {
  private instance: AxiosInstance;
  private cache = new Map<string, CachedResponse>();
  private pendingRequests = new Map<string, Promise<any>>();
  private requestQueue: RequestQueueItem[] = [];
  private isOnline = navigator.onLine;
  private cancelTokens = new Map<string, CancelTokenSource>();
  private rateLimiter = new Map<string, number>();

  constructor() {
    this.instance = axios.create({
      baseURL: environment.apiBaseUrl,
      timeout: 30000, // Increased timeout
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest', // CSRF protection
      },
      withCredentials: true, // Send cookies for httpOnly tokens
    });

    this.setupInterceptors();
    this.setupNetworkMonitoring();
    this.setupRateLimiting();
  }

  private setupInterceptors() {
    // Request interceptor with enhanced features
    this.instance.interceptors.request.use(
      (config) => {
        // Add request ID for tracking
        config.metadata = { 
          requestId: this.generateRequestId(),
          startTime: Date.now() 
        };

        // Add auth token if not skipped
        if (!config.skipAuth) {
          const token = this.getSecureToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }

        // Add security headers
        config.headers['X-Client-Version'] = environment.version || '1.0.0';
        config.headers['X-Client-Timestamp'] = Date.now().toString();

        // Log request in development
        if (environment.isDevelopment) {
          console.log(`🚀 HTTP Request [${config.metadata.requestId}]:`, {
            method: config.method?.toUpperCase(),
            url: config.url,
            headers: config.headers,
          });
        }

        return config;
      },
      (error) => {
        console.error('❌ Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor with enhanced error handling
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        const duration = Date.now() - response.config.metadata?.startTime;
        
        if (environment.isDevelopment) {
          console.log(`✅ HTTP Response [${response.config.metadata?.requestId}]:`, {
            status: response.status,
            duration: `${duration}ms`,
            size: JSON.stringify(response.data).length + ' bytes'
          });
        }

        return response;
      },
      async (error: AxiosError) => {
        const config = error.config as RequestConfig;
        
        // Enhanced retry logic
        if (this.shouldRetry(error, config)) {
          return this.retryRequest(config);
        }

        // Handle 401 with secure token refresh
        if (error.response?.status === 401 && !config._retry) {
          return this.handleUnauthorized(config);
        }

        // Handle network errors and offline scenarios
        if (!navigator.onLine) {
          return this.handleOfflineError(config);
        }

        // Log error details
        this.logError(error);
        
        return Promise.reject(this.enhanceError(error));
      }
    );
  }

  private setupNetworkMonitoring() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processOfflineQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  private setupRateLimiting() {
    // Simple rate limiting implementation
    setInterval(() => {
      this.rateLimiter.clear();
    }, 60000); // Reset every minute
  }

  // Security: Use more secure token storage (in production, use httpOnly cookies)
  private getSecureToken(): string | null {
    try {
      // In production, this should come from httpOnly cookies
      // For now, use localStorage with additional validation
      const token = localStorage.getItem('auth-token');
      if (token && this.isValidToken(token)) {
        return token;
      }
    } catch (error) {
      console.error('Token retrieval error:', error);
    }
    return null;
  }

  private isValidToken(token: string): boolean {
    try {
      // Basic JWT validation (in production, do server-side validation)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  // Caching implementation
  private getCacheKey(config: RequestConfig): string {
    const { method = 'GET', url = '', params, data } = config;
    return `${method}:${url}:${JSON.stringify(params)}:${JSON.stringify(data)}`;
  }

  private getCachedResponse<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCachedResponse<T>(key: string, data: T, cacheTime: number = 300000) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + cacheTime
    });
  }

  // Request deduplication
  private getDedupeKey(config: RequestConfig): string {
    return this.getCacheKey(config);
  }

  // Enhanced error handling
  private shouldRetry(error: AxiosError, config: RequestConfig): boolean {
    const retries = config.retries || 0;
    const currentRetries = config._retryCount || 0;
    
    return (
      currentRetries < retries &&
      (
        error.code === 'NETWORK_ERROR' ||
        error.code === 'TIMEOUT' ||
        (error.response?.status && error.response.status >= 500)
      )
    );
  }

  private async retryRequest(config: RequestConfig): Promise<any> {
    const retryCount = (config._retryCount || 0) + 1;
    const retryDelay = config.retryDelay || Math.pow(2, retryCount) * 1000; // Exponential backoff
    
    await this.delay(retryDelay);
    
    return this.instance.request({
      ...config,
      _retryCount: retryCount,
      _retry: true
    });
  }

  private async handleUnauthorized(config: RequestConfig): Promise<any> {
    try {
      // Implement secure token refresh
      const refreshed = await this.refreshToken();
      if (refreshed) {
        return this.instance.request({ ...config, _retry: true });
      }
    } catch (error) {
      this.handleAuthFailure();
    }
    throw new Error('Authentication failed');
  }

  private async refreshToken(): Promise<boolean> {
    try {
      // In production, this should use httpOnly cookies
      const refreshToken = localStorage.getItem('refresh-token');
      if (!refreshToken) return false;

      const response = await axios.post(`${environment.apiBaseUrl}/auth/refresh`, {
        refreshToken
      }, { withCredentials: true });

      const { token } = response.data;
      localStorage.setItem('auth-token', token);
      return true;
    } catch {
      return false;
    }
  }

  private handleAuthFailure() {
    localStorage.removeItem('auth-token');
    localStorage.removeItem('refresh-token');
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }

  private handleOfflineError(config: RequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ config, resolve, reject });
    });
  }

  private processOfflineQueue() {
    while (this.requestQueue.length > 0) {
      const { config, resolve, reject } = this.requestQueue.shift()!;
      this.instance.request(config)
        .then(resolve)
        .catch(reject);
    }
  }

  private logError(error: AxiosError) {
    if (environment.isDevelopment) {
      console.error('❌ HTTP Error:', {
        message: error.message,
        status: error.response?.status,
        url: error.config?.url,
        method: error.config?.method
      });
    }
  }

  private enhanceError(error: AxiosError): AxiosError {
    // Add user-friendly error messages
    if (!navigator.onLine) {
      error.message = 'No internet connection. Please check your network.';
    } else if (error.code === 'TIMEOUT') {
      error.message = 'Request timed out. Please try again.';
    } else if (error.response?.status === 429) {
      error.message = 'Too many requests. Please wait before trying again.';
    }
    
    return error;
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Rate limiting check
  private checkRateLimit(url: string): boolean {
    const key = url.split('?')[0]; // Remove query params
    const count = this.rateLimiter.get(key) || 0;
    
    if (count >= 100) { // 100 requests per minute per endpoint
      throw new Error('Rate limit exceeded');
    }
    
    this.rateLimiter.set(key, count + 1);
    return true;
  }

  // Public API methods with enhanced features
  async get<T>(url: string, config: RequestConfig = {}): Promise<T> {
    this.checkRateLimit(url);
    
    const cacheKey = this.getCacheKey({ ...config, method: 'GET', url });
    
    // Check cache
    if (config.useCache !== false) {
      const cached = this.getCachedResponse<T>(cacheKey);
      if (cached) return cached;
    }
    
    // Check deduplication
    if (config.dedupe !== false) {
      const dedupeKey = this.getDedupeKey({ ...config, method: 'GET', url });
      if (this.pendingRequests.has(dedupeKey)) {
        return this.pendingRequests.get(dedupeKey);
      }
    }

    const request = this.instance.get<T>(url, config).then(response => {
      const data = response.data;
      
      // Cache successful GET responses
      if (config.useCache !== false) {
        this.setCachedResponse(cacheKey, data, config.cacheTime);
      }
      
      return data;
    }).finally(() => {
      this.pendingRequests.delete(this.getDedupeKey({ ...config, method: 'GET', url }));
    });

    if (config.dedupe !== false) {
      this.pendingRequests.set(this.getDedupeKey({ ...config, method: 'GET', url }), request);
    }

    return request;
  }

  async post<T>(url: string, data?: any, config: RequestConfig = {}): Promise<T> {
    this.checkRateLimit(url);
    return this.instance.post<T>(url, data, config).then(response => response.data);
  }

  async put<T>(url: string, data?: any, config: RequestConfig = {}): Promise<T> {
    this.checkRateLimit(url);
    return this.instance.put<T>(url, data, config).then(response => response.data);
  }

  async delete<T>(url: string, config: RequestConfig = {}): Promise<T> {
    this.checkRateLimit(url);
    return this.instance.delete<T>(url, config).then(response => response.data);
  }

  // Request cancellation
  cancelRequest(requestId: string): void {
    const cancelToken = this.cancelTokens.get(requestId);
    if (cancelToken) {
      cancelToken.cancel('Request cancelled by user');
      this.cancelTokens.delete(requestId);
    }
  }

  cancelAllRequests(): void {
    this.cancelTokens.forEach(cancelToken => {
      cancelToken.cancel('All requests cancelled');
    });
    this.cancelTokens.clear();
  }

  // Upload with progress
  async upload<T>(
    url: string,
    file: File,
    onProgress?: (progress: number) => void,
    config: RequestConfig = {}
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    return this.instance.post<T>(url, formData, {
      ...config,
      headers: {
        ...config.headers,
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    }).then(response => response.data);
  }

  // Batch requests
  async batch<T>(requests: Array<() => Promise<T>>): Promise<T[]> {
    return Promise.all(requests.map(request => request()));
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }

  // Get cache stats
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, value]) => ({
        key,
        timestamp: value.timestamp,
        expiry: value.expiry,
        isExpired: Date.now() > value.expiry
      }))
    };
  }
}

// Create singleton instance
export const httpClient = new EnhancedHttpClient();

// Backward compatibility exports
export const httpGet = <T>(url: string, config?: RequestConfig): Promise<T> =>
  httpClient.get<T>(url, config);

export const httpPost = <T>(url: string, data?: any, config?: RequestConfig): Promise<T> =>
  httpClient.post<T>(url, data, config);

export const httpPut = <T>(url: string, data?: any, config?: RequestConfig): Promise<T> =>
  httpClient.put<T>(url, data, config);

export const httpDelete = <T>(url: string, config?: RequestConfig): Promise<T> =>
  httpClient.delete<T>(url, config);

export default httpClient;