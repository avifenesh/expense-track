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
 * Uses individual selectors for each primitive value to prevent
 * unnecessary re-renders and avoid Maximum update depth exceeded errors.
 */
export function useAuthState(): AuthState {
  // Use individual selectors for each primitive value
  // This is more efficient than selecting an object and avoids
  // potential issues with reference equality checks during rapid state changes
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const hasCompletedOnboarding = useAuthStore(
    (state) => state.user?.hasCompletedOnboarding ?? false
  );
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return {
    isAuthenticated,
    hasCompletedOnboarding,
    isLoading,
    userId,
  };
}
