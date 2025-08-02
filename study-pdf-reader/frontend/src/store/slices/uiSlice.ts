import { StateCreator } from 'zustand';
import { NotificationItem } from '../../types';
import { AppStore } from '../index';

export interface UISlice {
  // State
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  pdfNightMode: boolean;
  notifications: NotificationItem[];

  // Actions
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setPdfNightMode: (enabled: boolean) => void;
  togglePdfNightMode: () => void;
  addNotification: (notification: Omit<NotificationItem, 'id' | 'createdAt'>) => void;
  removeNotification: (id: string) => void;
}

// Helper function to detect system theme preference
const getSystemThemePreference = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
};

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set, get) => ({
  // Initial state with system preference detection
  sidebarCollapsed: false,
  theme: 'light',
  pdfNightMode: (() => {
    // Check localStorage first, then fall back to system preference
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem('pdfNightMode');
      if (saved !== null) {
        return JSON.parse(saved);
      }
      // If no saved preference, use system preference
      return getSystemThemePreference();
    } catch {
      return getSystemThemePreference();
    }
  })(),
  notifications: [],

  // Actions
  toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTheme: (theme) => set({ theme }),
  setPdfNightMode: (enabled) => {
    set({ pdfNightMode: enabled });
    // Persist to localStorage
    localStorage.setItem('pdfNightMode', JSON.stringify(enabled));
  },
  togglePdfNightMode: () => {
    const currentMode = get().pdfNightMode;
    const newMode = !currentMode;
    set({ pdfNightMode: newMode });
    // Persist to localStorage
    localStorage.setItem('pdfNightMode', JSON.stringify(newMode));
  },
  addNotification: (notification) => {
    const newNotification: NotificationItem = {
      id: `notification-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...notification,
      userId: '',
      read: false
    };
    set(state => ({ notifications: [...state.notifications, newNotification] }));
  },
  removeNotification: (id: string) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }));
  },
});
