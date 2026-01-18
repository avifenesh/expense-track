import { create } from 'zustand';
import { apiPost, apiPatch } from '../services/api';
import { ApiError } from '../services/api';
import { useAuthStore } from './authStore';

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
      // Step 1: Update currency
      await apiPatch<{ currency: Currency }>(
        '/users/me/currency',
        { currency: state.selectedCurrency },
        accessToken
      );

      // Step 2: Create selected categories (if any)
      if (state.selectedCategories.length > 0) {
        const DEFAULT_EXPENSE_CATEGORIES = [
          { name: 'Groceries', color: '#22c55e' },
          { name: 'Dining Out', color: '#f97316' },
          { name: 'Transportation', color: '#3b82f6' },
          { name: 'Utilities', color: '#8b5cf6' },
          { name: 'Entertainment', color: '#ec4899' },
          { name: 'Shopping', color: '#06b6d4' },
          { name: 'Health', color: '#ef4444' },
          { name: 'Housing', color: '#84cc16' },
          { name: 'Insurance', color: '#6366f1' },
          { name: 'Subscriptions', color: '#14b8a6' },
        ];

        const DEFAULT_INCOME_CATEGORIES = [
          { name: 'Salary', color: '#10b981' },
          { name: 'Freelance', color: '#06b6d4' },
          { name: 'Investments', color: '#8b5cf6' },
          { name: 'Other Income', color: '#6b7280' },
        ];

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

      // Step 3: Create budget if set (requires account and "Total" category)
      if (state.monthlyBudget !== null && state.monthlyBudget > 0) {
        // First, get user's accounts to find the first one
        const accountsResponse = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/accounts`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          if (accountsData.success && accountsData.data.accounts.length > 0) {
            const firstAccount = accountsData.data.accounts[0];

            // Get categories to find "Total" category
            const categoriesResponse = await fetch(
              `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/categories`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (categoriesResponse.ok) {
              const categoriesData = await categoriesResponse.json();
              if (categoriesData.success) {
                const totalCategory = categoriesData.data.categories.find(
                  (c: { name: string }) => c.name === 'Total'
                );

                if (totalCategory) {
                  // Get current month key (YYYY-MM)
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
        }
      }

      // Step 4: Seed sample data if requested
      if (state.wantsSampleData) {
        await apiPost<{ categoriesCreated: number; transactionsCreated: number; budgetsCreated: number }>(
          '/seed-data',
          {},
          accessToken
        );
      }

      // Step 5: Mark onboarding as complete
      await apiPost<{ hasCompletedOnboarding: boolean }>(
        '/onboarding/complete',
        {},
        accessToken
      );

      // Step 6: Update auth store
      authStore.updateUser({ hasCompletedOnboarding: true });

      set({ isCompleting: false });
    } catch (error) {
      if (error instanceof ApiError) {
        set({ error: error.message, isCompleting: false });
      } else {
        set({ error: 'Failed to complete onboarding', isCompleting: false });
      }
      throw error;
    }
  },

  reset: () => {
    set({ ...initialState });
  },
}));
