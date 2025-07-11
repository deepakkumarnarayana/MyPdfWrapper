import { StateCreator } from 'zustand';
import { NotificationItem } from '../../types';
import { AppStore } from '../index';

export interface UISlice {
  // State
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  notifications: NotificationItem[];

  // Actions
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  addNotification: (notification: Omit<NotificationItem, 'id' | 'createdAt'>) => void;
  removeNotification: (id: string) => void;
}

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
  // Initial state
  sidebarCollapsed: false,
  theme: 'light',
  notifications: [],

  // Actions
  toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTheme: (theme) => set({ theme }),
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
