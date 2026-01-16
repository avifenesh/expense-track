import { useState, useEffect } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  isLoading: boolean;
  userId: string | null;
}

/**
 * Hook to manage authentication state.
 * Currently a placeholder - actual auth logic will be implemented in task #70-71.
 */
export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    hasCompletedOnboarding: false,
    isLoading: true,
    userId: null,
  });

  useEffect(() => {
    const checkAuth = async () => {
      // Simulate checking for stored auth token
      // In task #70-71, this will:
      // 1. Check expo-secure-store for auth token
      // 2. Validate token with API
      // 3. Check if user has completed onboarding

      // Simulate async auth check
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Default to unauthenticated state for now
      setState({
        isAuthenticated: false,
        hasCompletedOnboarding: false,
        isLoading: false,
        userId: null,
      });
    };

    checkAuth();
  }, []);

  return state;
}
