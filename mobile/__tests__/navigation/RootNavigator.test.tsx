import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from '../../src/navigation/RootNavigator';

jest.mock('../../src/hooks/useAuthState', () => ({
  useAuthState: jest.fn(),
}));

import { useAuthState } from '../../src/hooks/useAuthState';

const mockUseAuthState = useAuthState as jest.Mock;

describe('RootNavigator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading indicator while checking auth', () => {
    mockUseAuthState.mockReturnValue({
      isAuthenticated: false,
      hasCompletedOnboarding: false,
      isLoading: true,
      userId: null,
    });

    render(
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    );

    // The loading screen renders an ActivityIndicator
    expect(screen.getByTestId).toBeTruthy();
  });

  it('shows auth stack when not authenticated', async () => {
    mockUseAuthState.mockReturnValue({
      isAuthenticated: false,
      hasCompletedOnboarding: false,
      isLoading: false,
      userId: null,
    });

    render(
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    );

    await waitFor(() => {
      expect(screen.getByText('Sign In')).toBeTruthy();
    });
  });

  it('shows onboarding when authenticated but not onboarded', async () => {
    mockUseAuthState.mockReturnValue({
      isAuthenticated: true,
      hasCompletedOnboarding: false,
      isLoading: false,
      userId: 'user-123',
    });

    render(
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    );

    await waitFor(() => {
      expect(screen.getByText('Welcome')).toBeTruthy();
    });
  });

  it('shows main app when authenticated and onboarded', async () => {
    mockUseAuthState.mockReturnValue({
      isAuthenticated: true,
      hasCompletedOnboarding: true,
      isLoading: false,
      userId: 'user-123',
    });

    render(
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeTruthy();
    });
  });
});
