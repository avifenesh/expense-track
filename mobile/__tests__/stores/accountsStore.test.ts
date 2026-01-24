import { useAccountsStore } from '../../src/stores/accountsStore';
import { useAuthStore } from '../../src/stores/authStore';
import { ApiError, apiGet, apiPatch, apiPost, apiPut, apiDelete } from '../../src/services/api';

jest.mock('../../src/services/api', () => {
  const actual = jest.requireActual('../../src/services/api');
  return {
    ...actual,
    apiGet: jest.fn(),
    apiPatch: jest.fn(),
    apiPost: jest.fn(),
    apiPut: jest.fn(),
    apiDelete: jest.fn(),
  };
});

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockApiPatch = apiPatch as jest.MockedFunction<typeof apiPatch>;
const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;
const mockApiPut = apiPut as jest.MockedFunction<typeof apiPut>;
const mockApiDelete = apiDelete as jest.MockedFunction<typeof apiDelete>;

const mockAccount = {
  id: 'acc-1',
  name: 'Personal Account',
  type: 'SELF' as const,
  preferredCurrency: 'USD' as const,
  color: '#4CAF50',
  icon: 'wallet',
  description: 'My personal finances',
  balance: 1000,
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

  describe('createAccount', () => {
    it('creates account successfully', async () => {
      useAccountsStore.setState({
        accounts: [{ ...mockAccount, type: 'PERSONAL' }],
        activeAccountId: 'acc-1',
      });
      mockApiPost.mockResolvedValue({
        id: 'acc-new',
        name: 'New Account',
        type: 'PARTNER',
        preferredCurrency: 'EUR',
        color: '#0000FF',
        icon: null,
        description: null,
      });

      const result = await useAccountsStore.getState().createAccount({
        name: 'New Account',
        type: 'PARTNER',
        color: '#0000FF',
        preferredCurrency: 'EUR',
      });

      expect(result).toBe(true);
      expect(mockApiPost).toHaveBeenCalledWith(
        '/accounts',
        { name: 'New Account', type: 'PARTNER', color: '#0000FF', preferredCurrency: 'EUR' },
        'test-token'
      );
      const state = useAccountsStore.getState();
      expect(state.accounts).toHaveLength(2);
      expect(state.accounts[1].id).toBe('acc-new');
      expect(state.accounts[1].name).toBe('New Account');
      expect(state.accounts[1].type).toBe('SHARED');
      expect(state.accounts[1].balance).toBe(0);
      expect(state.isLoading).toBe(false);
    });

    it('creates SELF account as PERSONAL type', async () => {
      useAccountsStore.setState({ accounts: [] });
      mockApiPost.mockResolvedValue({
        id: 'acc-self',
        name: 'Personal',
        type: 'SELF',
        preferredCurrency: null,
        color: null,
        icon: null,
        description: null,
      });

      await useAccountsStore.getState().createAccount({
        name: 'Personal',
        type: 'SELF',
      });

      const state = useAccountsStore.getState();
      expect(state.accounts[0].type).toBe('PERSONAL');
    });

    it('handles API errors', async () => {
      mockApiPost.mockRejectedValue(new ApiError('Name already exists', 'CONFLICT', 400));

      const result = await useAccountsStore.getState().createAccount({
        name: 'Duplicate',
        type: 'SELF',
      });

      expect(result).toBe(false);
      const state = useAccountsStore.getState();
      expect(state.error).toBe('Name already exists');
    });

    it('handles generic errors', async () => {
      mockApiPost.mockRejectedValue(new Error('Network error'));

      const result = await useAccountsStore.getState().createAccount({
        name: 'New',
        type: 'SELF',
      });

      expect(result).toBe(false);
      const state = useAccountsStore.getState();
      expect(state.error).toBe('Failed to create account');
    });

    it('sets isLoading during create', async () => {
      let loadingDuringCreate = false;
      mockApiPost.mockImplementation(async () => {
        loadingDuringCreate = useAccountsStore.getState().isLoading;
        return {
          id: 'acc-new',
          name: 'New',
          type: 'SELF',
          preferredCurrency: null,
          color: null,
          icon: null,
          description: null,
        };
      });

      await useAccountsStore.getState().createAccount({ name: 'New', type: 'SELF' });

      expect(loadingDuringCreate).toBe(true);
      expect(useAccountsStore.getState().isLoading).toBe(false);
    });
  });

  describe('updateAccount', () => {
    it('updates account with all fields successfully', async () => {
      useAccountsStore.setState({
        accounts: [{ ...mockAccount, type: 'PERSONAL' }],
        activeAccountId: 'acc-1',
      });
      mockApiPut.mockResolvedValue({
        id: 'acc-1',
        name: 'Updated Name',
        type: 'PARTNER',
        preferredCurrency: 'EUR',
        color: '#0000FF',
        icon: null,
        description: null,
      });

      const result = await useAccountsStore.getState().updateAccount('acc-1', {
        name: 'Updated Name',
        type: 'PARTNER',
        color: '#0000FF',
        preferredCurrency: 'EUR',
      });

      expect(result).toBe(true);
      expect(mockApiPut).toHaveBeenCalledWith(
        '/accounts/acc-1',
        { name: 'Updated Name', type: 'PARTNER', color: '#0000FF', preferredCurrency: 'EUR' },
        'test-token'
      );
      const state = useAccountsStore.getState();
      expect(state.accounts[0].name).toBe('Updated Name');
      expect(state.accounts[0].type).toBe('SHARED');
      expect(state.accounts[0].color).toBe('#0000FF');
      expect(state.accounts[0].preferredCurrency).toBe('EUR');
      expect(state.isLoading).toBe(false);
    });

    it('updates account name only', async () => {
      useAccountsStore.setState({
        accounts: [{ ...mockAccount, type: 'PERSONAL' }],
        activeAccountId: 'acc-1',
      });
      mockApiPut.mockResolvedValue({
        id: 'acc-1',
        name: 'New Name',
        type: 'SELF',
        preferredCurrency: 'USD',
        color: '#4CAF50',
        icon: 'wallet',
        description: 'My personal finances',
      });

      const result = await useAccountsStore.getState().updateAccount('acc-1', { name: 'New Name' });

      expect(result).toBe(true);
      expect(mockApiPut).toHaveBeenCalledWith('/accounts/acc-1', { name: 'New Name' }, 'test-token');
    });

    it('handles API errors', async () => {
      useAccountsStore.setState({
        accounts: [{ ...mockAccount, type: 'PERSONAL' }],
      });
      mockApiPut.mockRejectedValue(new ApiError('Name already exists', 'CONFLICT', 400));

      const result = await useAccountsStore.getState().updateAccount('acc-1', { name: 'Duplicate Name' });

      expect(result).toBe(false);
      const state = useAccountsStore.getState();
      expect(state.error).toBe('Name already exists');
    });

    it('handles generic errors', async () => {
      mockApiPut.mockRejectedValue(new Error('Network error'));

      const result = await useAccountsStore.getState().updateAccount('acc-1', { name: 'New Name' });

      expect(result).toBe(false);
      const state = useAccountsStore.getState();
      expect(state.error).toBe('Failed to update account');
    });

    it('sets isLoading during update', async () => {
      let loadingDuringUpdate = false;
      mockApiPut.mockImplementation(async () => {
        loadingDuringUpdate = useAccountsStore.getState().isLoading;
        return {
          id: 'acc-1',
          name: 'Updated',
          type: 'SELF',
          preferredCurrency: null,
          color: null,
          icon: null,
          description: null,
        };
      });

      await useAccountsStore.getState().updateAccount('acc-1', { name: 'Updated' });

      expect(loadingDuringUpdate).toBe(true);
      expect(useAccountsStore.getState().isLoading).toBe(false);
    });
  });

  describe('deleteAccount', () => {
    it('deletes account successfully', async () => {
      useAccountsStore.setState({
        accounts: [
          { ...mockAccount, type: 'PERSONAL' },
          { ...mockAccount, id: 'acc-2', name: 'Second', type: 'SHARED' },
        ],
        activeAccountId: 'acc-1',
      });
      mockApiDelete.mockResolvedValue({ deleted: true });

      const result = await useAccountsStore.getState().deleteAccount('acc-2');

      expect(result).toBe(true);
      expect(mockApiDelete).toHaveBeenCalledWith('/accounts/acc-2', 'test-token');
      const state = useAccountsStore.getState();
      expect(state.accounts).toHaveLength(1);
      expect(state.accounts.find((a) => a.id === 'acc-2')).toBeUndefined();
    });

    it('preserves activeAccountId when deleting non-active account', async () => {
      useAccountsStore.setState({
        accounts: [
          { ...mockAccount, type: 'PERSONAL' },
          { ...mockAccount, id: 'acc-2', name: 'Second', type: 'SHARED' },
        ],
        activeAccountId: 'acc-1',
      });
      mockApiDelete.mockResolvedValue({ deleted: true });

      await useAccountsStore.getState().deleteAccount('acc-2');

      const state = useAccountsStore.getState();
      expect(state.activeAccountId).toBe('acc-1');
      expect(state.accounts).toHaveLength(1);
    });

    it('handles API errors', async () => {
      useAccountsStore.setState({
        accounts: [{ ...mockAccount, type: 'PERSONAL' }],
      });
      mockApiDelete.mockRejectedValue(new ApiError('Cannot delete only account', 'VALIDATION_ERROR', 400));

      const result = await useAccountsStore.getState().deleteAccount('acc-1');

      expect(result).toBe(false);
      const state = useAccountsStore.getState();
      expect(state.error).toBe('Cannot delete only account');
    });

    it('handles generic errors', async () => {
      mockApiDelete.mockRejectedValue(new Error('Network error'));

      const result = await useAccountsStore.getState().deleteAccount('acc-1');

      expect(result).toBe(false);
      const state = useAccountsStore.getState();
      expect(state.error).toBe('Failed to delete account');
    });

    it('sets isLoading during delete', async () => {
      let loadingDuringDelete = false;
      mockApiDelete.mockImplementation(async () => {
        loadingDuringDelete = useAccountsStore.getState().isLoading;
        return { deleted: true };
      });

      await useAccountsStore.getState().deleteAccount('acc-1');

      expect(loadingDuringDelete).toBe(true);
      expect(useAccountsStore.getState().isLoading).toBe(false);
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
