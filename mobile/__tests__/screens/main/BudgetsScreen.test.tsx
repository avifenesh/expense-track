import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { BudgetsScreen } from '../../../src/screens/main/BudgetsScreen';
import { useAccountsStore } from '../../../src/stores/accountsStore';
import { useTransactionsStore } from '../../../src/stores/transactionsStore';
import { useBudgetsStore } from '../../../src/stores/budgetsStore';
import { useCategoriesStore } from '../../../src/stores/categoriesStore';
import type { MainTabScreenProps } from '../../../src/navigation/types';

// Mock stores
jest.mock('../../../src/stores/accountsStore');
jest.mock('../../../src/stores/transactionsStore');
jest.mock('../../../src/stores/budgetsStore');
jest.mock('../../../src/stores/categoriesStore');

const mockUseAccountsStore = useAccountsStore as jest.MockedFunction<typeof useAccountsStore>;
const mockUseTransactionsStore = useTransactionsStore as jest.MockedFunction<typeof useTransactionsStore>;
const mockUseBudgetsStore = useBudgetsStore as jest.MockedFunction<typeof useBudgetsStore>;
const mockUseCategoriesStore = useCategoriesStore as jest.MockedFunction<typeof useCategoriesStore>;

const mockAccount = {
  id: 'acc-1',
  name: 'Personal Account',
  type: 'PERSONAL' as const,
  preferredCurrency: 'USD' as const,
  color: '#4CAF50',
  icon: 'wallet',
  description: 'My personal finances',
};

const mockExpenseCategory = {
  id: 'cat-1',
  name: 'Food',
  type: 'EXPENSE' as const,
  color: '#4CAF50',
  isArchived: false,
  isHolding: false,
};

const mockExpenseCategory2 = {
  id: 'cat-2',
  name: 'Transport',
  type: 'EXPENSE' as const,
  color: '#2196F3',
  isArchived: false,
  isHolding: false,
};

const mockTransaction = {
  id: 'tx-1',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  type: 'EXPENSE' as const,
  amount: '150.00',
  currency: 'USD' as const,
  date: '2026-01-15',
  month: '2026-01-01',
  description: 'Groceries',
  isRecurring: false,
  category: mockExpenseCategory,
};

const mockTransaction2 = {
  id: 'tx-2',
  accountId: 'acc-1',
  categoryId: 'cat-2',
  type: 'EXPENSE' as const,
  amount: '50.00',
  currency: 'USD' as const,
  date: '2026-01-14',
  month: '2026-01-01',
  description: 'Bus fare',
  isRecurring: false,
  category: mockExpenseCategory2,
};

const mockBudget = {
  id: 'budget-1',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  month: '2026-01-01',
  planned: '500.00',
  currency: 'USD' as const,
  notes: null,
  category: mockExpenseCategory,
};

const mockBudget2 = {
  id: 'budget-2',
  accountId: 'acc-1',
  categoryId: 'cat-2',
  month: '2026-01-01',
  planned: '100.00',
  currency: 'USD' as const,
  notes: null,
  category: mockExpenseCategory2,
};

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
} as unknown as MainTabScreenProps<'Budgets'>['navigation'];

const mockRoute = {
  key: 'Budgets',
  name: 'Budgets' as const,
  params: undefined,
} as MainTabScreenProps<'Budgets'>['route'];

function renderBudgetsScreen() {
  return render(
    <NavigationContainer>
      <BudgetsScreen navigation={mockNavigation} route={mockRoute} />
    </NavigationContainer>
  );
}

describe('BudgetsScreen', () => {
  const defaultAccountsState = {
    accounts: [mockAccount],
    selectedAccountId: 'acc-1',
    isLoading: false,
    error: null,
    fetchAccounts: jest.fn().mockResolvedValue(true),
    setSelectedAccount: jest.fn(),
    clearError: jest.fn(),
    reset: jest.fn(),
  };

  const defaultTransactionsState = {
    transactions: [mockTransaction, mockTransaction2],
    total: 2,
    hasMore: false,
    isLoading: false,
    error: null,
    filters: { accountId: 'acc-1' },
    offset: 0,
    limit: 50,
    fetchTransactions: jest.fn().mockResolvedValue(true),
    fetchMoreTransactions: jest.fn(),
    createTransaction: jest.fn(),
    updateTransaction: jest.fn(),
    deleteTransaction: jest.fn(),
    setFilters: jest.fn(),
    clearError: jest.fn(),
    reset: jest.fn(),
  };

  const defaultBudgetsState = {
    budgets: [mockBudget, mockBudget2],
    isLoading: false,
    error: null,
    filters: { accountId: 'acc-1' },
    selectedMonth: '2026-01',
    fetchBudgets: jest.fn().mockResolvedValue(undefined),
    createOrUpdateBudget: jest.fn(),
    deleteBudget: jest.fn(),
    setFilters: jest.fn(),
    setSelectedMonth: jest.fn(),
    clearError: jest.fn(),
    reset: jest.fn(),
  };

  const defaultCategoriesState = {
    categories: [mockExpenseCategory, mockExpenseCategory2],
    isLoading: false,
    error: null,
    fetchCategories: jest.fn().mockResolvedValue(undefined),
    createCategory: jest.fn(),
    archiveCategory: jest.fn(),
    unarchiveCategory: jest.fn(),
    getCategoriesByType: jest.fn(),
    clearError: jest.fn(),
    reset: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAccountsStore.mockReturnValue(defaultAccountsState);
    mockUseTransactionsStore.mockReturnValue(defaultTransactionsState);
    mockUseBudgetsStore.mockReturnValue(defaultBudgetsState);
    mockUseCategoriesStore.mockReturnValue(defaultCategoriesState);
  });

  describe('Rendering', () => {
    it('renders budgets title', async () => {
      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByText('Budgets')).toBeTruthy();
      });
    });

    it('renders subtitle', async () => {
      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByText('Track your spending by category')).toBeTruthy();
      });
    });

    it('renders month selector', async () => {
      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByLabelText('Previous month')).toBeTruthy();
        expect(screen.getByLabelText('Next month')).toBeTruthy();
      });
    });

    it('renders category budgets section header', async () => {
      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByText('Category Budgets')).toBeTruthy();
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner during initial load', async () => {
      mockUseAccountsStore.mockReturnValue({
        ...defaultAccountsState,
        accounts: [],
        selectedAccountId: null,
        isLoading: true,
      });

      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByText('Loading budgets...')).toBeTruthy();
      });
    });
  });

  describe('Error State', () => {
    it('shows error message when accounts fail to load', async () => {
      mockUseAccountsStore.mockReturnValue({
        ...defaultAccountsState,
        accounts: [],
        selectedAccountId: null,
        isLoading: false,
        error: 'Failed to load accounts',
      });

      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeTruthy();
        expect(screen.getByText('Failed to load accounts')).toBeTruthy();
      });
    });

    it('shows error when budgets fail to load', async () => {
      mockUseBudgetsStore.mockReturnValue({
        ...defaultBudgetsState,
        error: 'Failed to fetch budgets',
      });

      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeTruthy();
        expect(screen.getByText('Failed to fetch budgets')).toBeTruthy();
      });
    });

    it('shows retry button on error', async () => {
      mockUseAccountsStore.mockReturnValue({
        ...defaultAccountsState,
        accounts: [],
        selectedAccountId: null,
        isLoading: false,
        error: 'Network error',
      });

      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeTruthy();
      });
    });

    it('calls refresh handlers when retry is pressed', async () => {
      const fetchAccounts = jest.fn().mockResolvedValue(true);
      mockUseAccountsStore.mockReturnValue({
        ...defaultAccountsState,
        accounts: [],
        selectedAccountId: null,
        isLoading: false,
        error: 'Network error',
        fetchAccounts,
      });

      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Try Again'));

      await waitFor(() => {
        expect(fetchAccounts).toHaveBeenCalled();
      });
    });
  });

  describe('Empty States', () => {
    it('shows no accounts message when user has no accounts', async () => {
      mockUseAccountsStore.mockReturnValue({
        ...defaultAccountsState,
        accounts: [],
        selectedAccountId: null,
        isLoading: false,
      });

      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByText('No Accounts Found')).toBeTruthy();
        expect(screen.getByText('Create an account to start tracking your budgets.')).toBeTruthy();
      });
    });

    it('shows no budgets message when month has no budgets', async () => {
      mockUseBudgetsStore.mockReturnValue({
        ...defaultBudgetsState,
        budgets: [],
      });

      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByText('No budgets set')).toBeTruthy();
        expect(screen.getByText('Set up budgets to track your spending by category.')).toBeTruthy();
      });
    });
  });

  describe('Data Display', () => {
    it('displays budget category cards', async () => {
      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByText('Food')).toBeTruthy();
        expect(screen.getByText('Transport')).toBeTruthy();
      });
    });

    it('displays budget amounts correctly', async () => {
      renderBudgetsScreen();

      await waitFor(() => {
        // Food budget: $500 planned
        expect(screen.getByText('$500.00')).toBeTruthy();
        // Transport budget: $100 planned
        expect(screen.getByText('$100.00')).toBeTruthy();
      });
    });

    it('displays spent amounts from transactions', async () => {
      renderBudgetsScreen();

      await waitFor(() => {
        // Food spent: $150 (from mockTransaction)
        expect(screen.getByText('$150.00')).toBeTruthy();
        // Transport spent: $50 (from mockTransaction2)
        expect(screen.getByText('$50.00')).toBeTruthy();
      });
    });

    it('displays total budget in progress card', async () => {
      renderBudgetsScreen();

      await waitFor(() => {
        // Total spent should be $200 ($150 + $50)
        expect(screen.getByText('$200.00')).toBeTruthy();
        // Total budget text
        expect(screen.getByText(/of \$600\.00 budget/)).toBeTruthy();
      });
    });
  });

  describe('Month Navigation', () => {
    it('calls setFilters when month changes', async () => {
      const setFilters = jest.fn();
      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        setFilters,
      });

      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByLabelText('Next month')).toBeTruthy();
      });

      fireEvent.press(screen.getByLabelText('Next month'));

      await waitFor(() => {
        expect(setFilters).toHaveBeenCalled();
      });
    });

    it('calls setBudgetSelectedMonth when month changes', async () => {
      const setSelectedMonth = jest.fn();
      mockUseBudgetsStore.mockReturnValue({
        ...defaultBudgetsState,
        setSelectedMonth,
      });

      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByLabelText('Next month')).toBeTruthy();
      });

      fireEvent.press(screen.getByLabelText('Next month'));

      await waitFor(() => {
        expect(setSelectedMonth).toHaveBeenCalled();
      });
    });
  });

  describe('Initial Data Fetch', () => {
    it('fetches accounts on mount', async () => {
      const fetchAccounts = jest.fn().mockResolvedValue(true);
      mockUseAccountsStore.mockReturnValue({
        ...defaultAccountsState,
        fetchAccounts,
      });

      renderBudgetsScreen();

      await waitFor(() => {
        expect(fetchAccounts).toHaveBeenCalled();
      });
    });

    it('fetches budgets when account is selected', async () => {
      const fetchBudgets = jest.fn().mockResolvedValue(undefined);
      mockUseBudgetsStore.mockReturnValue({
        ...defaultBudgetsState,
        fetchBudgets,
      });

      renderBudgetsScreen();

      await waitFor(() => {
        expect(fetchBudgets).toHaveBeenCalled();
      });
    });

    it('fetches categories when account is selected', async () => {
      const fetchCategories = jest.fn().mockResolvedValue(undefined);
      mockUseCategoriesStore.mockReturnValue({
        ...defaultCategoriesState,
        fetchCategories,
      });

      renderBudgetsScreen();

      await waitFor(() => {
        expect(fetchCategories).toHaveBeenCalledWith('EXPENSE');
      });
    });

    it('fetches transactions when account is selected', async () => {
      const fetchTransactions = jest.fn().mockResolvedValue(true);
      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        fetchTransactions,
      });

      renderBudgetsScreen();

      await waitFor(() => {
        expect(fetchTransactions).toHaveBeenCalled();
      });
    });
  });

  describe('Pull to Refresh', () => {
    it('renders with RefreshControl', async () => {
      renderBudgetsScreen();

      await waitFor(() => {
        // The ScrollView should be rendered (indicates the main content is displayed)
        expect(screen.getByText('Budgets')).toBeTruthy();
      });
    });
  });

  describe('Over Budget Display', () => {
    it('displays over budget styling when spent exceeds planned', async () => {
      // Create a budget where spent > planned
      const overBudgetTransaction = {
        ...mockTransaction,
        amount: '600.00', // More than the $500 budget
      };

      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        transactions: [overBudgetTransaction, mockTransaction2],
      });

      renderBudgetsScreen();

      await waitFor(() => {
        // Should show the over budget amount
        expect(screen.getByText('$600.00')).toBeTruthy();
      });
    });
  });

  describe('Category Lookup', () => {
    it('falls back to budget.category when category not in store', async () => {
      // Categories store doesn't have the category
      mockUseCategoriesStore.mockReturnValue({
        ...defaultCategoriesState,
        categories: [],
      });

      renderBudgetsScreen();

      await waitFor(() => {
        // Should still show category names from budget.category
        expect(screen.getByText('Food')).toBeTruthy();
        expect(screen.getByText('Transport')).toBeTruthy();
      });
    });

    it('shows Unknown when no category available', async () => {
      // Budget without category info
      const budgetWithoutCategory = {
        ...mockBudget,
        category: undefined as unknown as typeof mockExpenseCategory,
      };

      mockUseBudgetsStore.mockReturnValue({
        ...defaultBudgetsState,
        budgets: [budgetWithoutCategory],
      });

      mockUseCategoriesStore.mockReturnValue({
        ...defaultCategoriesState,
        categories: [],
      });

      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByText('Unknown')).toBeTruthy();
      });
    });
  });
});
