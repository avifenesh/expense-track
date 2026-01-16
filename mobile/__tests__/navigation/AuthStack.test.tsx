import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthStack } from '../../src/navigation/AuthStack';
import { AuthProvider } from '../../src/contexts';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <AuthProvider>
      <NavigationContainer>{component}</NavigationContainer>
    </AuthProvider>
  );
};

describe('AuthStack', () => {
  it('renders login screen by default', () => {
    renderWithProviders(<AuthStack />);

    // "Sign In" appears as both title and button text
    expect(screen.getAllByText('Sign In').length).toBeGreaterThan(0);
    expect(screen.getByText('Welcome back to Balance Beacon')).toBeTruthy();
  });

  it('shows login form with email and password inputs', () => {
    renderWithProviders(<AuthStack />);

    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Password')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter your password')).toBeTruthy();
  });

  it('has navigation links', () => {
    renderWithProviders(<AuthStack />);

    expect(screen.getByText(/Don't have an account/)).toBeTruthy();
    expect(screen.getByText(/Forgot password/)).toBeTruthy();
  });
});
