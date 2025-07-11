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
      const [books, researchPapers, sessions, aiProviders, systemServices, stats] = await Promise.all([
        booksApi.getBooks(),
        researchPapersApi.getResearchPapers(),
        sessionsApi.getSessions(),
        aiProvidersApi.getAIProviders(),
        systemApi.getSystemServices(),
        systemApi.getStats(),
      ]);

      setData({
        books,
        researchPapers,
        sessions,
        aiProviders,
        systemServices,
        stats,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load data',
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