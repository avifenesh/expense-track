import { useBudgetsStore } from '../../src/stores/budgetsStore';
import { useAuthStore } from '../../src/stores/authStore';
import { ApiError, apiGet, apiPost, apiDelete } from '../../src/services/api';

jest.mock('../../src/services/api', () => {
  const actual = jest.requireActual('../../src/services/api');
  return {
    ...actual,
    apiGet: jest.fn(),
    apiPost: jest.fn(),
    apiDelete: jest.fn(),
  };
});

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;
const mockApiDelete = apiDelete as jest.MockedFunction<typeof apiDelete>;

const mockBudget = {
  id: 'budget-1',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  month: '2026-01-01',
  planned: '500.00',
  currency: 'USD' as const,
  notes: 'Monthly food budget',
  category: {
    id: 'cat-1',
    name: 'Food',
    type: 'EXPENSE' as const,
    color: '#4CAF50',
  },
};

describe('budgetsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useBudgetsStore.getState().reset();
    useAuthStore.setState({ accessToken: 'test-token' });
  });

  describe('initial state', () => {
    it('has correct initial values', () => {
      const state = useBudgetsStore.getState();
      expect(state.budgets).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.filters.accountId).toBe('');
      expect(state.selectedMonth).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('fetchBudgets', () => {
    it('fetches budgets successfully', async () => {
      mockApiGet.mockResolvedValue({ budgets: [mockBudget] });

      useBudgetsStore.getState().setFilters({ accountId: 'acc-1' });
      await useBudgetsStore.getState().fetchBudgets();

      const state = useBudgetsStore.getState();
      expect(state.budgets).toHaveLength(1);
      expect(state.budgets[0]).toEqual(mockBudget);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('applies filters to API request', async () => {
      mockApiGet.mockResolvedValue({ budgets: [] });

      useBudgetsStore.getState().setFilters({ accountId: 'acc-1' });
      useBudgetsStore.getState().setSelectedMonth('2026-02');
      await useBudgetsStore.getState().fetchBudgets();

      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('accountId=acc-1'),
        'test-token'
      );
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('month=2026-02'),
        'test-token'
      );
    });

    it('sets error when accountId is missing', async () => {
      await useBudgetsStore.getState().fetchBudgets();

      const state = useBudgetsStore.getState();
      expect(state.error).toBe('Account ID is required');
      expect(mockApiGet).not.toHaveBeenCalled();
    });

    it('handles API errors', async () => {
      mockApiGet.mockRejectedValue(new ApiError('Server error', 'SERVER_ERROR', 500));

      useBudgetsStore.getState().setFilters({ accountId: 'acc-1' });
      await useBudgetsStore.getState().fetchBudgets();

      const state = useBudgetsStore.getState();
      expect(state.error).toBe('Server error');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('createOrUpdateBudget', () => {
    it('creates new budget and adds to list', async () => {
      mockApiPost.mockResolvedValue(mockBudget);

      const result = await useBudgetsStore.getState().createOrUpdateBudget({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        monthKey: '2026-01',
        planned: 500,
        currency: 'USD',
      });

      expect(result).toEqual(mockBudget);
      const state = useBudgetsStore.getState();
      expect(state.budgets).toHaveLength(1);
    });

    it('updates existing budget in list', async () => {
      useBudgetsStore.setState({ budgets: [mockBudget] });
      const updatedBudget = { ...mockBudget, planned: '600.00' };
      mockApiPost.mockResolvedValue(updatedBudget);

      await useBudgetsStore.getState().createOrUpdateBudget({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        monthKey: '2026-01',
        planned: 600,
        currency: 'USD',
      });

      const state = useBudgetsStore.getState();
      expect(state.budgets).toHaveLength(1);
      expect(state.budgets[0].planned).toBe('600.00');
    });

    it('throws error on API failure', async () => {
      mockApiPost.mockRejectedValue(new ApiError('Validation error', 'VALIDATION_ERROR', 400));

      await expect(
        useBudgetsStore.getState().createOrUpdateBudget({
          accountId: 'acc-1',
          categoryId: 'cat-1',
          monthKey: '2026-01',
          planned: -500,
          currency: 'USD',
        })
      ).rejects.toThrow(ApiError);
    });

    it('wraps non-API errors', async () => {
      mockApiPost.mockRejectedValue(new Error('Network error'));

      await expect(
        useBudgetsStore.getState().createOrUpdateBudget({
          accountId: 'acc-1',
          categoryId: 'cat-1',
          monthKey: '2026-01',
          planned: 500,
          currency: 'USD',
        })
      ).rejects.toMatchObject({
        message: 'Failed to save budget',
        code: 'SAVE_FAILED',
      });
    });
  });

  describe('deleteBudget', () => {
    beforeEach(() => {
      useBudgetsStore.setState({ budgets: [mockBudget] });
    });

    it('removes budget from list with YYYY-MM-01 month format', async () => {
      mockApiDelete.mockResolvedValue({ message: 'Deleted' });

      // Budget has month '2026-01-01', pass monthKey '2026-01'
      await useBudgetsStore.getState().deleteBudget('acc-1', 'cat-1', '2026-01');

      const state = useBudgetsStore.getState();
      expect(state.budgets).toHaveLength(0);
    });

    it('constructs correct API URL with monthKey param', async () => {
      mockApiDelete.mockResolvedValue({ message: 'Deleted' });

      await useBudgetsStore.getState().deleteBudget('acc-1', 'cat-1', '2026-01');

      expect(mockApiDelete).toHaveBeenCalledWith(
        expect.stringContaining('accountId=acc-1'),
        'test-token'
      );
      expect(mockApiDelete).toHaveBeenCalledWith(
        expect.stringContaining('categoryId=cat-1'),
        'test-token'
      );
      expect(mockApiDelete).toHaveBeenCalledWith(
        expect.stringContaining('monthKey=2026-01'),
        'test-token'
      );
    });

    it('throws error on API failure', async () => {
      mockApiDelete.mockRejectedValue(new ApiError('Not found', 'NOT_FOUND', 404));

      await expect(
        useBudgetsStore.getState().deleteBudget('invalid', 'cat-1', '2026-01')
      ).rejects.toThrow(ApiError);
    });

    it('wraps non-API errors', async () => {
      mockApiDelete.mockRejectedValue(new Error('Network error'));

      await expect(
        useBudgetsStore.getState().deleteBudget('acc-1', 'cat-1', '2026-01')
      ).rejects.toMatchObject({
        message: 'Failed to delete budget',
        code: 'DELETE_FAILED',
      });
    });
  });

  describe('setFilters', () => {
    it('updates filters', () => {
      useBudgetsStore.getState().setFilters({
        accountId: 'acc-1',
        month: '2026-01',
      });

      const state = useBudgetsStore.getState();
      expect(state.filters.accountId).toBe('acc-1');
      expect(state.filters.month).toBe('2026-01');
    });

    it('merges with existing filters', () => {
      useBudgetsStore.getState().setFilters({ accountId: 'acc-1' });
      useBudgetsStore.getState().setFilters({ month: '2026-02' });

      const state = useBudgetsStore.getState();
      expect(state.filters.accountId).toBe('acc-1');
      expect(state.filters.month).toBe('2026-02');
    });
  });

  describe('setSelectedMonth', () => {
    it('updates selected month', () => {
      useBudgetsStore.getState().setSelectedMonth('2026-03');

      expect(useBudgetsStore.getState().selectedMonth).toBe('2026-03');
    });
  });

  describe('clearError', () => {
    it('clears error', () => {
      useBudgetsStore.setState({ error: 'Some error' });

      useBudgetsStore.getState().clearError();

      expect(useBudgetsStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets to initial state', () => {
      useBudgetsStore.setState({
        budgets: [mockBudget],
        error: 'Error',
        filters: { accountId: 'acc-1' },
        selectedMonth: '2025-12',
      });

      useBudgetsStore.getState().reset();

      const state = useBudgetsStore.getState();
      expect(state.budgets).toEqual([]);
      expect(state.error).toBeNull();
      expect(state.filters.accountId).toBe('');
    });
  });
});
