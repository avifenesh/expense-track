import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadQueue, saveQueue, clearQueue, QueuedItem } from '../../src/lib/queuePersistence';

jest.mock('@react-native-async-storage/async-storage');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

const createQueuedItem = (overrides: Partial<QueuedItem> = {}): QueuedItem => ({
  id: 'pending_123',
  data: {
    accountId: 'account-1',
    categoryId: 'category-1',
    type: 'EXPENSE',
    amount: 50,
    currency: 'USD',
    date: '2026-01-21T00:00:00.000Z',
    description: 'Test transaction',
  },
  createdAt: '2026-01-21T12:00:00.000Z',
  retryCount: 0,
  ...overrides,
});

describe('queuePersistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadQueue', () => {
    it('returns empty array when storage is empty', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await loadQueue();

      expect(result).toEqual([]);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('balance_beacon_offline_queue');
    });

    it('returns parsed items when storage has data', async () => {
      const items = [createQueuedItem()];
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(items));

      const result = await loadQueue();

      expect(result).toEqual(items);
    });

    it('handles invalid JSON gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce('invalid json');

      const result = await loadQueue();

      expect(result).toEqual([]);
    });

    it('returns empty array when stored value is not an array', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({ not: 'an array' }));

      const result = await loadQueue();

      expect(result).toEqual([]);
    });

    it('handles storage errors gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));

      const result = await loadQueue();

      expect(result).toEqual([]);
    });

    it('returns multiple queued items correctly', async () => {
      const items = [
        createQueuedItem({ id: 'pending_1' }),
        createQueuedItem({ id: 'pending_2', retryCount: 2 }),
      ];
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(items));

      const result = await loadQueue();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('pending_1');
      expect(result[1].retryCount).toBe(2);
    });
  });

  describe('saveQueue', () => {
    it('persists items to storage', async () => {
      const items = [createQueuedItem()];
      mockAsyncStorage.setItem.mockResolvedValueOnce();

      await saveQueue(items);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'balance_beacon_offline_queue',
        JSON.stringify(items)
      );
    });

    it('persists empty array', async () => {
      mockAsyncStorage.setItem.mockResolvedValueOnce();

      await saveQueue([]);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'balance_beacon_offline_queue',
        '[]'
      );
    });

    it('propagates storage errors', async () => {
      const error = new Error('Storage full');
      mockAsyncStorage.setItem.mockRejectedValueOnce(error);

      await expect(saveQueue([])).rejects.toThrow('Storage full');
    });

    it('saves items with lastError field', async () => {
      const items = [createQueuedItem({ lastError: 'Network timeout' })];
      mockAsyncStorage.setItem.mockResolvedValueOnce();

      await saveQueue(items);

      const savedData = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[0][1] as string
      );
      expect(savedData[0].lastError).toBe('Network timeout');
    });
  });

  describe('clearQueue', () => {
    it('removes queue from storage', async () => {
      mockAsyncStorage.removeItem.mockResolvedValueOnce();

      await clearQueue();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('balance_beacon_offline_queue');
    });

    it('propagates storage errors', async () => {
      const error = new Error('Storage unavailable');
      mockAsyncStorage.removeItem.mockRejectedValueOnce(error);

      await expect(clearQueue()).rejects.toThrow('Storage unavailable');
    });
  });
});
