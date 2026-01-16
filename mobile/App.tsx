import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from './src/navigation';

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
