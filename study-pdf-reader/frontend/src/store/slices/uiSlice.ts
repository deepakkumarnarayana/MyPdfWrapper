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
  hydratePdfNightMode: () => void;
  addNotification: (notification: Omit<NotificationItem, 'id' | 'createdAt'>) => void;
  removeNotification: (id: string) => void;
}

// Helper function to detect system theme preference
const getSystemThemePreference = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
};

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set, get) => ({
  // Initial state - start with system preference, localStorage will sync after mount
  sidebarCollapsed: false,
  theme: 'light',
  pdfNightMode: false, // Will be properly initialized in hydratePdfNightMode
  notifications: [],

  // Actions
  toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTheme: (theme) => set({ theme }),
  setPdfNightMode: (enabled) => {
    set({ pdfNightMode: enabled });
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('pdfNightMode', JSON.stringify(enabled));
    }
  },
  togglePdfNightMode: () => {
    const currentMode = get().pdfNightMode;
    const newMode = !currentMode;
    console.log(`[UI_STORE] togglePdfNightMode - Current: ${currentMode}, New: ${newMode}`);
    set({ pdfNightMode: newMode });
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('pdfNightMode', JSON.stringify(newMode));
    }
    console.log(`[UI_STORE] localStorage updated with: ${newMode}`);
  },
  // Hydrate pdfNightMode from localStorage after mount
  hydratePdfNightMode: () => {
    if (typeof window === 'undefined') return;
    
    try {
      const saved = localStorage.getItem('pdfNightMode');
      if (saved !== null) {
        const savedValue = JSON.parse(saved);
        console.log(`[UI_STORE] Hydrating pdfNightMode from localStorage: ${savedValue}`);
        set({ pdfNightMode: savedValue });
      } else {
        // If no saved preference, use system preference
        const systemPreference = getSystemThemePreference();
        console.log(`[UI_STORE] No localStorage preference, using system: ${systemPreference}`);
        set({ pdfNightMode: systemPreference });
        localStorage.setItem('pdfNightMode', JSON.stringify(systemPreference));
      }
    } catch (error) {
      console.error('[UI_STORE] Error hydrating pdfNightMode:', error);
      const systemPreference = getSystemThemePreference();
      set({ pdfNightMode: systemPreference });
      localStorage.setItem('pdfNightMode', JSON.stringify(systemPreference));
    }
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
