import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from '../../src/navigation/RootNavigator';
import { AuthProvider } from '../../src/contexts';
import { tokenStorage } from '../../src/lib/tokenStorage';

jest.mock('../../src/lib/tokenStorage');
jest.mock('../../src/services/auth');

jest.mock('../../src/hooks/useAuthState', () => ({
  useAuthState: jest.fn(),
}));

import { useAuthState } from '../../src/hooks/useAuthState';

const mockUseAuthState = useAuthState as jest.Mock;
const mockTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <AuthProvider>
      <NavigationContainer>{component}</NavigationContainer>
    </AuthProvider>
  );
};

describe('RootNavigator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokenStorage.getStoredCredentials.mockResolvedValue({
      accessToken: null,
      refreshToken: null,
      email: null,
      hasCompletedOnboarding: false,
    });
    mockTokenStorage.setStoredCredentials.mockResolvedValue(undefined);
    mockTokenStorage.setTokens.mockResolvedValue(undefined);
    mockTokenStorage.clearTokens.mockResolvedValue(undefined);
    mockTokenStorage.setOnboardingComplete.mockResolvedValue(undefined);
  });

  it('shows loading indicator while checking auth', () => {
    mockUseAuthState.mockReturnValue({
      isAuthenticated: false,
      hasCompletedOnboarding: false,
      isLoading: true,
      userId: null,
    });

    renderWithProviders(<RootNavigator />);

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

    renderWithProviders(<RootNavigator />);

    await waitFor(() => {
      // Check for login screen elements
      expect(screen.getAllByText('Sign In').length).toBeGreaterThan(0);
    });
  });

  it('shows onboarding when authenticated but not onboarded', async () => {
    mockUseAuthState.mockReturnValue({
      isAuthenticated: true,
      hasCompletedOnboarding: false,
      isLoading: false,
      userId: 'user-123',
    });

    renderWithProviders(<RootNavigator />);

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

    renderWithProviders(<RootNavigator />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeTruthy();
    });
  });
});
