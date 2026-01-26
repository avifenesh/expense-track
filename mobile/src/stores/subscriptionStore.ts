import { create } from 'zustand';
import { ApiError } from '../services/api';
import { getSubscriptionStatus } from '../services/subscription';
import type { SubscriptionStatus } from '../services/subscription';
import { useAuthStore } from './authStore';
import { registerStoreReset } from './storeRegistry';
import {
  loadSubscription,
  saveSubscription,
  clearSubscription,
} from '../lib/subscriptionPersistence';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface SubscriptionState {
  status: SubscriptionStatus | null;
  isActive: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  daysRemaining: number | null;
  canAccessApp: boolean;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
}

interface SubscriptionActions {
  fetchSubscription: () => Promise<void>;
  refresh: () => Promise<void>;
  loadFromCache: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export type SubscriptionStore = SubscriptionState & SubscriptionActions;

const initialState: SubscriptionState = {
  status: null,
  isActive: false,
  trialEndsAt: null,
  currentPeriodEnd: null,
  daysRemaining: null,
  canAccessApp: false,
  isLoading: false,
  error: null,
  lastFetched: null,
};

type SetState = (
  partial: Partial<SubscriptionState> | ((state: SubscriptionState) => Partial<SubscriptionState>)
) => void;

async function performFetch(set: SetState): Promise<void> {
  const accessToken = useAuthStore.getState().accessToken;
  if (!accessToken) {
    set({ error: 'Not authenticated' });
    return;
  }

  set({ isLoading: true, error: null });

  try {
    const response = await getSubscriptionStatus(accessToken);
    const { subscription } = response;
    const now = Date.now();

    set({
      status: subscription.status,
      isActive: subscription.isActive,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      daysRemaining: subscription.daysRemaining,
      canAccessApp: subscription.canAccessApp,
      isLoading: false,
      lastFetched: now,
    });

    await saveSubscription({
      status: subscription.status,
      isActive: subscription.isActive,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      daysRemaining: subscription.daysRemaining,
      canAccessApp: subscription.canAccessApp,
      cachedAt: now,
    });
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : 'Failed to fetch subscription status';
    set({ error: message, isLoading: false });
  }
}

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  ...initialState,

  fetchSubscription: async () => {
    const { isLoading, lastFetched } = get();

    if (isLoading) {
      return;
    }

    if (lastFetched && Date.now() - lastFetched < CACHE_TTL_MS) {
      return;
    }

    await performFetch(set);
  },

  refresh: async () => {
    const { isLoading } = get();

    if (isLoading) {
      return;
    }

    await performFetch(set);
  },

  loadFromCache: async () => {
    const cached = await loadSubscription();

    if (cached) {
      set({
        status: cached.status,
        isActive: cached.isActive,
        trialEndsAt: cached.trialEndsAt,
        currentPeriodEnd: cached.currentPeriodEnd,
        daysRemaining: cached.daysRemaining,
        canAccessApp: cached.canAccessApp,
        lastFetched: cached.cachedAt,
      });
    }

    const { fetchSubscription } = get();
    fetchSubscription();
  },

  clearError: () => {
    set({ error: null });
  },

  reset: async () => {
    await clearSubscription();
    set({ ...initialState });
  },
}));

registerStoreReset(() => useSubscriptionStore.getState().reset());
