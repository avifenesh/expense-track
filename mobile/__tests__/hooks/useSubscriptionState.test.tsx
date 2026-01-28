import { renderHook } from '@testing-library/react-native';
import { useSubscriptionState } from '../../src/hooks/useSubscriptionState';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';

jest.mock('../../src/stores/subscriptionStore');

const mockUseSubscriptionStore = useSubscriptionStore as unknown as jest.Mock;

describe('useSubscriptionState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns initial state when not initialized', () => {
    mockUseSubscriptionStore.mockImplementation(
      (selector: (state: Record<string, unknown>) => unknown) => {
        const state = {
          canAccessApp: false,
          isLoading: false,
          error: null,
          status: null,
          lastFetched: null,
        };
        return selector(state);
      }
    );

    const { result } = renderHook(() => useSubscriptionState());

    expect(result.current).toEqual({
      canAccessApp: false,
      isLoading: false,
      error: null,
      status: null,
      isInitialized: false,
    });
  });

  it('returns loading state', () => {
    mockUseSubscriptionStore.mockImplementation(
      (selector: (state: Record<string, unknown>) => unknown) => {
        const state = {
          canAccessApp: false,
          isLoading: true,
          error: null,
          status: null,
          lastFetched: null,
        };
        return selector(state);
      }
    );

    const { result } = renderHook(() => useSubscriptionState());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isInitialized).toBe(false);
  });

  it('returns active subscription state with canAccessApp true', () => {
    mockUseSubscriptionStore.mockImplementation(
      (selector: (state: Record<string, unknown>) => unknown) => {
        const state = {
          canAccessApp: true,
          isLoading: false,
          error: null,
          status: 'active',
          lastFetched: Date.now(),
        };
        return selector(state);
      }
    );

    const { result } = renderHook(() => useSubscriptionState());

    expect(result.current).toEqual({
      canAccessApp: true,
      isLoading: false,
      error: null,
      status: 'active',
      isInitialized: true,
    });
  });

  it('returns expired subscription state with canAccessApp false', () => {
    mockUseSubscriptionStore.mockImplementation(
      (selector: (state: Record<string, unknown>) => unknown) => {
        const state = {
          canAccessApp: false,
          isLoading: false,
          error: null,
          status: 'expired',
          lastFetched: Date.now(),
        };
        return selector(state);
      }
    );

    const { result } = renderHook(() => useSubscriptionState());

    expect(result.current).toEqual({
      canAccessApp: false,
      isLoading: false,
      error: null,
      status: 'expired',
      isInitialized: true,
    });
  });

  it('returns trial subscription state', () => {
    mockUseSubscriptionStore.mockImplementation(
      (selector: (state: Record<string, unknown>) => unknown) => {
        const state = {
          canAccessApp: true,
          isLoading: false,
          error: null,
          status: 'trialing',
          lastFetched: Date.now(),
        };
        return selector(state);
      }
    );

    const { result } = renderHook(() => useSubscriptionState());

    expect(result.current.canAccessApp).toBe(true);
    expect(result.current.status).toBe('trialing');
    expect(result.current.isInitialized).toBe(true);
  });

  it('returns error state', () => {
    mockUseSubscriptionStore.mockImplementation(
      (selector: (state: Record<string, unknown>) => unknown) => {
        const state = {
          canAccessApp: false,
          isLoading: false,
          error: 'Network error',
          status: null,
          lastFetched: null,
        };
        return selector(state);
      }
    );

    const { result } = renderHook(() => useSubscriptionState());

    expect(result.current).toEqual({
      canAccessApp: false,
      isLoading: false,
      error: 'Network error',
      status: null,
      isInitialized: false,
    });
  });

  it('returns isInitialized true when lastFetched is set', () => {
    mockUseSubscriptionStore.mockImplementation(
      (selector: (state: Record<string, unknown>) => unknown) => {
        const state = {
          canAccessApp: false,
          isLoading: false,
          error: null,
          status: 'expired',
          lastFetched: 1706424000000, // Some timestamp
        };
        return selector(state);
      }
    );

    const { result } = renderHook(() => useSubscriptionState());

    expect(result.current.isInitialized).toBe(true);
  });

  it('returns isInitialized false when lastFetched is null', () => {
    mockUseSubscriptionStore.mockImplementation(
      (selector: (state: Record<string, unknown>) => unknown) => {
        const state = {
          canAccessApp: false,
          isLoading: false,
          error: null,
          status: null,
          lastFetched: null,
        };
        return selector(state);
      }
    );

    const { result } = renderHook(() => useSubscriptionState());

    expect(result.current.isInitialized).toBe(false);
  });

  it('returns correct structure with all properties', () => {
    mockUseSubscriptionStore.mockImplementation(
      (selector: (state: Record<string, unknown>) => unknown) => {
        const state = {
          canAccessApp: true,
          isLoading: false,
          error: null,
          status: 'active',
          lastFetched: Date.now(),
        };
        return selector(state);
      }
    );

    const { result } = renderHook(() => useSubscriptionState());

    // Verify all properties exist and have correct types
    expect(typeof result.current.canAccessApp).toBe('boolean');
    expect(typeof result.current.isLoading).toBe('boolean');
    expect(typeof result.current.isInitialized).toBe('boolean');
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe('active');
  });
});
