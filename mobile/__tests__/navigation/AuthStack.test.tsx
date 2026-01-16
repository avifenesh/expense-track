import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthStack } from '../../src/navigation/AuthStack';

describe('AuthStack', () => {
  it('renders login screen by default', () => {
    render(
      <NavigationContainer>
        <AuthStack />
      </NavigationContainer>
    );

    expect(screen.getByText('Sign In')).toBeTruthy();
    expect(screen.getByText('Welcome back to Expense Track')).toBeTruthy();
  });

  it('shows login form placeholder', () => {
    render(
      <NavigationContainer>
        <AuthStack />
      </NavigationContainer>
    );

    expect(screen.getByText('Login form will be implemented in task #70')).toBeTruthy();
  });

  it('has navigation links', () => {
    render(
      <NavigationContainer>
        <AuthStack />
      </NavigationContainer>
    );

    expect(screen.getByText(/Don't have an account/)).toBeTruthy();
    expect(screen.getByText(/Forgot password/)).toBeTruthy();
  });
});
