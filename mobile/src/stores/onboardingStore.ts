import { create } from 'zustand';
import { apiPost, apiPatch, apiGet } from '../services/api';
import { ApiError } from '../services/api';
import { useAuthStore } from './authStore';

import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../constants/categories';
export type Currency = 'USD' | 'EUR' | 'ILS';

export interface CategorySelection {
  name: string;
  type: 'EXPENSE' | 'INCOME';
  color?: string;
}

interface OnboardingState {
  selectedCurrency: Currency;
  selectedCategories: string[];
  monthlyBudget: number | null;
  wantsSampleData: boolean;
  isCompleting: boolean;
  error: string | null;
}

interface OnboardingActions {
  setCurrency: (currency: Currency) => void;
  toggleCategory: (name: string) => void;
  setBudget: (amount: number | null) => void;
  setSampleData: (wants: boolean) => void;
  completeOnboarding: () => Promise<void>;
  reset: () => void;
}

export type OnboardingStore = OnboardingState & OnboardingActions;

const initialState: OnboardingState = {
  selectedCurrency: 'USD',
  selectedCategories: [],
  monthlyBudget: null,
  wantsSampleData: false,
  isCompleting: false,
  error: null,
};

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  ...initialState,

  setCurrency: (currency: Currency) => {
    set({ selectedCurrency: currency });
  },

  toggleCategory: (name: string) => {
    set((state) => {
      const isSelected = state.selectedCategories.includes(name);
      return {
        selectedCategories: isSelected
          ? state.selectedCategories.filter((n) => n !== name)
          : [...state.selectedCategories, name],
      };
    });
  },

  setBudget: (amount: number | null) => {
    set({ monthlyBudget: amount });
  },

  setSampleData: (wants: boolean) => {
    set({ wantsSampleData: wants });
  },

  completeOnboarding: async () => {
    const state = get();
    const authStore = useAuthStore.getState();
    const accessToken = authStore.accessToken;

    if (!accessToken) {
      set({ error: 'Not authenticated' });
      return;
    }

    set({ isCompleting: true, error: null });

    try {
      await apiPatch<{ currency: Currency }>(
        '/users/me/currency',
        { currency: state.selectedCurrency },
        accessToken
      );

      if (state.selectedCategories.length > 0) {


        const allDefaultCategories = [
          ...DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c, type: 'EXPENSE' as const })),
          ...DEFAULT_INCOME_CATEGORIES.map((c) => ({ ...c, type: 'INCOME' as const })),
        ];

        const categoriesToCreate = state.selectedCategories
          .map((name) => allDefaultCategories.find((c) => c.name === name))
          .filter((c): c is NonNullable<typeof c> => c !== undefined);

        if (categoriesToCreate.length > 0) {
          await apiPost<{ categoriesCreated: number; categories: unknown[] }>(
            '/categories/bulk',
            { categories: categoriesToCreate },
            accessToken
          );
        }
      }

      if (state.monthlyBudget !== null && state.monthlyBudget > 0) {
        const accountsData = await apiGet<{ accounts: Array<{ id: string; name: string }> }>(
          '/accounts',
          accessToken
        );

        if (accountsData.accounts && accountsData.accounts.length > 0) {
          const firstAccount = accountsData.accounts[0];

          const categoriesData = await apiGet<{ categories: Array<{ id: string; name: string }> }>(
            '/categories',
            accessToken
          );

          if (categoriesData.categories) {
            const totalCategory = categoriesData.categories.find(
              (c: { name: string }) => c.name === 'Total'
            );

            if (totalCategory) {
              const now = new Date();
              const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

              await apiPost<{ success: boolean }>(
                '/budgets/quick',
                {
                  accountId: firstAccount.id,
                  categoryId: totalCategory.id,
                  monthKey,
                  planned: state.monthlyBudget,
                  currency: state.selectedCurrency,
                },
                accessToken
              );
            }
          }
        }
      }

      if (state.wantsSampleData) {
        await apiPost<{ categoriesCreated: number; transactionsCreated: number; budgetsCreated: number }>(
          '/seed-data',
          {},
          accessToken
        );
      }

      await apiPost<{ hasCompletedOnboarding: boolean }>(
        '/onboarding/complete',
        {},
        accessToken
      );

      authStore.updateUser({ hasCompletedOnboarding: true });

      set({ isCompleting: false });
    } catch (error) {
      if (error instanceof ApiError) {
        set({ error: error.message, isCompleting: false });
      } else {
        set({ error: 'Failed to complete onboarding', isCompleting: false });
      }
    }
  },

  reset: () => {
    set({ ...initialState });
  },
}));
