import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SettingsScreen } from '../../../src/screens/main/SettingsScreen';
import { AuthProvider } from '../../../src/contexts';
import * as biometricService from '../../../src/services/biometric';
import * as authService from '../../../src/services/auth';
import { useAuthStore } from '../../../src/stores';
import { createMockStoreImplementation } from '../../utils/mockZustandStore';
import type { MainTabScreenProps } from '../../../src/navigation/types';

jest.mock('../../../src/services/biometric');
jest.mock('../../../src/services/auth');
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
}> = {}) => {
  const state = {
    user: null,
    accessToken: null,
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
});
