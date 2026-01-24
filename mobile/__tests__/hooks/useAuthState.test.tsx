import { renderHook } from '@testing-library/react-native';
import { useAuthState } from '../../src/hooks/useAuthState';
import { useAuthStore } from '../../src/stores/authStore';

jest.mock('../../src/stores/authStore');

const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

describe('useAuthState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns initial loading state', () => {
    mockUseAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) => {
      const state = {
        isAuthenticated: false,
        isLoading: true,
        user: null,
      };
      return selector(state);
    });

    const { result } = renderHook(() => useAuthState());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('returns unauthenticated state after loading complete', () => {
    mockUseAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) => {
      const state = {
        isAuthenticated: false,
        isLoading: false,
        user: null,
      };
      return selector(state);
    });

    const { result } = renderHook(() => useAuthState());

    expect(result.current).toEqual({
      isAuthenticated: false,
      hasCompletedOnboarding: false,
      isLoading: false,
      userId: null,
    });
  });

  it('returns authenticated state with user data', () => {
    mockUseAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) => {
      const state = {
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          hasCompletedOnboarding: true,
        },
      };
      return selector(state);
    });

    const { result } = renderHook(() => useAuthState());

    expect(result.current).toEqual({
      isAuthenticated: true,
      hasCompletedOnboarding: true,
      isLoading: false,
      userId: 'user-123',
    });
  });

  it('returns correct state when user has not completed onboarding', () => {
    mockUseAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) => {
      const state = {
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-456',
          email: 'new@example.com',
          hasCompletedOnboarding: false,
        },
      };
      return selector(state);
    });

    const { result } = renderHook(() => useAuthState());

    expect(result.current).toEqual({
      isAuthenticated: true,
      hasCompletedOnboarding: false,
      isLoading: false,
      userId: 'user-456',
    });
  });

  it('returns correct final state structure', () => {
    mockUseAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) => {
      const state = {
        isAuthenticated: false,
        isLoading: false,
        user: null,
      };
      return selector(state);
    });

    const { result } = renderHook(() => useAuthState());

    // Verify all properties exist and have correct types
    expect(typeof result.current.isAuthenticated).toBe('boolean');
    expect(typeof result.current.hasCompletedOnboarding).toBe('boolean');
    expect(typeof result.current.isLoading).toBe('boolean');
    expect(result.current.userId).toBeNull();
  });
});
