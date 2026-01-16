import { useAuth } from '../contexts';

interface AuthState {
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  isLoading: boolean;
  userId: string | null;
}

/**
 * Hook to access authentication state from AuthContext.
 * Used by navigation to determine which stack to show.
 *
 * This hook wraps useAuth for compatibility with existing navigation code.
 * Task #71 will add secure token persistence using expo-secure-store.
 */
export function useAuthState(): AuthState {
  const { isAuthenticated, isLoading, user } = useAuth();

  return {
    isAuthenticated,
    hasCompletedOnboarding: user?.hasCompletedOnboarding ?? false,
    isLoading,
    userId: user?.id ?? null,
  };
}
