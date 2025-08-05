import { StateCreator } from 'zustand';
import { Session } from '../../types/dashboard';
import { apiService } from '../../services/ApiService';
import { AppStore } from '../index';

export interface SessionsSlice {
  // State
  sessions: Session[];
  sessionsLoading: boolean;
  sessionsError: string | null;

  // Actions
  fetchSessions: () => Promise<void>;
  createSession: (sessionData: Partial<Session>) => Promise<void>;
  updateSession: (id: string, updates: Partial<Session>) => Promise<void>;
}

export const createSessionsSlice: StateCreator<AppStore, [], [], SessionsSlice> = (set) => ({
  // Initial state
  sessions: [],
  sessionsLoading: false,
  sessionsError: null,

  // Actions
  fetchSessions: async () => {
    set({ sessionsLoading: true, sessionsError: null });
    try {
      const sessions = await apiService.get<Session[]>('/sessions');
      set({ sessions: sessions, sessionsLoading: false });
    } catch (error) {
      set({ sessionsError: error instanceof Error ? error.message : 'Failed to fetch sessions', sessionsLoading: false });
    }
  },

  createSession: async (sessionData: Partial<Session>) => {
    try {
      const response = await apiService.post<Session>('/sessions', sessionData);
      set(state => ({ sessions: [...state.sessions, response] }));
    } catch (error) {
      set({ sessionsError: error instanceof Error ? error.message : 'Failed to create session' });
      throw error;
    }
  },

  updateSession: async (id: string, updates: Partial<Session>) => {
    try {
      const response = await apiService.put<Session>(`/sessions/${id}`, updates);
      set(state => ({
        sessions: state.sessions.map(s => s.id === id ? response : s)
      }));
    } catch (error) {
      set({ sessionsError: error instanceof Error ? error.message : 'Failed to update session' });
      throw error;
    }
  },
});
