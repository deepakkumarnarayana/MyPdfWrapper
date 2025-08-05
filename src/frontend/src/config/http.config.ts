export interface HttpClientConfig {
  // Base configuration
  baseURL: string;
  timeout: number;
  withCredentials: boolean;

  // Security settings
  enableCSRFProtection: boolean;
  secureTokenStorage: boolean;
  validateTokens: boolean;
  
  // Caching settings
  enableCaching: boolean;
  defaultCacheTime: number;
  maxCacheSize: number;
  
  // Retry settings
  enableRetry: boolean;
  defaultRetries: number;
  retryDelay: number;
  retryMultiplier: number;
  
  // Rate limiting
  enableRateLimit: boolean;
  requestsPerMinute: number;
  
  // Request deduplication
  enableDeduplication: boolean;
  
  // Offline support
  enableOfflineQueue: boolean;
  maxOfflineRequests: number;
  
  // Logging and monitoring
  enableRequestLogging: boolean;
  enablePerformanceMonitoring: boolean;
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
  
  // Development features
  enableMocking: boolean;
  mockDelay: number;
}

export const defaultHttpConfig: HttpClientConfig = {
  // Base configuration
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api',
  timeout: 30000,
  withCredentials: true,

  // Security settings
  enableCSRFProtection: true,
  secureTokenStorage: true,
  validateTokens: true,
  
  // Caching settings
  enableCaching: true,
  defaultCacheTime: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 100,
  
  // Retry settings
  enableRetry: true,
  defaultRetries: 3,
  retryDelay: 1000,
  retryMultiplier: 2,
  
  // Rate limiting
  enableRateLimit: true,
  requestsPerMinute: 100,
  
  // Request deduplication
  enableDeduplication: true,
  
  // Offline support
  enableOfflineQueue: true,
  maxOfflineRequests: 50,
  
  // Logging and monitoring
  enableRequestLogging: process.env.NODE_ENV === 'development',
  enablePerformanceMonitoring: true,
  logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'error',
  
  // Development features
  enableMocking: process.env.NODE_ENV === 'test',
  mockDelay: 1000,
};

// Environment-specific configurations
export const httpConfigs = {
  development: {
    ...defaultHttpConfig,
    enableRequestLogging: true,
    enablePerformanceMonitoring: true,
    logLevel: 'debug' as const,
    timeout: 10000,
  },
  
  staging: {
    ...defaultHttpConfig,
    enableRequestLogging: false,
    logLevel: 'warn' as const,
    timeout: 20000,
  },
  
  production: {
    ...defaultHttpConfig,
    enableRequestLogging: false,
    enablePerformanceMonitoring: true,
    logLevel: 'error' as const,
    timeout: 30000,
    defaultRetries: 2,
  },
  
  test: {
    ...defaultHttpConfig,
    enableMocking: true,
    enableRequestLogging: false,
    enableCaching: false,
    timeout: 5000,
  },
};

// Get configuration based on environment
export function getHttpConfig(): HttpClientConfig {
  const env = process.env.NODE_ENV || 'development';
  return httpConfigs[env as keyof typeof httpConfigs] || defaultHttpConfig;
}

// Custom configuration override
export function createHttpConfig(overrides: Partial<HttpClientConfig>): HttpClientConfig {
  return {
    ...getHttpConfig(),
    ...overrides,
  };
}