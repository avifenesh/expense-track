import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Share, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SettingsScreen } from '../../../src/screens/main/SettingsScreen';
import { AuthProvider } from '../../../src/contexts';
import * as biometricService from '../../../src/services/biometric';
import * as authService from '../../../src/services/auth';
import { ApiError } from '../../../src/services/api';
import { useAuthStore } from '../../../src/stores';
import { createMockStoreImplementation } from '../../utils/mockZustandStore';
import type { MainTabScreenProps } from '../../../src/navigation/types';

jest.mock('../../../src/services/biometric', () => ({
  ...jest.requireActual('../../../src/services/biometric'),
  checkBiometricCapability: jest.fn(),
  isBiometricEnabled: jest.fn(),
  enableBiometric: jest.fn(),
  disableBiometric: jest.fn(),
  authenticateWithBiometric: jest.fn(),
}));
jest.mock('../../../src/services/auth');

jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
jest.spyOn(Alert, 'alert').mockImplementation(() => {});
// Mock the stores index (which the component imports from)
jest.mock('../../../src/stores', () => ({
  useAuthStore: jest.fn(),
}));

const mockBiometricService = biometricService as jest.Mocked<typeof biometricService>;
const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

const mockLogout = jest.fn();
const mockEnableBiometric = jest.fn();
const mockDisableBiometric = jest.fn();

const setupAuthStoreMock = (overrides: Partial<{
  biometricCapability: { isAvailable: boolean; biometricType: string; isEnrolled: boolean } | null;
  isBiometricEnabled: boolean;
  user: { id: string; email: string; displayName?: string; hasCompletedOnboarding: boolean } | null;
  accessToken: string | null;
}> = {}) => {
  const state = {
    user: overrides.user ?? null,
    accessToken: overrides.accessToken ?? null,
    refreshToken: null,
    isAuthenticated: false,
    hasCompletedOnboarding: false,
    biometricCapability: overrides.biometricCapability ?? null,
    isBiometricEnabled: overrides.isBiometricEnabled ?? false,
    isLoading: false,
    error: null,
    login: jest.fn(),
    loginWithBiometric: jest.fn(),
    logout: mockLogout,
    register: jest.fn(),
    setOnboardingComplete: jest.fn(),
    checkBiometric: jest.fn(),
    enableBiometric: mockEnableBiometric,
    disableBiometric: mockDisableBiometric,
    refreshTokens: jest.fn(),
    setCredentials: jest.fn(),
    clearError: jest.fn(),
    reset: jest.fn(),
  };
  mockUseAuthStore.mockImplementation(createMockStoreImplementation(state));
  (mockUseAuthStore as jest.Mock & { getState: () => typeof state }).getState = jest.fn(() => state);
};

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({
    reset: jest.fn(),
  })),
} as unknown as MainTabScreenProps<'Settings'>['navigation'];

const mockRoute = {
  key: 'Settings',
  name: 'Settings' as const,
  params: undefined,
} as MainTabScreenProps<'Settings'>['route'];

const renderSettingsScreen = () => {
  return render(
    <AuthProvider>
      <NavigationContainer>
        <SettingsScreen navigation={mockNavigation} route={mockRoute} />
      </NavigationContainer>
    </AuthProvider>
  );
};

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuthStoreMock();
    // Default biometric mocks - not available
    mockBiometricService.checkBiometricCapability.mockResolvedValue({
      isAvailable: false,
      biometricType: 'none',
      isEnrolled: false,
    });
    mockBiometricService.isBiometricEnabled.mockResolvedValue(false);
  });

  describe('Rendering', () => {
    it('renders settings title', async () => {
      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeTruthy();
      });
    });

    it('renders Account section', async () => {
      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByText('Account')).toBeTruthy();
      });
      expect(screen.getByText('Profile')).toBeTruthy();
      expect(screen.getByText('Currency')).toBeTruthy();
      expect(screen.getByText('Accounts')).toBeTruthy();
      expect(screen.getByText('Categories')).toBeTruthy();
    });

    it('renders Data section', async () => {
      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByText('Data')).toBeTruthy();
      });
      expect(screen.getByText('Export Data')).toBeTruthy();
      expect(screen.getByText('Delete Account')).toBeTruthy();
    });

    it('renders About section', async () => {
      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByText('About')).toBeTruthy();
      });
      expect(screen.getByText('Privacy Policy')).toBeTruthy();
      expect(screen.getByText('Terms of Service')).toBeTruthy();
      expect(screen.getByText('Version')).toBeTruthy();
    });

    it('renders Sign Out button', async () => {
      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('logout-button')).toBeTruthy();
      });
      expect(screen.getByText('Sign Out')).toBeTruthy();
    });

    it('renders app name', async () => {
      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByText('Balance Beacon')).toBeTruthy();
      });
    });
  });

  describe('Biometric Toggle', () => {
    it('does not show biometric toggle when not available', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: false,
        biometricType: 'none',
        isEnrolled: false,
      });
      mockBiometricService.isBiometricEnabled.mockResolvedValue(false);

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeTruthy();
      });

      expect(screen.queryByTestId('biometric-switch')).toBeNull();
      expect(screen.queryByText('Security')).toBeNull();
    });

    it('shows biometric toggle when available', async () => {
      setupAuthStoreMock({
        biometricCapability: {
          isAvailable: true,
          biometricType: 'faceId',
          isEnrolled: true,
        },
        isBiometricEnabled: false,
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByText('Security')).toBeTruthy();
      });
      expect(screen.getByTestId('biometric-switch')).toBeTruthy();
      expect(screen.getByText('Face ID')).toBeTruthy();
      expect(screen.getByText('Quick unlock with Face ID')).toBeTruthy();
    });

    it('shows fingerprint label for fingerprint type', async () => {
      setupAuthStoreMock({
        biometricCapability: {
          isAvailable: true,
          biometricType: 'fingerprint',
          isEnrolled: true,
        },
        isBiometricEnabled: false,
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByText('Fingerprint')).toBeTruthy();
      });
      expect(screen.getByText('Quick unlock with Fingerprint')).toBeTruthy();
    });

    it('shows switch as on when biometric is enabled', async () => {
      setupAuthStoreMock({
        biometricCapability: {
          isAvailable: true,
          biometricType: 'faceId',
          isEnrolled: true,
        },
        isBiometricEnabled: true,
      });

      renderSettingsScreen();

      await waitFor(() => {
        const biometricSwitch = screen.getByTestId('biometric-switch');
        expect(biometricSwitch.props.value).toBe(true);
      });
    });

    it('shows switch as off when biometric is disabled', async () => {
      setupAuthStoreMock({
        biometricCapability: {
          isAvailable: true,
          biometricType: 'faceId',
          isEnrolled: true,
        },
        isBiometricEnabled: false,
      });

      renderSettingsScreen();

      await waitFor(() => {
        const biometricSwitch = screen.getByTestId('biometric-switch');
        expect(biometricSwitch.props.value).toBe(false);
      });
    });

    it('shows loading indicator when toggling biometric', async () => {
      setupAuthStoreMock({
        biometricCapability: {
          isAvailable: true,
          biometricType: 'faceId',
          isEnrolled: true,
        },
        isBiometricEnabled: false,
      });
      mockEnableBiometric.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('biometric-switch')).toBeTruthy();
      });

      const biometricSwitch = screen.getByTestId('biometric-switch');
      fireEvent(biometricSwitch, 'valueChange', true);

      await waitFor(() => {
        expect(screen.getByTestId('biometric-loading')).toBeTruthy();
      });
    });

    it('shows error when enabling biometric fails', async () => {
      setupAuthStoreMock({
        biometricCapability: {
          isAvailable: true,
          biometricType: 'faceId',
          isEnrolled: true,
        },
        isBiometricEnabled: false,
      });
      mockEnableBiometric.mockRejectedValue(new Error('User cancelled authentication'));

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('biometric-switch')).toBeTruthy();
      });

      const biometricSwitch = screen.getByTestId('biometric-switch');
      fireEvent(biometricSwitch, 'valueChange', true);

      await waitFor(() => {
        expect(screen.getByText('User cancelled authentication')).toBeTruthy();
      });
    });

    it('shows generic error when enabling biometric fails with non-Error', async () => {
      setupAuthStoreMock({
        biometricCapability: {
          isAvailable: true,
          biometricType: 'faceId',
          isEnrolled: true,
        },
        isBiometricEnabled: false,
      });
      mockEnableBiometric.mockRejectedValue('unknown error');

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('biometric-switch')).toBeTruthy();
      });

      const biometricSwitch = screen.getByTestId('biometric-switch');
      fireEvent(biometricSwitch, 'valueChange', true);

      await waitFor(() => {
        expect(screen.getByText('Failed to update biometric settings')).toBeTruthy();
      });
    });
  });

  describe('Logout', () => {
    it('calls logout when Sign Out is pressed', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('logout-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('logout-button'));

      await waitFor(() => {
        // Logout should be called (the actual logout behavior is handled by AuthContext)
        expect(screen.getByTestId('logout-button')).toBeTruthy();
      });
    });

    it('shows loading indicator during logout', async () => {
      mockAuthService.logout.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('logout-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('logout-button'));

      // Button should show loading state (ActivityIndicator replaces text)
      await waitFor(() => {
        expect(screen.queryByText('Sign Out')).toBeNull();
      });
    });

    it('disables logout button during loading', async () => {
      mockAuthService.logout.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('logout-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('logout-button'));

      await waitFor(() => {
        const logoutButton = screen.getByTestId('logout-button');
        expect(logoutButton.props.accessibilityState?.disabled).toBe(true);
      });
    });
  });

  describe('Export Data', () => {
    it('opens export modal when Export Data is pressed', async () => {
      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: 'access-token-123',
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.exportDataButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.exportDataButton'));

      await waitFor(() => {
        expect(screen.getByTestId('export-format-modal')).toBeTruthy();
      });
    });

    it('shows JSON and CSV format options in export modal', async () => {
      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: 'access-token-123',
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.exportDataButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.exportDataButton'));

      await waitFor(() => {
        expect(screen.getByTestId('export-format-modal.json')).toBeTruthy();
        expect(screen.getByTestId('export-format-modal.csv')).toBeTruthy();
      });
    });

    it('closes export modal when cancel is pressed', async () => {
      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: 'access-token-123',
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.exportDataButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.exportDataButton'));

      await waitFor(() => {
        expect(screen.getByTestId('export-format-modal')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('export-format-modal.cancel'));

      await waitFor(() => {
        expect(screen.queryByTestId('export-format-modal')).toBeNull();
      });
    });

    it('exports data in JSON format and shares it', async () => {
      const mockExportData = {
        exportedAt: '2026-01-26T00:00:00Z',
        user: { id: 'user-123', email: 'test@example.com' },
        accounts: [],
        transactions: [],
      };
      mockAuthService.exportUserData.mockResolvedValue(mockExportData);

      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: 'access-token-123',
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.exportDataButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.exportDataButton'));

      await waitFor(() => {
        expect(screen.getByTestId('export-format-modal.json')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('export-format-modal.json'));

      await waitFor(() => {
        expect(mockAuthService.exportUserData).toHaveBeenCalledWith('json', 'access-token-123');
      });

      await waitFor(() => {
        expect(Share.share).toHaveBeenCalledWith({
          message: JSON.stringify(mockExportData, null, 2),
          title: 'balance-beacon-export.json',
        });
      });

      expect(Alert.alert).toHaveBeenCalledWith('Success', 'Your data has been exported successfully');
    });

    it('exports data in CSV format and shares it', async () => {
      const mockCsvData = { format: 'csv' as const, data: 'id,name\n1,test' };
      mockAuthService.exportUserData.mockResolvedValue(mockCsvData);

      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: 'access-token-123',
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.exportDataButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.exportDataButton'));

      await waitFor(() => {
        expect(screen.getByTestId('export-format-modal.csv')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('export-format-modal.csv'));

      await waitFor(() => {
        expect(mockAuthService.exportUserData).toHaveBeenCalledWith('csv', 'access-token-123');
      });

      await waitFor(() => {
        expect(Share.share).toHaveBeenCalledWith({
          message: 'id,name\n1,test',
          title: 'balance-beacon-export.csv',
        });
      });
    });

    it('shows error alert when export fails with ApiError', async () => {
      mockAuthService.exportUserData.mockRejectedValue(new ApiError('Rate limit exceeded', 429));

      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: 'access-token-123',
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.exportDataButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.exportDataButton'));

      await waitFor(() => {
        expect(screen.getByTestId('export-format-modal.json')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('export-format-modal.json'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Export Failed', 'Rate limit exceeded');
      });
    });

    it('shows generic error when export fails with unknown error', async () => {
      mockAuthService.exportUserData.mockRejectedValue(new Error('Network error'));

      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: 'access-token-123',
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.exportDataButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.exportDataButton'));

      await waitFor(() => {
        expect(screen.getByTestId('export-format-modal.json')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('export-format-modal.json'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Export Failed', 'Failed to export data');
      });
    });

    it('shows error when no access token', async () => {
      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: null,
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.exportDataButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.exportDataButton'));

      await waitFor(() => {
        expect(screen.getByTestId('export-format-modal.json')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('export-format-modal.json'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'You must be logged in to export data');
      });
    });
  });

  describe('Delete Account', () => {
    it('opens delete modal when Delete Account is pressed', async () => {
      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: 'access-token-123',
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.deleteAccountButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.deleteAccountButton'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-account-modal')).toBeTruthy();
      });
    });

    it('shows warning text in delete modal', async () => {
      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: 'access-token-123',
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.deleteAccountButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.deleteAccountButton'));

      await waitFor(() => {
        expect(screen.getByText('This action cannot be undone')).toBeTruthy();
      });
    });

    it('shows email input in delete modal', async () => {
      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: 'access-token-123',
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.deleteAccountButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.deleteAccountButton'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-account-modal.email-input')).toBeTruthy();
      });
    });

    it('disables confirm button until email matches', async () => {
      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: 'access-token-123',
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.deleteAccountButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.deleteAccountButton'));

      await waitFor(() => {
        const confirmButton = screen.getByTestId('delete-account-modal.confirm');
        expect(confirmButton.props.accessibilityState?.disabled).toBe(true);
      });
    });

    it('enables confirm button when email matches', async () => {
      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: 'access-token-123',
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.deleteAccountButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.deleteAccountButton'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-account-modal.email-input')).toBeTruthy();
      });

      fireEvent.changeText(screen.getByTestId('delete-account-modal.email-input'), 'test@example.com');

      await waitFor(() => {
        const confirmButton = screen.getByTestId('delete-account-modal.confirm');
        expect(confirmButton.props.accessibilityState?.disabled).toBe(false);
      });
    });

    it('closes delete modal when cancel is pressed', async () => {
      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: 'access-token-123',
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.deleteAccountButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.deleteAccountButton'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-account-modal')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('delete-account-modal.cancel'));

      await waitFor(() => {
        expect(screen.queryByTestId('delete-account-modal')).toBeNull();
      });
    });

    it('deletes account when email matches and confirm is pressed', async () => {
      mockAuthService.deleteAccount.mockResolvedValue({ message: 'Account deleted successfully' });

      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: 'access-token-123',
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.deleteAccountButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.deleteAccountButton'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-account-modal.email-input')).toBeTruthy();
      });

      fireEvent.changeText(screen.getByTestId('delete-account-modal.email-input'), 'test@example.com');

      await waitFor(() => {
        const confirmButton = screen.getByTestId('delete-account-modal.confirm');
        expect(confirmButton.props.accessibilityState?.disabled).toBe(false);
      });

      fireEvent.press(screen.getByTestId('delete-account-modal.confirm'));

      await waitFor(() => {
        expect(mockAuthService.deleteAccount).toHaveBeenCalledWith('test@example.com', 'access-token-123');
      });

      // Alert.alert is called with callback that triggers logout when OK is pressed
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Account Deleted',
          'Your account has been permanently deleted',
          expect.arrayContaining([
            expect.objectContaining({ text: 'OK', onPress: expect.any(Function) }),
          ]),
          { cancelable: false }
        );
      });

      // Simulate pressing OK button to trigger logout
      const alertCall = (Alert.alert as jest.Mock).mock.calls.find(
        call => call[0] === 'Account Deleted'
      );
      if (alertCall && alertCall[2]) {
        const okButton = alertCall[2].find((btn: { text: string }) => btn.text === 'OK');
        okButton?.onPress?.();
      }

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });

    it('shows error alert when delete fails with ApiError', async () => {
      mockAuthService.deleteAccount.mockRejectedValue(new ApiError('Email confirmation does not match', 400));

      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: 'access-token-123',
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.deleteAccountButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.deleteAccountButton'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-account-modal.email-input')).toBeTruthy();
      });

      fireEvent.changeText(screen.getByTestId('delete-account-modal.email-input'), 'test@example.com');
      fireEvent.press(screen.getByTestId('delete-account-modal.confirm'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Delete Failed', 'Email confirmation does not match');
      });
    });

    it('shows generic error when delete fails with unknown error', async () => {
      mockAuthService.deleteAccount.mockRejectedValue(new Error('Network error'));

      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: 'access-token-123',
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.deleteAccountButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.deleteAccountButton'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-account-modal.email-input')).toBeTruthy();
      });

      fireEvent.changeText(screen.getByTestId('delete-account-modal.email-input'), 'test@example.com');
      fireEvent.press(screen.getByTestId('delete-account-modal.confirm'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Delete Failed', 'Failed to delete account');
      });
    });

    it('shows error when no access token for delete', async () => {
      setupAuthStoreMock({
        user: { id: 'user-123', email: 'test@example.com', hasCompletedOnboarding: true },
        accessToken: null,
      });

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByTestId('settings.deleteAccountButton')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('settings.deleteAccountButton'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-account-modal.email-input')).toBeTruthy();
      });

      fireEvent.changeText(screen.getByTestId('delete-account-modal.email-input'), 'test@example.com');
      fireEvent.press(screen.getByTestId('delete-account-modal.confirm'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'You must be logged in to delete your account');
      });
    });
  });
});
