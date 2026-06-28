import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// API base URL - change based on environment
const API_URL = process.env.API_URL || 'https://api.scavenger.io/v1';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, clear storage and redirect to login
      await AsyncStorage.removeItem('auth_token');
      // Navigation will handle redirect
    }
    return Promise.reject(error);
  }
);

// API methods
export const api = {
  // Auth
  login: (email, password) => 
    apiClient.post('/auth/login', { email, password }),
  
  register: (data) => 
    apiClient.post('/auth/register', data),
  
  logout: () => 
    apiClient.post('/auth/logout'),

  // Waste
  getWastes: (params) => 
    apiClient.get('/wastes', { params }),
  
  submitWaste: (data) => 
    apiClient.post('/wastes', data),
  
  getWasteById: (id) => 
    apiClient.get(`/wastes/${id}`),
  
  updateWaste: (id, data) => 
    apiClient.put(`/wastes/${id}`, data),
  
  deleteWaste: (id) => 
    apiClient.delete(`/wastes/${id}`),

  // User
  getProfile: () => 
    apiClient.get('/user/profile'),
  
  updateProfile: (data) => 
    apiClient.put('/user/profile', data),
  
  getStats: () => 
    apiClient.get('/user/stats'),

  // Notifications
  getNotifications: () => 
    apiClient.get('/notifications'),
  
  markNotificationRead: (id) => 
    apiClient.put(`/notifications/${id}/read`),
  
  registerPushToken: (token) => 
    apiClient.post('/notifications/register', { token }),
};

export default apiClient;
