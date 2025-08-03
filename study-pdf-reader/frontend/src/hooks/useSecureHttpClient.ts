import { useState, useCallback, useRef, useEffect } from 'react';
import { secureHttpClient, SecureRequestConfig, ValidationSchema } from '../services/http.client.secure';

interface UseSecureHttpState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  progress?: number;
  securityMetrics?: any;
}

interface UseSecureHttpOptions {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  onSecurityEvent?: (event: string, details: any) => void;
  useCache?: boolean;
  retries?: number;
  validation?: ValidationSchema;
  sanitize?: boolean;
}

// Secure GET Hook
export function useSecureHttpGet<T>(url: string, options: UseSecureHttpOptions = {}) {
  const [state, setState] = useState<UseSecureHttpState<T>>({
    data: null,
    loading: options.immediate ?? false,
    error: null,
    securityMetrics: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const execute = useCallback(async () => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    requestIdRef.current = Math.random().toString(36);

    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null,
      securityMetrics: secureHttpClient.getSecurityMetrics()
    }));

    try {
      const config: SecureRequestConfig = {
        signal: abortControllerRef.current.signal,
        useCache: options.useCache,
        retries: options.retries,
        validation: options.validation,
        sanitize: options.sanitize,
      };

      const data = await secureHttpClient.get<T>(url, config);

      setState({ 
        data, 
        loading: false, 
        error: null,
        securityMetrics: secureHttpClient.getSecurityMetrics()
      });
      
      options.onSuccess?.(data);
      return data;
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        const errorMessage = error.message || 'An error occurred';
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: errorMessage,
          securityMetrics: secureHttpClient.getSecurityMetrics()
        }));
        
        options.onError?.(errorMessage);
        
        // Log security events
        if (error.name === 'SecurityError') {
          options.onSecurityEvent?.('SECURITY_ERROR', { error: errorMessage, url });
        }
      }
      throw error;
    }
  }, [url, options.useCache, options.retries, options.validation, options.sanitize]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState(prev => ({ ...prev, loading: false }));
  }, []);

  useEffect(() => {
    if (options.immediate) {
      execute();
    }

    return () => {
      cancel();
    };
  }, [execute, options.immediate, cancel]);

  return {
    ...state,
    execute,
    cancel,
    refetch: execute,
  };
}

// Secure POST Hook
export function useSecureHttpPost<TData, TResponse>(options: UseSecureHttpOptions = {}) {
  const [state, setState] = useState<UseSecureHttpState<TResponse>>({
    data: null,
    loading: false,
    error: null,
    securityMetrics: null,
  });

  const execute = useCallback(async (url: string, data?: TData) => {
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null,
      securityMetrics: secureHttpClient.getSecurityMetrics()
    }));

    try {
      const config: SecureRequestConfig = {
        validation: options.validation,
        sanitize: options.sanitize,
        retries: options.retries,
      };

      const response = await secureHttpClient.post<TResponse>(url, data, config);
      
      setState({ 
        data: response, 
        loading: false, 
        error: null,
        securityMetrics: secureHttpClient.getSecurityMetrics()
      });
      
      options.onSuccess?.(response);
      return response;
    } catch (error: any) {
      const errorMessage = error.message || 'An error occurred';
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage,
        securityMetrics: secureHttpClient.getSecurityMetrics()
      }));
      
      options.onError?.(errorMessage);
      
      // Log security events
      if (error.name === 'SecurityError') {
        options.onSecurityEvent?.('SECURITY_ERROR', { error: errorMessage, url });
      }
      
      throw error;
    }
  }, [options.validation, options.sanitize, options.retries]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null, securityMetrics: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

// Secure Upload Hook
export function useSecureHttpUpload<T>(options: UseSecureHttpOptions = {}) {
  const [state, setState] = useState<UseSecureHttpState<T>>({
    data: null,
    loading: false,
    error: null,
    progress: 0,
    securityMetrics: null,
  });

  const execute = useCallback(async (url: string, file: File) => {
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null, 
      progress: 0,
      securityMetrics: secureHttpClient.getSecurityMetrics()
    }));

    try {
      // File security validation
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('File type not allowed');
      }

      if (file.size > 50 * 1024 * 1024) { // 50MB
        throw new Error('File size exceeds maximum allowed size');
      }

      const response = await secureHttpClient.upload<T>(
        url,
        file,
        (progress) => {
          setState(prev => ({ ...prev, progress }));
        },
        {
          retries: options.retries || 1, // Lower retries for uploads
        }
      );

      setState({ 
        data: response, 
        loading: false, 
        error: null, 
        progress: 100,
        securityMetrics: secureHttpClient.getSecurityMetrics()
      });
      
      options.onSuccess?.(response);
      return response;
    } catch (error: any) {
      const errorMessage = error.message || 'Upload failed';
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage,
        securityMetrics: secureHttpClient.getSecurityMetrics()
      }));
      
      options.onError?.(errorMessage);
      
      if (error.name === 'SecurityError') {
        options.onSecurityEvent?.('UPLOAD_SECURITY_ERROR', { error: errorMessage, fileName: file.name });
      }
      
      throw error;
    }
  }, [options.retries]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null, progress: 0, securityMetrics: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

// Generic Secure HTTP Hook
export function useSecureHttp<T>(options: UseSecureHttpOptions = {}) {
  const [state, setState] = useState<UseSecureHttpState<T>>({
    data: null,
    loading: false,
    error: null,
    securityMetrics: null,
  });

  const request = useCallback(async (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: any,
    config?: SecureRequestConfig
  ) => {
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null,
      securityMetrics: secureHttpClient.getSecurityMetrics()
    }));

    try {
      const requestConfig: SecureRequestConfig = {
        ...config,
        validation: options.validation,
        sanitize: options.sanitize,
        retries: options.retries,
      };

      let response: T;
      
      switch (method) {
        case 'GET':
          response = await secureHttpClient.get<T>(url, requestConfig);
          break;
        case 'POST':
          response = await secureHttpClient.post<T>(url, data, requestConfig);
          break;
        case 'PUT':
          response = await secureHttpClient.put<T>(url, data, requestConfig);
          break;
        case 'DELETE':
          response = await secureHttpClient.delete<T>(url, requestConfig);
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }

      setState({ 
        data: response, 
        loading: false, 
        error: null,
        securityMetrics: secureHttpClient.getSecurityMetrics()
      });
      
      options.onSuccess?.(response);
      return response;
    } catch (error: any) {
      const errorMessage = error.message || 'Request failed';
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage,
        securityMetrics: secureHttpClient.getSecurityMetrics()
      }));
      
      options.onError?.(errorMessage);
      
      if (error.name === 'SecurityError') {
        options.onSecurityEvent?.('SECURITY_ERROR', { 
          error: errorMessage, 
          method, 
          url 
        });
      }
      
      throw error;
    }
  }, [options.validation, options.sanitize, options.retries]);

  const get = useCallback((url: string, config?: SecureRequestConfig) => 
    request('GET', url, undefined, config), [request]);

  const post = useCallback((url: string, data?: any, config?: SecureRequestConfig) => 
    request('POST', url, data, config), [request]);

  const put = useCallback((url: string, data?: any, config?: SecureRequestConfig) => 
    request('PUT', url, data, config), [request]);

  const del = useCallback((url: string, config?: SecureRequestConfig) => 
    request('DELETE', url, undefined, config), [request]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null, securityMetrics: null });
  }, []);

  return {
    ...state,
    get,
    post,
    put,
    delete: del,
    reset,
  };
}

// Security Monitoring Hook
export function useSecurityMonitoring() {
  const [securityMetrics, setSecurityMetrics] = useState(secureHttpClient.getSecurityMetrics());
  const [cacheStats, setCacheStats] = useState(secureHttpClient.getCacheStats());

  const refreshMetrics = useCallback(() => {
    setSecurityMetrics(secureHttpClient.getSecurityMetrics());
    setCacheStats(secureHttpClient.getCacheStats());
  }, []);

  const clearCache = useCallback(() => {
    secureHttpClient.clearCache();
    refreshMetrics();
  }, [refreshMetrics]);

  useEffect(() => {
    const interval = setInterval(refreshMetrics, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [refreshMetrics]);

  return {
    securityMetrics,
    cacheStats,
    refreshMetrics,
    clearCache,
  };
}

// Authentication Hook
export function useSecureAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const login = useCallback(async (credentials: { email: string; password: string }) => {
    setAuthLoading(true);
    
    try {
      const config: SecureRequestConfig = {
        validation: {
          email: { type: 'string', required: true, pattern: /^\S+@\S+\.\S+$/ },
          password: { type: 'string', required: true, minLength: 8 }
        },
        skipAuth: true, // Don't add auth header for login
      };

      await secureHttpClient.post('/auth/login', credentials, config);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      setIsAuthenticated(false);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthLoading(true);
    
    try {
      await secureHttpClient.post('/auth/logout');
    } catch (error) {
      // Continue with logout even if request fails
    } finally {
      setIsAuthenticated(false);
      setAuthLoading(false);
    }
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      await secureHttpClient.get('/auth/status');
      setIsAuthenticated(true);
    } catch (error) {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    // Listen for auth events
    const handleAuthEvent = (event: CustomEvent) => {
      if (event.type === 'auth:logout') {
        setIsAuthenticated(false);
      }
    };

    window.addEventListener('auth:logout', handleAuthEvent as EventListener);
    
    // Check initial auth status
    checkAuthStatus();

    return () => {
      window.removeEventListener('auth:logout', handleAuthEvent as EventListener);
    };
  }, [checkAuthStatus]);

  return {
    isAuthenticated,
    authLoading,
    login,
    logout,
    checkAuthStatus,
  };
}

// Batch Request Hook
export function useSecureHttpBatch() {
  const [state, setState] = useState<{
    loading: boolean;
    errors: string[];
    completed: number;
    total: number;
    results: any[];
  }>({
    loading: false,
    errors: [],
    completed: 0,
    total: 0,
    results: [],
  });

  const execute = useCallback(async (requests: Array<() => Promise<any>>) => {
    setState({
      loading: true,
      errors: [],
      completed: 0,
      total: requests.length,
      results: [],
    });

    const results: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < requests.length; i++) {
      try {
        const result = await requests[i]();
        results.push(result);
      } catch (error: any) {
        errors.push(error.message);
        results.push(null);
      }

      setState(prev => ({
        ...prev,
        completed: i + 1,
        errors: [...errors],
        results: [...results],
      }));
    }

    setState(prev => ({
      ...prev,
      loading: false,
    }));

    return { results, errors };
  }, []);

  const reset = useCallback(() => {
    setState({
      loading: false,
      errors: [],
      completed: 0,
      total: 0,
      results: [],
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
    progress: state.total > 0 ? (state.completed / state.total) * 100 : 0,
  };
}

export default useSecureHttp;