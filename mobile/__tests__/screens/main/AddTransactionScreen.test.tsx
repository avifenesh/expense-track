import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { NavigationContainer } from '@react-navigation/native'
import { AddTransactionScreen } from '../../../src/screens/main/AddTransactionScreen'
import { useAccountsStore } from '../../../src/stores/accountsStore'
import { useTransactionsStore } from '../../../src/stores/transactionsStore'
import { useCategoriesStore } from '../../../src/stores/categoriesStore'
import { createMockStoreImplementation } from '../../utils/mockZustandStore'
import type { AppStackScreenProps } from '../../../src/navigation/types'

// Mock stores
jest.mock('../../../src/stores/accountsStore')
jest.mock('../../../src/stores/transactionsStore')
jest.mock('../../../src/stores/categoriesStore')

// Mock toast store
const mockToastSuccess = jest.fn()
const mockToastError = jest.fn()
jest.mock('../../../src/stores/toastStore', () => ({
  useToastStore: {
    getState: () => ({
      success: mockToastSuccess,
      error: mockToastError,
    }),
  },
}))

const mockUseAccountsStore = useAccountsStore as jest.MockedFunction<typeof useAccountsStore>
const mockUseTransactionsStore = useTransactionsStore as jest.MockedFunction<typeof useTransactionsStore>
const mockUseCategoriesStore = useCategoriesStore as jest.MockedFunction<typeof useCategoriesStore>

const mockAccount = {
  id: 'acc-1',
  name: 'Personal Account',
  type: 'PERSONAL' as const,
  preferredCurrency: 'USD' as const,
  color: '#4CAF50',
  icon: 'wallet',
  description: 'My personal finances',
}

const mockExpenseCategory = {
  id: 'cat-1',
  name: 'Food',
  type: 'EXPENSE' as const,
  color: '#4CAF50',
  isArchived: false,
  isHolding: false,
}

const mockIncomeCategory = {
  id: 'cat-2',
  name: 'Salary',
  type: 'INCOME' as const,
  color: '#22c55e',
  isArchived: false,
  isHolding: false,
}

const mockArchivedCategory = {
  id: 'cat-3',
  name: 'Archived',
  type: 'EXPENSE' as const,
  color: '#888888',
  isArchived: true,
  isHolding: false,
}

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as unknown as AppStackScreenProps<'CreateTransaction'>['navigation']

const mockRoute = {
  key: 'CreateTransaction',
  name: 'CreateTransaction' as const,
  params: undefined,
} as AppStackScreenProps<'CreateTransaction'>['route']

function renderAddTransactionScreen() {
  return render(
    <NavigationContainer>
      <AddTransactionScreen navigation={mockNavigation} route={mockRoute} />
    </NavigationContainer>,
  )
}

describe('AddTransactionScreen', () => {
  const defaultAccountsState = {
    accounts: [mockAccount],
    activeAccountId: 'acc-1',
    isLoading: false,
    error: null,
    fetchAccounts: jest.fn().mockResolvedValue(true),
    setActiveAccount: jest.fn(),
    clearError: jest.fn(),
    reset: jest.fn(),
  }

  const defaultTransactionsState = {
    transactions: [],
    total: 0,
    hasMore: false,
    isLoading: false,
    error: null,
    filters: { accountId: 'acc-1' },
    offset: 0,
    limit: 50,
    fetchTransactions: jest.fn().mockResolvedValue(true),
    fetchMoreTransactions: jest.fn(),
    createTransaction: jest.fn().mockResolvedValue({
      id: 'tx-new',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: 'EXPENSE',
      amount: '50.00',
      currency: 'USD',
      date: '2026-01-15',
      month: '2026-01-01',
      description: 'Test',
      isRecurring: false,
      category: mockExpenseCategory,
    }),
    updateTransaction: jest.fn(),
    deleteTransaction: jest.fn(),
    setFilters: jest.fn(),
    clearError: jest.fn(),
    reset: jest.fn(),
  }

  const defaultCategoriesState = {
    categories: [mockExpenseCategory, mockIncomeCategory, mockArchivedCategory],
    isLoading: false,
    error: null,
    fetchCategories: jest.fn().mockResolvedValue(undefined),
    createCategory: jest.fn(),
    archiveCategory: jest.fn(),
    unarchiveCategory: jest.fn(),
    getCategoriesByType: jest.fn((type) => [mockExpenseCategory, mockIncomeCategory].filter((c) => c.type === type)),
    clearError: jest.fn(),
    reset: jest.fn(),
  }

  const setupStoreMock = <T extends object>(mock: jest.Mock, state: T) => {
    mock.mockImplementation(createMockStoreImplementation(state))
    ;(mock as jest.Mock & { getState: () => T }).getState = jest.fn(() => state)
  }

  beforeEach(() => {
    jest.clearAllMocks()
    setupStoreMock(mockUseAccountsStore, defaultAccountsState)
    setupStoreMock(mockUseTransactionsStore, defaultTransactionsState)
    setupStoreMock(mockUseCategoriesStore, defaultCategoriesState)
  })

  describe('Rendering', () => {
    it('renders screen title', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Add Transaction')).toBeTruthy()
      })
    })

    it('renders cancel button', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeTruthy()
      })
    })

    it('renders type selector with Expense and Income options', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Expense')).toBeTruthy()
        expect(screen.getByText('Income')).toBeTruthy()
      })
    })

    it('renders amount input', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        expect(screen.getByLabelText('Amount')).toBeTruthy()
      })
    })

    it('renders category section', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Category')).toBeTruthy()
      })
    })

    it('renders date section', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Date')).toBeTruthy()
      })
    })

    it('renders description input', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Description (Optional)')).toBeTruthy()
      })
    })

    it('renders save button', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Save Transaction')).toBeTruthy()
      })
    })

    it('renders currency symbol based on account', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('$')).toBeTruthy()
      })
    })
  })

  describe('Type Selector', () => {
    it('defaults to Expense type', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        const expenseButton = screen.getByLabelText('Expense')
        expect(expenseButton.props.accessibilityState.selected).toBe(true)
      })
    })

    it('switches to Income type when pressed', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Income'))
      })

      await waitFor(() => {
        const incomeButton = screen.getByLabelText('Income')
        expect(incomeButton.props.accessibilityState.selected).toBe(true)
      })
    })

    it('fetches categories when type changes', async () => {
      const fetchCategories = jest.fn().mockResolvedValue(undefined)
      setupStoreMock(mockUseCategoriesStore, {
        ...defaultCategoriesState,
        fetchCategories,
      })

      renderAddTransactionScreen()

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Income'))
      })

      await waitFor(() => {
        expect(fetchCategories).toHaveBeenCalledWith('INCOME')
      })
    })
  })

  describe('Category Selection', () => {
    it('displays expense categories when Expense type is selected', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Food')).toBeTruthy()
      })
    })

    it('filters out archived categories', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        expect(screen.queryByText('Archived')).toBeNull()
      })
    })

    it('shows loading indicator when categories are loading', async () => {
      setupStoreMock(mockUseCategoriesStore, {
        ...defaultCategoriesState,
        categories: [],
        isLoading: true,
      })

      renderAddTransactionScreen()

      // Should not show categories while loading
      await waitFor(() => {
        expect(screen.queryByText('Food')).toBeNull()
      })
    })

    it('shows empty message when no categories available', async () => {
      setupStoreMock(mockUseCategoriesStore, {
        ...defaultCategoriesState,
        categories: [],
        isLoading: false,
      })

      renderAddTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('No categories available for this type')).toBeTruthy()
      })
    })

    it('allows selecting a category', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        const categoryButton = screen.getByLabelText('Select Food category')
        expect(categoryButton.props.accessibilityState.selected).toBe(true)
      })
    })
  })

  describe('Amount Input', () => {
    it('allows entering numeric amount', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '50.00')
        expect(amountInput.props.value).toBe('50.00')
      })
    })

    it('filters out non-numeric characters', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, 'abc50.00xyz')
        expect(amountInput.props.value).toBe('50.00')
      })
    })

    it('allows only two decimal places', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '50.12')
        expect(amountInput.props.value).toBe('50.12')
      })

      // Try to add more decimal places
      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '50.123')
        // Should not update because more than 2 decimal places
        expect(amountInput.props.value).toBe('50.12')
      })
    })
  })

  describe('Description Input', () => {
    it('allows entering description', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        const descInput = screen.getByLabelText('Description')
        fireEvent.changeText(descInput, 'Test description')
        expect(descInput.props.value).toBe('Test description')
      })
    })

    it('shows character count', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('0/200')).toBeTruthy()
      })

      await waitFor(() => {
        const descInput = screen.getByLabelText('Description')
        fireEvent.changeText(descInput, 'Test')
      })

      await waitFor(() => {
        expect(screen.getByText('4/200')).toBeTruthy()
      })
    })
  })

  describe('Preview', () => {
    it('shows preview when amount and category are selected', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '50.00')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeTruthy()
        expect(screen.getByText('-$50.00')).toBeTruthy()
      })
    })

    it('does not show preview without amount', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        expect(screen.queryByText('Preview')).toBeNull()
      })
    })

    it('does not show preview without category', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '50.00')
      })

      await waitFor(() => {
        expect(screen.queryByText('Preview')).toBeNull()
      })
    })
  })

  describe('Form Validation', () => {
    it('shows error when submitting without amount', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Transaction'))
      })

      await waitFor(() => {
        expect(screen.getByText('Amount is required')).toBeTruthy()
      })
    })

    it('shows error when submitting without category', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '50.00')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Transaction'))
      })

      await waitFor(() => {
        expect(screen.getByText('Please select a category')).toBeTruthy()
      })
    })

    it('shows error for zero amount', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '0')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Transaction'))
      })

      await waitFor(() => {
        expect(screen.getByText('Amount must be greater than zero')).toBeTruthy()
      })
    })
  })

  describe('Form Submission', () => {
    it('calls createTransaction with correct data', async () => {
      const createTransaction = jest.fn().mockResolvedValue({
        id: 'tx-new',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: 'EXPENSE',
        amount: '50.00',
        currency: 'USD',
        date: '2026-01-15',
        month: '2026-01-01',
        description: 'Test purchase',
        isRecurring: false,
        category: mockExpenseCategory,
      })

      setupStoreMock(mockUseTransactionsStore, {
        ...defaultTransactionsState,
        createTransaction,
      })

      renderAddTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '50.00')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        const descInput = screen.getByLabelText('Description')
        fireEvent.changeText(descInput, 'Test purchase')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Transaction'))
      })

      await waitFor(() => {
        expect(createTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            accountId: 'acc-1',
            categoryId: 'cat-1',
            type: 'EXPENSE',
            amount: 50,
            currency: 'USD',
            description: 'Test purchase',
            isRecurring: false,
          }),
        )
      })
    })

    it('navigates back after successful submission', async () => {
      const goBack = jest.fn()
      const navWithGoBack = { ...mockNavigation, goBack }

      render(
        <NavigationContainer>
          <AddTransactionScreen navigation={navWithGoBack as typeof mockNavigation} route={mockRoute} />
        </NavigationContainer>,
      )

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '50.00')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Transaction'))
      })

      await waitFor(() => {
        expect(goBack).toHaveBeenCalled()
      })
    })

    it('shows success toast on successful submission', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '50.00')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Transaction'))
      })

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Transaction created')
      })
    })

    it('shows error toast on submission failure', async () => {
      const createTransaction = jest.fn().mockRejectedValue(new Error('Network error'))

      setupStoreMock(mockUseTransactionsStore, {
        ...defaultTransactionsState,
        createTransaction,
      })

      renderAddTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '50.00')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Transaction'))
      })

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Network error')
      })
    })

    it('disables submit button while submitting', async () => {
      let resolvePromise: (value: unknown) => void
      const createTransaction = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve
          }),
      )

      setupStoreMock(mockUseTransactionsStore, {
        ...defaultTransactionsState,
        createTransaction,
      })

      renderAddTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '50.00')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Transaction'))
      })

      await waitFor(() => {
        const submitButton = screen.getByLabelText('Save transaction')
        expect(submitButton.props.accessibilityState.disabled).toBe(true)
      })

      // Resolve the promise to clean up
      resolvePromise!({})
    })
  })

  describe('Cancel Action', () => {
    it('navigates back when cancel is pressed', async () => {
      const goBack = jest.fn()
      const navWithGoBack = { ...mockNavigation, goBack }

      render(
        <NavigationContainer>
          <AddTransactionScreen navigation={navWithGoBack as typeof mockNavigation} route={mockRoute} />
        </NavigationContainer>,
      )

      await waitFor(() => {
        fireEvent.press(screen.getByText('Cancel'))
      })

      await waitFor(() => {
        expect(goBack).toHaveBeenCalled()
      })
    })
  })

  describe('No Account Selected', () => {
    it('shows error when no account is selected', async () => {
      setupStoreMock(mockUseAccountsStore, {
        ...defaultAccountsState,
        activeAccountId: null,
      })

      renderAddTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '50.00')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Transaction'))
      })

      await waitFor(() => {
        expect(screen.getByText('No account selected')).toBeTruthy()
      })
    })
  })

  describe('Currency Display', () => {
    it('shows EUR symbol for EUR accounts', async () => {
      setupStoreMock(mockUseAccountsStore, {
        ...defaultAccountsState,
        accounts: [{ ...mockAccount, preferredCurrency: 'EUR' as const }],
      })

      renderAddTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('\u20AC')).toBeTruthy()
      })
    })

    it('shows ILS symbol for ILS accounts', async () => {
      setupStoreMock(mockUseAccountsStore, {
        ...defaultAccountsState,
        accounts: [{ ...mockAccount, preferredCurrency: 'ILS' as const }],
      })

      renderAddTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('\u20AA')).toBeTruthy()
      })
    })
  })

  describe('Accessibility', () => {
    it('has accessible type buttons', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        expect(screen.getByLabelText('Expense')).toBeTruthy()
        expect(screen.getByLabelText('Income')).toBeTruthy()
      })
    })

    it('has accessible amount input', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        expect(amountInput.props.accessibilityHint).toBe('Enter the transaction amount')
      })
    })

    it('has accessible save button', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        const saveButton = screen.getByLabelText('Save transaction')
        expect(saveButton).toBeTruthy()
      })
    })

    it('has accessible cancel button', async () => {
      renderAddTransactionScreen()

      await waitFor(() => {
        const cancelButton = screen.getByLabelText('Cancel')
        expect(cancelButton).toBeTruthy()
      })
    })
  })
})
