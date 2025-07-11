export const apiConfig = {
  timeout: 10000,
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
};

export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    profile: '/auth/profile',
    checkAuth: '/auth/check',
    notifications: '/auth/notifications',
  },
  books: {
    list: '/books',
    create: '/books',
    get: (id: string) => `/books/${id}`,
    update: (id: string) => `/books/${id}`,
    delete: (id: string) => `/books/${id}`,
  },
  sessions: {
    list: '/sessions',
    create: '/sessions',
    get: (id: string) => `/sessions/${id}`,
    update: (id: string) => `/sessions/${id}`,
  },
};