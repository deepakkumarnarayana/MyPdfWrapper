import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Book, 
  ResearchPaper, 
  Session, 
  AIProvider, 
  SystemService, 
  DashboardStats
} from '../../../types/dashboard';
import { apiService } from '../../../services/ApiService';
import { pdfService } from '../../../services/pdfService';

// Define query keys for caching and invalidation
const QUERY_KEYS = {
  books: ['books'],
  researchPapers: ['researchPapers'],
  sessions: ['sessions'],
  aiProviders: ['aiProviders'],
  systemServices: ['systemServices'],
  stats: ['stats'],
  dashboard: ['dashboard'], // A key for all dashboard data
};

export const useDashboardData = () => {
  const queryClient = useQueryClient();

  // Fetch books
  const { 
    data: books = [], 
    isLoading: isBooksLoading, 
    error: booksError 
  } = useQuery<Book[], Error>({
    queryKey: QUERY_KEYS.books,
    queryFn: () => pdfService.getBooks(),
  });

  // Fetch research papers
  const { 
    data: researchPapers = [], 
    isLoading: isPapersLoading, 
    error: papersError 
  } = useQuery<ResearchPaper[], Error>({
    queryKey: QUERY_KEYS.researchPapers,
    queryFn: () => apiService.get<ResearchPaper[]>('/documents?document_type=research_paper'),
  });

  // Fetch sessions
  const { 
    data: sessions = [], 
    isLoading: isSessionsLoading, 
    error: sessionsError 
  } = useQuery<Session[], Error>({
    queryKey: QUERY_KEYS.sessions,
    queryFn: () => apiService.get<Session[]>('/sessions'),
  });

  // Fetch AI providers with auto-refresh
  const { 
    data: aiProviders = [], 
    isLoading: isProvidersLoading, 
    error: providersError 
  } = useQuery<AIProvider[], Error>({
    queryKey: QUERY_KEYS.aiProviders,
    queryFn: () => apiService.get<AIProvider[]>('/ai-providers'),
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Fetch system services with auto-refresh
  const { 
    data: systemServices = [], 
    isLoading: isServicesLoading, 
    error: servicesError 
  } = useQuery<SystemService[], Error>({
    queryKey: QUERY_KEYS.systemServices,
    queryFn: () => apiService.get<SystemService[]>('/system/services'),
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Fetch stats
  const { 
    data: stats = { totalTime: '0h 0m', cardsGenerated: '0', sessionsCompleted: '0', booksRead: '0' }, 
    isLoading: isStatsLoading, 
    error: statsError 
  } = useQuery<DashboardStats, Error>({
    queryKey: QUERY_KEYS.stats,
    queryFn: () => apiService.get<DashboardStats>('/system/stats'),
  });

  // Combine loading states and errors
  const isLoading = isBooksLoading || isPapersLoading || isSessionsLoading || isProvidersLoading || isServicesLoading || isStatsLoading;
  const error = booksError || papersError || sessionsError || providersError || servicesError || statsError;

  // Function to invalidate all dashboard queries and trigger a refresh
  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard });
  };

  return {
    books,
    researchPapers,
    sessions,
    aiProviders,
    systemServices,
    stats,
    isLoading,
    error: error ? error.message : null,
    refreshData,
    // Specific reload functions by invalidating specific query keys
    reloadBooks: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.books }),
    reloadSessions: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sessions }),
  };
};