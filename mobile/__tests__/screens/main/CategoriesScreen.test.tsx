import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { NavigationContainer } from '@react-navigation/native'
import { Alert } from 'react-native'
import { CategoriesScreen } from '../../../src/screens/main/CategoriesScreen'
import { useCategoriesStore } from '../../../src/stores/categoriesStore'
import { useAuthStore } from '../../../src/stores/authStore'
import type { AppStackScreenProps } from '../../../src/navigation/types'

// Mock toast store
const mockToastSuccess = jest.fn()
const mockToastError = jest.fn()

jest.mock('../../../src/stores/toastStore', () => ({
  useToastStore: {
    getState: jest.fn(() => ({
      success: mockToastSuccess,
      error: mockToastError,
    })),
  },
}))

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({
    reset: jest.fn(),
  })),
} as unknown as AppStackScreenProps<'Categories'>['navigation']

const mockRoute = {
  key: 'Categories',
  name: 'Categories' as const,
  params: undefined,
} as AppStackScreenProps<'Categories'>['route']

const mockCategories = [
  {
    id: 'cat-1',
    name: 'Groceries',
    type: 'EXPENSE' as const,
    color: '#22c55e',
    isArchived: false,
    isHolding: false,
  },
  {
    id: 'cat-2',
    name: 'Dining Out',
    type: 'EXPENSE' as const,
    color: '#f97316',
    isArchived: true,
    isHolding: false,
  },
  {
    id: 'cat-3',
    name: 'Salary',
    type: 'INCOME' as const,
    color: '#10b981',
    isArchived: false,
    isHolding: false,
  },
  {
    id: 'cat-4',
    name: 'Stocks',
    type: 'EXPENSE' as const,
    color: '#8b5cf6',
    isArchived: false,
    isHolding: true,
  },
]

const renderCategoriesScreen = () => {
  return render(
    <NavigationContainer>
      <CategoriesScreen navigation={mockNavigation} route={mockRoute} />
    </NavigationContainer>,
  )
}

describe('CategoriesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()

    // Set up auth store with test user
    useAuthStore.setState({
      accessToken: 'test-access-token',
      isAuthenticated: true,
      isLoading: false,
    })

    // Reset categories store with mock data
    useCategoriesStore.setState({
      categories: mockCategories,
      isLoading: false,
      error: null,
    })

    // Reset toast mocks
    mockToastSuccess.mockClear()
    mockToastError.mockClear()
  })

  describe('Loading State', () => {
    it('shows loading indicator when loading with no categories', () => {
      useCategoriesStore.setState({
        categories: [],
        isLoading: true,
        error: null,
      })

      renderCategoriesScreen()

      expect(screen.getByTestId('categories.loading')).toBeTruthy()
      expect(screen.getByText('Loading categories...')).toBeTruthy()
    })

    it('does not show loading when categories are present', () => {
      useCategoriesStore.setState({
        categories: mockCategories,
        isLoading: false,
        error: null,
      })

      renderCategoriesScreen()

      expect(screen.queryByTestId('categories.loading')).toBeNull()
    })
  })

  describe('Display Categories', () => {
    it('renders category list', () => {
      renderCategoriesScreen()

      expect(screen.getByTestId('categories.list')).toBeTruthy()
    })

    it('displays expense categories by default', () => {
      renderCategoriesScreen()

      expect(screen.getByText('Groceries')).toBeTruthy()
      expect(screen.getByText('Dining Out')).toBeTruthy()
      expect(screen.queryByText('Salary')).toBeNull() // Income category
    })

    it('shows archived badge for archived categories', () => {
      renderCategoriesScreen()

      expect(screen.getByTestId('categories.archived.cat-2')).toBeTruthy()
      expect(screen.getByText('Archived')).toBeTruthy()
    })

    it('shows holding badge for holding categories', () => {
      renderCategoriesScreen()

      expect(screen.getByTestId('categories.holding.cat-4')).toBeTruthy()
      expect(screen.getByText('Holding')).toBeTruthy()
    })

    it('displays color dots for categories', () => {
      renderCategoriesScreen()

      expect(screen.getByTestId('categories.colorDot.cat-1')).toBeTruthy()
    })

    it('shows empty state when no categories', async () => {
      useCategoriesStore.setState({
        categories: [],
        isLoading: false,
        error: null,
      })

      renderCategoriesScreen()

      await waitFor(() => {
        expect(screen.getByTestId('categories.empty')).toBeTruthy()
      })
      expect(screen.getByText('No expense categories')).toBeTruthy()
    })
  })

  describe('Tab Switching', () => {
    it('shows EXPENSE tab as active by default', () => {
      renderCategoriesScreen()

      expect(screen.getByTestId('categories.tabBar')).toBeTruthy()
      expect(screen.getByTestId('categories.tabExpense')).toBeTruthy()
      expect(screen.getByTestId('categories.tabIncome')).toBeTruthy()
    })

    it('switches to income categories when INCOME tab is pressed', async () => {
      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.tabIncome'))

      await waitFor(() => {
        expect(screen.getByText('Salary')).toBeTruthy()
      })
      expect(screen.queryByText('Groceries')).toBeNull()
    })

    it('switches back to expense categories when EXPENSE tab is pressed', async () => {
      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.tabIncome'))
      await waitFor(() => {
        expect(screen.getByText('Salary')).toBeTruthy()
      })

      fireEvent.press(screen.getByTestId('categories.tabExpense'))

      await waitFor(() => {
        expect(screen.getByText('Groceries')).toBeTruthy()
      })
      expect(screen.queryByText('Salary')).toBeNull()
    })
  })

  describe('Error Display', () => {
    it('displays error message when present', async () => {
      const mockFetchCategories = jest.fn().mockImplementation(() => {
        useCategoriesStore.setState({
          categories: mockCategories,
          isLoading: false,
          error: 'Failed to load categories',
        })
        return Promise.resolve()
      })

      jest.spyOn(useCategoriesStore, 'getState').mockReturnValue({
        ...useCategoriesStore.getState(),
        fetchCategories: mockFetchCategories,
      })

      renderCategoriesScreen()

      await waitFor(() => {
        expect(screen.getByTestId('categories.error')).toBeTruthy()
      })
      expect(screen.getByText('Failed to load categories')).toBeTruthy()
    })
  })

  describe('Create Modal', () => {
    it('opens create modal when Add button is pressed', async () => {
      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.addButton'))

      await waitFor(() => {
        expect(screen.getByTestId('categories.createModal')).toBeTruthy()
      })
      expect(screen.getByText('Create Category')).toBeTruthy()
    })

    it('opens create modal from empty state button', async () => {
      useCategoriesStore.setState({
        categories: [],
        isLoading: false,
        error: null,
      })

      renderCategoriesScreen()

      await waitFor(() => {
        expect(screen.getByTestId('categories.emptyCreateButton')).toBeTruthy()
      })

      fireEvent.press(screen.getByTestId('categories.emptyCreateButton'))

      await waitFor(() => {
        expect(screen.getByTestId('categories.createModal')).toBeTruthy()
      })
    })

    it('validates empty name', async () => {
      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.addButton'))

      await waitFor(() => {
        expect(screen.getByTestId('categories.createModal.nameInput')).toBeTruthy()
      })

      fireEvent.press(screen.getByTestId('categories.createModal.saveButton'))

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeTruthy()
      })
    })

    it('validates name too short', async () => {
      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.addButton'))

      await waitFor(() => {
        expect(screen.getByTestId('categories.createModal.nameInput')).toBeTruthy()
      })

      fireEvent.changeText(screen.getByTestId('categories.createModal.nameInput'), 'A')
      fireEvent.press(screen.getByTestId('categories.createModal.saveButton'))

      await waitFor(() => {
        expect(screen.getByText('Name must be at least 2 characters')).toBeTruthy()
      })
    })

    it('has type selector in create modal', async () => {
      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.addButton'))

      await waitFor(() => {
        expect(screen.getByTestId('categories.createModal.typeExpense')).toBeTruthy()
        expect(screen.getByTestId('categories.createModal.typeIncome')).toBeTruthy()
      })
    })

    it('closes modal when cancel is pressed', async () => {
      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.addButton'))

      await waitFor(() => {
        expect(screen.getByTestId('categories.createModal')).toBeTruthy()
      })

      fireEvent.press(screen.getByTestId('categories.createModal.cancelButton'))

      await waitFor(() => {
        expect(screen.queryByTestId('categories.createModal')).toBeNull()
      })
    })

    it('calls createCategory on successful save', async () => {
      const mockCreateCategory = jest.fn().mockResolvedValue({
        id: 'cat-new',
        name: 'New Category',
        type: 'EXPENSE',
        color: '#22c55e',
        isArchived: false,
        isHolding: false,
      })
      jest.spyOn(useCategoriesStore, 'getState').mockReturnValue({
        ...useCategoriesStore.getState(),
        createCategory: mockCreateCategory,
      })

      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.addButton'))

      await waitFor(() => {
        expect(screen.getByTestId('categories.createModal.nameInput')).toBeTruthy()
      })

      fireEvent.changeText(screen.getByTestId('categories.createModal.nameInput'), 'New Category')
      fireEvent.press(screen.getByTestId('categories.createModal.saveButton'))

      await waitFor(() => {
        expect(mockCreateCategory).toHaveBeenCalled()
      })
    })
  })

  describe('Edit Modal', () => {
    it('opens edit modal when pressing edit button', async () => {
      renderCategoriesScreen()

      const editButton = screen.getByTestId('categories.edit.cat-1')
      fireEvent.press(editButton)

      await waitFor(() => {
        expect(screen.getByTestId('categories.editModal')).toBeTruthy()
      })
      expect(screen.getByText('Edit Category')).toBeTruthy()
    })

    it('pre-fills current category name in edit modal', async () => {
      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.edit.cat-1'))

      await waitFor(() => {
        expect(screen.getByDisplayValue('Groceries')).toBeTruthy()
      })
    })

    it('validates empty name in edit modal', async () => {
      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.edit.cat-1'))

      await waitFor(() => {
        expect(screen.getByTestId('categories.editModal.nameInput')).toBeTruthy()
      })

      const input = screen.getByTestId('categories.editModal.nameInput')
      fireEvent.changeText(input, '')
      fireEvent.press(screen.getByTestId('categories.editModal.saveButton'))

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeTruthy()
      })
    })

    it('closes modal when cancel is pressed', async () => {
      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.edit.cat-1'))

      await waitFor(() => {
        expect(screen.getByTestId('categories.editModal')).toBeTruthy()
      })

      fireEvent.press(screen.getByTestId('categories.editModal.cancelButton'))

      await waitFor(() => {
        expect(screen.queryByTestId('categories.editModal')).toBeNull()
      })
    })

    it('calls updateCategory on successful save', async () => {
      const mockUpdateCategory = jest.fn().mockResolvedValue({
        id: 'cat-1',
        name: 'Updated Name',
        type: 'EXPENSE',
        color: '#22c55e',
        isArchived: false,
        isHolding: false,
      })
      jest.spyOn(useCategoriesStore, 'getState').mockReturnValue({
        ...useCategoriesStore.getState(),
        updateCategory: mockUpdateCategory,
      })

      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.edit.cat-1'))

      await waitFor(() => {
        expect(screen.getByTestId('categories.editModal.nameInput')).toBeTruthy()
      })

      fireEvent.changeText(screen.getByTestId('categories.editModal.nameInput'), 'Updated Name')
      fireEvent.press(screen.getByTestId('categories.editModal.saveButton'))

      await waitFor(() => {
        expect(mockUpdateCategory).toHaveBeenCalledWith({
          id: 'cat-1',
          name: 'Updated Name',
          color: '#22c55e',
        })
      })
    })
  })

  describe('Archive/Unarchive', () => {
    beforeEach(() => {
      jest.spyOn(Alert, 'alert')
    })

    it('shows archive confirmation alert', async () => {
      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.archive.cat-1'))

      expect(Alert.alert).toHaveBeenCalledWith(
        'Archive Category',
        'Are you sure you want to archive "Groceries"?',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
          expect.objectContaining({ text: 'Archive' }),
        ]),
      )
    })

    it('shows unarchive confirmation alert for archived category', async () => {
      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.archive.cat-2'))

      expect(Alert.alert).toHaveBeenCalledWith(
        'Unarchive Category',
        'Are you sure you want to unarchive "Dining Out"?',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
          expect.objectContaining({ text: 'Unarchive' }),
        ]),
      )
    })

    it('calls archiveCategory when confirmed', async () => {
      const mockArchiveCategory = jest.fn().mockResolvedValue(undefined)
      const originalGetState = useCategoriesStore.getState
      useCategoriesStore.getState = () => ({
        ...originalGetState(),
        archiveCategory: mockArchiveCategory,
      })

      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.archive.cat-1'))

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0]
      const archiveButton = alertCall[2].find((btn: { text: string }) => btn.text === 'Archive')
      await archiveButton.onPress()

      expect(mockArchiveCategory).toHaveBeenCalledWith('cat-1')

      useCategoriesStore.getState = originalGetState
    })

    it('calls unarchiveCategory when confirmed', async () => {
      const mockUnarchiveCategory = jest.fn().mockResolvedValue(undefined)
      const originalGetState = useCategoriesStore.getState
      useCategoriesStore.getState = () => ({
        ...originalGetState(),
        unarchiveCategory: mockUnarchiveCategory,
      })

      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.archive.cat-2'))

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0]
      const unarchiveButton = alertCall[2].find((btn: { text: string }) => btn.text === 'Unarchive')
      await unarchiveButton.onPress()

      expect(mockUnarchiveCategory).toHaveBeenCalledWith('cat-2')

      useCategoriesStore.getState = originalGetState
    })
  })

  describe('Delete Category', () => {
    beforeEach(() => {
      jest.spyOn(Alert, 'alert')
    })

    it('disables delete button for holding categories', async () => {
      renderCategoriesScreen()

      await waitFor(() => {
        expect(screen.getByTestId('categories.delete.cat-4')).toBeTruthy()
      })

      const deleteButton = screen.getByTestId('categories.delete.cat-4')
      expect(deleteButton.props.accessibilityState?.disabled).toBe(true)
    })

    it('does not call Alert.alert when pressing disabled delete button for holding categories', async () => {
      renderCategoriesScreen()

      // Pressing a disabled button should not trigger the onPress handler
      fireEvent.press(screen.getByTestId('categories.delete.cat-4'))

      // Alert.alert should not be called because the button is disabled
      // The visual feedback (disabled styling) prevents user interaction
      expect(Alert.alert).not.toHaveBeenCalled()
    })

    it('shows archive confirmation for non-holding categories', async () => {
      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.delete.cat-1'))

      expect(Alert.alert).toHaveBeenCalledWith(
        'Archive Category',
        'Are you sure you want to archive "Groceries"? Archived categories can be restored later.',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
          expect.objectContaining({ text: 'Archive', style: 'destructive' }),
        ]),
      )
    })

    it('shows already archived message for archived categories', async () => {
      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.delete.cat-2'))

      expect(Alert.alert).toHaveBeenCalledWith(
        'Already Archived',
        '"Dining Out" is already archived. Use "Unarchive" to restore it.',
        expect.arrayContaining([expect.objectContaining({ text: 'OK' })]),
      )
    })

    it('calls archiveCategory on archive confirmation', async () => {
      const mockArchiveCategory = jest.fn().mockResolvedValue(undefined)
      const originalGetState = useCategoriesStore.getState
      useCategoriesStore.getState = () => ({
        ...originalGetState(),
        archiveCategory: mockArchiveCategory,
      })

      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.delete.cat-1'))

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0]
      const archiveButton = alertCall[2].find((btn: { text: string }) => btn.text === 'Archive')
      await archiveButton.onPress()

      expect(mockArchiveCategory).toHaveBeenCalledWith('cat-1')

      useCategoriesStore.getState = originalGetState
    })
  })

  describe('Navigation', () => {
    it('calls goBack when close is pressed', () => {
      renderCategoriesScreen()

      fireEvent.press(screen.getByTestId('categories.closeButton'))

      expect(mockNavigation.goBack).toHaveBeenCalled()
    })
  })
})
