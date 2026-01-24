import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { MainTabNavigator } from '../../src/navigation/MainTabNavigator';
import { useAccountsStore } from '../../src/stores/accountsStore';
import { useTransactionsStore } from '../../src/stores/transactionsStore';
import { useBudgetsStore } from '../../src/stores/budgetsStore';
import { useCategoriesStore } from '../../src/stores/categoriesStore';
import { useSharingStore } from '../../src/stores/sharingStore';
import { useOfflineQueueStore } from '../../src/stores/offlineQueueStore';
import { createMockStoreImplementation } from '../utils/mockZustandStore';

// Mock all stores used by screens in MainTabNavigator
jest.mock('../../src/stores/accountsStore');
jest.mock('../../src/stores/transactionsStore');
jest.mock('../../src/stores/budgetsStore');
jest.mock('../../src/stores/categoriesStore');
jest.mock('../../src/stores/sharingStore');
jest.mock('../../src/stores/offlineQueueStore');

// Mock auth service
jest.mock('../../src/services/auth', () => ({
  logout: jest.fn().mockResolvedValue(undefined),
}));

const mockUseAccountsStore = useAccountsStore as jest.MockedFunction<typeof useAccountsStore>;
const mockUseTransactionsStore = useTransactionsStore as jest.MockedFunction<typeof useTransactionsStore>;
const mockUseBudgetsStore = useBudgetsStore as jest.MockedFunction<typeof useBudgetsStore>;
const mockUseCategoriesStore = useCategoriesStore as jest.MockedFunction<typeof useCategoriesStore>;
const mockUseSharingStore = useSharingStore as jest.MockedFunction<typeof useSharingStore>;
const mockUseOfflineQueueStore = useOfflineQueueStore as jest.MockedFunction<typeof useOfflineQueueStore>;

const mockAccount = {
  id: 'acc-1',
  userId: 'user-1',
  name: 'Main Account',
  preferredCurrency: 'USD' as const,
  isDefault: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockTransaction = {
  id: 'tx-1',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  type: 'EXPENSE' as const,
  amount: 50,
  currency: 'USD' as const,
  description: 'Test expense',
  date: '2026-01-15',
  month: '2026-01-01',
  isRecurring: false,
  category: {
    id: 'cat-1',
    name: 'Food',
    type: 'EXPENSE' as const,
    icon: 'food',
    color: '#FF5722',
    isArchived: false,
  },
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
};

const mockCategory = {
  id: 'cat-1',
  accountId: 'acc-1',
  name: 'Food',
  type: 'EXPENSE' as const,
  icon: 'food',
  color: '#FF5722',
  isArchived: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockBudget = {
  id: 'budget-1',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  month: '2026-01-01',
  amount: 500,
  spent: 50,
  remaining: 450,
  currency: 'USD' as const,
  category: mockCategory,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
};

const mockSharedExpense = {
  id: 'share-1',
  transactionId: 'tx-1',
  splitType: 'EQUAL' as const,
  description: 'Test shared expense',
  totalAmount: '100.00',
  currency: 'USD' as const,
  createdAt: '2026-01-15T12:00:00Z',
  transaction: {
    id: 'tx-1',
    date: '2026-01-15',
    description: 'Restaurant dinner',
    category: { id: 'cat-1', name: 'Food' },
  },
  participants: [],
  totalOwed: '0.00',
  totalPaid: '0.00',
  allSettled: true,
};

const mockSettlementBalance = {
  userId: 'user-2',
  userEmail: 'friend@example.com',
  userDisplayName: 'Friend',
  currency: 'USD' as const,
  youOwe: '0.00',
  theyOwe: '50.00',
  netBalance: '50.00',
};

const setupStoreMock = <T extends object>(mock: jest.Mock, state: T) => {
  mock.mockImplementation(createMockStoreImplementation(state));
  (mock as jest.Mock & { getState: () => T }).getState = jest.fn(() => state);
};

describe('MainTabNavigator', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    setupStoreMock(mockUseAccountsStore, {
      accounts: [mockAccount],
      activeAccountId: 'acc-1',
      isLoading: false,
      error: null,
      fetchAccounts: jest.fn().mockResolvedValue([mockAccount]),
      setActiveAccount: jest.fn(),
      createAccount: jest.fn(),
      updateAccount: jest.fn(),
      deleteAccount: jest.fn(),
      clearError: jest.fn(),
      reset: jest.fn(),
    });

    setupStoreMock(mockUseTransactionsStore, {
      transactions: [mockTransaction],
      filters: { month: '2026-01-01' },
      isLoading: false,
      error: null,
      fetchTransactions: jest.fn().mockResolvedValue([mockTransaction]),
      setFilters: jest.fn(),
      createTransaction: jest.fn(),
      updateTransaction: jest.fn(),
      deleteTransaction: jest.fn(),
      clearError: jest.fn(),
      reset: jest.fn(),
    });

    setupStoreMock(mockUseBudgetsStore, {
      budgets: [mockBudget],
      filters: { accountId: 'acc-1', month: '2026-01-01' },
      selectedMonth: '2026-01',
      isLoading: false,
      error: null,
      fetchBudgets: jest.fn().mockResolvedValue([mockBudget]),
      setFilters: jest.fn(),
      setSelectedMonth: jest.fn(),
      createOrUpdateBudget: jest.fn(),
      deleteBudget: jest.fn(),
      clearError: jest.fn(),
      reset: jest.fn(),
    });

    setupStoreMock(mockUseCategoriesStore, {
      categories: [mockCategory],
      isLoading: false,
      error: null,
      fetchCategories: jest.fn().mockResolvedValue([mockCategory]),
      createCategory: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
      archiveCategory: jest.fn(),
      unarchiveCategory: jest.fn(),
      getCategoriesByType: jest.fn().mockReturnValue([mockCategory]),
      clearError: jest.fn(),
      reset: jest.fn(),
    });

    setupStoreMock(mockUseSharingStore, {
      sharedByMe: [mockSharedExpense],
      sharedWithMe: [],
      settlementBalances: [mockSettlementBalance],
      isLoading: false,
      error: null,
      fetchSharing: jest.fn(),
      shareExpense: jest.fn(),
      markParticipantPaid: jest.fn(),
      sendReminder: jest.fn(),
      lookupUser: jest.fn(),
      clearError: jest.fn(),
      reset: jest.fn(),
    });

    setupStoreMock(mockUseOfflineQueueStore, {
      items: [],
      isSyncing: false,
      syncError: null,
      lastSyncAttempt: null,
      addToQueue: jest.fn(),
      removeFromQueue: jest.fn(),
      processQueue: jest.fn(),
      loadFromStorage: jest.fn(),
      getQueueCount: jest.fn().mockReturnValue(0),
      reset: jest.fn(),
    });
  });

  it('renders all five tabs', async () => {
    render(
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    );

    await waitFor(() => {
      expect(screen.getByText('Home')).toBeTruthy();
      expect(screen.getByText('Transactions')).toBeTruthy();
      expect(screen.getByText('Budgets')).toBeTruthy();
      expect(screen.getByText('Sharing')).toBeTruthy();
      expect(screen.getByText('Settings')).toBeTruthy();
    });
  });

  it('shows dashboard by default', async () => {
    render(
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    );

    await waitFor(() => {
      expect(screen.getByText('Your financial overview')).toBeTruthy();
      expect(screen.getByText('This Month')).toBeTruthy();
    });
  });

  it('navigates to transactions tab', async () => {
    render(
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    );

    await waitFor(() => {
      expect(screen.getByText('Transactions')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Transactions'));

    await waitFor(() => {
      expect(screen.getByText('+ Add')).toBeTruthy();
      expect(screen.getByText('All')).toBeTruthy();
    });
  });

  it('navigates to budgets tab', async () => {
    render(
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    );

    await waitFor(() => {
      expect(screen.getByText('Budgets')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Budgets'));

    await waitFor(() => {
      expect(screen.getByText('Track your spending by category')).toBeTruthy();
    });
  });

  it('navigates to sharing tab', async () => {
    render(
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    );

    await waitFor(() => {
      expect(screen.getByText('Sharing')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Sharing'));

    await waitFor(() => {
      expect(screen.getByText('Net Balance')).toBeTruthy();
      expect(screen.getByText('+ Share')).toBeTruthy();
    });
  });

  it('navigates to settings tab', async () => {
    render(
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    );

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Settings'));

    await waitFor(() => {
      expect(screen.getByText('Account')).toBeTruthy();
      expect(screen.getByText('Profile')).toBeTruthy();
      expect(screen.getByText('Sign Out')).toBeTruthy();
    });
  });

  it('maintains tab state when switching between tabs', async () => {
    render(
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('Transactions')).toBeTruthy();
    });

    // Go to transactions
    fireEvent.press(screen.getByText('Transactions'));
    await waitFor(() => {
      expect(screen.getByText('+ Add')).toBeTruthy();
    });

    // Go to settings
    fireEvent.press(screen.getByText('Settings'));
    await waitFor(() => {
      expect(screen.getByText('Sign Out')).toBeTruthy();
    });

    // Go back to dashboard
    fireEvent.press(screen.getByText('Home'));
    await waitFor(() => {
      expect(screen.getByText('Your financial overview')).toBeTruthy();
    });
  });
});
