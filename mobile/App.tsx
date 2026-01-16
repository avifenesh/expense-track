import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from './src/navigation';
import { AuthProvider } from './src/contexts';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer />
        <StatusBar style="light" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
