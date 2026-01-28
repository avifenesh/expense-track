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
 */
export function useSubscriptionState(): SubscriptionState {
  return useSubscriptionStore((state) => ({
    canAccessApp: state.canAccessApp,
    isLoading: state.isLoading,
    error: state.error,
    status: state.status,
    isInitialized: state.lastFetched !== null,
  }));
}
