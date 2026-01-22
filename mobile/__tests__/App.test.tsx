import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import App from '../App';
import { tokenStorage } from '../src/lib/tokenStorage';
import { networkStatus } from '../src/services/networkStatus';
import { useOfflineQueueStore } from '../src/stores/offlineQueueStore';

jest.mock('../src/lib/tokenStorage');
jest.mock('../src/services/auth');
jest.mock('../src/services/networkStatus');
jest.mock('../src/stores/offlineQueueStore');

const mockTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;
const mockNetworkStatus = networkStatus as jest.Mocked<typeof networkStatus>;
const mockOfflineQueueStore = useOfflineQueueStore as unknown as { getState: jest.Mock };

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
  const mockLoadFromStorage = jest.fn();
  const mockProcessQueue = jest.fn();
  const mockUnsubscribe = jest.fn();

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

    // Network status mocks
    mockNetworkStatus.initialize = jest.fn();
    mockNetworkStatus.subscribe = jest.fn().mockReturnValue(mockUnsubscribe);
    mockNetworkStatus.cleanup = jest.fn();
    mockOfflineQueueStore.getState = jest.fn().mockReturnValue({
      loadFromStorage: mockLoadFromStorage,
      processQueue: mockProcessQueue,
    });
  });

  it('renders the navigation container', async () => {
    render(<App />);
    // When not authenticated, we should see the login screen
    await waitFor(() => {
      // Check for multiple elements indicating login screen
      expect(screen.getAllByText('Sign In').length).toBeGreaterThan(0);
    });
  });

  it('shows auth screen when not logged in', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Welcome back to Balance Beacon')).toBeTruthy();
    });
  });

  it('shows login form elements', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter your password')).toBeTruthy();
    });
  });

  describe('network monitoring initialization', () => {
    it('initializes network monitoring on mount', () => {
      render(<App />);

      expect(mockNetworkStatus.initialize).toHaveBeenCalled();
    });

    it('loads offline queue from storage on mount', () => {
      render(<App />);

      expect(mockLoadFromStorage).toHaveBeenCalled();
    });

    it('subscribes to network status changes', () => {
      render(<App />);

      expect(mockNetworkStatus.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it('processes queue when network becomes available', () => {
      render(<App />);

      const subscribeCallback = mockNetworkStatus.subscribe.mock.calls[0][0];
      subscribeCallback({ isConnected: true, isInternetReachable: true });

      expect(mockProcessQueue).toHaveBeenCalled();
    });

    it('processes queue when connected with null reachability', () => {
      render(<App />);

      const subscribeCallback = mockNetworkStatus.subscribe.mock.calls[0][0];
      subscribeCallback({ isConnected: true, isInternetReachable: null });

      expect(mockProcessQueue).toHaveBeenCalled();
    });

    it('does not process queue when offline', () => {
      render(<App />);

      const subscribeCallback = mockNetworkStatus.subscribe.mock.calls[0][0];
      subscribeCallback({ isConnected: false, isInternetReachable: false });

      expect(mockProcessQueue).not.toHaveBeenCalled();
    });

    it('does not process queue when connected but not reachable', () => {
      render(<App />);

      const subscribeCallback = mockNetworkStatus.subscribe.mock.calls[0][0];
      subscribeCallback({ isConnected: true, isInternetReachable: false });

      expect(mockProcessQueue).not.toHaveBeenCalled();
    });

    it('cleans up on unmount', () => {
      const { unmount } = render(<App />);

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(mockNetworkStatus.cleanup).toHaveBeenCalled();
    });
  });
});
