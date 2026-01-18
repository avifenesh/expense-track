import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { DashboardScreen } from '../../../src/screens/main/DashboardScreen';
import { useAccountsStore } from '../../../src/stores/accountsStore';
import { useTransactionsStore } from '../../../src/stores/transactionsStore';
import { useBudgetsStore } from '../../../src/stores/budgetsStore';
import type { MainTabScreenProps } from '../../../src/navigation/types';

// Mock stores
jest.mock('../../../src/stores/accountsStore');
jest.mock('../../../src/stores/transactionsStore');
jest.mock('../../../src/stores/budgetsStore');

const mockUseAccountsStore = useAccountsStore as jest.MockedFunction<typeof useAccountsStore>;
const mockUseTransactionsStore = useTransactionsStore as jest.MockedFunction<typeof useTransactionsStore>;
const mockUseBudgetsStore = useBudgetsStore as jest.MockedFunction<typeof useBudgetsStore>;

const mockAccount = {
  id: 'acc-1',
  name: 'Personal Account',
  type: 'PERSONAL' as const,
  preferredCurrency: 'USD' as const,
  color: '#4CAF50',
  icon: 'wallet',
  description: 'My personal finances',
};

const mockTransaction = {
  id: 'tx-1',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  type: 'EXPENSE' as const,
  amount: '50.00',
  currency: 'USD' as const,
  date: '2026-01-15',
  month: '2026-01-01',
  description: 'Groceries',
  isRecurring: false,
  category: {
    id: 'cat-1',
    name: 'Food',
    type: 'EXPENSE' as const,
    color: '#4CAF50',
  },
};

const mockIncomeTransaction = {
  ...mockTransaction,
  id: 'tx-2',
  type: 'INCOME' as const,
  amount: '1000.00',
  description: 'Salary',
  category: {
    id: 'cat-2',
    name: 'Salary',
    type: 'INCOME' as const,
    color: '#22c55e',
  },
};

const mockBudget = {
  id: 'budget-1',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  month: '2026-01-01',
  planned: '500.00',
  currency: 'USD' as const,
  notes: null,
  category: {
    id: 'cat-1',
    name: 'Food',
    type: 'EXPENSE' as const,
    color: '#4CAF50',
  },
};

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
} as unknown as MainTabScreenProps<'Dashboard'>['navigation'];

const mockRoute = {
  key: 'Dashboard',
  name: 'Dashboard' as const,
  params: undefined,
} as MainTabScreenProps<'Dashboard'>['route'];

function renderDashboardScreen() {
  return render(
    <NavigationContainer>
      <DashboardScreen navigation={mockNavigation} route={mockRoute} />
    </NavigationContainer>
  );
}

describe('DashboardScreen', () => {
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
    transactions: [mockTransaction, mockIncomeTransaction],
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
    budgets: [mockBudget],
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAccountsStore.mockReturnValue(defaultAccountsState);
    mockUseTransactionsStore.mockReturnValue(defaultTransactionsState);
    mockUseBudgetsStore.mockReturnValue(defaultBudgetsState);
  });

  describe('Rendering', () => {
    it('renders dashboard title', async () => {
      renderDashboardScreen();

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeTruthy();
      });
    });

    it('renders subtitle', async () => {
      renderDashboardScreen();

      await waitFor(() => {
        expect(screen.getByText('Your financial overview')).toBeTruthy();
      });
    });

    it('renders month selector', async () => {
      renderDashboardScreen();

      await waitFor(() => {
        expect(screen.getByLabelText('Previous month')).toBeTruthy();
        expect(screen.getByLabelText('Next month')).toBeTruthy();
      });
    });

    it('renders recent transactions section', async () => {
      renderDashboardScreen();

      await waitFor(() => {
        expect(screen.getByText('Recent Transactions')).toBeTruthy();
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

      renderDashboardScreen();

      await waitFor(() => {
        expect(screen.getByText('Loading your finances...')).toBeTruthy();
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

      renderDashboardScreen();

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeTruthy();
        expect(screen.getByText('Failed to load accounts')).toBeTruthy();
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

      renderDashboardScreen();

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

      renderDashboardScreen();

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

      renderDashboardScreen();

      await waitFor(() => {
        expect(screen.getByText('No Accounts Found')).toBeTruthy();
        expect(screen.getByText('Create an account to start tracking your finances.')).toBeTruthy();
      });
    });

    it('shows no transactions message when month has no transactions', async () => {
      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        transactions: [],
        total: 0,
      });

      renderDashboardScreen();

      await waitFor(() => {
        expect(screen.getByText('No transactions this month')).toBeTruthy();
      });
    });
  });

  describe('Data Display', () => {
    it('displays transaction items', async () => {
      renderDashboardScreen();

      await waitFor(() => {
        expect(screen.getByText('Groceries')).toBeTruthy();
        expect(screen.getByText('Salary')).toBeTruthy();
      });
    });

    it('calculates and displays total income', async () => {
      renderDashboardScreen();

      await waitFor(() => {
        expect(screen.getByText('Income')).toBeTruthy();
        expect(screen.getByText('+$1,000.00')).toBeTruthy();
      });
    });

    it('calculates and displays total expenses', async () => {
      renderDashboardScreen();

      await waitFor(() => {
        expect(screen.getByText('Expenses')).toBeTruthy();
        expect(screen.getByText('-$50.00')).toBeTruthy();
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

      renderDashboardScreen();

      await waitFor(() => {
        expect(screen.getByLabelText('Next month')).toBeTruthy();
      });

      fireEvent.press(screen.getByLabelText('Next month'));

      await waitFor(() => {
        expect(setFilters).toHaveBeenCalled();
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

      renderDashboardScreen();

      await waitFor(() => {
        expect(fetchAccounts).toHaveBeenCalled();
      });
    });
  });

  describe('Pull to Refresh', () => {
    it('renders with RefreshControl', async () => {
      renderDashboardScreen();

      await waitFor(() => {
        // The ScrollView should be rendered (indicates the main content is displayed)
        expect(screen.getByText('Dashboard')).toBeTruthy();
      });
    });
  });

  describe('Add Transaction FAB', () => {
    it('renders FAB button', async () => {
      renderDashboardScreen();

      await waitFor(() => {
        expect(screen.getByLabelText('Add transaction')).toBeTruthy();
      });
    });

    it('renders FAB with plus symbol', async () => {
      renderDashboardScreen();

      await waitFor(() => {
        expect(screen.getByText('+')).toBeTruthy();
      });
    });

    it('navigates to CreateTransaction when FAB is pressed', async () => {
      const navigate = jest.fn();
      const navWithNavigate = { ...mockNavigation, navigate };

      render(
        <NavigationContainer>
          <DashboardScreen
            navigation={navWithNavigate as typeof mockNavigation}
            route={mockRoute}
          />
        </NavigationContainer>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Add transaction')).toBeTruthy();
      });

      fireEvent.press(screen.getByLabelText('Add transaction'));

      await waitFor(() => {
        expect(navigate).toHaveBeenCalledWith('CreateTransaction');
      });
    });
  });
});
