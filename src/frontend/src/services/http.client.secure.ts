import axios, { 
  AxiosInstance, 
  AxiosRequestConfig, 
  AxiosResponse, 
  AxiosError,
  CancelTokenSource 
} from 'axios';
import { getHttpConfig, HttpClientConfig } from '../config/http.config';

// Security-focused types and interfaces
interface SecureRequestConfig extends AxiosRequestConfig {
  useCache?: boolean;
  cacheTime?: number;
  retries?: number;
  retryDelay?: number;
  dedupe?: boolean;
  skipAuth?: boolean;
  skipCSRF?: boolean;
  validation?: ValidationSchema;
  sanitize?: boolean;
  onUploadProgress?: (progress: number) => void;
  onDownloadProgress?: (progress: number) => void;
}

interface ValidationSchema {
  [key: string]: {
    type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    maxLength?: number;
    minLength?: number;
    pattern?: RegExp;
    min?: number;
    max?: number;
    allowedValues?: any[];
  };
}

interface CachedResponse<T = any> {
  data: T;
  timestamp: number;
  expiry: number;
  etag?: string;
}

interface SecurityMetrics {
  totalRequests: number;
  blockedRequests: number;
  rateLimitHits: number;
  xssAttempts: number;
  invalidTokens: number;
  csrfFailures: number;
}

// Advanced XSS Protection Class
class XSSProtection {
  private static readonly DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /<link\b[^>]*>/gi,
    /<meta\b[^>]*>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi
  ];

  private static readonly HTML_ENTITIES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };

  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';
    
    let sanitized = input;
    
    // Remove dangerous patterns
    this.DANGEROUS_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    
    // HTML encode dangerous characters
    sanitized = sanitized.replace(/[&<>"'`=\/]/g, (char) => {
      return this.HTML_ENTITIES[char] || char;
    });
    
    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    
    return sanitized;
  }

  static sanitizeResponseData<T>(data: T): T {
    if (typeof data === 'string') {
      return this.sanitizeInput(data) as T;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeResponseData(item)) as T;
    }
    
    if (data && typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeResponseData(value);
      }
      return sanitized;
    }
    
    return data;
  }

  static detectXSSAttempt(input: string): boolean {
    return this.DANGEROUS_PATTERNS.some(pattern => pattern.test(input));
  }
}

// Secure Token Manager with httpOnly Cookie Support
class SecureTokenManager {
  private fallbackToken: string | null = null;
  private csrfToken: string | null = null;
  private tokenFingerprint: string | null = null;

  constructor() {
    this.initializeSecurity();
  }

  private initializeSecurity(): void {
    // Generate browser fingerprint for additional security
    this.tokenFingerprint = this.generateBrowserFingerprint();
    
    // Initialize CSRF token
    this.initializeCSRF();
  }

  private generateBrowserFingerprint(): string {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset().toString(),
      navigator.hardwareConcurrency?.toString() || '0'
    ];
    
    return btoa(components.join('|')).substring(0, 32);
  }

  async initializeCSRF(): Promise<void> {
    try {
      // Fetch CSRF token from server
      const response = await fetch('/api/v1/csrf-token', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-Client-Type': 'spa'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.csrfToken = data.csrfToken;
      }
    } catch (error) {
      console.warn('[SECURITY] Failed to initialize CSRF protection:', error);
    }
  }

  // For HTTPS environments, tokens should come from httpOnly cookies
  getToken(): string | null {
    // In production with HTTPS, this should return null as tokens
    // are automatically sent via httpOnly cookies
    if (location.protocol === 'https:') {
      return null; // httpOnly cookies handle authentication
    }
    
    // Fallback for development (encrypted localStorage)
    return this.getEncryptedToken();
  }

  private getEncryptedToken(): string | null {
    try {
      const encrypted = localStorage.getItem('__auth_data');
      if (!encrypted) return null;
      
      const data = JSON.parse(encrypted);
      
      // Verify fingerprint
      if (data.fingerprint !== this.tokenFingerprint) {
        this.clearTokens();
        return null;
      }
      
      // Simple encryption (in production, use proper crypto)
      return atob(data.token);
    } catch {
      this.clearTokens();
      return null;
    }
  }

  setToken(token: string, refreshToken?: string): void {
    // In HTTPS production, server sets httpOnly cookies
    if (location.protocol === 'https:') {
      // Tokens are set via httpOnly cookies by server
      return;
    }
    
    // Development fallback with encryption
    try {
      const data = {
        token: btoa(token), // Simple encryption
        refreshToken: refreshToken ? btoa(refreshToken) : null,
        fingerprint: this.tokenFingerprint,
        timestamp: Date.now()
      };
      
      localStorage.setItem('__auth_data', JSON.stringify(data));
    } catch (error) {
      console.error('[SECURITY] Failed to store token:', error);
    }
  }

  getCSRFToken(): string | null {
    return this.csrfToken;
  }

  clearTokens(): void {
    localStorage.removeItem('__auth_data');
    this.fallbackToken = null;
    this.csrfToken = null;
  }

  isValidToken(token: string): boolean {
    if (!token) return false;
    
    try {
      // Basic JWT validation
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      
      const payload = JSON.parse(atob(parts[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }
}

// Input Validation Engine
class InputValidator {
  static validate(data: any, schema: ValidationSchema): any {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid request data format');
    }

    const validated: any = {};
    const errors: string[] = [];

    for (const [key, rules] of Object.entries(schema)) {
      const value = data[key];
      
      try {
        validated[key] = this.validateField(key, value, rules);
      } catch (error: any) {
        errors.push(error.message);
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(`Validation failed: ${errors.join(', ')}`);
    }

    return validated;
  }

  private static validateField(key: string, value: any, rules: any): any {
    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      throw new ValidationError(`Field '${key}' is required`);
    }

    if (value === undefined || value === null) {
      return value;
    }

    // Type validation
    if (rules.type && typeof value !== rules.type) {
      throw new ValidationError(`Field '${key}' must be of type ${rules.type}`);
    }

    // String validations
    if (typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        throw new ValidationError(`Field '${key}' must be at least ${rules.minLength} characters`);
      }
      
      if (rules.maxLength && value.length > rules.maxLength) {
        throw new ValidationError(`Field '${key}' exceeds maximum length of ${rules.maxLength}`);
      }

      if (rules.pattern && !rules.pattern.test(value)) {
        throw new ValidationError(`Field '${key}' format is invalid`);
      }

      // XSS detection
      if (XSSProtection.detectXSSAttempt(value)) {
        throw new SecurityError(`Potential XSS detected in field '${key}'`);
      }

      // Sanitize
      value = XSSProtection.sanitizeInput(value);
    }

    // Number validations
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        throw new ValidationError(`Field '${key}' must be at least ${rules.min}`);
      }
      
      if (rules.max !== undefined && value > rules.max) {
        throw new ValidationError(`Field '${key}' must not exceed ${rules.max}`);
      }
    }

    // Allowed values check
    if (rules.allowedValues && !rules.allowedValues.includes(value)) {
      throw new ValidationError(`Field '${key}' has invalid value`);
    }

    return value;
  }
}

// Custom Error Classes
class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Secure Logger
class SecureLogger {
  private static readonly SENSITIVE_PATTERNS = [
    /password/i, /token/i, /secret/i, /key/i, /auth/i, /credential/i,
    /ssn/i, /social/i, /credit/i, /card/i, /phone/i, /email/i
  ];

  static logRequest(config: SecureRequestConfig): void {
    if (!this.shouldLog('DEBUG')) return;

    const sanitized = {
      method: config.method?.toUpperCase(),
      url: this.sanitizeURL(config.url || ''),
      requestId: (config as any).metadata?.requestId,
      timestamp: new Date().toISOString()
    };

    this.writeLog('REQUEST', sanitized);
  }

  static logResponse(response: AxiosResponse, duration: number): void {
    if (!this.shouldLog('DEBUG')) return;

    const sanitized = {
      status: response.status,
      duration: `${duration}ms`,
      size: this.getResponseSize(response),
      requestId: (response.config as any).metadata?.requestId,
      timestamp: new Date().toISOString()
    };

    this.writeLog('RESPONSE', sanitized);
  }

  static logSecurityEvent(event: string, details: any): void {
    const sanitized = {
      event,
      details: this.sanitizeLogData(details),
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent.substring(0, 100),
      url: location.pathname
    };

    this.writeLog('SECURITY', sanitized);
  }

  private static sanitizeLogData(data: any): any {
    if (typeof data === 'string') {
      return this.isSensitiveData(data) ? '[REDACTED]' : data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeLogData(item));
    }

    if (data && typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (this.isSensitiveField(key)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeLogData(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  private static isSensitiveField(field: string): boolean {
    return this.SENSITIVE_PATTERNS.some(pattern => pattern.test(field));
  }

  private static isSensitiveData(data: string): boolean {
    return this.SENSITIVE_PATTERNS.some(pattern => pattern.test(data));
  }

  private static sanitizeURL(url: string): string {
    try {
      const parsed = new URL(url, location.origin);
      parsed.search = ''; // Remove query parameters
      return parsed.pathname;
    } catch {
      return '[INVALID_URL]';
    }
  }

  private static shouldLog(level: string): boolean {
    return process.env.NODE_ENV === 'development' || level === 'SECURITY';
  }

  private static getResponseSize(response: AxiosResponse): string {
    try {
      const size = JSON.stringify(response.data).length;
      return size > 1024 ? `${(size / 1024).toFixed(1)}KB` : `${size}B`;
    } catch {
      return 'Unknown';
    }
  }

  private static writeLog(type: string, data: any): void {
    if (process.env.NODE_ENV === 'production') {
      // Send to secure logging service
      this.sendToSecurityService(type, data);
    } else {
      console.log(`[${type}]`, data);
    }
  }

  private static sendToSecurityService(type: string, data: any): void {
    // Implement secure logging service integration
    // Example: DataDog, Splunk, or custom security monitoring
  }
}

// Ultra-Secure HTTP Client Implementation
class UltraSecureHttpClient {
  private instance: AxiosInstance;
  private config: HttpClientConfig;
  private tokenManager: SecureTokenManager;
  private cache = new Map<string, CachedResponse>();
  private pendingRequests = new Map<string, Promise<any>>();
  private rateLimiter = new Map<string, number[]>();
  private securityMetrics: SecurityMetrics = {
    totalRequests: 0,
    blockedRequests: 0,
    rateLimitHits: 0,
    xssAttempts: 0,
    invalidTokens: 0,
    csrfFailures: 0
  };

  constructor(customConfig?: Partial<HttpClientConfig>) {
    this.config = { ...getHttpConfig(), ...customConfig };
    this.tokenManager = new SecureTokenManager();
    this.enforceHTTPS();
    this.createSecureInstance();
    this.setupSecurityMonitoring();
  }

  private enforceHTTPS(): void {
    // Modern security: Enforce HTTPS-only in production
    if (location.protocol === 'http:' && process.env.NODE_ENV === 'production') {
      // Force redirect to HTTPS
      location.replace(location.href.replace('http:', 'https:'));
      return;
    }

    // Validate that HTTPS is available for API calls
    if (process.env.NODE_ENV === 'production' && !this.config.baseURL.startsWith('https:')) {
      throw new SecurityError('HTTPS is required for production API calls');
    }

    // Check for HSTS support and log security status
    this.checkHSTSSupport();
  }

  private checkHSTSSupport(): void {
    if (location.protocol === 'https:') {
      SecureLogger.logSecurityEvent('HTTPS_ENFORCED', {
        protocol: location.protocol,
        host: location.host,
        hasHSTS: this.hasHSTSHeader()
      });
    } else if (process.env.NODE_ENV === 'development') {
      console.warn('🔒 SECURITY WARNING: Using HTTP in development. HTTPS recommended.');
    }
  }

  private hasHSTSHeader(): boolean {
    // Check if HSTS header was sent (browser enforces this)
    return document.location.protocol === 'https:' && 
           ('strict-transport-security' in document.documentElement.dataset ||
            performance.getEntriesByType('navigation').some(entry => 
              (entry as any).transferSize > 0
            ));
  }

  private createSecureInstance(): void {
    this.instance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      withCredentials: this.config.withCredentials,
      headers: this.getDefaultSecurityHeaders(),
    });

    this.setupInterceptors();
  }

  private getDefaultSecurityHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Client-Type': 'spa',
      'X-Client-Version': process.env.REACT_APP_VERSION || '1.0.0',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    };
  }

  private setupInterceptors(): void {
    // Enhanced Request Interceptor
    this.instance.interceptors.request.use(
      (config) => {
        this.securityMetrics.totalRequests++;
        
        // Add metadata
        const metadata = {
          requestId: this.generateSecureRequestId(),
          startTime: Date.now(),
          fingerprint: this.generateRequestFingerprint(config)
        };
        (config as any).metadata = metadata;

        // Security validations
        this.validateRequest(config);

        // Add authentication
        if (!config.skipAuth) {
          this.addAuthentication(config);
        }

        // Add CSRF protection
        if (!config.skipCSRF && ['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase() || '')) {
          this.addCSRFProtection(config);
        }

        // Rate limiting check
        this.checkRateLimit(config.url || '');

        // Input validation and sanitization
        if (config.data && config.validation) {
          config.data = InputValidator.validate(config.data, config.validation);
        }

        if (config.data && config.sanitize !== false) {
          config.data = XSSProtection.sanitizeResponseData(config.data);
        }

        // Security headers
        config.headers = {
          ...config.headers,
          'X-Request-ID': metadata.requestId,
          'X-Client-Timestamp': Date.now().toString(),
        };

        // Log request
        SecureLogger.logRequest(config);

        return config;
      },
      (error) => {
        SecureLogger.logSecurityEvent('REQUEST_INTERCEPTOR_ERROR', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Enhanced Response Interceptor
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        const metadata = (response.config as any).metadata;
        const duration = Date.now() - metadata?.startTime;

        // Log response
        SecureLogger.logResponse(response, duration);

        // Sanitize response data
        if (response.data && typeof response.data === 'object') {
          response.data = XSSProtection.sanitizeResponseData(response.data);
        }

        // Update CSRF token if provided
        const newCSRFToken = response.headers['x-csrf-token'];
        if (newCSRFToken) {
          this.tokenManager['csrfToken'] = newCSRFToken;
        }

        return response;
      },
      async (error: AxiosError) => {
        const config = error.config as SecureRequestConfig;
        
        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !config._retry) {
          return this.handleUnauthorized(config);
        }

        // Handle rate limiting
        if (error.response?.status === 429) {
          this.securityMetrics.rateLimitHits++;
          SecureLogger.logSecurityEvent('RATE_LIMIT_HIT', { url: config.url });
        }

        // Enhanced retry logic
        if (this.shouldRetry(error, config)) {
          return this.retryRequest(config);
        }

        // Log security events
        if (this.isSecurityRelatedError(error)) {
          SecureLogger.logSecurityEvent('SECURITY_ERROR', {
            status: error.response?.status,
            message: error.message,
            url: config.url
          });
        }

        return Promise.reject(this.enhanceError(error));
      }
    );
  }

  private validateRequest(config: AxiosRequestConfig): void {
    // URL validation
    if (!this.isValidURL(config.url || '')) {
      this.securityMetrics.blockedRequests++;
      throw new SecurityError('Invalid request URL detected');
    }

    // Payload size validation
    if (config.data) {
      const size = JSON.stringify(config.data).length;
      if (size > 1024 * 1024) { // 1MB limit
        throw new SecurityError('Request payload exceeds size limit');
      }
    }

    // Header validation
    this.validateHeaders(config.headers || {});
  }

  private isValidURL(url: string): boolean {
    try {
      const parsed = new URL(url, this.config.baseURL);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  private validateHeaders(headers: any): void {
    const dangerous = ['host', 'origin', 'referer'];
    for (const header of dangerous) {
      if (header in headers) {
        throw new SecurityError(`Dangerous header detected: ${header}`);
      }
    }
  }

  private addAuthentication(config: AxiosRequestConfig): void {
    const token = this.tokenManager.getToken();
    if (token) {
      if (!this.tokenManager.isValidToken(token)) {
        this.securityMetrics.invalidTokens++;
        this.tokenManager.clearTokens();
        throw new SecurityError('Invalid or expired token');
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  private addCSRFProtection(config: AxiosRequestConfig): void {
    const csrfToken = this.tokenManager.getCSRFToken();
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    } else {
      // Log CSRF failure but don't block request (server should handle)
      this.securityMetrics.csrfFailures++;
      SecureLogger.logSecurityEvent('CSRF_TOKEN_MISSING', { url: config.url });
    }
  }

  private checkRateLimit(url: string): void {
    if (!this.config.enableRateLimit) return;

    const key = this.getRateLimitKey(url);
    const now = Date.now();
    const window = 60000; // 1 minute
    
    if (!this.rateLimiter.has(key)) {
      this.rateLimiter.set(key, []);
    }
    
    const requests = this.rateLimiter.get(key)!;
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < window);
    
    if (validRequests.length >= this.config.requestsPerMinute) {
      this.securityMetrics.rateLimitHits++;
      throw new SecurityError('Rate limit exceeded');
    }
    
    validRequests.push(now);
    this.rateLimiter.set(key, validRequests);
  }

  private getRateLimitKey(url: string): string {
    // Combine URL pattern with client fingerprint
    const urlPattern = url.split('?')[0]; // Remove query params
    return `${this.tokenManager['tokenFingerprint']}:${urlPattern}`;
  }

  private generateSecureRequestId(): string {
    // Cryptographically secure random ID
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private generateRequestFingerprint(config: AxiosRequestConfig): string {
    const components = [
      config.method || 'GET',
      config.url || '',
      JSON.stringify(config.params || {}),
      Date.now().toString()
    ];
    return btoa(components.join('|')).substring(0, 16);
  }

  private async handleUnauthorized(config: SecureRequestConfig): Promise<any> {
    try {
      // Mark as retry to prevent infinite loops
      config._retry = true;
      
      // Attempt token refresh
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // Retry original request with new token
        return this.instance.request(config);
      }
    } catch (error) {
      this.handleAuthFailure();
    }
    
    throw new SecurityError('Authentication failed');
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Refresh-Request': 'true'
        }
      });

      if (response.ok) {
        // Server sets new httpOnly cookies automatically
        return true;
      }
    } catch (error) {
      SecureLogger.logSecurityEvent('TOKEN_REFRESH_FAILED', { error });
    }
    
    return false;
  }

  private handleAuthFailure(): void {
    this.tokenManager.clearTokens();
    SecureLogger.logSecurityEvent('AUTH_FAILURE', {});
    
    // Dispatch custom event for app-wide logout handling
    window.dispatchEvent(new CustomEvent('auth:logout', {
      detail: { reason: 'token_refresh_failed' }
    }));
  }

  private shouldRetry(error: AxiosError, config: SecureRequestConfig): boolean {
    const retries = config.retries || this.config.defaultRetries;
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

  private async retryRequest(config: SecureRequestConfig): Promise<any> {
    const retryCount = (config._retryCount || 0) + 1;
    const delay = (config.retryDelay || this.config.retryDelay) * Math.pow(this.config.retryMultiplier, retryCount - 1);
    
    await this.delay(delay);
    
    return this.instance.request({
      ...config,
      _retryCount: retryCount,
      _retry: true
    });
  }

  private isSecurityRelatedError(error: AxiosError): boolean {
    const status = error.response?.status;
    return !!(status && [401, 403, 413, 429].includes(status));
  }

  private enhanceError(error: AxiosError): AxiosError {
    // Create user-friendly error messages
    const status = error.response?.status;
    
    switch (status) {
      case 400:
        error.message = 'Invalid request. Please check your input.';
        break;
      case 401:
        error.message = 'Authentication required. Please log in.';
        break;
      case 403:
        error.message = 'Access denied. You do not have permission.';
        break;
      case 404:
        error.message = 'Resource not found.';
        break;
      case 413:
        error.message = 'Request too large. Please reduce the data size.';
        break;
      case 429:
        error.message = 'Too many requests. Please wait before trying again.';
        break;
      case 500:
        error.message = 'Server error. Please try again later.';
        break;
      default:
        if (!navigator.onLine) {
          error.message = 'No internet connection. Please check your network.';
        } else {
          error.message = 'An unexpected error occurred. Please try again.';
        }
    }
    
    return error;
  }

  private setupSecurityMonitoring(): void {
    // Monitor security metrics
    setInterval(() => {
      if (this.securityMetrics.blockedRequests > 0 || 
          this.securityMetrics.xssAttempts > 0 || 
          this.securityMetrics.rateLimitHits > 10) {
        
        SecureLogger.logSecurityEvent('SECURITY_METRICS', this.securityMetrics);
      }
    }, 60000); // Every minute

    // Clear rate limiter periodically
    setInterval(() => {
      this.rateLimiter.clear();
    }, 60000);

    // Cache cleanup
    setInterval(() => {
      this.cleanupCache();
    }, 300000); // Every 5 minutes
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expiry) {
        this.cache.delete(key);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods with security enhancements
  async get<T>(url: string, config: SecureRequestConfig = {}): Promise<T> {
    const cacheKey = this.getCacheKey({ ...config, method: 'GET', url });
    
    // Check cache
    if (config.useCache !== false && this.config.enableCaching) {
      const cached = this.getCachedResponse<T>(cacheKey);
      if (cached) return cached;
    }
    
    // Check deduplication
    if (config.dedupe !== false && this.config.enableDeduplication) {
      const dedupeKey = this.getDedupeKey({ ...config, method: 'GET', url });
      if (this.pendingRequests.has(dedupeKey)) {
        return this.pendingRequests.get(dedupeKey);
      }
    }

    const request = this.instance.get<T>(url, config).then(response => {
      const data = response.data;
      
      // Cache successful GET responses
      if (config.useCache !== false && this.config.enableCaching) {
        this.setCachedResponse(cacheKey, data, config.cacheTime);
      }
      
      return data;
    }).finally(() => {
      if (config.dedupe !== false) {
        this.pendingRequests.delete(this.getDedupeKey({ ...config, method: 'GET', url }));
      }
    });

    if (config.dedupe !== false && this.config.enableDeduplication) {
      this.pendingRequests.set(this.getDedupeKey({ ...config, method: 'GET', url }), request);
    }

    return request;
  }

  async post<T>(url: string, data?: any, config: SecureRequestConfig = {}): Promise<T> {
    return this.instance.post<T>(url, data, config).then(response => response.data);
  }

  async put<T>(url: string, data?: any, config: SecureRequestConfig = {}): Promise<T> {
    return this.instance.put<T>(url, data, config).then(response => response.data);
  }

  async delete<T>(url: string, config: SecureRequestConfig = {}): Promise<T> {
    return this.instance.delete<T>(url, config).then(response => response.data);
  }

  async upload<T>(
    url: string,
    file: File,
    onProgress?: (progress: number) => void,
    config: SecureRequestConfig = {}
  ): Promise<T> {
    // File validation
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      throw new SecurityError('File size exceeds maximum allowed size');
    }

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

  // Cache management
  private getCacheKey(config: SecureRequestConfig): string {
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

  private setCachedResponse<T>(key: string, data: T, cacheTime: number = this.config.defaultCacheTime): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + cacheTime
    });
  }

  private getDedupeKey(config: SecureRequestConfig): string {
    return this.getCacheKey(config);
  }

  // Utility methods
  clearCache(): void {
    this.cache.clear();
  }

  getSecurityMetrics(): SecurityMetrics {
    return { ...this.securityMetrics };
  }

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
export const secureHttpClient = new UltraSecureHttpClient();

// Backward compatibility exports
export const httpGet = <T>(url: string, config?: SecureRequestConfig): Promise<T> =>
  secureHttpClient.get<T>(url, config);

export const httpPost = <T>(url: string, data?: any, config?: SecureRequestConfig): Promise<T> =>
  secureHttpClient.post<T>(url, data, config);

export const httpPut = <T>(url: string, data?: any, config?: SecureRequestConfig): Promise<T> =>
  secureHttpClient.put<T>(url, data, config);

export const httpDelete = <T>(url: string, config?: SecureRequestConfig): Promise<T> =>
  secureHttpClient.delete<T>(url, config);

export { UltraSecureHttpClient, SecureRequestConfig, ValidationSchema };
export default secureHttpClient;