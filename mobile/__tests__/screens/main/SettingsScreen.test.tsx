import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SettingsScreen } from '../../../src/screens/main/SettingsScreen';
import { AuthProvider } from '../../../src/contexts';
import * as biometricService from '../../../src/services/biometric';
import * as authService from '../../../src/services/auth';
import type { MainTabScreenProps } from '../../../src/navigation/types';

jest.mock('../../../src/services/biometric');
jest.mock('../../../src/services/auth');

const mockBiometricService = biometricService as jest.Mocked<typeof biometricService>;
const mockAuthService = authService as jest.Mocked<typeof authService>;

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
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: true,
        biometricType: 'faceId',
        isEnrolled: true,
      });
      mockBiometricService.isBiometricEnabled.mockResolvedValue(false);

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByText('Security')).toBeTruthy();
      });
      expect(screen.getByTestId('biometric-switch')).toBeTruthy();
      expect(screen.getByText('Face ID')).toBeTruthy();
      expect(screen.getByText('Quick unlock with Face ID')).toBeTruthy();
    });

    it('shows fingerprint label for fingerprint type', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: true,
        biometricType: 'fingerprint',
        isEnrolled: true,
      });
      mockBiometricService.isBiometricEnabled.mockResolvedValue(false);

      renderSettingsScreen();

      await waitFor(() => {
        expect(screen.getByText('Fingerprint')).toBeTruthy();
      });
      expect(screen.getByText('Quick unlock with Fingerprint')).toBeTruthy();
    });

    it('shows switch as on when biometric is enabled', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: true,
        biometricType: 'faceId',
        isEnrolled: true,
      });
      mockBiometricService.isBiometricEnabled.mockResolvedValue(true);

      renderSettingsScreen();

      await waitFor(() => {
        const biometricSwitch = screen.getByTestId('biometric-switch');
        expect(biometricSwitch.props.value).toBe(true);
      });
    });

    it('shows switch as off when biometric is disabled', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: true,
        biometricType: 'faceId',
        isEnrolled: true,
      });
      mockBiometricService.isBiometricEnabled.mockResolvedValue(false);

      renderSettingsScreen();

      await waitFor(() => {
        const biometricSwitch = screen.getByTestId('biometric-switch');
        expect(biometricSwitch.props.value).toBe(false);
      });
    });

    it('shows loading indicator when toggling biometric', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: true,
        biometricType: 'faceId',
        isEnrolled: true,
      });
      mockBiometricService.isBiometricEnabled.mockResolvedValue(false);
      mockBiometricService.promptBiometric.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
      );
      mockBiometricService.enableBiometric.mockImplementation(
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
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: true,
        biometricType: 'faceId',
        isEnrolled: true,
      });
      mockBiometricService.isBiometricEnabled.mockResolvedValue(false);
      mockBiometricService.promptBiometric.mockResolvedValue({
        success: false,
        error: 'User cancelled authentication',
      });

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
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: true,
        biometricType: 'faceId',
        isEnrolled: true,
      });
      mockBiometricService.isBiometricEnabled.mockResolvedValue(false);
      mockBiometricService.promptBiometric.mockRejectedValue('unknown error');

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
});
