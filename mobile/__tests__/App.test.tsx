import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import App from '../App';

// Mock the auth state hook to avoid async issues
jest.mock('../src/hooks/useAuthState', () => ({
  useAuthState: () => ({
    isAuthenticated: false,
    hasCompletedOnboarding: false,
    isLoading: false,
    userId: null,
  }),
}));

describe('App', () => {
  it('renders the navigation container', async () => {
    render(<App />);
    // When not authenticated, we should see the login screen
    await waitFor(() => {
      expect(screen.getByText('Sign In')).toBeTruthy();
    });
  });

  it('shows auth screen when not logged in', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Welcome back to Expense Track')).toBeTruthy();
    });
  });
});
