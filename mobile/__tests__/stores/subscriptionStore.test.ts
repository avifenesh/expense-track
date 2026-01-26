import { useSubscriptionStore } from '../../src/stores/subscriptionStore';
import { useAuthStore } from '../../src/stores/authStore';
import { ApiError } from '../../src/services/api';
import { getSubscriptionStatus } from '../../src/services/subscription';
import {
  loadSubscription,
  saveSubscription,
  clearSubscription,
} from '../../src/lib/subscriptionPersistence';

jest.mock('../../src/services/subscription', () => ({
  getSubscriptionStatus: jest.fn(),
}));

jest.mock('../../src/lib/subscriptionPersistence', () => ({
  loadSubscription: jest.fn(),
  saveSubscription: jest.fn(),
  clearSubscription: jest.fn(),
}));

const mockGetSubscriptionStatus = getSubscriptionStatus as jest.MockedFunction<
  typeof getSubscriptionStatus
>;
const mockLoadSubscription = loadSubscription as jest.MockedFunction<typeof loadSubscription>;
const mockSaveSubscription = saveSubscription as jest.MockedFunction<typeof saveSubscription>;
const mockClearSubscription = clearSubscription as jest.MockedFunction<typeof clearSubscription>;

const mockSubscriptionResponse = {
  subscription: {
    status: 'TRIALING' as const,
    isActive: true,
    canAccessApp: true,
    trialEndsAt: '2026-02-09T00:00:00.000Z',
    currentPeriodEnd: null,
    daysRemaining: 14,
    paddleCustomerId: null,
    paddleSubscriptionId: null,
  },
  checkout: null,
  pricing: {
    monthlyPriceCents: 300,
    trialDays: 14,
    currency: 'USD',
  },
};

describe('subscriptionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSubscriptionStore.setState({
      status: null,
      isActive: false,
      trialEndsAt: null,
      currentPeriodEnd: null,
      daysRemaining: null,
      canAccessApp: false,
      isLoading: false,
      error: null,
      lastFetched: null,
    });
    useAuthStore.setState({ accessToken: 'test-token' });
    mockSaveSubscription.mockResolvedValue();
    mockClearSubscription.mockResolvedValue();
  });

  describe('initial state', () => {
    it('has correct initial values', () => {
      const state = useSubscriptionStore.getState();
      expect(state.status).toBeNull();
      expect(state.isActive).toBe(false);
      expect(state.trialEndsAt).toBeNull();
      expect(state.currentPeriodEnd).toBeNull();
      expect(state.daysRemaining).toBeNull();
      expect(state.canAccessApp).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastFetched).toBeNull();
    });
  });

  describe('fetchSubscription', () => {
    it('fetches subscription successfully', async () => {
      mockGetSubscriptionStatus.mockResolvedValue(mockSubscriptionResponse);

      await useSubscriptionStore.getState().fetchSubscription();

      const state = useSubscriptionStore.getState();
      expect(state.status).toBe('TRIALING');
      expect(state.isActive).toBe(true);
      expect(state.canAccessApp).toBe(true);
      expect(state.trialEndsAt).toBe('2026-02-09T00:00:00.000Z');
      expect(state.daysRemaining).toBe(14);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastFetched).not.toBeNull();
    });

    it('saves subscription to cache after fetch', async () => {
      mockGetSubscriptionStatus.mockResolvedValue(mockSubscriptionResponse);

      await useSubscriptionStore.getState().fetchSubscription();

      expect(mockSaveSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'TRIALING',
          isActive: true,
          canAccessApp: true,
          trialEndsAt: '2026-02-09T00:00:00.000Z',
          daysRemaining: 14,
          cachedAt: expect.any(Number),
        })
      );
    });

    it('sets error when not authenticated', async () => {
      useAuthStore.setState({ accessToken: null });

      await useSubscriptionStore.getState().fetchSubscription();

      const state = useSubscriptionStore.getState();
      expect(state.error).toBe('Not authenticated');
      expect(mockGetSubscriptionStatus).not.toHaveBeenCalled();
    });

    it('handles API errors', async () => {
      mockGetSubscriptionStatus.mockRejectedValue(
        new ApiError('Subscription not found', 'NOT_FOUND', 404)
      );

      await useSubscriptionStore.getState().fetchSubscription();

      const state = useSubscriptionStore.getState();
      expect(state.error).toBe('Subscription not found');
      expect(state.isLoading).toBe(false);
    });

    it('handles non-API errors', async () => {
      mockGetSubscriptionStatus.mockRejectedValue(new Error('Network error'));

      await useSubscriptionStore.getState().fetchSubscription();

      const state = useSubscriptionStore.getState();
      expect(state.error).toBe('Failed to fetch subscription status');
      expect(state.isLoading).toBe(false);
    });

    it('skips fetch when already loading', async () => {
      useSubscriptionStore.setState({ isLoading: true });

      await useSubscriptionStore.getState().fetchSubscription();

      expect(mockGetSubscriptionStatus).not.toHaveBeenCalled();
    });

    it('skips fetch when cache is fresh', async () => {
      const now = Date.now();
      useSubscriptionStore.setState({ lastFetched: now - 1000 }); // 1 second ago

      await useSubscriptionStore.getState().fetchSubscription();

      expect(mockGetSubscriptionStatus).not.toHaveBeenCalled();
    });

    it('fetches when cache is expired', async () => {
      const now = Date.now();
      useSubscriptionStore.setState({ lastFetched: now - 6 * 60 * 1000 }); // 6 minutes ago
      mockGetSubscriptionStatus.mockResolvedValue(mockSubscriptionResponse);

      await useSubscriptionStore.getState().fetchSubscription();

      expect(mockGetSubscriptionStatus).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('forces fetch ignoring TTL', async () => {
      const now = Date.now();
      useSubscriptionStore.setState({ lastFetched: now - 1000 }); // 1 second ago (fresh)
      mockGetSubscriptionStatus.mockResolvedValue(mockSubscriptionResponse);

      await useSubscriptionStore.getState().refresh();

      expect(mockGetSubscriptionStatus).toHaveBeenCalled();
      const state = useSubscriptionStore.getState();
      expect(state.status).toBe('TRIALING');
    });

    it('skips refresh when already loading', async () => {
      useSubscriptionStore.setState({ isLoading: true });

      await useSubscriptionStore.getState().refresh();

      expect(mockGetSubscriptionStatus).not.toHaveBeenCalled();
    });

    it('sets error when not authenticated', async () => {
      useAuthStore.setState({ accessToken: null });

      await useSubscriptionStore.getState().refresh();

      const state = useSubscriptionStore.getState();
      expect(state.error).toBe('Not authenticated');
      expect(mockGetSubscriptionStatus).not.toHaveBeenCalled();
    });

    it('saves subscription to cache after refresh', async () => {
      mockGetSubscriptionStatus.mockResolvedValue(mockSubscriptionResponse);

      await useSubscriptionStore.getState().refresh();

      expect(mockSaveSubscription).toHaveBeenCalled();
    });

    it('handles API errors during refresh', async () => {
      mockGetSubscriptionStatus.mockRejectedValue(new ApiError('Server error', 'SERVER_ERROR', 500));

      await useSubscriptionStore.getState().refresh();

      const state = useSubscriptionStore.getState();
      expect(state.error).toBe('Server error');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('loadFromCache', () => {
    it('loads subscription from cache', async () => {
      mockLoadSubscription.mockResolvedValue({
        status: 'ACTIVE',
        isActive: true,
        canAccessApp: true,
        trialEndsAt: null,
        currentPeriodEnd: '2026-02-26T00:00:00.000Z',
        daysRemaining: 30,
        cachedAt: Date.now() - 1000,
      });
      mockGetSubscriptionStatus.mockResolvedValue(mockSubscriptionResponse);

      await useSubscriptionStore.getState().loadFromCache();

      const state = useSubscriptionStore.getState();
      expect(state.status).toBe('ACTIVE');
      expect(state.isActive).toBe(true);
      expect(state.currentPeriodEnd).toBe('2026-02-26T00:00:00.000Z');
    });

    it('fetches fresh data in background after loading cache', async () => {
      mockLoadSubscription.mockResolvedValue({
        status: 'ACTIVE',
        isActive: true,
        canAccessApp: true,
        trialEndsAt: null,
        currentPeriodEnd: '2026-02-26T00:00:00.000Z',
        daysRemaining: 30,
        cachedAt: Date.now() - 6 * 60 * 1000, // 6 minutes ago (expired)
      });
      mockGetSubscriptionStatus.mockResolvedValue(mockSubscriptionResponse);

      await useSubscriptionStore.getState().loadFromCache();

      // Wait for background fetch to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockGetSubscriptionStatus).toHaveBeenCalled();
    });

    it('handles empty cache', async () => {
      mockLoadSubscription.mockResolvedValue(null);
      mockGetSubscriptionStatus.mockResolvedValue(mockSubscriptionResponse);

      await useSubscriptionStore.getState().loadFromCache();

      // Should still attempt to fetch
      expect(mockGetSubscriptionStatus).toHaveBeenCalled();
    });

    it('sets lastFetched from cache', async () => {
      const cachedAt = Date.now() - 2 * 60 * 1000;
      mockLoadSubscription.mockResolvedValue({
        status: 'TRIALING',
        isActive: true,
        canAccessApp: true,
        trialEndsAt: '2026-02-09T00:00:00.000Z',
        currentPeriodEnd: null,
        daysRemaining: 14,
        cachedAt,
      });
      mockGetSubscriptionStatus.mockResolvedValue(mockSubscriptionResponse);

      await useSubscriptionStore.getState().loadFromCache();

      const state = useSubscriptionStore.getState();
      expect(state.lastFetched).toBe(cachedAt);
    });
  });

  describe('clearError', () => {
    it('clears error', () => {
      useSubscriptionStore.setState({ error: 'Some error' });

      useSubscriptionStore.getState().clearError();

      expect(useSubscriptionStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets to initial state', async () => {
      useSubscriptionStore.setState({
        status: 'ACTIVE',
        isActive: true,
        canAccessApp: true,
        trialEndsAt: null,
        currentPeriodEnd: '2026-02-26T00:00:00.000Z',
        daysRemaining: 30,
        error: 'Error',
        lastFetched: Date.now(),
      });

      await useSubscriptionStore.getState().reset();

      const state = useSubscriptionStore.getState();
      expect(state.status).toBeNull();
      expect(state.isActive).toBe(false);
      expect(state.canAccessApp).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastFetched).toBeNull();
    });

    it('clears subscription cache', async () => {
      await useSubscriptionStore.getState().reset();

      expect(mockClearSubscription).toHaveBeenCalled();
    });
  });

  describe('subscription status types', () => {
    it('handles ACTIVE status', async () => {
      mockGetSubscriptionStatus.mockResolvedValue({
        ...mockSubscriptionResponse,
        subscription: {
          ...mockSubscriptionResponse.subscription,
          status: 'ACTIVE',
          trialEndsAt: null,
          currentPeriodEnd: '2026-02-26T00:00:00.000Z',
          daysRemaining: 30,
        },
      });

      await useSubscriptionStore.getState().fetchSubscription();

      const state = useSubscriptionStore.getState();
      expect(state.status).toBe('ACTIVE');
      expect(state.trialEndsAt).toBeNull();
      expect(state.currentPeriodEnd).toBe('2026-02-26T00:00:00.000Z');
    });

    it('handles PAST_DUE status', async () => {
      mockGetSubscriptionStatus.mockResolvedValue({
        ...mockSubscriptionResponse,
        subscription: {
          ...mockSubscriptionResponse.subscription,
          status: 'PAST_DUE',
          isActive: true,
          canAccessApp: true,
        },
      });

      await useSubscriptionStore.getState().fetchSubscription();

      const state = useSubscriptionStore.getState();
      expect(state.status).toBe('PAST_DUE');
      expect(state.isActive).toBe(true);
      expect(state.canAccessApp).toBe(true);
    });

    it('handles CANCELED status', async () => {
      mockGetSubscriptionStatus.mockResolvedValue({
        ...mockSubscriptionResponse,
        subscription: {
          ...mockSubscriptionResponse.subscription,
          status: 'CANCELED',
          isActive: false,
          canAccessApp: true, // Can still access until period ends
          currentPeriodEnd: '2026-02-26T00:00:00.000Z',
        },
      });

      await useSubscriptionStore.getState().fetchSubscription();

      const state = useSubscriptionStore.getState();
      expect(state.status).toBe('CANCELED');
      expect(state.isActive).toBe(false);
      expect(state.canAccessApp).toBe(true);
    });

    it('handles EXPIRED status', async () => {
      mockGetSubscriptionStatus.mockResolvedValue({
        ...mockSubscriptionResponse,
        subscription: {
          ...mockSubscriptionResponse.subscription,
          status: 'EXPIRED',
          isActive: false,
          canAccessApp: false,
          daysRemaining: null,
        },
      });

      await useSubscriptionStore.getState().fetchSubscription();

      const state = useSubscriptionStore.getState();
      expect(state.status).toBe('EXPIRED');
      expect(state.isActive).toBe(false);
      expect(state.canAccessApp).toBe(false);
      expect(state.daysRemaining).toBeNull();
    });
  });
});
