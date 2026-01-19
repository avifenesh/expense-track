import { create } from 'zustand';
import { apiGet, ApiError } from '../services/api';
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
}

interface AccountsResponse {
  accounts: Account[];
}

interface AccountsState {
  accounts: Account[];
  selectedAccountId: string | null;
  isLoading: boolean;
  error: string | null;
}

interface AccountsActions {
  fetchAccounts: () => Promise<boolean>;
  setSelectedAccount: (accountId: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

export type AccountsStore = AccountsState & AccountsActions;

const initialState: AccountsState = {
  accounts: [],
  selectedAccountId: null,
  isLoading: false,
  error: null,
};

export const useAccountsStore = create<AccountsStore>((set, get) => ({
  ...initialState,

  fetchAccounts: async () => {
    const accessToken = useAuthStore.getState().accessToken;

    set({ isLoading: true, error: null });

    try {
      const response = await apiGet<AccountsResponse>('/accounts', accessToken);

      const accounts = response.accounts;
      const { selectedAccountId } = get();

      // Auto-select first account if none selected
      const newSelectedId =
        selectedAccountId && accounts.some((a) => a.id === selectedAccountId)
          ? selectedAccountId
          : accounts.length > 0
            ? accounts[0].id
            : null;

      set({
        accounts,
        selectedAccountId: newSelectedId,
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

  setSelectedAccount: (accountId: string | null) => {
    set({ selectedAccountId: accountId });
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
