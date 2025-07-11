// TypeScript interfaces for Dashboard data
// These define the shape of data returned from JSON APIs

import { BookItem } from './index';

export interface Book extends Omit<BookItem, 'fileSize'> {
  pages: string;
  fileSize: string;
  currentPage?: number;
}

export interface ResearchPaper {
  id: string;
  title: string;
  pages: string;
  progress: number;
  status: 'In Progress' | 'Started' | 'Completed';
  authors?: string[];
  publishedDate: string;
  journal?: string;
  citations?: number;
}

export interface Session {
  id: string;
  title: string;
  pages: string;
  duration: string;
  hasCards: boolean;
  bookId?: string;
  createdAt: string;
  cardsGenerated?: number;
  pagesRead?: number;
}

export interface AIProvider {
  id: string;
  name: string;
  lastUsed: string;
  status: 'online' | 'offline';
  apiKeyConfigured?: boolean;
  responseTime?: number;
  requestCount?: number;
}

export interface SystemService {
  id: string;
  service: string;
  status: 'Online' | 'Active' | 'Synced' | 'Offline' | 'Error';
  color: 'success' | 'info' | 'primary' | 'warning' | 'error';
  uptime?: number;
  lastCheck?: string;
}

export interface DashboardStats {
  totalTime: string;
  cardsGenerated: string;
  sessionsCompleted: string;
  booksRead: string;
}