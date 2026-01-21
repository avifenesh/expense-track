import { create } from 'zustand';
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from '../services/api';
import { useAuthStore } from './authStore';
import { registerStoreReset } from './storeRegistry';
import { networkStatus } from '../services/networkStatus';
import { useOfflineQueueStore } from './offlineQueueStore';
import { logger } from '../lib/logger';
import type { Currency } from '../types';
import type { Category, TransactionType } from './categoriesStore';

export type { TransactionType } from './categoriesStore';

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: string;
  currency: Currency;
  date: string;
  month: string;
  description: string | null;
  isRecurring: boolean;
  category: Category;
  isPending?: boolean;
}

export interface TransactionFilters {
  accountId: string;
  month?: string;
  categoryId?: string;
  type?: TransactionType;
}

export interface CreateTransactionInput {
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  date: string;
  description?: string;
  isRecurring?: boolean;
}

export interface UpdateTransactionInput extends Partial<CreateTransactionInput> {
  id: string;
}

interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  hasMore: boolean;
}

interface TransactionsState {
  transactions: Transaction[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  filters: TransactionFilters;
  offset: number;
  limit: number;
}

interface TransactionsActions {
  fetchTransactions: (resetPagination?: boolean) => Promise<boolean>;
  fetchMoreTransactions: () => Promise<void>;
  createTransaction: (data: CreateTransactionInput) => Promise<Transaction>;
  updateTransaction: (data: UpdateTransactionInput) => Promise<Transaction>;
  deleteTransaction: (id: string) => Promise<void>;
  setFilters: (filters: Partial<TransactionFilters>) => void;
  clearError: () => void;
  reset: () => void;
}

export type TransactionsStore = TransactionsState & TransactionsActions;

const initialState: TransactionsState = {
  transactions: [],
  total: 0,
  hasMore: false,
  isLoading: false,
  error: null,
  filters: {
    accountId: '',
  },
  offset: 0,
  limit: 50,
};

function createPendingTransaction(
  pendingId: string,
  data: CreateTransactionInput
): Transaction {
  const date = new Date(data.date);
  const month = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();

  return {
    id: pendingId,
    accountId: data.accountId,
    categoryId: data.categoryId,
    type: data.type,
    amount: data.amount.toString(),
    currency: data.currency,
    date: data.date,
    month,
    description: data.description ?? null,
    isRecurring: data.isRecurring ?? false,
    category: {
      id: data.categoryId,
      name: 'Pending',
      type: data.type,
      color: '#9CA3AF',
      isArchived: false,
      isHolding: false,
    },
    isPending: true,
  };
}

export const useTransactionsStore = create<TransactionsStore>((set, get) => ({
  ...initialState,

  fetchTransactions: async (resetPagination = true) => {
    const { filters, limit } = get();
    const accessToken = useAuthStore.getState().accessToken;

    if (!filters.accountId) {
      set({ error: 'Account ID is required', isLoading: false });
      return false;
    }

    set({ isLoading: true, error: null });

    if (resetPagination) {
      set({ offset: 0 });
    }

    const offset = resetPagination ? 0 : get().offset;

    try {
      const params = new URLSearchParams();
      params.set('accountId', filters.accountId);
      params.set('limit', limit.toString());
      params.set('offset', offset.toString());

      if (filters.month) {
        params.set('month', filters.month);
      }
      if (filters.categoryId) {
        params.set('categoryId', filters.categoryId);
      }
      if (filters.type) {
        params.set('type', filters.type);
      }

      const response = await apiGet<TransactionsResponse>(
        `/transactions?${params.toString()}`,
        accessToken
      );

      set({
        transactions: resetPagination
          ? response.transactions
          : [...get().transactions, ...response.transactions],
        total: response.total,
        hasMore: response.hasMore,
        isLoading: false,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Failed to fetch transactions';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  fetchMoreTransactions: async () => {
    const { hasMore, isLoading, limit, offset } = get();

    if (!hasMore || isLoading) {
      return;
    }

    const newOffset = offset + limit;
    set({ offset: newOffset });

    const success = await get().fetchTransactions(false);

    if (!success) {
      set({ offset });
    }
  },

  createTransaction: async (data: CreateTransactionInput) => {
    const accessToken = useAuthStore.getState().accessToken;

    if (!networkStatus.isOnline()) {
      logger.info('Offline: queueing transaction for later sync');
      const pendingId = await useOfflineQueueStore.getState().addToQueue(data);
      const pendingTransaction = createPendingTransaction(pendingId, data);
      set((state) => ({
        transactions: [pendingTransaction, ...state.transactions],
        total: state.total + 1,
      }));
      return pendingTransaction;
    }

    try {
      const { id } = await apiPost<{ id: string }>(
        '/transactions',
        data,
        accessToken
      );

      const transaction = await apiGet<Transaction>(
        `/transactions/${id}`,
        accessToken
      );

      set((state) => ({
        transactions: [transaction, ...state.transactions],
        total: state.total + 1,
      }));

      return transaction;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
        logger.info('Network error: queueing transaction for later sync');
        const pendingId = await useOfflineQueueStore.getState().addToQueue(data);
        const pendingTransaction = createPendingTransaction(pendingId, data);
        set((state) => ({
          transactions: [pendingTransaction, ...state.transactions],
          total: state.total + 1,
        }));
        return pendingTransaction;
      }
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to create transaction', 'CREATE_FAILED', 0);
    }
  },

  updateTransaction: async (data: UpdateTransactionInput) => {
    const accessToken = useAuthStore.getState().accessToken;
    const { id, ...updates } = data;

    try {
      await apiPut<{ id: string }>(
        `/transactions/${id}`,
        updates,
        accessToken
      );

      const transaction = await apiGet<Transaction>(
        `/transactions/${id}`,
        accessToken
      );

      set((state) => ({
        transactions: state.transactions.map((t) =>
          t.id === id ? transaction : t
        ),
      }));

      return transaction;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to update transaction', 'UPDATE_FAILED', 0);
    }
  },

  deleteTransaction: async (id: string) => {
    const accessToken = useAuthStore.getState().accessToken;

    try {
      await apiDelete<{ message: string }>(`/transactions/${id}`, accessToken);

      set((state) => ({
        transactions: state.transactions.filter((t) => t.id !== id),
        total: state.total - 1,
      }));
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to delete transaction', 'DELETE_FAILED', 0);
    }
  },

  setFilters: (filters: Partial<TransactionFilters>) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({ ...initialState });
  },
}));

// Register for cleanup on logout
registerStoreReset(() => useTransactionsStore.getState().reset());
