import { StateCreator } from 'zustand';
import { User, NotificationItem } from '../../types';
import { apiService } from '../../services/ApiService';
import { AppStore } from '../index';

export interface AuthSlice {
  // State
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  notifications: NotificationItem[];

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const createAuthSlice: StateCreator<AppStore, [], [], AuthSlice> = (set) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  notifications: [],

  // Actions
  login: async (email: string, password: string) => {
    set(state => ({ ...state, loading: true, error: null }));

    try {
      const response = await apiService.post<{ user: User }>('/auth/login', { email, password });
      set(state => ({ 
        ...state, 
        user: response.user,
        isAuthenticated: true,
        loading: false 
      }));
    } catch (error) {
      set(state => ({ 
        ...state, 
        error: error instanceof Error ? error.message : 'Login failed',
        loading: false 
      }));
      throw error;
    }
  },

  logout: async () => {
    try {
      await apiService.post('/auth/logout');
      set(state => ({
        ...state,
        user: null,
        isAuthenticated: false,
        notifications: [],
        error: null
      }));
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  updateProfile: async (updates: Partial<User>) => {
    set(state => ({ ...state, loading: true }));

    try {
      const response = await apiService.put<User>('/auth/profile', updates);
      set(state => ({
        ...state,
        user: response,
        loading: false
      }));
    } catch (error) {
      set(state => ({
        ...state,
        error: error instanceof Error ? error.message : 'Update failed',
        loading: false
      }));
      throw error;
    }
  },

  fetchNotifications: async () => {
    try {
      const response = await apiService.get<NotificationItem[]>('/auth/notifications');
      set(state => ({
        ...state,
        notifications: response
      }));
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  },

  markNotificationRead: async (id: string) => {
    try {
      await apiService.patch(`/auth/notifications/${id}/read`);
      set(state => ({
        ...state,
        notifications: state.notifications.map(n => 
          n.id === id ? { ...n, read: true } : n
        )
      }));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  },

  checkAuth: async () => {
    set(state => ({ ...state, loading: true }));

    try {
      const response = await apiService.get<{ authenticated: boolean; user: User | null }>('/auth/check');
      set(state => ({
        ...state,
        isAuthenticated: response.authenticated,
        user: response.user || null,
        loading: false
      }));
    } catch (error) {
      set(state => ({
        ...state,
        isAuthenticated: false,
        user: null,
        loading: false
      }));
    }
  },
});
