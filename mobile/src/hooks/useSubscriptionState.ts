import { useSubscriptionStore } from '../stores';
import type { SubscriptionStatus } from '../services/subscription';

interface SubscriptionState {
  canAccessApp: boolean;
  isLoading: boolean;
  error: string | null;
  status: SubscriptionStatus | null;
  isInitialized: boolean;
}

/**
 * Hook to access subscription state from Zustand store.
 * Used by navigation to determine whether to show paywall.
 * Uses individual selectors for each primitive value to prevent
 * unnecessary re-renders and avoid Maximum update depth exceeded errors.
 */
export function useSubscriptionState(): SubscriptionState {
  // Use individual selectors for each primitive value
  // This is more efficient than selecting an object and avoids
  // potential issues with reference equality checks during rapid state changes
  const canAccessApp = useSubscriptionStore((state) => state.canAccessApp);
  const isLoading = useSubscriptionStore((state) => state.isLoading);
  const error = useSubscriptionStore((state) => state.error);
  const status = useSubscriptionStore((state) => state.status);
  const lastFetched = useSubscriptionStore((state) => state.lastFetched);

  // Derive isInitialized from lastFetched - if we've ever fetched (or loaded cache),
  // we have initialization data
  const isInitialized = lastFetched !== null;

  return {
    canAccessApp,
    isLoading,
    error,
    status,
    isInitialized,
  };
}
