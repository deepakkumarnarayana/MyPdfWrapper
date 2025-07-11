import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { createAuthSlice, AuthSlice } from './slices/authSlice';
import { createBooksSlice, BooksSlice } from './slices/booksSlice';
import { createSessionsSlice, SessionsSlice } from './slices/sessionsSlice';
import { createUISlice, UISlice } from './slices/uiSlice';

// Combined store type
export interface AppStore extends AuthSlice, BooksSlice, SessionsSlice, UISlice {}

// Create the main store
export const useAppStore = create<AppStore>()(
  devtools(
    subscribeWithSelector(
      (...a) => ({
        ...createAuthSlice(...a),
        ...createBooksSlice(...a),
        ...createSessionsSlice(...a),
        ...createUISlice(...a),
      })
    ),
    { name: 'study-pdf-store' }
  )
);

// Selector hooks for better performance
export const useAuth = () => useAppStore(state => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
  login: state.login,
  logout: state.logout,
  updateProfile: state.updateProfile,
  checkAuth: state.checkAuth,
  fetchNotifications: state.fetchNotifications,
  notifications: state.notifications,
}));

export const useBooks = () => useAppStore(state => ({
  books: state.books,
  loading: state.booksLoading,
  error: state.booksError,
  fetchBooks: state.fetchBooks,
  createBook: state.createBook,
  updateBook: state.updateBook,
  deleteBook: state.deleteBook,
}));

export const useSessions = () => useAppStore(state => ({
  sessions: state.sessions,
  loading: state.sessionsLoading,
  error: state.sessionsError,
  fetchSessions: state.fetchSessions,
  createSession: state.createSession,
  updateSession: state.updateSession,
}));

export const useUI = () => useAppStore(state => ({
  sidebarCollapsed: state.sidebarCollapsed,
  theme: state.theme,
  notifications: state.notifications,
  toggleSidebar: state.toggleSidebar,
  setTheme: state.setTheme,
  addNotification: state.addNotification,
  removeNotification: state.removeNotification,
}));
