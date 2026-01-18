import { useAccountsStore } from '../../src/stores/accountsStore';
import { useAuthStore } from '../../src/stores/authStore';
import { ApiError, apiGet } from '../../src/services/api';

jest.mock('../../src/services/api');

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;

const mockAccount = {
  id: 'acc-1',
  name: 'Personal Account',
  type: 'PERSONAL' as const,
  preferredCurrency: 'USD' as const,
  color: '#4CAF50',
  icon: 'wallet',
  description: 'My personal finances',
};

describe('accountsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAccountsStore.getState().reset();
    useAuthStore.setState({ accessToken: 'test-token' });
  });

  describe('initial state', () => {
    it('has correct initial values', () => {
      const state = useAccountsStore.getState();
      expect(state.accounts).toEqual([]);
      expect(state.selectedAccountId).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchAccounts', () => {
    it('fetches accounts successfully and returns true', async () => {
      mockApiGet.mockResolvedValue({
        accounts: [mockAccount],
      });

      const result = await useAccountsStore.getState().fetchAccounts();

      expect(result).toBe(true);
      const state = useAccountsStore.getState();
      expect(state.accounts).toHaveLength(1);
      expect(state.accounts[0]).toEqual(mockAccount);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('auto-selects first account when none selected', async () => {
      mockApiGet.mockResolvedValue({
        accounts: [mockAccount, { ...mockAccount, id: 'acc-2', name: 'Second Account' }],
      });

      await useAccountsStore.getState().fetchAccounts();

      const state = useAccountsStore.getState();
      expect(state.selectedAccountId).toBe('acc-1');
    });

    it('preserves selected account if still exists', async () => {
      useAccountsStore.setState({ selectedAccountId: 'acc-2' });
      mockApiGet.mockResolvedValue({
        accounts: [mockAccount, { ...mockAccount, id: 'acc-2', name: 'Second Account' }],
      });

      await useAccountsStore.getState().fetchAccounts();

      const state = useAccountsStore.getState();
      expect(state.selectedAccountId).toBe('acc-2');
    });

    it('selects first account if selected account no longer exists', async () => {
      useAccountsStore.setState({ selectedAccountId: 'deleted-account' });
      mockApiGet.mockResolvedValue({
        accounts: [mockAccount],
      });

      await useAccountsStore.getState().fetchAccounts();

      const state = useAccountsStore.getState();
      expect(state.selectedAccountId).toBe('acc-1');
    });

    it('sets selectedAccountId to null when no accounts returned', async () => {
      mockApiGet.mockResolvedValue({ accounts: [] });

      await useAccountsStore.getState().fetchAccounts();

      const state = useAccountsStore.getState();
      expect(state.selectedAccountId).toBeNull();
    });

    it('handles API errors and returns false', async () => {
      mockApiGet.mockRejectedValue(new ApiError('Server error', 'SERVER_ERROR', 500));

      const result = await useAccountsStore.getState().fetchAccounts();

      expect(result).toBe(false);
      const state = useAccountsStore.getState();
      expect(state.error).toBe('Server error');
      expect(state.isLoading).toBe(false);
    });

    it('handles generic errors', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'));

      const result = await useAccountsStore.getState().fetchAccounts();

      expect(result).toBe(false);
      const state = useAccountsStore.getState();
      expect(state.error).toBe('Failed to fetch accounts');
    });

    it('sets isLoading during fetch', async () => {
      let loadingDuringFetch = false;
      mockApiGet.mockImplementation(async () => {
        loadingDuringFetch = useAccountsStore.getState().isLoading;
        return { accounts: [mockAccount] };
      });

      await useAccountsStore.getState().fetchAccounts();

      expect(loadingDuringFetch).toBe(true);
      expect(useAccountsStore.getState().isLoading).toBe(false);
    });

    it('calls the correct API endpoint', async () => {
      mockApiGet.mockResolvedValue({ accounts: [] });

      await useAccountsStore.getState().fetchAccounts();

      expect(mockApiGet).toHaveBeenCalledWith('/accounts', 'test-token');
    });
  });

  describe('setSelectedAccount', () => {
    it('sets selected account ID', () => {
      useAccountsStore.getState().setSelectedAccount('acc-123');

      const state = useAccountsStore.getState();
      expect(state.selectedAccountId).toBe('acc-123');
    });

    it('allows setting to null', () => {
      useAccountsStore.setState({ selectedAccountId: 'acc-1' });

      useAccountsStore.getState().setSelectedAccount(null);

      const state = useAccountsStore.getState();
      expect(state.selectedAccountId).toBeNull();
    });
  });

  describe('clearError', () => {
    it('clears error', () => {
      useAccountsStore.setState({ error: 'Some error' });

      useAccountsStore.getState().clearError();

      expect(useAccountsStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets to initial state', () => {
      useAccountsStore.setState({
        accounts: [mockAccount],
        selectedAccountId: 'acc-1',
        error: 'Error',
        isLoading: true,
      });

      useAccountsStore.getState().reset();

      const state = useAccountsStore.getState();
      expect(state.accounts).toEqual([]);
      expect(state.selectedAccountId).toBeNull();
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });
});
