import { useOfflineQueueStore } from '../../src/stores/offlineQueueStore';
import { loadQueue, saveQueue, clearQueue } from '../../src/lib/queuePersistence';
import { apiPost, apiGet, ApiError } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';

jest.mock('../../src/lib/queuePersistence');
jest.mock('../../src/services/api');
jest.mock('../../src/stores/authStore');

const mockLoadQueue = loadQueue as jest.MockedFunction<typeof loadQueue>;
const mockSaveQueue = saveQueue as jest.MockedFunction<typeof saveQueue>;
const mockClearQueue = clearQueue as jest.MockedFunction<typeof clearQueue>;
const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;
const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

const createTransactionInput = () => ({
  accountId: 'account-1',
  categoryId: 'category-1',
  type: 'EXPENSE' as const,
  amount: 50,
  currency: 'USD' as const,
  date: '2026-01-21T00:00:00.000Z',
  description: 'Test transaction',
});

const createTransaction = (id: string) => ({
  id,
  accountId: 'account-1',
  categoryId: 'category-1',
  type: 'EXPENSE' as const,
  amount: '50.00',
  currency: 'USD' as const,
  date: '2026-01-21T00:00:00.000Z',
  month: '2026-01-01T00:00:00.000Z',
  description: 'Test transaction',
  isRecurring: false,
  category: {
    id: 'category-1',
    name: 'Food',
    icon: '',
    type: 'EXPENSE' as const,
    isArchived: false,
    sortOrder: 0,
  },
});

describe('offlineQueueStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOfflineQueueStore.getState().reset();
    mockLoadQueue.mockResolvedValue([]);
    mockSaveQueue.mockResolvedValue();
    mockClearQueue.mockResolvedValue();
    mockUseAuthStore.getState = jest.fn().mockReturnValue({ accessToken: 'test-token' });
  });

  describe('addToQueue', () => {
    it('adds item to queue and persists', async () => {
      const data = createTransactionInput();

      const id = await useOfflineQueueStore.getState().addToQueue(data);

      expect(id).toMatch(/^pending_/);
      expect(useOfflineQueueStore.getState().items).toHaveLength(1);
      expect(useOfflineQueueStore.getState().items[0].data).toEqual(data);
      expect(mockSaveQueue).toHaveBeenCalled();
    });

    it('generates unique IDs for each item', async () => {
      const data = createTransactionInput();

      const id1 = await useOfflineQueueStore.getState().addToQueue(data);
      const id2 = await useOfflineQueueStore.getState().addToQueue(data);

      expect(id1).not.toBe(id2);
      expect(useOfflineQueueStore.getState().items).toHaveLength(2);
    });

    it('sets retryCount to 0 for new items', async () => {
      const data = createTransactionInput();

      await useOfflineQueueStore.getState().addToQueue(data);

      expect(useOfflineQueueStore.getState().items[0].retryCount).toBe(0);
    });

    it('clears syncError on new addition', async () => {
      useOfflineQueueStore.setState({ syncError: 'Previous error' });

      await useOfflineQueueStore.getState().addToQueue(createTransactionInput());

      expect(useOfflineQueueStore.getState().syncError).toBeNull();
    });
  });

  describe('removeFromQueue', () => {
    it('removes item from queue and persists', async () => {
      const id = await useOfflineQueueStore.getState().addToQueue(createTransactionInput());
      mockSaveQueue.mockClear();

      await useOfflineQueueStore.getState().removeFromQueue(id);

      expect(useOfflineQueueStore.getState().items).toHaveLength(0);
      expect(mockSaveQueue).toHaveBeenCalled();
    });

    it('does nothing when item not found', async () => {
      await useOfflineQueueStore.getState().addToQueue(createTransactionInput());

      await useOfflineQueueStore.getState().removeFromQueue('non-existent');

      expect(useOfflineQueueStore.getState().items).toHaveLength(1);
    });
  });

  describe('processQueue', () => {
    it('does nothing when queue is empty', async () => {
      await useOfflineQueueStore.getState().processQueue();

      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it('does nothing when already syncing', async () => {
      useOfflineQueueStore.setState({ isSyncing: true });
      await useOfflineQueueStore.getState().addToQueue(createTransactionInput());

      await useOfflineQueueStore.getState().processQueue();

      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it('does nothing when not authenticated', async () => {
      mockUseAuthStore.getState = jest.fn().mockReturnValue({ accessToken: null });
      await useOfflineQueueStore.getState().addToQueue(createTransactionInput());

      await useOfflineQueueStore.getState().processQueue();

      expect(mockApiPost).not.toHaveBeenCalled();
      expect(useOfflineQueueStore.getState().syncError).toBe('Not authenticated');
    });

    it('syncs items successfully', async () => {
      const data = createTransactionInput();
      await useOfflineQueueStore.getState().addToQueue(data);
      mockApiPost.mockResolvedValueOnce({ id: 'server-id-1' });
      mockApiGet.mockResolvedValueOnce(createTransaction('server-id-1'));

      await useOfflineQueueStore.getState().processQueue();

      expect(mockApiPost).toHaveBeenCalledWith('/transactions', data, 'test-token');
      expect(useOfflineQueueStore.getState().items).toHaveLength(0);
      expect(useOfflineQueueStore.getState().syncError).toBeNull();
    });

    it('sets isSyncing during processing', async () => {
      await useOfflineQueueStore.getState().addToQueue(createTransactionInput());
      let syncingDuringProcess = false;

      mockApiPost.mockImplementation(async () => {
        syncingDuringProcess = useOfflineQueueStore.getState().isSyncing;
        return { id: 'server-id' };
      });
      mockApiGet.mockResolvedValueOnce(createTransaction('server-id'));

      await useOfflineQueueStore.getState().processQueue();

      expect(syncingDuringProcess).toBe(true);
      expect(useOfflineQueueStore.getState().isSyncing).toBe(false);
    });

    it('increments retryCount on failure', async () => {
      await useOfflineQueueStore.getState().addToQueue(createTransactionInput());
      mockApiPost.mockRejectedValueOnce(new ApiError('Server error', 'SERVER_ERROR', 500));

      await useOfflineQueueStore.getState().processQueue();

      expect(useOfflineQueueStore.getState().items[0].retryCount).toBe(1);
      expect(useOfflineQueueStore.getState().items[0].lastError).toBe('Server error');
    });

    it('processes multiple items sequentially', async () => {
      await useOfflineQueueStore.getState().addToQueue(createTransactionInput());
      await useOfflineQueueStore.getState().addToQueue(createTransactionInput());

      mockApiPost
        .mockResolvedValueOnce({ id: 'server-id-1' })
        .mockResolvedValueOnce({ id: 'server-id-2' });
      mockApiGet
        .mockResolvedValueOnce(createTransaction('server-id-1'))
        .mockResolvedValueOnce(createTransaction('server-id-2'));

      await useOfflineQueueStore.getState().processQueue();

      expect(mockApiPost).toHaveBeenCalledTimes(2);
      expect(useOfflineQueueStore.getState().items).toHaveLength(0);
    });

    it('continues processing remaining items after failure', async () => {
      await useOfflineQueueStore.getState().addToQueue(createTransactionInput());
      await useOfflineQueueStore.getState().addToQueue(createTransactionInput());

      mockApiPost
        .mockRejectedValueOnce(new ApiError('Network error', 'NETWORK_ERROR', 0))
        .mockResolvedValueOnce({ id: 'server-id-2' });
      mockApiGet.mockResolvedValueOnce(createTransaction('server-id-2'));

      await useOfflineQueueStore.getState().processQueue();

      expect(useOfflineQueueStore.getState().items).toHaveLength(1);
      expect(useOfflineQueueStore.getState().syncError).toContain('1 transaction(s) failed');
    });

    it('sets lastSyncAttempt timestamp', async () => {
      await useOfflineQueueStore.getState().addToQueue(createTransactionInput());
      mockApiPost.mockResolvedValueOnce({ id: 'server-id' });
      mockApiGet.mockResolvedValueOnce(createTransaction('server-id'));

      await useOfflineQueueStore.getState().processQueue();

      expect(useOfflineQueueStore.getState().lastSyncAttempt).not.toBeNull();
    });
  });

  describe('loadFromStorage', () => {
    it('loads queue from storage', async () => {
      const storedItems = [
        {
          id: 'pending_123',
          data: createTransactionInput(),
          createdAt: '2026-01-21T00:00:00.000Z',
          retryCount: 1,
        },
      ];
      mockLoadQueue.mockResolvedValueOnce(storedItems);

      await useOfflineQueueStore.getState().loadFromStorage();

      expect(useOfflineQueueStore.getState().items).toEqual(storedItems);
    });

    it('handles empty storage', async () => {
      mockLoadQueue.mockResolvedValueOnce([]);

      await useOfflineQueueStore.getState().loadFromStorage();

      expect(useOfflineQueueStore.getState().items).toEqual([]);
    });
  });

  describe('getQueueCount', () => {
    it('returns 0 for empty queue', () => {
      expect(useOfflineQueueStore.getState().getQueueCount()).toBe(0);
    });

    it('returns correct count for non-empty queue', async () => {
      await useOfflineQueueStore.getState().addToQueue(createTransactionInput());
      await useOfflineQueueStore.getState().addToQueue(createTransactionInput());

      expect(useOfflineQueueStore.getState().getQueueCount()).toBe(2);
    });
  });

  describe('reset', () => {
    it('clears all state and storage', async () => {
      await useOfflineQueueStore.getState().addToQueue(createTransactionInput());
      useOfflineQueueStore.setState({ syncError: 'Error', isSyncing: true });

      useOfflineQueueStore.getState().reset();

      expect(useOfflineQueueStore.getState().items).toEqual([]);
      expect(useOfflineQueueStore.getState().syncError).toBeNull();
      expect(useOfflineQueueStore.getState().isSyncing).toBe(false);
      expect(mockClearQueue).toHaveBeenCalled();
    });
  });
});
