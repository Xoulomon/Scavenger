import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './apiClient';
import NetInfo from '@react-native-community/netinfo';

const OFFLINE_QUEUE_KEY = 'offline_queue';
const SYNC_INTERVAL = 5000; // 5 seconds

let syncInterval = null;

// Initialize offline sync
export const initOfflineSync = () => {
  // Start sync when online
  NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      processOfflineQueue();
    }
  });
  
  // Periodic sync
  syncInterval = setInterval(() => {
    processOfflineQueue();
  }, SYNC_INTERVAL);
};

// Queue an offline request
export const queueOfflineRequest = async (request) => {
  try {
    const queue = await getOfflineQueue();
    queue.push({
      ...request,
      timestamp: Date.now(),
      id: Date.now().toString(),
    });
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    
    // Try to process immediately if online
    if (await isOnline()) {
      processOfflineQueue();
    }
  } catch (error) {
    console.error('Failed to queue offline request:', error);
  }
};

// Process offline queue
export const processOfflineQueue = async () => {
  try {
    if (!(await isOnline())) return;
    
    const queue = await getOfflineQueue();
    if (queue.length === 0) return;
    
    const successful = [];
    const failed = [];
    
    for (const request of queue) {
      try {
        await executeRequest(request);
        successful.push(request.id);
      } catch (error) {
        console.error('Failed to process offline request:', error);
        failed.push(request);
      }
    }
    
    // Update queue
    const remaining = queue.filter(r => !successful.includes(r.id));
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    
    // Retry failed requests later
    if (failed.length > 0) {
      setTimeout(processOfflineQueue, 30000); // Try again in 30 seconds
    }
  } catch (error) {
    console.error('Failed to process offline queue:', error);
  }
};

// Execute a queued request
const executeRequest = async (request) => {
  const { method, url, data } = request;
  switch (method.toLowerCase()) {
    case 'get':
      await api.get(url);
      break;
    case 'post':
      await api.post(url, data);
      break;
    case 'put':
      await api.put(url, data);
      break;
    case 'delete':
      await api.delete(url);
      break;
    default:
      throw new Error(`Unknown method: ${method}`);
  }
};

// Get offline queue
const getOfflineQueue = async () => {
  const queue = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  return queue ? JSON.parse(queue) : [];
};

// Check if online
const isOnline = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected;
};

// Clear offline queue
export const clearOfflineQueue = async () => {
  await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
};

// Get queue size
export const getQueueSize = async () => {
  const queue = await getOfflineQueue();
  return queue.length;
};
