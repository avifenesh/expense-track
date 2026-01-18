import { useTransactionsStore } from '../../src/stores/transactionsStore';
import { useAuthStore } from '../../src/stores/authStore';
import { ApiError, apiGet, apiPost, apiPut, apiDelete } from '../../src/services/api';

jest.mock('../../src/services/api');

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;
const mockApiPut = apiPut as jest.MockedFunction<typeof apiPut>;
const mockApiDelete = apiDelete as jest.MockedFunction<typeof apiDelete>;

const mockTransaction = {
  id: 'tx-1',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  type: 'EXPENSE' as const,
  amount: '50.00',
  currency: 'USD' as const,
  date: '2026-01-15',
  month: '2026-01-01',
  description: 'Test transaction',
  isRecurring: false,
  category: {
    id: 'cat-1',
    name: 'Food',
    type: 'EXPENSE' as const,
    color: '#4CAF50',
  },
};

describe('transactionsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTransactionsStore.getState().reset();
    useAuthStore.setState({ accessToken: 'test-token' });
  });

  describe('initial state', () => {
    it('has correct initial values', () => {
      const state = useTransactionsStore.getState();
      expect(state.transactions).toEqual([]);
      expect(state.total).toBe(0);
      expect(state.hasMore).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.filters.accountId).toBe('');
    });
  });

  describe('fetchTransactions', () => {
    it('fetches transactions successfully and returns true', async () => {
      mockApiGet.mockResolvedValue({
        transactions: [mockTransaction],
        total: 1,
        hasMore: false,
      });

      useTransactionsStore.getState().setFilters({ accountId: 'acc-1' });
      const result = await useTransactionsStore.getState().fetchTransactions();

      expect(result).toBe(true);
      const state = useTransactionsStore.getState();
      expect(state.transactions).toHaveLength(1);
      expect(state.transactions[0]).toEqual(mockTransaction);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('applies filters to API request', async () => {
      mockApiGet.mockResolvedValue({ transactions: [], total: 0, hasMore: false });

      useTransactionsStore.getState().setFilters({
        accountId: 'acc-1',
        month: '2026-01',
        categoryId: 'cat-1',
        type: 'EXPENSE',
      });
      await useTransactionsStore.getState().fetchTransactions();

      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('accountId=acc-1'),
        'test-token'
      );
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('month=2026-01'),
        'test-token'
      );
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('categoryId=cat-1'),
        'test-token'
      );
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('type=EXPENSE'),
        'test-token'
      );
    });

    it('sets error and returns false when accountId is missing', async () => {
      const result = await useTransactionsStore.getState().fetchTransactions();

      expect(result).toBe(false);
      const state = useTransactionsStore.getState();
      expect(state.error).toBe('Account ID is required');
      expect(mockApiGet).not.toHaveBeenCalled();
    });

    it('handles API errors and returns false', async () => {
      mockApiGet.mockRejectedValue(new ApiError('Server error', 'SERVER_ERROR', 500));

      useTransactionsStore.getState().setFilters({ accountId: 'acc-1' });
      const result = await useTransactionsStore.getState().fetchTransactions();

      expect(result).toBe(false);
      const state = useTransactionsStore.getState();
      expect(state.error).toBe('Server error');
      expect(state.isLoading).toBe(false);
    });

    it('resets pagination on fresh fetch', async () => {
      mockApiGet.mockResolvedValue({
        transactions: [mockTransaction],
        total: 1,
        hasMore: false,
      });

      useTransactionsStore.setState({ offset: 50 });
      useTransactionsStore.getState().setFilters({ accountId: 'acc-1' });
      await useTransactionsStore.getState().fetchTransactions(true);

      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('offset=0'),
        'test-token'
      );
    });
  });

  describe('fetchMoreTransactions', () => {
    it('appends transactions on pagination', async () => {
      const firstBatch = { ...mockTransaction, id: 'tx-1' };
      const secondBatch = { ...mockTransaction, id: 'tx-2' };

      mockApiGet
        .mockResolvedValueOnce({
          transactions: [firstBatch],
          total: 2,
          hasMore: true,
        })
        .mockResolvedValueOnce({
          transactions: [secondBatch],
          total: 2,
          hasMore: false,
        });

      useTransactionsStore.getState().setFilters({ accountId: 'acc-1' });
      await useTransactionsStore.getState().fetchTransactions();
      await useTransactionsStore.getState().fetchMoreTransactions();

      const state = useTransactionsStore.getState();
      expect(state.transactions).toHaveLength(2);
      expect(state.transactions[0].id).toBe('tx-1');
      expect(state.transactions[1].id).toBe('tx-2');
    });

    it('does nothing when hasMore is false', async () => {
      useTransactionsStore.setState({ hasMore: false });

      await useTransactionsStore.getState().fetchMoreTransactions();

      expect(mockApiGet).not.toHaveBeenCalled();
    });

    it('does nothing when already loading', async () => {
      useTransactionsStore.setState({ isLoading: true, hasMore: true });

      await useTransactionsStore.getState().fetchMoreTransactions();

      expect(mockApiGet).not.toHaveBeenCalled();
    });

    it('uses correct offset for pagination', async () => {
      mockApiGet
        .mockResolvedValueOnce({
          transactions: [{ ...mockTransaction, id: 'tx-1' }],
          total: 100,
          hasMore: true,
        })
        .mockResolvedValueOnce({
          transactions: [{ ...mockTransaction, id: 'tx-2' }],
          total: 100,
          hasMore: true,
        });

      useTransactionsStore.getState().setFilters({ accountId: 'acc-1' });
      await useTransactionsStore.getState().fetchTransactions();

      expect(mockApiGet).toHaveBeenLastCalledWith(
        expect.stringContaining('offset=0'),
        'test-token'
      );

      await useTransactionsStore.getState().fetchMoreTransactions();

      expect(mockApiGet).toHaveBeenLastCalledWith(
        expect.stringContaining('offset=50'),
        'test-token'
      );

      expect(useTransactionsStore.getState().offset).toBe(50);
    });

    it('reverts offset on failed pagination', async () => {
      mockApiGet
        .mockResolvedValueOnce({
          transactions: [{ ...mockTransaction, id: 'tx-1' }],
          total: 100,
          hasMore: true,
        })
        .mockRejectedValueOnce(new ApiError('Network error', 'NETWORK_ERROR', 0));

      useTransactionsStore.getState().setFilters({ accountId: 'acc-1' });
      await useTransactionsStore.getState().fetchTransactions();
      await useTransactionsStore.getState().fetchMoreTransactions();

      expect(useTransactionsStore.getState().offset).toBe(0);
    });
  });

  describe('createTransaction', () => {
    it('creates transaction, fetches full data, and adds to list', async () => {
      // API returns only { id } on create, then we fetch full transaction
      mockApiPost.mockResolvedValue({ id: 'tx-1' });
      mockApiGet.mockResolvedValue(mockTransaction);

      useTransactionsStore.getState().setFilters({ accountId: 'acc-1' });
      const result = await useTransactionsStore.getState().createTransaction({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: 'EXPENSE',
        amount: 50,
        currency: 'USD',
        date: '2026-01-15',
      });

      expect(mockApiPost).toHaveBeenCalledWith('/transactions', expect.any(Object), 'test-token');
      expect(mockApiGet).toHaveBeenCalledWith('/transactions/tx-1', 'test-token');
      expect(result).toEqual(mockTransaction);
      const state = useTransactionsStore.getState();
      expect(state.transactions[0]).toEqual(mockTransaction);
      expect(state.total).toBe(1);
    });

    it('throws error on API failure', async () => {
      mockApiPost.mockRejectedValue(new ApiError('Validation error', 'VALIDATION_ERROR', 400));

      await expect(
        useTransactionsStore.getState().createTransaction({
          accountId: 'acc-1',
          categoryId: 'cat-1',
          type: 'EXPENSE',
          amount: -50,
          currency: 'USD',
          date: '2026-01-15',
        })
      ).rejects.toThrow(ApiError);
    });
  });

  describe('updateTransaction', () => {
    beforeEach(() => {
      useTransactionsStore.setState({ transactions: [mockTransaction] });
    });

    it('updates transaction, fetches full data, and updates in list', async () => {
      const updated = { ...mockTransaction, description: 'Updated' };
      // API returns only { id } on update, then we fetch full transaction
      mockApiPut.mockResolvedValue({ id: 'tx-1' });
      mockApiGet.mockResolvedValue(updated);

      const result = await useTransactionsStore.getState().updateTransaction({
        id: 'tx-1',
        description: 'Updated',
      });

      expect(mockApiPut).toHaveBeenCalledWith('/transactions/tx-1', { description: 'Updated' }, 'test-token');
      expect(mockApiGet).toHaveBeenCalledWith('/transactions/tx-1', 'test-token');
      expect(result).toEqual(updated);
      const state = useTransactionsStore.getState();
      expect(state.transactions[0].description).toBe('Updated');
    });

    it('throws error on API failure', async () => {
      mockApiPut.mockRejectedValue(new ApiError('Not found', 'NOT_FOUND', 404));

      await expect(
        useTransactionsStore.getState().updateTransaction({
          id: 'invalid',
          description: 'Test',
        })
      ).rejects.toThrow(ApiError);
    });
  });

  describe('deleteTransaction', () => {
    beforeEach(() => {
      useTransactionsStore.setState({
        transactions: [mockTransaction],
        total: 1,
      });
    });

    it('removes transaction from list', async () => {
      mockApiDelete.mockResolvedValue({ message: 'Deleted' });

      await useTransactionsStore.getState().deleteTransaction('tx-1');

      const state = useTransactionsStore.getState();
      expect(state.transactions).toHaveLength(0);
      expect(state.total).toBe(0);
    });

    it('throws error on API failure', async () => {
      mockApiDelete.mockRejectedValue(new ApiError('Not found', 'NOT_FOUND', 404));

      await expect(
        useTransactionsStore.getState().deleteTransaction('invalid')
      ).rejects.toThrow(ApiError);
    });
  });

  describe('setFilters', () => {
    it('updates filters', () => {
      useTransactionsStore.getState().setFilters({
        accountId: 'acc-1',
        month: '2026-01',
      });

      const state = useTransactionsStore.getState();
      expect(state.filters.accountId).toBe('acc-1');
      expect(state.filters.month).toBe('2026-01');
    });

    it('merges with existing filters', () => {
      useTransactionsStore.getState().setFilters({ accountId: 'acc-1' });
      useTransactionsStore.getState().setFilters({ type: 'EXPENSE' });

      const state = useTransactionsStore.getState();
      expect(state.filters.accountId).toBe('acc-1');
      expect(state.filters.type).toBe('EXPENSE');
    });
  });

  describe('clearError', () => {
    it('clears error', () => {
      useTransactionsStore.setState({ error: 'Some error' });

      useTransactionsStore.getState().clearError();

      expect(useTransactionsStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets to initial state', () => {
      useTransactionsStore.setState({
        transactions: [mockTransaction],
        total: 1,
        error: 'Error',
        filters: { accountId: 'acc-1', month: '2026-01' },
      });

      useTransactionsStore.getState().reset();

      const state = useTransactionsStore.getState();
      expect(state.transactions).toEqual([]);
      expect(state.total).toBe(0);
      expect(state.error).toBeNull();
      expect(state.filters.accountId).toBe('');
    });
  });
});
