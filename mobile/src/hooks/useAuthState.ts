import { useAuthStore } from '../stores';

interface AuthState {
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  isLoading: boolean;
  userId: string | null;
}

/**
 * Hook to access authentication state from Zustand store.
 * Used by navigation to determine which stack to show.
 */
export function useAuthState(): AuthState {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);

  return {
    isAuthenticated,
    hasCompletedOnboarding: user?.hasCompletedOnboarding ?? false,
    isLoading,
    userId: user?.id ?? null,
  };
}
