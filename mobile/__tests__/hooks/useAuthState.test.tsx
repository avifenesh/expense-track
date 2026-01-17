import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useAuthState } from '../../src/hooks/useAuthState';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { tokenStorage } from '../../src/lib/tokenStorage';

jest.mock('../../src/lib/tokenStorage');
jest.mock('../../src/services/auth');

const mockTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;

// Wrapper component that provides AuthProvider
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('useAuthState', () => {
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

  it('returns initial loading state', () => {
    const { result } = renderHook(() => useAuthState(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('transitions to unauthenticated state after async check', async () => {
    const { result } = renderHook(() => useAuthState(), { wrapper });

    // Initial state should be loading
    expect(result.current.isLoading).toBe(true);

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
    const { result } = renderHook(() => useAuthState(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify all properties exist and have correct types
    expect(typeof result.current.isAuthenticated).toBe('boolean');
    expect(typeof result.current.hasCompletedOnboarding).toBe('boolean');
    expect(typeof result.current.isLoading).toBe('boolean');
    expect(result.current.userId).toBeNull();
  });
});
