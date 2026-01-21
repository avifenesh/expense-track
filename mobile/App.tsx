import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from './src/navigation';
import { useAuthStore, useOfflineQueueStore } from './src/stores';
import { networkStatus } from './src/services/networkStatus';

export default function App() {
  useEffect(() => {
    // Initialize auth store on app startup
    useAuthStore.getState().initialize();

    // Initialize network monitoring
    networkStatus.initialize();

    // Load offline queue from storage
    useOfflineQueueStore.getState().loadFromStorage();

    // Subscribe to network changes and process queue when online
    const unsubscribe = networkStatus.subscribe((status) => {
      if (status.isConnected && (status.isInternetReachable === null || status.isInternetReachable)) {
        // Process queue when network becomes available
        useOfflineQueueStore.getState().processQueue();
      }
    });

    return () => {
      unsubscribe();
      networkStatus.cleanup();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
