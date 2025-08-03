import { StateCreator } from 'zustand';
import { User, NotificationItem } from '../../types';
import { authApi } from '../../services/api/auth.api';
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
      const response = await authApi.login(email, password);
      set(state => ({ 
        ...state, 
        user: response.data.user,
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
      await authApi.logout();
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
      const response = await authApi.updateProfile(updates);
      set(state => ({
        ...state,
        user: response.data,
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
      const response = await authApi.getNotifications();
      set(state => ({
        ...state,
        notifications: response.data
      }));
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  },

  markNotificationRead: async (id: string) => {
    try {
      await authApi.markNotificationRead(id);
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
      const response = await authApi.checkAuth();
      set(state => ({
        ...state,
        isAuthenticated: response.data.authenticated,
        user: response.data.user || null,
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
