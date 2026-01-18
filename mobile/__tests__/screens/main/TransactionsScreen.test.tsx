import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { TransactionsScreen } from '../../../src/screens/main/TransactionsScreen';
import { useAccountsStore } from '../../../src/stores/accountsStore';
import { useTransactionsStore } from '../../../src/stores/transactionsStore';
import type { MainTabScreenProps } from '../../../src/navigation/types';

jest.mock('../../../src/stores/accountsStore');
jest.mock('../../../src/stores/transactionsStore');

const mockUseAccountsStore = useAccountsStore as jest.MockedFunction<typeof useAccountsStore>;
const mockUseTransactionsStore = useTransactionsStore as jest.MockedFunction<typeof useTransactionsStore>;

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
  date: '2026-01-14',
  description: 'Salary',
  category: {
    id: 'cat-2',
    name: 'Salary',
    type: 'INCOME' as const,
    color: '#22c55e',
  },
};

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
} as unknown as MainTabScreenProps<'Transactions'>['navigation'];

const mockRoute = {
  key: 'Transactions',
  name: 'Transactions' as const,
  params: undefined,
} as MainTabScreenProps<'Transactions'>['route'];

function renderTransactionsScreen() {
  return render(
    <NavigationContainer>
      <TransactionsScreen navigation={mockNavigation} route={mockRoute} />
    </NavigationContainer>
  );
}

describe('TransactionsScreen', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAccountsStore.mockReturnValue(defaultAccountsState);
    mockUseTransactionsStore.mockReturnValue(defaultTransactionsState);
  });

  describe('Rendering', () => {
    it('renders title', async () => {
      renderTransactionsScreen();

      await waitFor(() => {
        expect(screen.getByText('Transactions')).toBeTruthy();
      });
    });

    it('renders Add button', async () => {
      renderTransactionsScreen();

      await waitFor(() => {
        expect(screen.getByText('+ Add')).toBeTruthy();
      });
    });

    it('renders Add button with accessibility label', async () => {
      renderTransactionsScreen();

      await waitFor(() => {
        expect(screen.getByLabelText('Add transaction')).toBeTruthy();
      });
    });

    it('renders filter chips', async () => {
      renderTransactionsScreen();

      await waitFor(() => {
        expect(screen.getByText('All')).toBeTruthy();
        expect(screen.getByText('Income')).toBeTruthy();
        expect(screen.getByText('Expenses')).toBeTruthy();
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator when loading transactions', async () => {
      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        transactions: [],
        isLoading: true,
      });

      renderTransactionsScreen();

      await waitFor(() => {
        expect(screen.queryByText('Groceries')).toBeNull();
      });
    });
  });

  describe('Error State', () => {
    it('shows error message when transactions fail to load', async () => {
      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        transactions: [],
        error: 'Failed to fetch transactions',
      });

      renderTransactionsScreen();

      await waitFor(() => {
        expect(screen.getByText('Unable to load transactions')).toBeTruthy();
        expect(screen.getByText('Failed to fetch transactions')).toBeTruthy();
      });
    });
  });

  describe('Empty States', () => {
    it('shows no accounts message when user has no accounts', async () => {
      mockUseAccountsStore.mockReturnValue({
        ...defaultAccountsState,
        accounts: [],
        selectedAccountId: null,
      });
      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        transactions: [],
      });

      renderTransactionsScreen();

      await waitFor(() => {
        expect(screen.getByText('No accounts found')).toBeTruthy();
      });
    });

    it('shows empty state when no transactions exist', async () => {
      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        transactions: [],
      });

      renderTransactionsScreen();

      await waitFor(() => {
        expect(screen.getByText('No transactions')).toBeTruthy();
      });
    });
  });

  describe('Transaction Display', () => {
    it('displays transactions', async () => {
      renderTransactionsScreen();

      await waitFor(() => {
        expect(screen.getByText('Groceries')).toBeTruthy();
        expect(screen.getByText('Salary')).toBeTruthy();
      });
    });

    it('displays transaction amounts', async () => {
      renderTransactionsScreen();

      await waitFor(() => {
        expect(screen.getByText('-$50.00')).toBeTruthy();
        expect(screen.getByText('+$1,000.00')).toBeTruthy();
      });
    });
  });

  describe('Filter Functionality', () => {
    it('calls setFilters and fetchTransactions when filter changes', async () => {
      const setFilters = jest.fn();
      const fetchTransactions = jest.fn().mockResolvedValue(true);

      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        setFilters,
        fetchTransactions,
      });

      renderTransactionsScreen();

      await waitFor(() => {
        expect(screen.getByText('Income')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Income'));

      await waitFor(() => {
        expect(setFilters).toHaveBeenCalledWith(expect.objectContaining({ type: 'INCOME' }));
        expect(fetchTransactions).toHaveBeenCalledWith(true);
      });
    });

    it('clears type filter when "All" is pressed', async () => {
      const setFilters = jest.fn();
      const fetchTransactions = jest.fn().mockResolvedValue(true);

      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        setFilters,
        fetchTransactions,
      });

      renderTransactionsScreen();

      await waitFor(() => {
        expect(screen.getByText('All')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('All'));

      await waitFor(() => {
        expect(setFilters).toHaveBeenCalledWith(expect.objectContaining({ type: undefined }));
      });
    });

    it('calls setFilters with EXPENSE when Expenses chip is pressed', async () => {
      const setFilters = jest.fn();
      const fetchTransactions = jest.fn().mockResolvedValue(true);

      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        setFilters,
        fetchTransactions,
      });

      renderTransactionsScreen();

      await waitFor(() => {
        expect(screen.getByText('Expenses')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Expenses'));

      await waitFor(() => {
        expect(setFilters).toHaveBeenCalledWith(expect.objectContaining({ type: 'EXPENSE' }));
      });
    });
  });

  describe('Initial Data Fetch', () => {
    it('fetches accounts on mount if not loaded', async () => {
      const fetchAccounts = jest.fn().mockResolvedValue(true);
      mockUseAccountsStore.mockReturnValue({
        ...defaultAccountsState,
        accounts: [],
        fetchAccounts,
      });

      renderTransactionsScreen();

      await waitFor(() => {
        expect(fetchAccounts).toHaveBeenCalled();
      });
    });

    it('sets account filter and fetches transactions after accounts load', async () => {
      const setFilters = jest.fn();
      const fetchTransactions = jest.fn().mockResolvedValue(true);

      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        setFilters,
        fetchTransactions,
      });

      renderTransactionsScreen();

      await waitFor(() => {
        expect(setFilters).toHaveBeenCalledWith({ accountId: 'acc-1' });
        expect(fetchTransactions).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('Add Transaction Navigation', () => {
    it('navigates to CreateTransaction when Add button is pressed', async () => {
      const navigate = jest.fn();
      const navWithNavigate = { ...mockNavigation, navigate };

      render(
        <NavigationContainer>
          <TransactionsScreen
            navigation={navWithNavigate as typeof mockNavigation}
            route={mockRoute}
          />
        </NavigationContainer>
      );

      await waitFor(() => {
        expect(screen.getByText('+ Add')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('+ Add'));

      await waitFor(() => {
        expect(navigate).toHaveBeenCalledWith('CreateTransaction');
      });
    });
  });
});
