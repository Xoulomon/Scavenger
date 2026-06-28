import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from 'react-query';
import { StatusBar } from 'expo-status-bar';
import { registerRootComponent } from 'expo';

// Import navigation
import AppNavigator from './src/navigation/AppNavigator';

// Import stores
import { useAppStore } from './src/store/appStore';

// Import services
import { initNotifications } from './src/services/notificationService';
import { initOfflineSync } from './src/services/offlineService';

const queryClient = new QueryClient();

export default function App() {
  const { theme } = useAppStore();

  React.useEffect(() => {
    // Initialize services
    initNotifications();
    initOfflineSync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

registerRootComponent(App);
