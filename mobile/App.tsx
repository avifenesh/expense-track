import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from './src/navigation';
import { useAuthStore } from './src/stores';

export default function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <SafeAreaProvider>
      <NavigationContainer />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
