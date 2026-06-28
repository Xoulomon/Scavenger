import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './apiClient';
import { useAppStore } from '../store/appStore';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Initialize notifications
export const initNotifications = async () => {
  try {
    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Notification permissions not granted');
      return;
    }

    // Register for push notifications
    const token = await getPushToken();
    if (token) {
      await registerPushToken(token);
    }

    // Handle notification responses
    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    // Handle notifications received while app is open
    const subscription2 = Notifications.addNotificationReceivedListener(
      handleNotificationReceived
    );

    return () => {
      subscription.remove();
      subscription2.remove();
    };
  } catch (error) {
    console.error('Failed to initialize notifications:', error);
  }
};

// Get push token
export const getPushToken = async () => {
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return token.data;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
};

// Register push token with server
export const registerPushToken = async (token) => {
  try {
    await api.registerPushToken(token);
    await AsyncStorage.setItem('push_token', token);
  } catch (error) {
    console.error('Failed to register push token:', error);
  }
};

// Handle notification response
const handleNotificationResponse = (response) => {
  const { data } = response.notification.request.content;
  if (data?.screen) {
    // Navigate to screen
    const { screen, params } = data;
    // Use navigation service to navigate
    navigationService.navigate(screen, params);
  }
};

// Handle notification received
const handleNotificationReceived = (notification) => {
  const { title, body, data } = notification.request.content;
  useAppStore.getState().addNotification({
    id: notification.request.identifier,
    title,
    body,
    data,
    read: false,
    timestamp: new Date().toISOString(),
  });
};

// Send local notification
export const sendLocalNotification = async (title, body, data = {}) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null, // Send immediately
  });
};

// Schedule notification
export const scheduleNotification = async (title, body, date, data = {}) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: {
      date,
    },
  });
};

// Cancel notification
export const cancelNotification = async (id) => {
  await Notifications.cancelScheduledNotificationAsync(id);
};

// Dismiss notification
export const dismissNotification = async (id) => {
  await Notifications.dismissNotificationAsync(id);
};
