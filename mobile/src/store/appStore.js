import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/apiClient';

export const useAppStore = create((set, get) => ({
  // User state
  user: null,
  isAuthenticated: false,
  isLoading: false,
  
  // Theme
  theme: 'light',
  
  // Notifications
  notifications: [],
  unreadCount: 0,
  
  // Actions
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  
  setTheme: (theme) => {
    set({ theme });
    AsyncStorage.setItem('theme', theme);
  },
  
  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await api.login(email, password);
      const { user, token } = response.data;
      await AsyncStorage.setItem('auth_token', token);
      set({ user, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (error) {
      set({ isLoading: false });
      return { success: false, error: error.message };
    }
  },
  
  logout: async () => {
    await AsyncStorage.removeItem('auth_token');
    set({ user: null, isAuthenticated: false });
  },
  
  loadUser: async () => {
    set({ isLoading: true });
    try {
      const response = await api.getProfile();
      set({ user: response.data, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
    }
  },
  
  loadNotifications: async () => {
    try {
      const response = await api.getNotifications();
      const notifications = response.data;
      const unreadCount = notifications.filter(n => !n.read).length;
      set({ notifications, unreadCount });
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  },
  
  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },
  
  markNotificationRead: async (id) => {
    try {
      await api.markNotificationRead(id);
      set((state) => ({
        notifications: state.notifications.map(n =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: state.unreadCount - 1,
      }));
    } catch (error) {
      console.error('Failed to mark notification read:', error);
    }
  },
}));
