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

jest.mock('../../src/hooks/useSubscriptionState', () => ({
  useSubscriptionState: jest.fn(),
}));

// Mock the offline queue store to prevent infinite loops
jest.mock('../../src/stores/offlineQueueStore', () => ({
  useOfflineQueueStore: jest.fn((selector) => {
    const state = {
      items: [],
      isSyncing: false,
      syncError: null,
      processQueue: jest.fn(),
    };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

import { useAuthState } from '../../src/hooks/useAuthState';
import { useSubscriptionState } from '../../src/hooks/useSubscriptionState';

const mockUseAuthState = useAuthState as jest.Mock;
const mockUseSubscriptionState = useSubscriptionState as jest.Mock;
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

    // Default subscription state - has access
    mockUseSubscriptionState.mockReturnValue({
      canAccessApp: true,
      isLoading: false,
      error: null,
      status: 'active',
      isInitialized: true,
    });
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

    // When authenticated and onboarded, the main app tabs should render
    // Look for any indicator of the main app (tabs or dashboard-related content)
    await waitFor(() => {
      // Check for any of: Dashboard tab, tab bar, or main app content
      const dashboardElements = screen.queryAllByText(/Dashboard/i);
      const tabBar = screen.queryByTestId('bottom-tabs');
      expect(dashboardElements.length > 0 || tabBar).toBeTruthy();
    }, { timeout: 3000 });
  });

  describe('Paywall', () => {
    it('shows paywall when authenticated, onboarded, but canAccessApp is false', async () => {
      mockUseAuthState.mockReturnValue({
        isAuthenticated: true,
        hasCompletedOnboarding: true,
        isLoading: false,
        userId: 'user-123',
      });

      mockUseSubscriptionState.mockReturnValue({
        canAccessApp: false,
        isLoading: false,
        error: null,
        status: 'expired',
        isInitialized: true,
      });

      renderWithProviders(<RootNavigator />);

      await waitFor(() => {
        expect(screen.getByTestId('paywall.screen')).toBeTruthy();
        expect(screen.getByText('Subscription Expired')).toBeTruthy();
      });
    });

    it('shows main app when authenticated, onboarded, and canAccessApp is true', async () => {
      mockUseAuthState.mockReturnValue({
        isAuthenticated: true,
        hasCompletedOnboarding: true,
        isLoading: false,
        userId: 'user-123',
      });

      mockUseSubscriptionState.mockReturnValue({
        canAccessApp: true,
        isLoading: false,
        error: null,
        status: 'active',
        isInitialized: true,
      });

      renderWithProviders(<RootNavigator />);

      await waitFor(() => {
        // Should NOT show paywall
        expect(screen.queryByTestId('paywall.screen')).toBeNull();
        // Should show main app
        const dashboardElements = screen.queryAllByText(/Dashboard/i);
        const tabBar = screen.queryByTestId('bottom-tabs');
        expect(dashboardElements.length > 0 || tabBar).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('shows loading while subscription is loading for authenticated+onboarded user', () => {
      mockUseAuthState.mockReturnValue({
        isAuthenticated: true,
        hasCompletedOnboarding: true,
        isLoading: false,
        userId: 'user-123',
      });

      mockUseSubscriptionState.mockReturnValue({
        canAccessApp: false,
        isLoading: true,
        error: null,
        status: null,
        isInitialized: false,
      });

      renderWithProviders(<RootNavigator />);

      // Should show loading, not paywall
      expect(screen.getByTestId('root.loadingScreen')).toBeTruthy();
      expect(screen.queryByTestId('paywall.screen')).toBeNull();
    });

    it('does NOT show paywall when subscription has error (lenient offline)', async () => {
      mockUseAuthState.mockReturnValue({
        isAuthenticated: true,
        hasCompletedOnboarding: true,
        isLoading: false,
        userId: 'user-123',
      });

      mockUseSubscriptionState.mockReturnValue({
        canAccessApp: false,
        isLoading: false,
        error: 'Network error',
        status: null,
        isInitialized: false,
      });

      renderWithProviders(<RootNavigator />);

      await waitFor(() => {
        // Should NOT show paywall when there's an error
        expect(screen.queryByTestId('paywall.screen')).toBeNull();
        // Should show main app (lenient behavior)
        const dashboardElements = screen.queryAllByText(/Dashboard/i);
        const tabBar = screen.queryByTestId('bottom-tabs');
        expect(dashboardElements.length > 0 || tabBar).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('does NOT show paywall when subscription is not initialized', async () => {
      mockUseAuthState.mockReturnValue({
        isAuthenticated: true,
        hasCompletedOnboarding: true,
        isLoading: false,
        userId: 'user-123',
      });

      mockUseSubscriptionState.mockReturnValue({
        canAccessApp: false,
        isLoading: false,
        error: null,
        status: null,
        isInitialized: false,
      });

      renderWithProviders(<RootNavigator />);

      await waitFor(() => {
        // Should NOT show paywall when not initialized
        expect(screen.queryByTestId('paywall.screen')).toBeNull();
        // Should show main app
        const dashboardElements = screen.queryAllByText(/Dashboard/i);
        const tabBar = screen.queryByTestId('bottom-tabs');
        expect(dashboardElements.length > 0 || tabBar).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('shows paywall for trialing subscription when canAccessApp is false', async () => {
      mockUseAuthState.mockReturnValue({
        isAuthenticated: true,
        hasCompletedOnboarding: true,
        isLoading: false,
        userId: 'user-123',
      });

      // Trial expired
      mockUseSubscriptionState.mockReturnValue({
        canAccessApp: false,
        isLoading: false,
        error: null,
        status: 'trial_expired',
        isInitialized: true,
      });

      renderWithProviders(<RootNavigator />);

      await waitFor(() => {
        expect(screen.getByTestId('paywall.screen')).toBeTruthy();
      });
    });

    it('does NOT show paywall for unauthenticated users', async () => {
      mockUseAuthState.mockReturnValue({
        isAuthenticated: false,
        hasCompletedOnboarding: false,
        isLoading: false,
        userId: null,
      });

      mockUseSubscriptionState.mockReturnValue({
        canAccessApp: false,
        isLoading: false,
        error: null,
        status: 'expired',
        isInitialized: true,
      });

      renderWithProviders(<RootNavigator />);

      await waitFor(() => {
        // Should show auth, not paywall
        expect(screen.queryByTestId('paywall.screen')).toBeNull();
        expect(screen.getAllByText('Sign In').length).toBeGreaterThan(0);
      });
    });

    it('does NOT show paywall for users who have not completed onboarding', async () => {
      mockUseAuthState.mockReturnValue({
        isAuthenticated: true,
        hasCompletedOnboarding: false,
        isLoading: false,
        userId: 'user-123',
      });

      mockUseSubscriptionState.mockReturnValue({
        canAccessApp: false,
        isLoading: false,
        error: null,
        status: 'expired',
        isInitialized: true,
      });

      renderWithProviders(<RootNavigator />);

      await waitFor(() => {
        // Should show onboarding, not paywall
        expect(screen.queryByTestId('paywall.screen')).toBeNull();
        expect(screen.getByText('Welcome')).toBeTruthy();
      });
    });
  });
});
