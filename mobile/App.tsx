import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from './src/navigation';
import { useAuthStore } from './src/stores';

export default function App() {
  useEffect(() => {
    // Initialize auth store on app startup
    useAuthStore.getState().initialize();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
