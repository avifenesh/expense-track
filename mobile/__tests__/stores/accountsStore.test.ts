import { useAccountsStore } from '../../src/stores/accountsStore';
import { useAuthStore } from '../../src/stores/authStore';
import { ApiError, apiGet, apiPatch } from '../../src/services/api';

jest.mock('../../src/services/api');

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockApiPatch = apiPatch as jest.MockedFunction<typeof apiPatch>;

const mockAccount = {
  id: 'acc-1',
  name: 'Personal Account',
  type: 'SELF' as const,
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
      expect(state.activeAccountId).toBeNull();
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
      expect(state.accounts[0]).toEqual({ ...mockAccount, type: 'PERSONAL' });
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('auto-selects first account when none selected', async () => {
      mockApiGet.mockResolvedValue({
        accounts: [mockAccount, { ...mockAccount, id: 'acc-2', name: 'Second Account' }],
      });

      await useAccountsStore.getState().fetchAccounts();

      const state = useAccountsStore.getState();
      expect(state.activeAccountId).toBe('acc-1');
    });

    it('preserves selected account if still exists', async () => {
      useAccountsStore.setState({ activeAccountId: 'acc-2' });
      mockApiGet.mockResolvedValue({
        accounts: [mockAccount, { ...mockAccount, id: 'acc-2', name: 'Second Account' }],
      });

      await useAccountsStore.getState().fetchAccounts();

      const state = useAccountsStore.getState();
      expect(state.activeAccountId).toBe('acc-2');
    });

    it('selects first account if selected account no longer exists', async () => {
      useAccountsStore.setState({ activeAccountId: 'deleted-account' });
      mockApiGet.mockResolvedValue({
        accounts: [mockAccount],
      });

      await useAccountsStore.getState().fetchAccounts();

      const state = useAccountsStore.getState();
      expect(state.activeAccountId).toBe('acc-1');
    });

    it('sets activeAccountId to null when no accounts returned', async () => {
      mockApiGet.mockResolvedValue({ accounts: [] });

      await useAccountsStore.getState().fetchAccounts();

      const state = useAccountsStore.getState();
      expect(state.activeAccountId).toBeNull();
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

  describe('setActiveAccount', () => {
    it('sets selected account ID and calls API', async () => {
      mockApiPatch.mockResolvedValue({ activeAccountId: 'acc-123' });

      const result = await useAccountsStore.getState().setActiveAccount('acc-123');

      expect(result).toBe(true);
      expect(mockApiPatch).toHaveBeenCalledWith('/accounts/acc-123/activate', {}, 'test-token');
      const state = useAccountsStore.getState();
      expect(state.activeAccountId).toBe('acc-123');
    });

    it('allows setting to null without API call', async () => {
      useAccountsStore.setState({ activeAccountId: 'acc-1' });

      const result = await useAccountsStore.getState().setActiveAccount(null);

      expect(result).toBe(true);
      expect(mockApiPatch).not.toHaveBeenCalled();
      const state = useAccountsStore.getState();
      expect(state.activeAccountId).toBeNull();
    });

    it('handles API errors', async () => {
      mockApiPatch.mockRejectedValue(new ApiError('Activation failed', 'ACTIVATION_ERROR', 500));

      const result = await useAccountsStore.getState().setActiveAccount('acc-123');

      expect(result).toBe(false);
      const state = useAccountsStore.getState();
      expect(state.error).toBe('Activation failed');
    });

    it('handles generic errors', async () => {
      mockApiPatch.mockRejectedValue(new Error('Network error'));

      const result = await useAccountsStore.getState().setActiveAccount('acc-123');

      expect(result).toBe(false);
      const state = useAccountsStore.getState();
      expect(state.error).toBe('Failed to activate account');
    });
  });

  describe('getActiveAccount', () => {
    it('returns active account when it exists', () => {
      useAccountsStore.setState({
        accounts: [
          { ...mockAccount, type: 'PERSONAL' },
          { ...mockAccount, id: 'acc-2', name: 'Second Account', type: 'SHARED' },
        ],
        activeAccountId: 'acc-2',
      });

      const account = useAccountsStore.getState().getActiveAccount();

      expect(account).toEqual({ ...mockAccount, id: 'acc-2', name: 'Second Account', type: 'SHARED' });
    });

    it('returns undefined when no account is active', () => {
      useAccountsStore.setState({
        accounts: [{ ...mockAccount, type: 'PERSONAL' }],
        activeAccountId: null,
      });

      const account = useAccountsStore.getState().getActiveAccount();

      expect(account).toBeUndefined();
    });

    it('returns undefined when active account not in list', () => {
      useAccountsStore.setState({
        accounts: [{ ...mockAccount, type: 'PERSONAL' }],
        activeAccountId: 'non-existent',
      });

      const account = useAccountsStore.getState().getActiveAccount();

      expect(account).toBeUndefined();
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
        activeAccountId: 'acc-1',
        error: 'Error',
        isLoading: true,
      });

      useAccountsStore.getState().reset();

      const state = useAccountsStore.getState();
      expect(state.accounts).toEqual([]);
      expect(state.activeAccountId).toBeNull();
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });
});
