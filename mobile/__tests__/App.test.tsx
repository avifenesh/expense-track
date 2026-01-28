import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react-native';
import App from '../App';
import { tokenStorage } from '../src/lib/tokenStorage';
import { networkStatus } from '../src/services/networkStatus';

jest.mock('../src/lib/tokenStorage');
jest.mock('../src/services/auth');
jest.mock('../src/services/networkStatus');

// Mock offline queue store with getState
const mockLoadFromStorage = jest.fn().mockResolvedValue(undefined);
const mockProcessQueue = jest.fn();

jest.mock('../src/stores/offlineQueueStore', () => ({
  useOfflineQueueStore: Object.assign(
    jest.fn((selector) => {
      const state = {
        items: [],
        isSyncing: false,
        syncError: null,
        loadFromStorage: mockLoadFromStorage,
        processQueue: mockProcessQueue,
      };
      return typeof selector === 'function' ? selector(state) : state;
    }),
    {
      getState: jest.fn(() => ({
        items: [],
        isSyncing: false,
        syncError: null,
        loadFromStorage: mockLoadFromStorage,
        processQueue: mockProcessQueue,
      })),
    }
  ),
}));

// Mock auth store
const mockInitialize = jest.fn();
jest.mock('../src/stores/authStore', () => ({
  useAuthStore: Object.assign(
    jest.fn((selector) => {
      const state = {
        accessToken: null,
        user: null,
        isLoading: false,
        isAuthenticated: false,
        initialize: mockInitialize,
      };
      return typeof selector === 'function' ? selector(state) : state;
    }),
    {
      getState: jest.fn(() => ({
        accessToken: null,
        user: null,
        isLoading: false,
        isAuthenticated: false,
        initialize: mockInitialize,
      })),
      subscribe: jest.fn(() => jest.fn()), // Returns unsubscribe function
    }
  ),
}));

// Mock subscription store
const mockLoadFromCache = jest.fn();
const mockRefresh = jest.fn();
jest.mock('../src/stores/subscriptionStore', () => ({
  useSubscriptionStore: Object.assign(
    jest.fn((selector) => {
      const state = {
        canAccessApp: true,
        isLoading: false,
        error: null,
        status: 'ACTIVE' as const,
        lastFetched: Date.now(),
        loadFromCache: mockLoadFromCache,
        refresh: mockRefresh,
      };
      return typeof selector === 'function' ? selector(state) : state;
    }),
    {
      getState: jest.fn(() => ({
        canAccessApp: true,
        isLoading: false,
        error: null,
        status: 'ACTIVE' as const,
        lastFetched: Date.now(),
        loadFromCache: mockLoadFromCache,
        refresh: mockRefresh,
      })),
    }
  ),
}));

const mockTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;
const mockNetworkStatus = networkStatus as jest.Mocked<typeof networkStatus>;

// Mock the auth state hook to avoid async issues
jest.mock('../src/hooks/useAuthState', () => ({
  useAuthState: () => ({
    isAuthenticated: false,
    hasCompletedOnboarding: false,
    isLoading: false,
    userId: null,
  }),
}));

// Mock the subscription state hook
jest.mock('../src/hooks/useSubscriptionState', () => ({
  useSubscriptionState: () => ({
    canAccessApp: true,
    isLoading: false,
    error: null,
    status: 'ACTIVE' as const,
    isInitialized: true,
  }),
}));

describe('App', () => {
  const mockUnsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

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
    mockNetworkStatus.getStatus = jest.fn().mockReturnValue({
      isConnected: true,
      isInternetReachable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
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
    it('initializes network monitoring on mount', async () => {
      render(<App />);

      // Need to wait for async initialization
      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(mockNetworkStatus.initialize).toHaveBeenCalled();
    });

    it('loads offline queue from storage on mount', async () => {
      render(<App />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(mockLoadFromStorage).toHaveBeenCalled();
    });

    it('subscribes to network status changes', async () => {
      render(<App />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(mockNetworkStatus.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it('processes queue when network becomes available', async () => {
      render(<App />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // The subscription callback should trigger queue processing
      expect(mockNetworkStatus.subscribe).toHaveBeenCalled();

      // Simulate network becoming available through the callback
      const subscribeCallback = mockNetworkStatus.subscribe.mock.calls[0][0];
      mockProcessQueue.mockClear();

      await act(async () => {
        subscribeCallback({ isConnected: true, isInternetReachable: true });
        jest.advanceTimersByTime(600); // debounce timeout is 500ms
      });

      expect(mockProcessQueue).toHaveBeenCalled();
    });

    it('processes queue when connected with null reachability', async () => {
      render(<App />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      const subscribeCallback = mockNetworkStatus.subscribe.mock.calls[0][0];
      mockProcessQueue.mockClear();

      await act(async () => {
        subscribeCallback({ isConnected: true, isInternetReachable: null });
        jest.advanceTimersByTime(600);
      });

      expect(mockProcessQueue).toHaveBeenCalled();
    });

    it('does not process queue when offline', async () => {
      render(<App />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      const subscribeCallback = mockNetworkStatus.subscribe.mock.calls[0][0];
      mockProcessQueue.mockClear();

      await act(async () => {
        subscribeCallback({ isConnected: false, isInternetReachable: false });
        jest.advanceTimersByTime(600);
      });

      expect(mockProcessQueue).not.toHaveBeenCalled();
    });

    it('does not process queue when connected but not reachable', async () => {
      render(<App />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      const subscribeCallback = mockNetworkStatus.subscribe.mock.calls[0][0];
      mockProcessQueue.mockClear();

      await act(async () => {
        subscribeCallback({ isConnected: true, isInternetReachable: false });
        jest.advanceTimersByTime(600);
      });

      expect(mockProcessQueue).not.toHaveBeenCalled();
    });

    it('cleans up on unmount', async () => {
      const { unmount } = render(<App />);

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(mockNetworkStatus.cleanup).toHaveBeenCalled();
    });
  });
});
