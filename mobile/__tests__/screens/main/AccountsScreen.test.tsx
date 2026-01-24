import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { NavigationContainer } from '@react-navigation/native'
import { Alert } from 'react-native'
import { AccountsScreen } from '../../../src/screens/main/AccountsScreen'
import { useAccountsStore } from '../../../src/stores/accountsStore'
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
} as unknown as AppStackScreenProps<'Accounts'>['navigation']

const mockRoute = {
  key: 'Accounts',
  name: 'Accounts' as const,
  params: undefined,
} as AppStackScreenProps<'Accounts'>['route']

const mockAccounts = [
  {
    id: 'acc-1',
    name: 'Personal Account',
    type: 'PERSONAL' as const,
    preferredCurrency: 'USD' as const,
    color: '#4CAF50',
    icon: 'wallet',
    description: 'My personal finances',
    balance: 1500.5,
  },
  {
    id: 'acc-2',
    name: 'Shared Account',
    type: 'SHARED' as const,
    preferredCurrency: 'EUR' as const,
    color: '#2196F3',
    icon: 'users',
    description: 'Shared with roommates',
    balance: -250.0,
  },
]

const renderAccountsScreen = () => {
  return render(
    <NavigationContainer>
      <AccountsScreen navigation={mockNavigation} route={mockRoute} />
    </NavigationContainer>,
  )
}

describe('AccountsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Set up auth store with test user
    useAuthStore.setState({
      accessToken: 'test-access-token',
      isAuthenticated: true,
      isLoading: false,
    })

    // Reset accounts store with mock data
    useAccountsStore.setState({
      accounts: mockAccounts,
      activeAccountId: 'acc-1',
      isLoading: false,
      error: null,
    })

    // Reset toast mocks
    mockToastSuccess.mockClear()
    mockToastError.mockClear()
  })

  describe('Loading State', () => {
    it('shows loading indicator when loading with no accounts', () => {
      useAccountsStore.setState({
        accounts: [],
        isLoading: true,
        error: null,
      })

      renderAccountsScreen()

      expect(screen.getByTestId('accounts.loading')).toBeTruthy()
      expect(screen.getByText('Loading accounts...')).toBeTruthy()
    })

    it('does not show loading when accounts are present', () => {
      useAccountsStore.setState({
        accounts: mockAccounts,
        isLoading: false,
        error: null,
      })

      renderAccountsScreen()

      expect(screen.queryByTestId('accounts.loading')).toBeNull()
    })
  })

  describe('Display Accounts', () => {
    it('renders account list', () => {
      renderAccountsScreen()

      expect(screen.getByTestId('accounts.list')).toBeTruthy()
    })

    it('displays account names', () => {
      renderAccountsScreen()

      expect(screen.getByText('Personal Account')).toBeTruthy()
      expect(screen.getByText('Shared Account')).toBeTruthy()
    })

    it('displays account type badges', () => {
      renderAccountsScreen()

      expect(screen.getByText('PERSONAL')).toBeTruthy()
      expect(screen.getByText('SHARED')).toBeTruthy()
    })

    it('displays positive balance correctly', () => {
      renderAccountsScreen()

      expect(screen.getByText('$1,500.50')).toBeTruthy()
    })

    it('displays negative balance correctly', () => {
      renderAccountsScreen()

      expect(screen.getByText(/-250/)).toBeTruthy()
    })

    it('shows active indicator on active account', () => {
      renderAccountsScreen()

      expect(screen.getByTestId('accounts.active.acc-1')).toBeTruthy()
      expect(screen.queryByTestId('accounts.active.acc-2')).toBeNull()
    })

    it('shows empty state when no accounts', async () => {
      useAccountsStore.setState({
        accounts: [],
        activeAccountId: null,
        isLoading: false,
        error: null,
      })

      renderAccountsScreen()

      await waitFor(() => {
        expect(screen.getByText('No accounts found')).toBeTruthy()
      })
    })
  })

  describe('Error Display', () => {
    it('displays error message when present', async () => {
      const mockFetchAccounts = jest.fn().mockImplementation(() => {
        useAccountsStore.setState({
          accounts: mockAccounts,
          activeAccountId: 'acc-1',
          isLoading: false,
          error: 'Failed to load accounts',
        })
        return Promise.resolve(false)
      })

      jest.spyOn(useAccountsStore, 'getState').mockReturnValue({
        ...useAccountsStore.getState(),
        fetchAccounts: mockFetchAccounts,
      })

      renderAccountsScreen()

      await waitFor(() => {
        expect(screen.getByTestId('accounts.error')).toBeTruthy()
      })
      expect(screen.getByText('Failed to load accounts')).toBeTruthy()
    })
  })

  describe('Switch Account', () => {
    it('calls setActiveAccount when tapping non-active account', async () => {
      const mockSetActiveAccount = jest.fn().mockResolvedValue(true)
      useAccountsStore.setState({
        accounts: mockAccounts,
        activeAccountId: 'acc-1',
        isLoading: false,
        error: null,
      })
      jest.spyOn(useAccountsStore, 'getState').mockReturnValue({
        ...useAccountsStore.getState(),
        setActiveAccount: mockSetActiveAccount,
      })

      renderAccountsScreen()

      const sharedAccount = screen.getByTestId('accounts.account.acc-2')
      fireEvent.press(sharedAccount)

      await waitFor(() => {
        expect(mockSetActiveAccount).toHaveBeenCalledWith('acc-2')
      })
    })

    it('does not call setActiveAccount when tapping active account', async () => {
      const mockSetActiveAccount = jest.fn().mockResolvedValue(true)
      jest.spyOn(useAccountsStore, 'getState').mockReturnValue({
        ...useAccountsStore.getState(),
        setActiveAccount: mockSetActiveAccount,
      })

      renderAccountsScreen()

      const activeAccount = screen.getByTestId('accounts.account.acc-1')
      fireEvent.press(activeAccount)

      expect(mockSetActiveAccount).not.toHaveBeenCalled()
    })
  })

  describe('Edit Account', () => {
    it('opens edit modal when pressing edit button', async () => {
      renderAccountsScreen()

      const editButton = screen.getByTestId('accounts.edit.acc-1')
      fireEvent.press(editButton)

      await waitFor(() => {
        expect(screen.getByTestId('accounts.editModal')).toBeTruthy()
      })
      expect(screen.getByText('Edit Account')).toBeTruthy()
    })

    it('pre-fills current account name in edit modal', async () => {
      renderAccountsScreen()

      const editButton = screen.getByTestId('accounts.edit.acc-1')
      fireEvent.press(editButton)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Personal Account')).toBeTruthy()
      })
    })

    it('validates empty name', async () => {
      renderAccountsScreen()

      fireEvent.press(screen.getByTestId('accounts.edit.acc-1'))

      await waitFor(() => {
        expect(screen.getByTestId('accounts.editModal.nameInput')).toBeTruthy()
      })

      const input = screen.getByTestId('accounts.editModal.nameInput')
      fireEvent.changeText(input, '')
      fireEvent.press(screen.getByTestId('accounts.editModal.saveButton'))

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeTruthy()
      })
    })

    it('validates name length over 50 chars', async () => {
      renderAccountsScreen()

      fireEvent.press(screen.getByTestId('accounts.edit.acc-1'))

      await waitFor(() => {
        expect(screen.getByTestId('accounts.editModal.nameInput')).toBeTruthy()
      })

      const input = screen.getByTestId('accounts.editModal.nameInput')
      fireEvent.changeText(input, 'a'.repeat(51))
      fireEvent.press(screen.getByTestId('accounts.editModal.saveButton'))

      await waitFor(() => {
        expect(screen.getByText('Name must be 50 characters or less')).toBeTruthy()
      })
    })

    it('calls updateAccount on successful save', async () => {
      const mockUpdateAccount = jest.fn().mockResolvedValue(true)
      jest.spyOn(useAccountsStore, 'getState').mockReturnValue({
        ...useAccountsStore.getState(),
        updateAccount: mockUpdateAccount,
      })

      renderAccountsScreen()

      fireEvent.press(screen.getByTestId('accounts.edit.acc-1'))

      await waitFor(() => {
        expect(screen.getByTestId('accounts.editModal.nameInput')).toBeTruthy()
      })

      const input = screen.getByTestId('accounts.editModal.nameInput')
      fireEvent.changeText(input, 'Updated Name')
      fireEvent.press(screen.getByTestId('accounts.editModal.saveButton'))

      await waitFor(() => {
        expect(mockUpdateAccount).toHaveBeenCalledWith('acc-1', 'Updated Name')
      })
    })

    it('closes modal after successful update', async () => {
      const mockUpdateAccount = jest.fn().mockResolvedValue(true)
      jest.spyOn(useAccountsStore, 'getState').mockReturnValue({
        ...useAccountsStore.getState(),
        updateAccount: mockUpdateAccount,
      })

      renderAccountsScreen()

      fireEvent.press(screen.getByTestId('accounts.edit.acc-1'))

      await waitFor(() => {
        expect(screen.getByTestId('accounts.editModal')).toBeTruthy()
      })

      fireEvent.changeText(screen.getByTestId('accounts.editModal.nameInput'), 'Updated Name')
      fireEvent.press(screen.getByTestId('accounts.editModal.saveButton'))

      await waitFor(() => {
        expect(screen.queryByTestId('accounts.editModal')).toBeNull()
      })
    })

    it('closes modal when cancel is pressed', async () => {
      renderAccountsScreen()

      fireEvent.press(screen.getByTestId('accounts.edit.acc-1'))

      await waitFor(() => {
        expect(screen.getByTestId('accounts.editModal')).toBeTruthy()
      })

      fireEvent.press(screen.getByTestId('accounts.editModal.cancelButton'))

      await waitFor(() => {
        expect(screen.queryByTestId('accounts.editModal')).toBeNull()
      })
    })
  })

  describe('Delete Account', () => {
    beforeEach(() => {
      jest.spyOn(Alert, 'alert')
    })

    it('disables delete button for active account', async () => {
      renderAccountsScreen()

      await waitFor(() => {
        expect(screen.getByTestId('accounts.delete.acc-1')).toBeTruthy()
      })

      // The delete button for the active account should be disabled
      const deleteButton = screen.getByTestId('accounts.delete.acc-1')
      expect(deleteButton.props.accessibilityState?.disabled).toBe(true)
    })

    it('disables delete button when only one account exists', async () => {
      useAccountsStore.setState({
        accounts: [mockAccounts[0]],
        activeAccountId: null,
        isLoading: false,
        error: null,
      })

      renderAccountsScreen()

      await waitFor(() => {
        expect(screen.getByTestId('accounts.delete.acc-1')).toBeTruthy()
      })

      const deleteButton = screen.getByTestId('accounts.delete.acc-1')
      expect(deleteButton.props.accessibilityState?.disabled).toBe(true)
    })

    it('shows confirmation alert for deletable account', async () => {
      renderAccountsScreen()

      await waitFor(() => {
        expect(screen.getByTestId('accounts.delete.acc-2')).toBeTruthy()
      })

      fireEvent.press(screen.getByTestId('accounts.delete.acc-2'))

      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Account',
        'Are you sure you want to delete "Shared Account"? This action cannot be undone.',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
          expect.objectContaining({ text: 'Delete', style: 'destructive' }),
        ]),
      )
    })

    it('calls deleteAccount when confirmed', async () => {
      const mockDeleteAccount = jest.fn().mockResolvedValue(true)
      const originalGetState = useAccountsStore.getState
      useAccountsStore.getState = () => ({
        ...originalGetState(),
        deleteAccount: mockDeleteAccount,
      })

      renderAccountsScreen()

      await waitFor(() => {
        expect(screen.getByTestId('accounts.delete.acc-2')).toBeTruthy()
      })

      fireEvent.press(screen.getByTestId('accounts.delete.acc-2'))

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0]
      const deleteButton = alertCall[2].find((btn: { text: string }) => btn.text === 'Delete')
      await deleteButton.onPress()

      expect(mockDeleteAccount).toHaveBeenCalledWith('acc-2')

      useAccountsStore.getState = originalGetState
    })
  })

  describe('Navigation', () => {
    it('calls goBack when close is pressed', () => {
      renderAccountsScreen()

      fireEvent.press(screen.getByTestId('accounts.closeButton'))

      expect(mockNavigation.goBack).toHaveBeenCalled()
    })
  })
})
