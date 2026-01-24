import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { NavigationContainer } from '@react-navigation/native'
import { AddBudgetScreen } from '../../../src/screens/main/AddBudgetScreen'
import { useAccountsStore } from '../../../src/stores/accountsStore'
import { useBudgetsStore } from '../../../src/stores/budgetsStore'
import { useCategoriesStore } from '../../../src/stores/categoriesStore'
import type { AppStackScreenProps } from '../../../src/navigation/types'

// Mock stores
jest.mock('../../../src/stores/accountsStore')
jest.mock('../../../src/stores/budgetsStore')
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
const mockUseBudgetsStore = useBudgetsStore as jest.MockedFunction<typeof useBudgetsStore>
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

const mockExpenseCategory2 = {
  id: 'cat-2',
  name: 'Transport',
  type: 'EXPENSE' as const,
  color: '#2196F3',
  isArchived: false,
  isHolding: false,
}

const mockArchivedCategory = {
  id: 'cat-3',
  name: 'Archived Category',
  type: 'EXPENSE' as const,
  color: '#888888',
  isArchived: true,
  isHolding: false,
}

const mockIncomeCategory = {
  id: 'cat-4',
  name: 'Salary',
  type: 'INCOME' as const,
  color: '#22c55e',
  isArchived: false,
  isHolding: false,
}

const mockExistingBudget = {
  id: 'budget-1',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  month: '2026-01-01',
  planned: '500.00',
  currency: 'USD' as const,
  notes: null,
  category: mockExpenseCategory,
}

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as unknown as AppStackScreenProps<'CreateBudget'>['navigation']

const mockRoute = {
  key: 'CreateBudget',
  name: 'CreateBudget' as const,
  params: undefined,
} as AppStackScreenProps<'CreateBudget'>['route']

function renderAddBudgetScreen() {
  return render(
    <NavigationContainer>
      <AddBudgetScreen navigation={mockNavigation} route={mockRoute} />
    </NavigationContainer>,
  )
}

describe('AddBudgetScreen', () => {
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

  const defaultBudgetsState = {
    budgets: [],
    isLoading: false,
    error: null,
    filters: { accountId: 'acc-1' },
    selectedMonth: '2026-01',
    fetchBudgets: jest.fn().mockResolvedValue(undefined),
    createOrUpdateBudget: jest.fn().mockResolvedValue({
      id: 'budget-new',
      accountId: 'acc-1',
      categoryId: 'cat-2',
      month: '2026-01-01',
      planned: '200.00',
      currency: 'USD',
      notes: null,
      category: mockExpenseCategory2,
    }),
    deleteBudget: jest.fn(),
    setFilters: jest.fn(),
    setSelectedMonth: jest.fn(),
    clearError: jest.fn(),
    reset: jest.fn(),
  }

  const defaultCategoriesState = {
    categories: [mockExpenseCategory, mockExpenseCategory2, mockArchivedCategory, mockIncomeCategory],
    isLoading: false,
    error: null,
    fetchCategories: jest.fn().mockResolvedValue(undefined),
    createCategory: jest.fn(),
    archiveCategory: jest.fn(),
    unarchiveCategory: jest.fn(),
    getCategoriesByType: jest.fn(),
    clearError: jest.fn(),
    reset: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAccountsStore.mockReturnValue(defaultAccountsState)
    mockUseBudgetsStore.mockReturnValue(defaultBudgetsState)
    mockUseCategoriesStore.mockReturnValue(defaultCategoriesState)
  })

  describe('Rendering', () => {
    it('renders screen title', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        expect(screen.getByText('Add Budget')).toBeTruthy()
      })
    })

    it('renders cancel button', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeTruthy()
      })
    })

    it('renders month selector', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        expect(screen.getByText('Month')).toBeTruthy()
        expect(screen.getByLabelText('Previous month')).toBeTruthy()
        expect(screen.getByLabelText('Next month')).toBeTruthy()
      })
    })

    it('renders amount input', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        expect(screen.getByText('Budget Amount')).toBeTruthy()
        expect(screen.getByLabelText('Budget amount')).toBeTruthy()
      })
    })

    it('renders category section', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        expect(screen.getByText('Category')).toBeTruthy()
      })
    })

    it('renders save button', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        expect(screen.getByText('Save Budget')).toBeTruthy()
      })
    })

    it('renders currency symbol based on account', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        expect(screen.getByText('$')).toBeTruthy()
      })
    })
  })

  describe('Category Filtering', () => {
    it('displays only expense categories', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        expect(screen.getByText('Food')).toBeTruthy()
        expect(screen.getByText('Transport')).toBeTruthy()
        expect(screen.queryByText('Salary')).toBeNull()
      })
    })

    it('filters out archived categories', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        expect(screen.queryByText('Archived Category')).toBeNull()
      })
    })

    it('filters out categories with existing budgets for selected month', async () => {
      mockUseBudgetsStore.mockReturnValue({
        ...defaultBudgetsState,
        budgets: [mockExistingBudget],
      })

      renderAddBudgetScreen()

      await waitFor(() => {
        // Food has existing budget, should be filtered out
        expect(screen.queryByText('Food')).toBeNull()
        // Transport has no budget, should be visible
        expect(screen.getByText('Transport')).toBeTruthy()
      })
    })

    it('shows empty message when all categories have budgets', async () => {
      const budgetForAll = [
        mockExistingBudget,
        {
          ...mockExistingBudget,
          id: 'budget-2',
          categoryId: 'cat-2',
          category: mockExpenseCategory2,
        },
      ]

      mockUseBudgetsStore.mockReturnValue({
        ...defaultBudgetsState,
        budgets: budgetForAll,
      })

      renderAddBudgetScreen()

      await waitFor(() => {
        expect(
          screen.getByText('No categories available. All expense categories already have budgets for this month.'),
        ).toBeTruthy()
      })
    })

    it('shows loading indicator when categories are loading', async () => {
      mockUseCategoriesStore.mockReturnValue({
        ...defaultCategoriesState,
        categories: [],
        isLoading: true,
      })

      renderAddBudgetScreen()

      await waitFor(() => {
        expect(screen.queryByText('Food')).toBeNull()
      })
    })
  })

  describe('Category Selection', () => {
    it('allows selecting a category', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        const categoryButton = screen.getByLabelText('Select Food category')
        expect(categoryButton.props.accessibilityState.selected).toBe(true)
      })
    })

    it('resets category selection when month changes and category becomes unavailable', async () => {
      // Start with no budgets
      mockUseBudgetsStore.mockReturnValue({
        ...defaultBudgetsState,
        budgets: [],
      })

      const { rerender } = renderAddBudgetScreen()

      // Select a category
      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      // Verify selection
      await waitFor(() => {
        const categoryButton = screen.getByLabelText('Select Food category')
        expect(categoryButton.props.accessibilityState.selected).toBe(true)
      })

      // Now simulate month change where Food has a budget
      mockUseBudgetsStore.mockReturnValue({
        ...defaultBudgetsState,
        budgets: [mockExistingBudget],
      })

      rerender(
        <NavigationContainer>
          <AddBudgetScreen navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>,
      )

      // Food should no longer be visible
      await waitFor(() => {
        expect(screen.queryByText('Food')).toBeNull()
      })
    })
  })

  describe('Amount Input', () => {
    it('allows entering numeric amount', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Budget amount')
        fireEvent.changeText(amountInput, '500.00')
        expect(amountInput.props.value).toBe('500.00')
      })
    })

    it('filters out non-numeric characters', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Budget amount')
        fireEvent.changeText(amountInput, 'abc500.00xyz')
        expect(amountInput.props.value).toBe('500.00')
      })
    })

    it('allows only two decimal places', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Budget amount')
        fireEvent.changeText(amountInput, '500.12')
        expect(amountInput.props.value).toBe('500.12')
      })

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Budget amount')
        fireEvent.changeText(amountInput, '500.123')
        // Should not update because more than 2 decimal places
        expect(amountInput.props.value).toBe('500.12')
      })
    })
  })

  describe('Preview', () => {
    it('shows preview when amount and category are selected', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Budget amount')
        fireEvent.changeText(amountInput, '500.00')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeTruthy()
        expect(screen.getByText('$500.00')).toBeTruthy()
      })
    })

    it('does not show preview without amount', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        expect(screen.queryByText('Preview')).toBeNull()
      })
    })

    it('does not show preview without category', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Budget amount')
        fireEvent.changeText(amountInput, '500.00')
      })

      await waitFor(() => {
        expect(screen.queryByText('Preview')).toBeNull()
      })
    })
  })

  describe('Form Validation', () => {
    it('shows error when submitting without amount', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Budget'))
      })

      await waitFor(() => {
        expect(screen.getByText('Amount is required')).toBeTruthy()
      })
    })

    it('shows error when submitting without category', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Budget amount')
        fireEvent.changeText(amountInput, '500.00')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Budget'))
      })

      await waitFor(() => {
        expect(screen.getByText('Please select a category')).toBeTruthy()
      })
    })

    it('shows error for zero amount', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Budget amount')
        fireEvent.changeText(amountInput, '0')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Budget'))
      })

      await waitFor(() => {
        expect(screen.getByText('Amount must be greater than zero')).toBeTruthy()
      })
    })
  })

  describe('Form Submission', () => {
    it('calls createOrUpdateBudget with correct data', async () => {
      const createOrUpdateBudget = jest.fn().mockResolvedValue({
        id: 'budget-new',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: '2026-01-01',
        planned: '500.00',
        currency: 'USD',
        notes: null,
        category: mockExpenseCategory,
      })

      mockUseBudgetsStore.mockReturnValue({
        ...defaultBudgetsState,
        createOrUpdateBudget,
      })

      renderAddBudgetScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Budget amount')
        fireEvent.changeText(amountInput, '500.00')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Budget'))
      })

      await waitFor(() => {
        expect(createOrUpdateBudget).toHaveBeenCalledWith(
          expect.objectContaining({
            accountId: 'acc-1',
            categoryId: 'cat-1',
            planned: 500,
            currency: 'USD',
          }),
        )
      })
    })

    it('navigates back after successful submission', async () => {
      const goBack = jest.fn()
      const navWithGoBack = { ...mockNavigation, goBack }

      render(
        <NavigationContainer>
          <AddBudgetScreen navigation={navWithGoBack as typeof mockNavigation} route={mockRoute} />
        </NavigationContainer>,
      )

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Budget amount')
        fireEvent.changeText(amountInput, '500.00')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Budget'))
      })

      await waitFor(() => {
        expect(goBack).toHaveBeenCalled()
      })
    })

    it('shows success toast on successful submission', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Budget amount')
        fireEvent.changeText(amountInput, '500.00')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Budget'))
      })

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Budget saved')
      })
    })

    it('shows error toast on submission failure', async () => {
      const createOrUpdateBudget = jest.fn().mockRejectedValue(new Error('Network error'))

      mockUseBudgetsStore.mockReturnValue({
        ...defaultBudgetsState,
        createOrUpdateBudget,
      })

      renderAddBudgetScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Budget amount')
        fireEvent.changeText(amountInput, '500.00')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Budget'))
      })

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Network error')
      })
    })

    it('disables submit button while submitting', async () => {
      let resolvePromise: (value: unknown) => void
      const createOrUpdateBudget = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve
          }),
      )

      mockUseBudgetsStore.mockReturnValue({
        ...defaultBudgetsState,
        createOrUpdateBudget,
      })

      renderAddBudgetScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Budget amount')
        fireEvent.changeText(amountInput, '500.00')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Budget'))
      })

      await waitFor(() => {
        const submitButton = screen.getByLabelText('Save budget')
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
          <AddBudgetScreen navigation={navWithGoBack as typeof mockNavigation} route={mockRoute} />
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
      mockUseAccountsStore.mockReturnValue({
        ...defaultAccountsState,
        activeAccountId: null,
      })

      renderAddBudgetScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Budget amount')
        fireEvent.changeText(amountInput, '500.00')
      })

      await waitFor(() => {
        fireEvent.press(screen.getByLabelText('Select Food category'))
      })

      await waitFor(() => {
        fireEvent.press(screen.getByText('Save Budget'))
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

      renderAddBudgetScreen()

      await waitFor(() => {
        expect(screen.getByText('€')).toBeTruthy()
      })
    })

    it('shows ILS symbol for ILS accounts', async () => {
      mockUseAccountsStore.mockReturnValue({
        ...defaultAccountsState,
        accounts: [{ ...mockAccount, preferredCurrency: 'ILS' as const }],
      })

      renderAddBudgetScreen()

      await waitFor(() => {
        expect(screen.getByText('₪')).toBeTruthy()
      })
    })
  })

  describe('Month Selector', () => {
    it('allows future months for budgets', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        const nextButton = screen.getByLabelText('Next month')
        // Next month should be enabled for budgets
        expect(nextButton.props.accessibilityState?.disabled).toBeFalsy()
      })
    })

    it('uses initialMonth from navigation params when provided', async () => {
      const customMonth = '2025-06'
      const routeWithMonth = {
        key: 'CreateBudget',
        name: 'CreateBudget' as const,
        params: { initialMonth: customMonth },
      } as AppStackScreenProps<'CreateBudget'>['route']

      render(
        <NavigationContainer>
          <AddBudgetScreen navigation={mockNavigation} route={routeWithMonth} />
        </NavigationContainer>,
      )

      await waitFor(() => {
        // The month selector should show June 2025
        expect(screen.getByText('June 2025')).toBeTruthy()
      })
    })
  })

  describe('Accessibility', () => {
    it('has accessible amount input', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        const amountInput = screen.getByLabelText('Budget amount')
        expect(amountInput.props.accessibilityHint).toBe('Enter the budget amount for this category')
      })
    })

    it('has accessible save button', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        const saveButton = screen.getByLabelText('Save budget')
        expect(saveButton).toBeTruthy()
      })
    })

    it('has accessible cancel button', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        const cancelButton = screen.getByLabelText('Cancel')
        expect(cancelButton).toBeTruthy()
      })
    })

    it('has accessible category buttons', async () => {
      renderAddBudgetScreen()

      await waitFor(() => {
        const foodCategory = screen.getByLabelText('Select Food category')
        expect(foodCategory).toBeTruthy()
      })
    })
  })

  describe('Initial Data Fetch', () => {
    it('fetches expense categories on mount', async () => {
      const fetchCategories = jest.fn().mockResolvedValue(undefined)
      mockUseCategoriesStore.mockReturnValue({
        ...defaultCategoriesState,
        fetchCategories,
      })

      renderAddBudgetScreen()

      await waitFor(() => {
        expect(fetchCategories).toHaveBeenCalledWith('EXPENSE')
      })
    })
  })
})
