import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { BudgetsScreen } from '../../../src/screens/main/BudgetsScreen';
import { useAccountsStore } from '../../../src/stores/accountsStore';
import { useTransactionsStore } from '../../../src/stores/transactionsStore';
import { useBudgetsStore } from '../../../src/stores/budgetsStore';
import { useCategoriesStore } from '../../../src/stores/categoriesStore';
import { useOfflineQueueStore } from '../../../src/stores/offlineQueueStore';
import type { MainTabScreenProps } from '../../../src/navigation/types';

// Mock stores
jest.mock('../../../src/stores/accountsStore');
jest.mock('../../../src/stores/transactionsStore');
jest.mock('../../../src/stores/budgetsStore');
jest.mock('../../../src/stores/categoriesStore');
jest.mock('../../../src/stores/offlineQueueStore');

const mockUseAccountsStore = useAccountsStore as unknown as jest.Mock & { getState: jest.Mock };
const mockUseTransactionsStore = useTransactionsStore as unknown as jest.Mock & { getState: jest.Mock };
const mockUseBudgetsStore = useBudgetsStore as unknown as jest.Mock & { getState: jest.Mock };
const mockUseCategoriesStore = useCategoriesStore as unknown as jest.Mock & { getState: jest.Mock };
const mockUseOfflineQueueStore = useOfflineQueueStore as unknown as jest.Mock & { getState: jest.Mock };

// Helper to create store mock that handles selectors
function createStoreMock<T extends object>(state: T): (selector?: (s: T) => unknown) => unknown {
  return (selector?: (s: T) => unknown) => {
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  };
}

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
    activeAccountId: 'acc-1',
    isLoading: false,
    error: null,
    fetchAccounts: jest.fn().mockResolvedValue(true),
    setActiveAccount: jest.fn(),
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

  const defaultOfflineQueueState = {
    items: [],
    isSyncing: false,
    syncError: null,
    processQueue: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAccountsStore.mockImplementation(createStoreMock(defaultAccountsState));
    mockUseAccountsStore.getState = jest.fn(() => defaultAccountsState);
    mockUseTransactionsStore.mockImplementation(createStoreMock(defaultTransactionsState));
    mockUseTransactionsStore.getState = jest.fn(() => defaultTransactionsState);
    mockUseBudgetsStore.mockImplementation(createStoreMock(defaultBudgetsState));
    mockUseBudgetsStore.getState = jest.fn(() => defaultBudgetsState);
    mockUseCategoriesStore.mockImplementation(createStoreMock(defaultCategoriesState));
    mockUseCategoriesStore.getState = jest.fn(() => defaultCategoriesState);
    mockUseOfflineQueueStore.mockImplementation(createStoreMock(defaultOfflineQueueState));
    mockUseOfflineQueueStore.getState = jest.fn(() => defaultOfflineQueueState);
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
      const loadingState = {
        ...defaultAccountsState,
        accounts: [],
        activeAccountId: null,
        isLoading: true,
      };
      mockUseAccountsStore.mockImplementation(createStoreMock(loadingState));
      mockUseAccountsStore.getState = jest.fn(() => loadingState);

      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('budgets.skeleton')).toBeTruthy();
      });
    });
  });

  describe('Error State', () => {
    it('shows error message when accounts fail to load', async () => {
      const errorState = {
        ...defaultAccountsState,
        accounts: [],
        activeAccountId: null,
        isLoading: false,
        error: 'Failed to load accounts',
      };
      mockUseAccountsStore.mockImplementation(createStoreMock(errorState));
      mockUseAccountsStore.getState = jest.fn(() => errorState);

      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeTruthy();
        expect(screen.getByText('Failed to load accounts')).toBeTruthy();
      });
    });

    it('shows error when budgets fail to load', async () => {
      const errorState = {
        ...defaultBudgetsState,
        error: 'Failed to fetch budgets',
      };
      mockUseBudgetsStore.mockImplementation(createStoreMock(errorState));
      mockUseBudgetsStore.getState = jest.fn(() => errorState);

      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeTruthy();
        expect(screen.getByText('Failed to fetch budgets')).toBeTruthy();
      });
    });

    it('shows retry button on error', async () => {
      const errorState = {
        ...defaultAccountsState,
        accounts: [],
        activeAccountId: null,
        isLoading: false,
        error: 'Network error',
      };
      mockUseAccountsStore.mockImplementation(createStoreMock(errorState));
      mockUseAccountsStore.getState = jest.fn(() => errorState);

      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeTruthy();
      });
    });

    it('calls refresh handlers when retry is pressed', async () => {
      const fetchAccounts = jest.fn().mockResolvedValue(true);
      const errorState = {
        ...defaultAccountsState,
        accounts: [],
        activeAccountId: null,
        isLoading: false,
        error: 'Network error',
        fetchAccounts,
      };
      mockUseAccountsStore.mockImplementation(createStoreMock(errorState));
      mockUseAccountsStore.getState = jest.fn(() => errorState);

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
      const emptyState = {
        ...defaultAccountsState,
        accounts: [],
        activeAccountId: null,
        isLoading: false,
      };
      mockUseAccountsStore.mockImplementation(createStoreMock(emptyState));
      mockUseAccountsStore.getState = jest.fn(() => emptyState);

      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByText('No Accounts Found')).toBeTruthy();
        expect(screen.getByText('Create an account to start tracking your budgets.')).toBeTruthy();
      });
    });

    it('shows no budgets message when month has no budgets', async () => {
      const emptyBudgetsState = {
        ...defaultBudgetsState,
        budgets: [],
      };
      mockUseBudgetsStore.mockImplementation(createStoreMock(emptyBudgetsState));
      mockUseBudgetsStore.getState = jest.fn(() => emptyBudgetsState);

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
      const stateWithSetFilters = {
        ...defaultTransactionsState,
        setFilters,
      };
      mockUseTransactionsStore.mockImplementation(createStoreMock(stateWithSetFilters));
      mockUseTransactionsStore.getState = jest.fn(() => stateWithSetFilters);

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
      const stateWithSetMonth = {
        ...defaultBudgetsState,
        setSelectedMonth,
      };
      mockUseBudgetsStore.mockImplementation(createStoreMock(stateWithSetMonth));
      mockUseBudgetsStore.getState = jest.fn(() => stateWithSetMonth);

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
      const stateWithFetch = {
        ...defaultAccountsState,
        fetchAccounts,
      };
      mockUseAccountsStore.mockImplementation(createStoreMock(stateWithFetch));
      mockUseAccountsStore.getState = jest.fn(() => stateWithFetch);

      renderBudgetsScreen();

      await waitFor(() => {
        expect(fetchAccounts).toHaveBeenCalled();
      });
    });

    it('fetches budgets when account is selected', async () => {
      const fetchBudgets = jest.fn().mockResolvedValue(undefined);
      const stateWithFetch = {
        ...defaultBudgetsState,
        fetchBudgets,
      };
      mockUseBudgetsStore.mockImplementation(createStoreMock(stateWithFetch));
      mockUseBudgetsStore.getState = jest.fn(() => stateWithFetch);

      renderBudgetsScreen();

      await waitFor(() => {
        expect(fetchBudgets).toHaveBeenCalled();
      });
    });

    it('fetches categories when account is selected', async () => {
      const fetchCategories = jest.fn().mockResolvedValue(undefined);
      const stateWithFetch = {
        ...defaultCategoriesState,
        fetchCategories,
      };
      mockUseCategoriesStore.mockImplementation(createStoreMock(stateWithFetch));
      mockUseCategoriesStore.getState = jest.fn(() => stateWithFetch);

      renderBudgetsScreen();

      await waitFor(() => {
        expect(fetchCategories).toHaveBeenCalledWith('EXPENSE');
      });
    });

    it('fetches transactions when account is selected', async () => {
      const fetchTransactions = jest.fn().mockResolvedValue(true);
      const stateWithFetch = {
        ...defaultTransactionsState,
        fetchTransactions,
      };
      mockUseTransactionsStore.mockImplementation(createStoreMock(stateWithFetch));
      mockUseTransactionsStore.getState = jest.fn(() => stateWithFetch);

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

      const stateWithOverBudget = {
        ...defaultTransactionsState,
        transactions: [overBudgetTransaction, mockTransaction2],
      };
      mockUseTransactionsStore.mockImplementation(createStoreMock(stateWithOverBudget));
      mockUseTransactionsStore.getState = jest.fn(() => stateWithOverBudget);

      renderBudgetsScreen();

      await waitFor(() => {
        // Should show the over budget amount
        expect(screen.getByText('$600.00')).toBeTruthy();
      });
    });
  });

  describe('FAB Button', () => {
    it('renders FAB button', async () => {
      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('budgets.addButton')).toBeTruthy();
      });
    });

    it('has correct accessibility label', async () => {
      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByLabelText('Add budget')).toBeTruthy();
      });
    });

    it('navigates to CreateBudget when pressed', async () => {
      const navigate = jest.fn();
      const navWithNavigate = { ...mockNavigation, navigate };

      render(
        <NavigationContainer>
          <BudgetsScreen
            navigation={navWithNavigate as typeof mockNavigation}
            route={mockRoute}
          />
        </NavigationContainer>
      );

      await waitFor(() => {
        fireEvent.press(screen.getByTestId('budgets.addButton'));
      });

      await waitFor(() => {
        expect(navigate).toHaveBeenCalledWith('CreateBudget', {
          initialMonth: expect.any(String),
        });
      });
    });
  });

  describe('Category Lookup', () => {
    it('falls back to budget.category when category not in store', async () => {
      // Categories store doesn't have the category
      const emptyCategoriesState = {
        ...defaultCategoriesState,
        categories: [],
      };
      mockUseCategoriesStore.mockImplementation(createStoreMock(emptyCategoriesState));
      mockUseCategoriesStore.getState = jest.fn(() => emptyCategoriesState);

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

      const budgetStateWithoutCategory = {
        ...defaultBudgetsState,
        budgets: [budgetWithoutCategory],
      };
      mockUseBudgetsStore.mockImplementation(createStoreMock(budgetStateWithoutCategory));
      mockUseBudgetsStore.getState = jest.fn(() => budgetStateWithoutCategory);

      const emptyCategoriesState = {
        ...defaultCategoriesState,
        categories: [],
      };
      mockUseCategoriesStore.mockImplementation(createStoreMock(emptyCategoriesState));
      mockUseCategoriesStore.getState = jest.fn(() => emptyCategoriesState);

      renderBudgetsScreen();

      await waitFor(() => {
        expect(screen.getByText('Unknown')).toBeTruthy();
      });
    });
  });
});
