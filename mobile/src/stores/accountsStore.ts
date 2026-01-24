import { create } from 'zustand';
import { apiGet, apiPatch, apiPost, apiPut, apiDelete, ApiError } from '../services/api';
import { useAuthStore } from './authStore';
import { registerStoreReset } from './storeRegistry';
import type { Currency } from '../types';

export type AccountType = 'PERSONAL' | 'SHARED';
export type DbAccountType = 'SELF' | 'PARTNER' | 'OTHER';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  dbType: DbAccountType;
  preferredCurrency: Currency | null;
  color: string | null;
  icon: string | null;
  description: string | null;
  balance: number;
}

export interface CreateAccountData {
  name: string;
  type: DbAccountType;
  color?: string | null;
  preferredCurrency?: Currency | null;
}

export interface UpdateAccountData {
  name: string;
  type?: DbAccountType;
  color?: string | null;
  preferredCurrency?: Currency | null;
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
  createAccount: (data: CreateAccountData) => Promise<boolean>;
  updateAccount: (id: string, data: UpdateAccountData) => Promise<boolean>;
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
        dbType: acc.type,
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

  createAccount: async (data: CreateAccountData) => {
    const accessToken = useAuthStore.getState().accessToken;

    set({ isLoading: true, error: null });

    try {
      const created = await apiPost<{
        id: string;
        name: string;
        type: 'SELF' | 'PARTNER' | 'OTHER';
        preferredCurrency: Currency | null;
        color: string | null;
        icon: string | null;
        description: string | null;
      }>('/accounts', data, accessToken);

      const newAccount: Account = {
        ...created,
        type: mapAccountType(created.type),
        dbType: created.type,
        balance: 0,
      };

      const { accounts } = get();
      set({
        accounts: [...accounts, newAccount],
        isLoading: false,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Failed to create account';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  updateAccount: async (id: string, data: UpdateAccountData) => {
    const accessToken = useAuthStore.getState().accessToken;

    set({ isLoading: true, error: null });

    try {
      const updated = await apiPut<{
        id: string;
        name: string;
        type: 'SELF' | 'PARTNER' | 'OTHER';
        preferredCurrency: Currency | null;
        color: string | null;
        icon: string | null;
        description: string | null;
      }>(`/accounts/${id}`, data, accessToken);

      const { accounts } = get();
      set({
        accounts: accounts.map((acc) =>
          acc.id === id
            ? {
                ...acc,
                name: updated.name,
                type: mapAccountType(updated.type),
                dbType: updated.type,
                preferredCurrency: updated.preferredCurrency,
                color: updated.color,
              }
            : acc
        ),
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

      set({
        accounts: remainingAccounts,
        activeAccountId,
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

registerStoreReset(() => useAccountsStore.getState().reset());
