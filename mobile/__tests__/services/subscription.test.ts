import { getSubscriptionStatus } from '../../src/services/subscription';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Factory function to create mock responses with customizable overrides
function createMockResponse(overrides: {
  subscription?: Partial<{
    status: string;
    isActive: boolean;
    canAccessApp: boolean;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    daysRemaining: number | null;
    paddleCustomerId: string | null;
    paddleSubscriptionId: string | null;
  }>;
  checkout?: {
    priceId: string;
    customData: Record<string, unknown>;
    customerEmail: string;
  } | null;
  pricing?: Partial<{
    monthlyPriceCents: number;
    trialDays: number;
    currency: string;
  }>;
} = {}) {
  return {
    subscription: {
      status: 'TRIALING',
      isActive: true,
      canAccessApp: true,
      trialEndsAt: '2024-01-28T00:00:00.000Z',
      currentPeriodEnd: null,
      daysRemaining: 14,
      paddleCustomerId: null,
      paddleSubscriptionId: null,
      ...overrides.subscription,
    },
    checkout: overrides.checkout !== undefined
      ? overrides.checkout
      : {
          priceId: 'pri_123',
          customData: { userId: 'user-123' },
          customerEmail: 'test@example.com',
        },
    pricing: {
      monthlyPriceCents: 300,
      trialDays: 14,
      currency: 'USD',
      ...overrides.pricing,
    },
  };
}

describe('Subscription Service', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('getSubscriptionStatus', () => {
    it('returns full subscription data for trialing user', async () => {
      const mockResponse = createMockResponse();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockResponse,
          }),
      });

      const result = await getSubscriptionStatus('access-token-123');

      expect(result).toEqual(mockResponse);
      expect(result.subscription.status).toBe('TRIALING');
      expect(result.subscription.isActive).toBe(true);
      expect(result.subscription.canAccessApp).toBe(true);
    });

    it('returns subscription data for active paid user', async () => {
      const mockResponse = createMockResponse({
        subscription: {
          status: 'ACTIVE',
          trialEndsAt: null,
          currentPeriodEnd: '2024-02-15T00:00:00.000Z',
          daysRemaining: 30,
          paddleCustomerId: 'ctm_abc123',
          paddleSubscriptionId: 'sub_xyz789',
        },
        checkout: null,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockResponse,
          }),
      });

      const result = await getSubscriptionStatus('access-token-456');

      expect(result).toEqual(mockResponse);
      expect(result.subscription.status).toBe('ACTIVE');
      expect(result.checkout).toBeNull();
      expect(result.subscription.paddleSubscriptionId).toBe('sub_xyz789');
    });

    it('returns subscription data for expired user', async () => {
      const mockResponse = createMockResponse({
        subscription: {
          status: 'EXPIRED',
          isActive: false,
          canAccessApp: false,
          trialEndsAt: '2024-01-01T00:00:00.000Z',
          currentPeriodEnd: null,
          daysRemaining: null,
        },
        checkout: {
          priceId: 'pri_123',
          customData: { userId: 'user-expired' },
          customerEmail: 'expired@example.com',
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockResponse,
          }),
      });

      const result = await getSubscriptionStatus('access-token-expired');

      expect(result).toEqual(mockResponse);
      expect(result.subscription.status).toBe('EXPIRED');
      expect(result.subscription.isActive).toBe(false);
      expect(result.subscription.canAccessApp).toBe(false);
    });

    it('sends authorization header with access token', async () => {
      const mockResponse = createMockResponse({ checkout: null });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockResponse,
          }),
      });

      await getSubscriptionStatus('my-secret-token');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/subscriptions'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer my-secret-token',
          }),
        })
      );
    });

    it('throws ApiError when unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            success: false,
            error: 'Unauthorized',
          }),
      });

      await expect(getSubscriptionStatus('invalid-token')).rejects.toThrow(
        'Unauthorized'
      );
    });

    it('throws ApiError on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(getSubscriptionStatus('access-token')).rejects.toThrow(
        'Network error'
      );
    });
  });
});
