import { create } from 'zustand';
import { apiGet, apiPost, apiDelete, ApiError } from '../services/api';
import { useAuthStore } from './authStore';
import { registerStoreReset } from './storeRegistry';
import type { Currency } from '../types';
import type { Category } from './categoriesStore';

export interface Budget {
  id: string;
  accountId: string;
  categoryId: string;
  month: string;
  planned: string;
  currency: Currency;
  notes: string | null;
  category: Category;
}

export interface BudgetFilters {
  accountId: string;
  month?: string;
}

export interface CreateBudgetInput {
  accountId: string;
  categoryId: string;
  monthKey: string;
  planned: number;
  currency: Currency;
  notes?: string;
}

export interface UpdateBudgetInput extends Partial<CreateBudgetInput> {
  accountId: string;
  categoryId: string;
  monthKey: string;
}

interface BudgetsResponse {
  budgets: Budget[];
}

interface BudgetsState {
  budgets: Budget[];
  isLoading: boolean;
  error: string | null;
  filters: BudgetFilters;
  selectedMonth: string;
}

interface BudgetsActions {
  fetchBudgets: () => Promise<void>;
  createOrUpdateBudget: (data: CreateBudgetInput) => Promise<Budget>;
  deleteBudget: (accountId: string, categoryId: string, monthKey: string) => Promise<void>;
  setFilters: (filters: Partial<BudgetFilters>) => void;
  setSelectedMonth: (month: string) => void;
  clearError: () => void;
  reset: () => void;
}

export type BudgetsStore = BudgetsState & BudgetsActions;

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const initialState: BudgetsState = {
  budgets: [],
  isLoading: false,
  error: null,
  filters: {
    accountId: '',
  },
  selectedMonth: getCurrentMonth(),
};

export const useBudgetsStore = create<BudgetsStore>((set, get) => ({
  ...initialState,

  fetchBudgets: async () => {
    const { filters, selectedMonth } = get();
    const accessToken = useAuthStore.getState().accessToken;

    if (!filters.accountId) {
      set({ error: 'Account ID is required', isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const params = new URLSearchParams();
      params.set('accountId', filters.accountId);

      if (selectedMonth) {
        params.set('month', selectedMonth);
      }

      const response = await apiGet<BudgetsResponse>(
        `/budgets?${params.toString()}`,
        accessToken
      );

      set({
        budgets: response.budgets,
        isLoading: false,
      });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Failed to fetch budgets';
      set({ error: message, isLoading: false });
    }
  },

  createOrUpdateBudget: async (data: CreateBudgetInput) => {
    const accessToken = useAuthStore.getState().accessToken;

    try {
      const budget = await apiPost<Budget>('/budgets', data, accessToken);

      set((state) => {
        const existingIndex = state.budgets.findIndex(
          (b) =>
            b.accountId === budget.accountId &&
            b.categoryId === budget.categoryId &&
            b.month === budget.month
        );

        if (existingIndex >= 0) {
          const updatedBudgets = [...state.budgets];
          updatedBudgets[existingIndex] = budget;
          return { budgets: updatedBudgets };
        }

        return { budgets: [...state.budgets, budget] };
      });

      return budget;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to save budget', 'SAVE_FAILED', 0);
    }
  },

  deleteBudget: async (accountId: string, categoryId: string, monthKey: string) => {
    const accessToken = useAuthStore.getState().accessToken;

    try {
      const params = new URLSearchParams();
      params.set('accountId', accountId);
      params.set('categoryId', categoryId);
      params.set('monthKey', monthKey);

      await apiDelete<{ message: string }>(
        `/budgets?${params.toString()}`,
        accessToken
      );

      // API stores month as first day of month (YYYY-MM-01), but we pass monthKey as YYYY-MM
      // Normalize both to YYYY-MM for comparison
      const normalizeMonth = (m: string) => m.slice(0, 7);

      set((state) => ({
        budgets: state.budgets.filter(
          (b) =>
            !(
              b.accountId === accountId &&
              b.categoryId === categoryId &&
              normalizeMonth(b.month) === normalizeMonth(monthKey)
            )
        ),
      }));
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to delete budget', 'DELETE_FAILED', 0);
    }
  },

  setFilters: (filters: Partial<BudgetFilters>) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  setSelectedMonth: (month: string) => {
    set({ selectedMonth: month });
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({ ...initialState });
  },
}));

// Register for cleanup on logout
registerStoreReset(() => useBudgetsStore.getState().reset());
