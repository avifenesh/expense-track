import { create } from 'zustand';
import { apiGet, apiPatch, apiPut, apiDelete, ApiError } from '../services/api';
import { useAuthStore } from './authStore';
import { registerStoreReset } from './storeRegistry';
import type { Currency } from '../types';

export type AccountType = 'PERSONAL' | 'SHARED';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  preferredCurrency: Currency | null;
  color: string | null;
  icon: string | null;
  description: string | null;
  balance: number;
}

interface AccountsResponse {
  accounts: Array<{
    id: string;
    name: string;
    type: 'SELF' | 'PARTNER' | 'OTHER';
    preferredCurrency: Currency | null;
    color: string | null;
    icon: string | null;
    description: string | null;
    balance: number;
  }>;
}

interface AccountsState {
  accounts: Account[];
  activeAccountId: string | null;
  isLoading: boolean;
  error: string | null;
}

interface AccountsActions {
  fetchAccounts: () => Promise<boolean>;
  setActiveAccount: (accountId: string | null) => Promise<boolean>;
  updateAccount: (id: string, name: string) => Promise<boolean>;
  deleteAccount: (id: string) => Promise<boolean>;
  getActiveAccount: () => Account | undefined;
  clearError: () => void;
  reset: () => void;
}

export type AccountsStore = AccountsState & AccountsActions;

const initialState: AccountsState = {
  accounts: [],
  activeAccountId: null,
  isLoading: false,
  error: null,
};

function mapAccountType(dbType: 'SELF' | 'PARTNER' | 'OTHER'): AccountType {
  return dbType === 'SELF' ? 'PERSONAL' : 'SHARED';
}

export const useAccountsStore = create<AccountsStore>((set, get) => ({
  ...initialState,

  fetchAccounts: async () => {
    const accessToken = useAuthStore.getState().accessToken;

    set({ isLoading: true, error: null });

    try {
      const response = await apiGet<AccountsResponse>('/accounts', accessToken);

      const accounts = response.accounts.map((acc) => ({
        ...acc,
        type: mapAccountType(acc.type),
      }));

      const { activeAccountId } = get();

      const newActiveId =
        activeAccountId && accounts.some((a) => a.id === activeAccountId)
          ? activeAccountId
          : accounts.length > 0
            ? accounts[0].id
            : null;

      set({
        accounts,
        activeAccountId: newActiveId,
        isLoading: false,
      });

      return true;
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Failed to fetch accounts';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  setActiveAccount: async (accountId: string | null) => {
    const accessToken = useAuthStore.getState().accessToken;

    if (!accountId) {
      set({ activeAccountId: null });
      return true;
    }

    set({ isLoading: true, error: null });

    try {
      await apiPatch(`/accounts/${accountId}/activate`, {}, accessToken);
      set({ activeAccountId: accountId, isLoading: false });
      return true;
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Failed to activate account';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  updateAccount: async (id: string, name: string) => {
    const accessToken = useAuthStore.getState().accessToken;

    set({ isLoading: true, error: null });

    try {
      const updated = await apiPut<{ id: string; name: string }>(`/accounts/${id}`, { name }, accessToken);
      const { accounts } = get();
      set({
        accounts: accounts.map((acc) => (acc.id === id ? { ...acc, name: updated.name } : acc)),
        isLoading: false,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Failed to update account';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  deleteAccount: async (id: string) => {
    const accessToken = useAuthStore.getState().accessToken;

    set({ isLoading: true, error: null });

    try {
      await apiDelete(`/accounts/${id}`, accessToken);
      const { accounts, activeAccountId } = get();
      const remainingAccounts = accounts.filter((acc) => acc.id !== id);

      // If the deleted account was active, select the first remaining account
      const newActiveId = activeAccountId === id
        ? (remainingAccounts.length > 0 ? remainingAccounts[0].id : null)
        : activeAccountId;

      set({
        accounts: remainingAccounts,
        activeAccountId: newActiveId,
        isLoading: false,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Failed to delete account';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  getActiveAccount: () => {
    const { accounts, activeAccountId } = get();
    return accounts.find((acc) => acc.id === activeAccountId);
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({ ...initialState });
  },
}));

// Register for cleanup on logout
registerStoreReset(() => useAccountsStore.getState().reset());
