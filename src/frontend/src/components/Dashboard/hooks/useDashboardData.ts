import { useState, useEffect, useCallback } from 'react';
import { 
  Book, 
  ResearchPaper, 
  Session, 
  AIProvider, 
  SystemService, 
  DashboardStats
} from '../../../types/dashboard';
import { booksApi } from '../../../services/api/books.api';
import { researchPapersApi } from '../../../services/api/researchPapers.api';
import { sessionsApi } from '../../../services/api/sessions.api';
import { aiProvidersApi } from '../../../services/api/aiProviders.api';
import { systemApi } from '../../../services/api/system.api';

export interface DashboardData {
  books: Book[];
  researchPapers: ResearchPaper[];
  sessions: Session[];
  aiProviders: AIProvider[];
  systemServices: SystemService[];
  stats: DashboardStats;
  isLoading: boolean;
  error: string | null;
}

export const useDashboardData = () => {
  const [data, setData] = useState<DashboardData>({
    books: [],
    researchPapers: [],
    sessions: [],
    aiProviders: [],
    systemServices: [],
    stats: {
      totalTime: '0h 0m',
      cardsGenerated: '0',
      sessionsCompleted: '0',
      booksRead: '0',
    },
    isLoading: true,
    error: null,
  });

  const loadData = useCallback(async () => {
    setData(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Use Promise.allSettled to handle individual API failures gracefully
      const results = await Promise.allSettled([
        booksApi.getBooks(),
        researchPapersApi.getResearchPapers(),
        sessionsApi.getSessions(),
        aiProvidersApi.getAIProviders(),
        systemApi.getSystemServices(),
        systemApi.getStats(),
      ]);

      // Helper to extract data or return a default value on failure
      const getDataOrDefault = <T>(result: PromiseSettledResult<T>, defaultValue: T): T => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        // Log the error for debugging but don't let it break the dashboard
        console.error('API call failed:', result.reason);
        return defaultValue;
      };

      setData({
        books: getDataOrDefault(results[0], []),
        researchPapers: getDataOrDefault(results[1], []),
        sessions: getDataOrDefault(results[2], []),
        aiProviders: getDataOrDefault(results[3], []),
        systemServices: getDataOrDefault(results[4], []),
        stats: getDataOrDefault(results[5], {
          totalTime: '0h 0m',
          cardsGenerated: '0',
          sessionsCompleted: '0',
          booksRead: '0',
        }),
        isLoading: false,
        error: null, // No critical error since we are handling failures gracefully
      });
    } catch (error) {
      // This catch block will now only handle unexpected critical errors
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load critical data',
      }));
    }
  }, []);

  const refreshData = useCallback(() => {
    loadData();
  }, [loadData]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 5 minutes for system services and AI providers
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [aiProviders, systemServices] = await Promise.all([
          aiProvidersApi.getAIProviders(),
          systemApi.getSystemServices(),
        ]);
        
        setData(prev => ({
          ...prev,
          aiProviders,
          systemServices,
        }));
      } catch (error) {
        console.error('Failed to refresh real-time data:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, []);

  return {
    ...data,
    refreshData,
    reloadBooks: useCallback(async () => {
      try {
        const books = await booksApi.getBooks();
        setData(prev => ({ ...prev, books }));
      } catch (error) {
        console.error('Failed to reload books:', error);
      }
    }, []),
    reloadSessions: useCallback(async () => {
      try {
        const sessions = await sessionsApi.getSessions();
        setData(prev => ({ ...prev, sessions }));
      } catch (error) {
        console.error('Failed to reload sessions:', error);
      }
    }, []),
  };
};