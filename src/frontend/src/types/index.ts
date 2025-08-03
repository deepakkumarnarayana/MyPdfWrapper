import React from 'react';

// API Response Types
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
  errors?: string[];
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Entity Types
export interface BookItem {
  id: string;
  title: string;
  fileName: string;
  fileUrl?: string;
  fileSize: number;
  totalPages: number;
  lastReadPage: number;
  progress: number;
  status: 'In Progress' | 'Started' | 'Completed';
  thumbnail?: string;
  uploadDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionItem {
  id: string;
  bookId: string;
  book?: BookItem;
  startPage: number;
  endPage: number;
  duration: number; // in seconds
  pagesRead: number[];
  status: 'Completed' | 'In Progress' | 'Cards Generated';
  cardsGenerated: boolean;
  startTime: string;
  endTime?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlashCard {
  id: string;
  sessionId: string;
  bookId: string;
  front: string;
  back: string;
  pageNumber: number;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  reviewCount: number;
  correctCount: number;
  lastReviewed?: string;
  isBookmarked: boolean;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan: 'free' | 'pro' | 'premium';
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  defaultZoom: number;
  autoGenerateCards: boolean;
  sessionReminders: boolean;
  preferredAI: string;
}

export interface StudyStats {
  totalTime: number; // in seconds
  cardsGenerated: number;
  sessionsCompleted: number;
  booksRead: number;
  averageSessionTime: number; // in seconds
  longestSession: number; // in seconds
  favoriteTimeOfDay: string;
  weeklyProgress: number[];
  monthlyGoal: number;
  currentStreak: number;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface AIProvider {
  id: string;
  name: string;
  active: boolean;
  apiKey?: string;
  endpoint?: string;
  model?: string;
  lastUsed?: string;
  usageCount: number;
  configuration: Record<string, any>;
}

// UI Component Types
export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export interface CardProps {
  children: React.ReactNode;
  onClick?: () => void;
  hoverable?: boolean;
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export interface ProgressProps {
  value: number;
  max?: number;
  color?: string;
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

// Navigation Types
export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  badge?: number;
  active?: boolean;
  onClick?: () => void;
  children?: SidebarItem[];
  permissions?: string[];
}

// Legacy types for backwards compatibility
export interface PDF extends BookItem {}
export interface Flashcard extends FlashCard {}

// Additional API Types
export interface FlashcardGenerationResponse {
  flashcards: FlashCard[];
  sessionId: string;
  pagesProcessed: number[];
}

export interface APIError {
  message: string;
  code: string;
  statusCode: number;
}

// Hook Types
export interface UseApiOptions {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (...args: any[]) => Promise<T>;
  reset: () => void;
}
