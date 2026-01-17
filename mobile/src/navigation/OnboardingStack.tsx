import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from './types';
import {
  OnboardingWelcomeScreen,
  OnboardingCurrencyScreen,
  OnboardingCategoriesScreen,
  OnboardingBudgetScreen,
  OnboardingSampleDataScreen,
  OnboardingCompleteScreen,
  OnboardingBiometricScreen,
} from '../screens';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0f172a' },
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}
    >
      <Stack.Screen
        name="OnboardingWelcome"
        component={OnboardingWelcomeScreen}
      />
      <Stack.Screen
        name="OnboardingCurrency"
        component={OnboardingCurrencyScreen}
      />
      <Stack.Screen
        name="OnboardingCategories"
        component={OnboardingCategoriesScreen}
      />
      <Stack.Screen
        name="OnboardingBudget"
        component={OnboardingBudgetScreen}
      />
      <Stack.Screen
        name="OnboardingSampleData"
        component={OnboardingSampleDataScreen}
      />
      <Stack.Screen
        name="OnboardingComplete"
        component={OnboardingCompleteScreen}
      />
      <Stack.Screen
        name="OnboardingBiometric"
        component={OnboardingBiometricScreen}
      />
    </Stack.Navigator>
  );
}
