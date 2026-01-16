import React from 'react';
import {
  NavigationContainer as RNNavigationContainer,
  DefaultTheme,
  Theme,
} from '@react-navigation/native';
import { RootNavigator } from './RootNavigator';

const navigationTheme: Theme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    primary: '#38bdf8',
    background: '#0f172a',
    card: '#1e293b',
    text: '#f8fafc',
    border: 'rgba(255,255,255,0.1)',
    notification: '#f43f5e',
  },
};

export function NavigationContainer() {
  return (
    <RNNavigationContainer theme={navigationTheme}>
      <RootNavigator />
    </RNNavigationContainer>
  );
}
