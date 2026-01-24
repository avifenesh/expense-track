import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { NavigationContainer } from '@react-navigation/native'
import { EditTransactionScreen } from '../../../src/screens/main/EditTransactionScreen'
import { useAccountsStore } from '../../../src/stores/accountsStore'
import { useTransactionsStore } from '../../../src/stores/transactionsStore'
import { useCategoriesStore } from '../../../src/stores/categoriesStore'
import type { AppStackScreenProps } from '../../../src/navigation/types'
import { Alert } from 'react-native'

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

// Mock Alert (still needed for delete confirmation dialog)
jest.spyOn(Alert, 'alert')

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

const mockTransaction = {
  id: 'tx-1',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  type: 'EXPENSE' as const,
  amount: '50.00',
  currency: 'USD' as const,
  date: '2026-01-15',
  month: '2026-01-01',
  description: 'Lunch',
  isRecurring: false,
  category: mockExpenseCategory,
}

const mockIncomeTransaction = {
  id: 'tx-2',
  accountId: 'acc-1',
  categoryId: 'cat-2',
  type: 'INCOME' as const,
  amount: '1000.00',
  currency: 'USD' as const,
  date: '2026-01-10',
  month: '2026-01-01',
  description: 'Monthly salary',
  isRecurring: false,
  category: mockIncomeCategory,
}

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as unknown as AppStackScreenProps<'EditTransaction'>['navigation']

const mockRoute = {
  key: 'EditTransaction',
  name: 'EditTransaction' as const,
  params: { transactionId: 'tx-1' },
} as AppStackScreenProps<'EditTransaction'>['route']

function renderEditTransactionScreen(route = mockRoute, navigation = mockNavigation) {
  return render(
    <NavigationContainer>
      <EditTransactionScreen navigation={navigation} route={route} />
    </NavigationContainer>,
  )
}

describe('EditTransactionScreen', () => {
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
    updateTransaction: jest.fn().mockResolvedValue(mockTransaction),
    deleteTransaction: jest.fn().mockResolvedValue(undefined),
    setFilters: jest.fn(),
    clearError: jest.fn(),
    reset: jest.fn(),
  }

  const defaultCategoriesState = {
    categories: [mockExpenseCategory, mockIncomeCategory],
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

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAccountsStore.mockReturnValue(defaultAccountsState)
    mockUseTransactionsStore.mockReturnValue(defaultTransactionsState)
    mockUseCategoriesStore.mockReturnValue(defaultCategoriesState)
  })

  describe('Rendering', () => {
    it('renders screen title "Edit Transaction"', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Edit Transaction')).toBeTruthy()
      })
    })

    it('renders update button text', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Update Transaction')).toBeTruthy()
      })
    })

    it('renders delete button', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Delete Transaction')).toBeTruthy()
      })
    })

    it('renders cancel button', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeTruthy()
      })
    })

    it('renders type selector with Expense and Income options', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Expense')).toBeTruthy()
        expect(screen.getByText('Income')).toBeTruthy()
      })
    })

    it('renders amount input', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        expect(screen.getByLabelText('Amount')).toBeTruthy()
      })
    })

    it('renders category section', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Category')).toBeTruthy()
      })
    })

    it('renders date section', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Date')).toBeTruthy()
      })
    })

    it('renders description input', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Description (Optional)')).toBeTruthy()
      })
    })

    it('renders currency symbol based on account', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('$')).toBeTruthy()
      })
    })
  })

  describe('Loading State', () => {
    it('shows loading indicator when transaction is being loaded', async () => {
      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        transactions: [],
      })

      renderEditTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Loading transaction...')).toBeTruthy()
      })
    })
  })

  describe('Error State - Transaction Not Found', () => {
    it('shows error when transaction is not found', async () => {
      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        transactions: [],
      })

      renderEditTransactionScreen()

      // First it shows loading, then after initialization it shows error
      await waitFor(
        () => {
          expect(screen.getByText('Transaction Not Found')).toBeTruthy()
        },
        { timeout: 2000 },
      )
    })

    it('shows go back button when transaction not found', async () => {
      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        transactions: [],
      })

      renderEditTransactionScreen()

      await waitFor(
        () => {
          expect(screen.getByText('Go Back')).toBeTruthy()
        },
        { timeout: 2000 },
      )
    })

    it('navigates back when go back button is pressed', async () => {
      const goBack = jest.fn()
      const navWithGoBack = { ...mockNavigation, goBack }

      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        transactions: [],
      })

      renderEditTransactionScreen(mockRoute, navWithGoBack as typeof mockNavigation)

      await waitFor(
        () => {
          const backButton = screen.getByText('Go Back')
          fireEvent.press(backButton)
        },
        { timeout: 2000 },
      )

      await waitFor(() => {
        expect(goBack).toHaveBeenCalled()
      })
    })
  })

  describe('Pre-population', () => {
    it('pre-populates amount from transaction', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        expect(amountInput.props.value).toBe('50.00')
      })
    })

    it('pre-populates description from transaction', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        const descInput = screen.getByLabelText('Description')
        expect(descInput.props.value).toBe('Lunch')
      })
    })

    it('pre-populates type selection (expense)', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        const expenseButton = screen.getByLabelText('Expense')
        expect(expenseButton.props.accessibilityState.selected).toBe(true)
      })
    })

    it('pre-populates type selection (income)', async () => {
      const incomeRoute = {
        ...mockRoute,
        params: { transactionId: 'tx-2' },
      }

      renderEditTransactionScreen(incomeRoute)

      await waitFor(() => {
        const incomeButton = screen.getByLabelText('Income')
        expect(incomeButton.props.accessibilityState.selected).toBe(true)
      })
    })

    it('pre-populates category selection', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        const categoryButton = screen.getByLabelText('Select Food category')
        expect(categoryButton.props.accessibilityState.selected).toBe(true)
      })
    })
  })

  describe('Update Transaction', () => {
    it('calls updateTransaction with correct data', async () => {
      const updateTransaction = jest.fn().mockResolvedValue(mockTransaction)

      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        updateTransaction,
      })

      renderEditTransactionScreen()

      // Wait for pre-population
      await waitFor(() => {
        expect(screen.getByLabelText('Amount').props.value).toBe('50.00')
      })

      // Change amount
      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '75.00')
      })

      // Submit
      await waitFor(() => {
        fireEvent.press(screen.getByText('Update Transaction'))
      })

      await waitFor(() => {
        expect(updateTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'tx-1',
            categoryId: 'cat-1',
            type: 'EXPENSE',
            amount: 75,
            currency: 'USD',
          }),
        )
      })
    })

    it('navigates back on successful update', async () => {
      const goBack = jest.fn()
      const navWithGoBack = { ...mockNavigation, goBack }

      renderEditTransactionScreen(mockRoute, navWithGoBack as typeof mockNavigation)

      // Wait for pre-population
      await waitFor(() => {
        expect(screen.getByLabelText('Amount').props.value).toBe('50.00')
      })

      // Submit
      await waitFor(() => {
        fireEvent.press(screen.getByText('Update Transaction'))
      })

      await waitFor(() => {
        expect(goBack).toHaveBeenCalled()
      })
    })

    it('shows success toast on successful update', async () => {
      renderEditTransactionScreen()

      // Wait for pre-population
      await waitFor(() => {
        expect(screen.getByLabelText('Amount').props.value).toBe('50.00')
      })

      // Submit
      await waitFor(() => {
        fireEvent.press(screen.getByText('Update Transaction'))
      })

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Transaction updated')
      })
    })

    it('shows error toast on update failure', async () => {
      const updateTransaction = jest.fn().mockRejectedValue(new Error('Network error'))

      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        updateTransaction,
      })

      renderEditTransactionScreen()

      // Wait for pre-population
      await waitFor(() => {
        expect(screen.getByLabelText('Amount').props.value).toBe('50.00')
      })

      // Submit
      await waitFor(() => {
        fireEvent.press(screen.getByText('Update Transaction'))
      })

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Network error')
      })
    })

    it('disables submit button while submitting', async () => {
      let resolvePromise: (value: unknown) => void
      const updateTransaction = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve
          }),
      )

      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        updateTransaction,
      })

      renderEditTransactionScreen()

      // Wait for pre-population
      await waitFor(() => {
        expect(screen.getByLabelText('Amount').props.value).toBe('50.00')
      })

      // Submit
      await waitFor(() => {
        fireEvent.press(screen.getByText('Update Transaction'))
      })

      await waitFor(() => {
        const submitButton = screen.getByLabelText('Update transaction')
        expect(submitButton.props.accessibilityState.disabled).toBe(true)
      })

      // Resolve the promise to clean up
      resolvePromise!({})
    })
  })

  describe('Delete Transaction', () => {
    it('shows confirmation dialog when delete is pressed', async () => {
      renderEditTransactionScreen()

      // Wait for screen to load
      await waitFor(() => {
        expect(screen.getByText('Delete Transaction')).toBeTruthy()
      })

      // Press delete
      fireEvent.press(screen.getByText('Delete Transaction'))

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Delete Transaction',
          'Are you sure you want to delete this transaction? This action cannot be undone.',
          expect.arrayContaining([
            expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
            expect.objectContaining({ text: 'Delete', style: 'destructive' }),
          ]),
        )
      })
    })

    it('calls deleteTransaction when confirm is pressed', async () => {
      const deleteTransaction = jest.fn().mockResolvedValue(undefined)

      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        deleteTransaction,
      })

      // Mock Alert to immediately call the delete callback
      ;(Alert.alert as jest.Mock).mockImplementation((_title, _message, buttons) => {
        const deleteButton = buttons?.find((b: { text: string }) => b.text === 'Delete')
        deleteButton?.onPress?.()
      })

      renderEditTransactionScreen()

      // Wait for screen to load
      await waitFor(() => {
        expect(screen.getByText('Delete Transaction')).toBeTruthy()
      })

      // Press delete
      fireEvent.press(screen.getByText('Delete Transaction'))

      await waitFor(() => {
        expect(deleteTransaction).toHaveBeenCalledWith('tx-1')
      })
    })

    it('navigates back after successful delete', async () => {
      const goBack = jest.fn()
      const deleteTransaction = jest.fn().mockResolvedValue(undefined)
      const navWithGoBack = { ...mockNavigation, goBack }

      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        deleteTransaction,
      })

      // Mock Alert to immediately call the delete callback
      ;(Alert.alert as jest.Mock).mockImplementation((_title, _message, buttons) => {
        const deleteButton = buttons?.find((b: { text: string }) => b.text === 'Delete')
        deleteButton?.onPress?.()
      })

      renderEditTransactionScreen(mockRoute, navWithGoBack as typeof mockNavigation)

      // Wait for screen to load
      await waitFor(() => {
        expect(screen.getByText('Delete Transaction')).toBeTruthy()
      })

      // Press delete
      fireEvent.press(screen.getByText('Delete Transaction'))

      await waitFor(() => {
        expect(goBack).toHaveBeenCalled()
      })
    })

    it('shows success toast on successful delete', async () => {
      const deleteTransaction = jest.fn().mockResolvedValue(undefined)

      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        deleteTransaction,
      })

      // Mock Alert to immediately call the delete callback
      ;(Alert.alert as jest.Mock).mockImplementation((_title, _message, buttons) => {
        const deleteButton = buttons?.find((b: { text: string }) => b.text === 'Delete')
        deleteButton?.onPress?.()
      })

      renderEditTransactionScreen()

      // Wait for screen to load
      await waitFor(() => {
        expect(screen.getByText('Delete Transaction')).toBeTruthy()
      })

      // Press delete
      fireEvent.press(screen.getByText('Delete Transaction'))

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Transaction deleted')
      })
    })

    it('shows error toast on delete failure', async () => {
      const deleteTransaction = jest.fn().mockRejectedValue(new Error('Delete failed'))

      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        deleteTransaction,
      })

      // Mock Alert for delete confirmation
      let deleteCallback: (() => Promise<void>) | undefined
      ;(Alert.alert as jest.Mock).mockImplementation((title, _message, buttons) => {
        if (title === 'Delete Transaction') {
          const deleteButton = buttons?.find((b: { text: string }) => b.text === 'Delete')
          deleteCallback = deleteButton?.onPress
        }
      })

      renderEditTransactionScreen()

      // Wait for screen to load
      await waitFor(() => {
        expect(screen.getByText('Delete Transaction')).toBeTruthy()
      })

      // Press delete
      fireEvent.press(screen.getByText('Delete Transaction'))

      // Execute the delete callback
      if (deleteCallback) {
        await deleteCallback()
      }

      // Check that error toast was shown
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Delete failed')
      })
    })

    it('does not delete when cancel is pressed', async () => {
      const deleteTransaction = jest.fn()

      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        deleteTransaction,
      })

      // Mock Alert to call cancel
      ;(Alert.alert as jest.Mock).mockImplementation((_title, _message, buttons) => {
        const cancelButton = buttons?.find((b: { text: string }) => b.text === 'Cancel')
        cancelButton?.onPress?.()
      })

      renderEditTransactionScreen()

      // Wait for screen to load
      await waitFor(() => {
        expect(screen.getByText('Delete Transaction')).toBeTruthy()
      })

      // Press delete
      fireEvent.press(screen.getByText('Delete Transaction'))

      // deleteTransaction should not be called
      expect(deleteTransaction).not.toHaveBeenCalled()
    })

    it('disables delete button while deleting', async () => {
      let resolvePromise: (value: unknown) => void
      const deleteTransaction = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve
          }),
      )

      mockUseTransactionsStore.mockReturnValue({
        ...defaultTransactionsState,
        deleteTransaction,
      })

      // Mock Alert to immediately call the delete callback
      ;(Alert.alert as jest.Mock).mockImplementation((_title, _message, buttons) => {
        const deleteButton = buttons?.find((b: { text: string }) => b.text === 'Delete')
        deleteButton?.onPress?.()
      })

      renderEditTransactionScreen()

      // Wait for screen to load
      await waitFor(() => {
        expect(screen.getByText('Delete Transaction')).toBeTruthy()
      })

      // Press delete
      fireEvent.press(screen.getByText('Delete Transaction'))

      await waitFor(() => {
        const deleteButton = screen.getByLabelText('Delete transaction')
        expect(deleteButton.props.accessibilityState.disabled).toBe(true)
      })

      // Resolve the promise to clean up
      resolvePromise!(undefined)
    })
  })

  describe('Form Validation', () => {
    it('shows error when submitting without amount', async () => {
      renderEditTransactionScreen()

      // Wait for pre-population
      await waitFor(() => {
        expect(screen.getByLabelText('Amount').props.value).toBe('50.00')
      })

      // Clear amount
      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '')
      })

      // Submit
      await waitFor(() => {
        fireEvent.press(screen.getByText('Update Transaction'))
      })

      await waitFor(() => {
        expect(screen.getByText('Amount is required')).toBeTruthy()
      })
    })

    it('shows error for zero amount', async () => {
      renderEditTransactionScreen()

      // Wait for pre-population
      await waitFor(() => {
        expect(screen.getByLabelText('Amount').props.value).toBe('50.00')
      })

      // Set amount to 0
      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '0')
      })

      // Submit
      await waitFor(() => {
        fireEvent.press(screen.getByText('Update Transaction'))
      })

      await waitFor(() => {
        expect(screen.getByText('Amount must be greater than zero')).toBeTruthy()
      })
    })

    it('shows error when category is cleared after type change', async () => {
      renderEditTransactionScreen()

      // Wait for pre-population
      await waitFor(() => {
        expect(screen.getByLabelText('Amount').props.value).toBe('50.00')
      })

      // Change type to Income (this clears the category)
      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Income'))
      })

      // Submit
      await waitFor(() => {
        fireEvent.press(screen.getByText('Update Transaction'))
      })

      await waitFor(() => {
        expect(screen.getByText('Please select a category')).toBeTruthy()
      })
    })
  })

  describe('Amount Input', () => {
    it('allows editing amount', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '99.99')
        expect(amountInput.props.value).toBe('99.99')
      })
    })

    it('filters out non-numeric characters', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, 'abc123.45xyz')
        expect(amountInput.props.value).toBe('123.45')
      })
    })

    it('allows only two decimal places', async () => {
      renderEditTransactionScreen()

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
    it('allows editing description', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        const descInput = screen.getByLabelText('Description')
        fireEvent.changeText(descInput, 'Updated description')
        expect(descInput.props.value).toBe('Updated description')
      })
    })

    it('shows character count', async () => {
      renderEditTransactionScreen()

      // Pre-populated with "Lunch" (5 chars)
      await waitFor(() => {
        expect(screen.getByText('5/200')).toBeTruthy()
      })

      await waitFor(() => {
        const descInput = screen.getByLabelText('Description')
        fireEvent.changeText(descInput, 'Updated')
      })

      await waitFor(() => {
        expect(screen.getByText('7/200')).toBeTruthy()
      })
    })
  })

  describe('Cancel Action', () => {
    it('navigates back when cancel is pressed', async () => {
      const goBack = jest.fn()
      const navWithGoBack = { ...mockNavigation, goBack }

      renderEditTransactionScreen(mockRoute, navWithGoBack as typeof mockNavigation)

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
      mockUseAccountsStore.mockReturnValue({
        ...defaultAccountsState,
        activeAccountId: null,
      })

      renderEditTransactionScreen()

      // Wait for pre-population
      await waitFor(() => {
        expect(screen.getByLabelText('Amount').props.value).toBe('50.00')
      })

      // Submit
      await waitFor(() => {
        fireEvent.press(screen.getByText('Update Transaction'))
      })

      await waitFor(() => {
        expect(screen.getByText('No account selected')).toBeTruthy()
      })
    })
  })

  describe('Currency Display', () => {
    it('shows EUR symbol for EUR accounts', async () => {
      mockUseAccountsStore.mockReturnValue({
        ...defaultAccountsState,
        accounts: [{ ...mockAccount, preferredCurrency: 'EUR' as const }],
      })

      renderEditTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('\u20AC')).toBeTruthy()
      })
    })

    it('shows ILS symbol for ILS accounts', async () => {
      mockUseAccountsStore.mockReturnValue({
        ...defaultAccountsState,
        accounts: [{ ...mockAccount, preferredCurrency: 'ILS' as const }],
      })

      renderEditTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('\u20AA')).toBeTruthy()
      })
    })
  })

  describe('Type Change', () => {
    it('clears category when type changes', async () => {
      renderEditTransactionScreen()

      // Wait for pre-population - category should be selected
      await waitFor(() => {
        const categoryButton = screen.getByLabelText('Select Food category')
        expect(categoryButton.props.accessibilityState.selected).toBe(true)
      })

      // Change type to Income
      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Income'))
      })

      // Category should now show Income categories, Food should not be selected
      await waitFor(() => {
        expect(screen.queryByLabelText('Select Food category')).toBeNull()
      })
    })

    it('fetches categories when type changes', async () => {
      const fetchCategories = jest.fn().mockResolvedValue(undefined)
      mockUseCategoriesStore.mockReturnValue({
        ...defaultCategoriesState,
        fetchCategories,
      })

      renderEditTransactionScreen()

      // Change type to Income
      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Income'))
      })

      await waitFor(() => {
        expect(fetchCategories).toHaveBeenCalledWith('INCOME')
      })
    })
  })

  describe('Preview', () => {
    it('shows preview when amount and category are selected', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeTruthy()
        expect(screen.getByText('-$50.00')).toBeTruthy()
      })
    })

    it('updates preview when amount changes', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        fireEvent.changeText(amountInput, '100.00')
      })

      await waitFor(() => {
        expect(screen.getByText('-$100.00')).toBeTruthy()
      })
    })
  })

  describe('Accessibility', () => {
    it('has accessible type buttons', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        expect(screen.getByLabelText('Expense')).toBeTruthy()
        expect(screen.getByLabelText('Income')).toBeTruthy()
      })
    })

    it('has accessible amount input', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Amount')
        expect(amountInput.props.accessibilityHint).toBe('Enter the transaction amount')
      })
    })

    it('has accessible update button', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        const updateButton = screen.getByLabelText('Update transaction')
        expect(updateButton).toBeTruthy()
      })
    })

    it('has accessible delete button', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        const deleteButton = screen.getByLabelText('Delete transaction')
        expect(deleteButton).toBeTruthy()
      })
    })

    it('has accessible cancel button', async () => {
      renderEditTransactionScreen()

      await waitFor(() => {
        const cancelButton = screen.getByLabelText('Cancel')
        expect(cancelButton).toBeTruthy()
      })
    })
  })
})
