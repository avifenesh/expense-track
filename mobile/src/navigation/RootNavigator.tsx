import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { AuthStack } from './AuthStack';
import { OnboardingStack } from './OnboardingStack';
import { AppStack } from './AppStack';
import { PaywallScreen } from '../screens/PaywallScreen';
import { useAuthState } from '../hooks/useAuthState';
import { useSubscriptionState } from '../hooks/useSubscriptionState';

const Stack = createNativeStackNavigator<RootStackParamList>();

function LoadingScreen() {
  return (
    <View style={styles.loading} testID="root.loadingScreen">
      <ActivityIndicator size="large" color="#38bdf8" testID="root.loadingIndicator" />
    </View>
  );
}

export function RootNavigator() {
  const { isAuthenticated, hasCompletedOnboarding, isLoading: authLoading } = useAuthState();
  const {
    canAccessApp,
    isLoading: subscriptionLoading,
    isInitialized: subscriptionInitialized,
    error: subscriptionError,
  } = useSubscriptionState();

  // Show loading while auth is initializing
  if (authLoading) {
    return <LoadingScreen />;
  }

  // For authenticated + onboarded users, also wait for subscription to initialize
  // But only if we don't have cached data yet and there's no error
  // Network errors should NOT block access (lenient offline behavior)
  const shouldWaitForSubscription =
    isAuthenticated &&
    hasCompletedOnboarding &&
    !subscriptionInitialized &&
    subscriptionLoading &&
    !subscriptionError;

  if (shouldWaitForSubscription) {
    return <LoadingScreen />;
  }

  // Determine if paywall should be shown:
  // - User is authenticated and onboarded
  // - Subscription has been initialized (we have data)
  // - canAccessApp is explicitly false
  // - No subscription error (network errors should NOT lock out users)
  const shouldShowPaywall =
    isAuthenticated &&
    hasCompletedOnboarding &&
    subscriptionInitialized &&
    !canAccessApp &&
    !subscriptionError;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : !hasCompletedOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingStack} />
      ) : shouldShowPaywall ? (
        <Stack.Screen name="Paywall" component={PaywallScreen} />
      ) : (
        <Stack.Screen name="App" component={AppStack} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
