import { useShallow } from 'zustand/shallow';
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
 * Uses shallow comparison to prevent unnecessary re-renders.
 */
export function useAuthState(): AuthState {
  const { isAuthenticated, isLoading, user } = useAuthStore(
    useShallow((state) => ({
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      user: state.user,
    }))
  );

  return {
    isAuthenticated,
    hasCompletedOnboarding: user?.hasCompletedOnboarding ?? false,
    isLoading,
    userId: user?.id ?? null,
  };
}
