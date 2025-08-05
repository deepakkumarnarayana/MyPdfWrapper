/**
 * Centralized API Endpoint Definitions
 */
export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    profile: '/auth/profile',
    checkAuth: '/auth/check',
    notifications: '/auth/notifications',
  },
  documents: {
    list: '/documents',
    create: '/documents',
    get: (id: string) => `/documents/${id}`,
    update: (id: string) => `/documents/${id}`,
    delete: (id: string) => `/documents/${id}`,
    url: (id: string) => `/documents/${id}/url`,
  },
  sessions: {
    list: '/sessions',
    create: '/sessions',
    get: (id: string) => `/sessions/${id}`,
    update: (id: string) => `/sessions/${id}`,
  },
  flashcards: {
    list: (docId: number) => `/documents/${docId}/flashcards`,
    generate: (docId: number) => `/documents/${docId}/flashcards/generate`,
    update: (id: number) => `/flashcards/${id}`,
    delete: (id: number) => `/flashcards/${id}`,
  },
  health: '/health',
};
