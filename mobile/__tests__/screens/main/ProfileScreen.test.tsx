import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { NavigationContainer } from '@react-navigation/native'
import { ProfileScreen } from '../../../src/screens/main/ProfileScreen'
import { AuthProvider } from '../../../src/contexts'
import * as authService from '../../../src/services/auth'
import { ApiError } from '../../../src/services/api'
import { useAuthStore } from '../../../src/stores/authStore'
import { useAccountsStore } from '../../../src/stores/accountsStore'
import type { AppStackScreenProps } from '../../../src/navigation/types'

jest.mock('../../../src/services/auth')

const mockAuthService = authService as jest.Mocked<typeof authService>

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({
    reset: jest.fn(),
  })),
} as unknown as AppStackScreenProps<'Profile'>['navigation']

const mockRoute = {
  key: 'Profile',
  name: 'Profile' as const,
  params: undefined,
} as AppStackScreenProps<'Profile'>['route']

const renderProfileScreen = () => {
  return render(
    <AuthProvider>
      <NavigationContainer>
        <ProfileScreen navigation={mockNavigation} route={mockRoute} />
      </NavigationContainer>
    </AuthProvider>,
  )
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Set up auth store with test user
    useAuthStore.setState({
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        displayName: 'Test User',
        hasCompletedOnboarding: true,
      },
      accessToken: 'test-access-token',
      isAuthenticated: true,
      isLoading: false,
    })

    // Reset accounts store
    useAccountsStore.setState({
      accounts: [],
      isLoading: false,
      error: '',
    })

    // Default mock implementations
    mockAuthService.getProfile.mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      displayName: 'Test User',
      preferredCurrency: 'USD',
      hasCompletedOnboarding: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      subscription: {
        status: 'active',
        plan: 'pro',
        trialDaysRemaining: null,
        cancelAtPeriodEnd: false,
      },
    })

    mockAuthService.updateProfile.mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      displayName: 'Updated Name',
      preferredCurrency: 'USD',
    })

    mockAuthService.updateCurrency.mockResolvedValue({ currency: 'USD' })
  })

  describe('Initial Loading', () => {
    it('shows loading state initially', async () => {
      // Make getProfile take time to resolve
      mockAuthService.getProfile.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  id: 'test-user-id',
                  email: 'test@example.com',
                  displayName: 'Test User',
                  preferredCurrency: 'USD',
                  hasCompletedOnboarding: true,
                  createdAt: '2026-01-01T00:00:00.000Z',
                  subscription: {
                    status: 'active',
                    plan: 'pro',
                    trialDaysRemaining: null,
                    cancelAtPeriodEnd: false,
                  },
                }),
              100,
            ),
          ),
      )

      renderProfileScreen()

      expect(screen.getByTestId('profile.loading')).toBeTruthy()
      expect(screen.getByText('Loading profile...')).toBeTruthy()
    })

    it('displays user email after loading', async () => {
      renderProfileScreen()

      await waitFor(() => {
        expect(screen.getByTestId('profile.email')).toBeTruthy()
      })
      expect(screen.getByText('test@example.com')).toBeTruthy()
    })

    it('displays user display name after loading', async () => {
      renderProfileScreen()

      await waitFor(() => {
        expect(screen.getByTestId('profile.displayNameInput')).toBeTruthy()
      })
      expect(screen.getByDisplayValue('Test User')).toBeTruthy()
    })

    it('displays currency options after loading', async () => {
      renderProfileScreen()

      await waitFor(() => {
        expect(screen.getByTestId('profile.currency.USD')).toBeTruthy()
      })
      expect(screen.getByTestId('profile.currency.EUR')).toBeTruthy()
      expect(screen.getByTestId('profile.currency.ILS')).toBeTruthy()
    })
  })

  describe('Validation', () => {
    it('shows error when display name is empty', async () => {
      renderProfileScreen()

      await waitFor(() => {
        expect(screen.getByTestId('profile.displayNameInput')).toBeTruthy()
      })

      const input = screen.getByTestId('profile.displayNameInput')
      fireEvent.changeText(input, '')

      await waitFor(() => {
        expect(screen.getByText('Display name is required')).toBeTruthy()
      })
    })

    it('shows error when display name is only whitespace', async () => {
      renderProfileScreen()

      await waitFor(() => {
        expect(screen.getByTestId('profile.displayNameInput')).toBeTruthy()
      })

      const input = screen.getByTestId('profile.displayNameInput')
      fireEvent.changeText(input, '   ')

      await waitFor(() => {
        expect(screen.getByText('Display name is required')).toBeTruthy()
      })
    })

    it('clears error when valid name is entered', async () => {
      renderProfileScreen()

      await waitFor(() => {
        expect(screen.getByTestId('profile.displayNameInput')).toBeTruthy()
      })

      const input = screen.getByTestId('profile.displayNameInput')
      fireEvent.changeText(input, '')

      await waitFor(() => {
        expect(screen.getByText('Display name is required')).toBeTruthy()
      })

      fireEvent.changeText(input, 'Valid Name')

      await waitFor(() => {
        expect(screen.queryByText('Display name is required')).toBeNull()
      })
    })

    it('disables save button when no changes made', async () => {
      renderProfileScreen()

      await waitFor(() => {
        expect(screen.getByTestId('profile.saveButton')).toBeTruthy()
      })

      const saveButton = screen.getByTestId('profile.saveButton')
      expect(saveButton.props.accessibilityState?.disabled).toBe(true)
    })

    it('enables save button when display name changes', async () => {
      renderProfileScreen()

      await waitFor(() => {
        expect(screen.getByTestId('profile.displayNameInput')).toBeTruthy()
      })

      const input = screen.getByTestId('profile.displayNameInput')
      fireEvent.changeText(input, 'New Name')

      await waitFor(() => {
        const saveButton = screen.getByTestId('profile.saveButton')
        expect(saveButton.props.accessibilityState?.disabled).toBe(false)
      })
    })

    it('enables save button when currency changes', async () => {
      renderProfileScreen()

      await waitFor(() => {
        expect(screen.getByTestId('profile.currency.EUR')).toBeTruthy()
      })

      fireEvent.press(screen.getByTestId('profile.currency.EUR'))

      await waitFor(() => {
        const saveButton = screen.getByTestId('profile.saveButton')
        expect(saveButton.props.accessibilityState?.disabled).toBe(false)
      })
    })
  })

  describe('Successful Save', () => {
    it('calls updateProfile when display name changes', async () => {
      renderProfileScreen()

      await waitFor(() => {
        expect(screen.getByTestId('profile.displayNameInput')).toBeTruthy()
      })

      const input = screen.getByTestId('profile.displayNameInput')
      fireEvent.changeText(input, 'New Name')

      const saveButton = screen.getByTestId('profile.saveButton')
      fireEvent.press(saveButton)

      await waitFor(() => {
        expect(mockAuthService.updateProfile).toHaveBeenCalledWith({ displayName: 'New Name' }, 'test-access-token')
      })
    })

    it('calls updateCurrency when currency changes', async () => {
      renderProfileScreen()

      await waitFor(() => {
        expect(screen.getByTestId('profile.currency.EUR')).toBeTruthy()
      })

      fireEvent.press(screen.getByTestId('profile.currency.EUR'))

      const saveButton = screen.getByTestId('profile.saveButton')
      fireEvent.press(saveButton)

      await waitFor(() => {
        expect(mockAuthService.updateCurrency).toHaveBeenCalledWith('EUR', 'test-access-token')
      })
    })

    it('shows success message after save', async () => {
      renderProfileScreen()

      await waitFor(() => {
        expect(screen.getByTestId('profile.displayNameInput')).toBeTruthy()
      })

      const input = screen.getByTestId('profile.displayNameInput')
      fireEvent.changeText(input, 'New Name')

      const saveButton = screen.getByTestId('profile.saveButton')
      fireEvent.press(saveButton)

      await waitFor(() => {
        expect(screen.getByTestId('profile.successMessage')).toBeTruthy()
      })
      expect(screen.getByText('Profile updated successfully')).toBeTruthy()
    })

    it('updates auth store with new display name', async () => {
      renderProfileScreen()

      await waitFor(() => {
        expect(screen.getByTestId('profile.displayNameInput')).toBeTruthy()
      })

      const input = screen.getByTestId('profile.displayNameInput')
      fireEvent.changeText(input, 'New Name')

      const saveButton = screen.getByTestId('profile.saveButton')
      fireEvent.press(saveButton)

      await waitFor(() => {
        expect(screen.getByTestId('profile.successMessage')).toBeTruthy()
      })

      // Verify auth store was updated
      const state = useAuthStore.getState()
      expect(state.user?.displayName).toBe('Updated Name')
    })
  })

  describe('Error Handling', () => {
    it('shows error message when updateProfile fails', async () => {
      mockAuthService.updateProfile.mockRejectedValue(new ApiError('Display name already taken', 'CONFLICT', 409))

      renderProfileScreen()

      await waitFor(() => {
        expect(screen.getByTestId('profile.displayNameInput')).toBeTruthy()
      })

      const input = screen.getByTestId('profile.displayNameInput')
      fireEvent.changeText(input, 'New Name')

      const saveButton = screen.getByTestId('profile.saveButton')
      fireEvent.press(saveButton)

      await waitFor(() => {
        expect(screen.getByTestId('profile.errorMessage')).toBeTruthy()
      })
      expect(screen.getByText('Display name already taken')).toBeTruthy()
    })

    it('shows generic error for non-ApiError failures', async () => {
      mockAuthService.updateProfile.mockRejectedValue(new Error('Network error'))

      renderProfileScreen()

      await waitFor(() => {
        expect(screen.getByTestId('profile.displayNameInput')).toBeTruthy()
      })

      const input = screen.getByTestId('profile.displayNameInput')
      fireEvent.changeText(input, 'New Name')

      const saveButton = screen.getByTestId('profile.saveButton')
      fireEvent.press(saveButton)

      await waitFor(() => {
        expect(screen.getByTestId('profile.errorMessage')).toBeTruthy()
      })
      expect(screen.getByText('Failed to update profile. Please try again.')).toBeTruthy()
    })

    it('falls back to auth store data when getProfile fails', async () => {
      mockAuthService.getProfile.mockRejectedValue(new Error('API error'))

      renderProfileScreen()

      // Should still display from auth store fallback
      await waitFor(() => {
        expect(screen.getByTestId('profile.displayNameInput')).toBeTruthy()
      })
      expect(screen.getByDisplayValue('Test User')).toBeTruthy()
    })

    it('shows not authenticated error when no access token', async () => {
      useAuthStore.setState({
        accessToken: null,
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          displayName: 'Test User',
          hasCompletedOnboarding: true,
        },
        isAuthenticated: false,
      })

      renderProfileScreen()

      await waitFor(() => {
        expect(screen.getByTestId('profile.displayNameInput')).toBeTruthy()
      })

      const input = screen.getByTestId('profile.displayNameInput')
      fireEvent.changeText(input, 'New Name')

      const saveButton = screen.getByTestId('profile.saveButton')
      fireEvent.press(saveButton)

      await waitFor(() => {
        expect(screen.getByTestId('profile.errorMessage')).toBeTruthy()
      })
      expect(screen.getByText('Not authenticated')).toBeTruthy()
    })
  })

  describe('Navigation', () => {
    it('calls goBack when cancel is pressed', async () => {
      renderProfileScreen()

      await waitFor(() => {
        expect(screen.getByTestId('profile.cancelButton')).toBeTruthy()
      })

      fireEvent.press(screen.getByTestId('profile.cancelButton'))

      expect(mockNavigation.goBack).toHaveBeenCalled()
    })
  })
})
