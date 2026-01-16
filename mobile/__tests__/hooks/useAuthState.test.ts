import { renderHook, waitFor } from '@testing-library/react-native';
import { useAuthState } from '../../src/hooks/useAuthState';

describe('useAuthState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns initial loading state', () => {
    const { result } = renderHook(() => useAuthState());

    expect(result.current).toEqual({
      isAuthenticated: false,
      hasCompletedOnboarding: false,
      isLoading: true,
      userId: null,
    });
  });

  it('transitions to unauthenticated state after async check', async () => {
    const { result } = renderHook(() => useAuthState());

    // Initial state should be loading
    expect(result.current.isLoading).toBe(true);

    // Advance timers to complete the async auth check
    jest.advanceTimersByTime(500);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current).toEqual({
      isAuthenticated: false,
      hasCompletedOnboarding: false,
      isLoading: false,
      userId: null,
    });
  });

  it('returns correct final state structure', async () => {
    const { result } = renderHook(() => useAuthState());

    jest.advanceTimersByTime(500);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify all properties exist and have correct types
    expect(typeof result.current.isAuthenticated).toBe('boolean');
    expect(typeof result.current.hasCompletedOnboarding).toBe('boolean');
    expect(typeof result.current.isLoading).toBe('boolean');
    expect(result.current.userId).toBeNull();
  });

  it('does not change state before timeout completes', () => {
    const { result } = renderHook(() => useAuthState());

    // Advance partially through the timeout
    jest.advanceTimersByTime(250);

    // Should still be loading
    expect(result.current.isLoading).toBe(true);
  });
});
