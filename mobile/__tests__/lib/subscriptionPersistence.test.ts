import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadSubscription,
  saveSubscription,
  clearSubscription,
  CachedSubscription,
} from '../../src/lib/subscriptionPersistence';

jest.mock('@react-native-async-storage/async-storage');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

const createCachedSubscription = (
  overrides: Partial<CachedSubscription> = {}
): CachedSubscription => ({
  status: 'TRIALING',
  isActive: true,
  trialEndsAt: '2026-02-09T00:00:00.000Z',
  currentPeriodEnd: null,
  daysRemaining: 14,
  canAccessApp: true,
  cachedAt: 1706300000000,
  ...overrides,
});

describe('subscriptionPersistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadSubscription', () => {
    it('returns null when storage is empty', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await loadSubscription();

      expect(result).toBeNull();
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('balance_beacon_subscription');
    });

    it('returns parsed subscription when storage has data', async () => {
      const subscription = createCachedSubscription();
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(subscription));

      const result = await loadSubscription();

      expect(result).toEqual(subscription);
    });

    it('handles invalid JSON gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce('invalid json');

      const result = await loadSubscription();

      expect(result).toBeNull();
    });

    it('returns null when stored value is not an object', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify('not an object'));

      const result = await loadSubscription();

      expect(result).toBeNull();
    });

    it('returns null when stored value is missing status', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({ isActive: true, canAccessApp: true })
      );

      const result = await loadSubscription();

      expect(result).toBeNull();
    });

    it('handles storage errors gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));

      const result = await loadSubscription();

      expect(result).toBeNull();
    });

    it('returns subscription with all status types', async () => {
      const activeSubscription = createCachedSubscription({
        status: 'ACTIVE',
        trialEndsAt: null,
        currentPeriodEnd: '2026-02-26T00:00:00.000Z',
        daysRemaining: 30,
      });
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(activeSubscription));

      const result = await loadSubscription();

      expect(result?.status).toBe('ACTIVE');
      expect(result?.currentPeriodEnd).toBe('2026-02-26T00:00:00.000Z');
    });

    it('returns subscription with expired status', async () => {
      const expiredSubscription = createCachedSubscription({
        status: 'EXPIRED',
        isActive: false,
        canAccessApp: false,
        daysRemaining: null,
      });
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(expiredSubscription));

      const result = await loadSubscription();

      expect(result?.status).toBe('EXPIRED');
      expect(result?.isActive).toBe(false);
      expect(result?.canAccessApp).toBe(false);
    });
  });

  describe('saveSubscription', () => {
    it('persists subscription to storage', async () => {
      const subscription = createCachedSubscription();
      mockAsyncStorage.setItem.mockResolvedValueOnce();

      await saveSubscription(subscription);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'balance_beacon_subscription',
        JSON.stringify(subscription)
      );
    });

    it('persists subscription with null values', async () => {
      const subscription = createCachedSubscription({
        trialEndsAt: null,
        currentPeriodEnd: null,
        daysRemaining: null,
      });
      mockAsyncStorage.setItem.mockResolvedValueOnce();

      await saveSubscription(subscription);

      const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1] as string);
      expect(savedData.trialEndsAt).toBeNull();
      expect(savedData.currentPeriodEnd).toBeNull();
      expect(savedData.daysRemaining).toBeNull();
    });

    it('propagates storage errors', async () => {
      const error = new Error('Storage full');
      mockAsyncStorage.setItem.mockRejectedValueOnce(error);

      await expect(saveSubscription(createCachedSubscription())).rejects.toThrow('Storage full');
    });

    it('saves cachedAt timestamp correctly', async () => {
      const timestamp = Date.now();
      const subscription = createCachedSubscription({ cachedAt: timestamp });
      mockAsyncStorage.setItem.mockResolvedValueOnce();

      await saveSubscription(subscription);

      const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1] as string);
      expect(savedData.cachedAt).toBe(timestamp);
    });
  });

  describe('clearSubscription', () => {
    it('removes subscription from storage', async () => {
      mockAsyncStorage.removeItem.mockResolvedValueOnce();

      await clearSubscription();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('balance_beacon_subscription');
    });

    it('propagates storage errors', async () => {
      const error = new Error('Storage unavailable');
      mockAsyncStorage.removeItem.mockRejectedValueOnce(error);

      await expect(clearSubscription()).rejects.toThrow('Storage unavailable');
    });
  });
});
