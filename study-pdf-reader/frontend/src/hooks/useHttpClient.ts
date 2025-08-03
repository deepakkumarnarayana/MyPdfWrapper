import { useState, useCallback, useRef, useEffect } from 'react';
import { httpClient } from '../services/http.client.enhanced';

interface UseHttpState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  progress?: number;
}

interface UseHttpOptions {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  useCache?: boolean;
  retries?: number;
}

export function useHttpGet<T>(url: string, options: UseHttpOptions = {}) {
  const [state, setState] = useState<UseHttpState<T>>({
    data: null,
    loading: options.immediate ?? false,
    error: null,
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

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const data = await httpClient.get<T>(url, {
        signal: abortControllerRef.current.signal,
        useCache: options.useCache,
        retries: options.retries,
      });

      setState({ data, loading: false, error: null });
      options.onSuccess?.(data);
      return data;
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        const errorMessage = error.message || 'An error occurred';
        setState(prev => ({ ...prev, loading: false, error: errorMessage }));
        options.onError?.(errorMessage);
      }
      throw error;
    }
  }, [url, options.useCache, options.retries]);

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

export function useHttpPost<TData, TResponse>() {
  const [state, setState] = useState<UseHttpState<TResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (url: string, data?: TData) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await httpClient.post<TResponse>(url, data);
      setState({ data: response, loading: false, error: null });
      return response;
    } catch (error: any) {
      const errorMessage = error.message || 'An error occurred';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

export function useHttpUpload<T>() {
  const [state, setState] = useState<UseHttpState<T>>({
    data: null,
    loading: false,
    error: null,
    progress: 0,
  });

  const execute = useCallback(async (url: string, file: File) => {
    setState(prev => ({ ...prev, loading: true, error: null, progress: 0 }));

    try {
      const response = await httpClient.upload<T>(
        url,
        file,
        (progress) => {
          setState(prev => ({ ...prev, progress }));
        }
      );

      setState({ data: response, loading: false, error: null, progress: 100 });
      return response;
    } catch (error: any) {
      const errorMessage = error.message || 'Upload failed';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null, progress: 0 });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

// Generic HTTP hook with full control
export function useHttp<T>() {
  const [state, setState] = useState<UseHttpState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const get = useCallback(async (url: string, config?: any) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await httpClient.get<T>(url, config);
      setState({ data, loading: false, error: null });
      return data;
    } catch (error: any) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      throw error;
    }
  }, []);

  const post = useCallback(async (url: string, data?: any, config?: any) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await httpClient.post<T>(url, data, config);
      setState({ data: response, loading: false, error: null });
      return response;
    } catch (error: any) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      throw error;
    }
  }, []);

  const put = useCallback(async (url: string, data?: any, config?: any) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await httpClient.put<T>(url, data, config);
      setState({ data: response, loading: false, error: null });
      return response;
    } catch (error: any) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      throw error;
    }
  }, []);

  const del = useCallback(async (url: string, config?: any) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await httpClient.delete<T>(url, config);
      setState({ data: response, loading: false, error: null });
      return response;
    } catch (error: any) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
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

// Hook for managing multiple requests
export function useHttpBatch() {
  const [state, setState] = useState<{
    loading: boolean;
    errors: string[];
    completed: number;
    total: number;
  }>({
    loading: false,
    errors: [],
    completed: 0,
    total: 0,
  });

  const execute = useCallback(async (requests: Array<() => Promise<any>>) => {
    setState({
      loading: true,
      errors: [],
      completed: 0,
      total: requests.length,
    });

    const results = [];
    const errors = [];

    for (let i = 0; i < requests.length; i++) {
      try {
        const result = await requests[i]();
        results.push(result);
      } catch (error: any) {
        errors.push(error.message);
      }

      setState(prev => ({
        ...prev,
        completed: i + 1,
        errors,
      }));
    }

    setState(prev => ({
      ...prev,
      loading: false,
    }));

    return { results, errors };
  }, []);

  return {
    ...state,
    execute,
    progress: state.total > 0 ? (state.completed / state.total) * 100 : 0,
  };
}

export default useHttp;