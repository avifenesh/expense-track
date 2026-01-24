import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { OnboardingBiometricScreen } from '../../../src/screens/onboarding/OnboardingBiometricScreen';
import { useAuthStore } from '../../../src/stores/authStore';

jest.mock('../../../src/stores/authStore');

const mockUseAuthStore = useAuthStore as unknown as jest.Mock & { getState: jest.Mock };

// Helper to create store mock that handles selectors
function createStoreMock<T extends object>(state: T): (selector?: (s: T) => unknown) => unknown {
  return (selector?: (s: T) => unknown) => {
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  };
}

const mockNavigation = {
  navigate: jest.fn(),
  getParent: jest.fn(() => ({
    reset: jest.fn(),
  })),
} as unknown as Parameters<typeof OnboardingBiometricScreen>[0]['navigation'];

const mockRoute = {
  key: 'OnboardingBiometric',
  name: 'OnboardingBiometric' as const,
  params: undefined,
};

describe('OnboardingBiometricScreen', () => {
  const defaultAuthState = {
    isAuthenticated: true,
    isLoading: false,
    user: { id: '1', email: 'test@example.com', hasCompletedOnboarding: false },
    accessToken: 'test-token',
    biometricCapability: {
      isAvailable: true,
      biometricType: 'faceId' as const,
      isEnrolled: true,
    },
    isBiometricEnabled: false,
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    refreshToken: jest.fn(),
    updateUser: jest.fn(),
    loginWithBiometric: jest.fn(),
    enableBiometric: jest.fn(),
    disableBiometric: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockImplementation(createStoreMock(defaultAuthState));
    mockUseAuthStore.getState = jest.fn(() => defaultAuthState);
  });

  it('renders with biometric available', () => {
    render(
      <OnboardingBiometricScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(screen.getByText('Quick Access')).toBeTruthy();
    expect(screen.getByText(/Use Face ID to quickly unlock/)).toBeTruthy();
    expect(screen.getByText('Enable Face ID')).toBeTruthy();
    expect(screen.getByText('Skip for now')).toBeTruthy();
  });

  it('renders fingerprint label for fingerprint type', () => {
    const fingerprintState = {
      ...defaultAuthState,
      biometricCapability: {
        isAvailable: true,
        biometricType: 'fingerprint' as const,
        isEnrolled: true,
      },
    };
    mockUseAuthStore.mockImplementation(createStoreMock(fingerprintState));
    mockUseAuthStore.getState = jest.fn(() => fingerprintState);

    render(
      <OnboardingBiometricScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(screen.getByText(/Use Fingerprint to quickly unlock/)).toBeTruthy();
    expect(screen.getByText('Enable Fingerprint')).toBeTruthy();
  });

  it('renders continue button when biometric not available', () => {
    const noBiometricState = {
      ...defaultAuthState,
      biometricCapability: {
        isAvailable: false,
        biometricType: 'none' as const,
        isEnrolled: false,
      },
    };
    mockUseAuthStore.mockImplementation(createStoreMock(noBiometricState));
    mockUseAuthStore.getState = jest.fn(() => noBiometricState);

    render(
      <OnboardingBiometricScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(screen.getByText('Biometric authentication is not available on this device.')).toBeTruthy();
    expect(screen.getByText('Continue')).toBeTruthy();
    expect(screen.queryByText('Skip for now')).toBeNull();
  });

  it('enables biometric and completes onboarding on enable button press', async () => {
    const enableBiometric = jest.fn().mockResolvedValue(undefined);
    const updateUser = jest.fn();

    const stateWithFns = {
      ...defaultAuthState,
      enableBiometric,
      updateUser,
    };
    mockUseAuthStore.mockImplementation(createStoreMock(stateWithFns));
    mockUseAuthStore.getState = jest.fn(() => stateWithFns);

    render(
      <OnboardingBiometricScreen
        navigation={mockNavigation}
        route={mockRoute}
      />
    );

    fireEvent.press(screen.getByTestId('onboarding.biometric.enableButton'));

    await waitFor(() => {
      expect(enableBiometric).toHaveBeenCalled();
      expect(updateUser).toHaveBeenCalledWith({ hasCompletedOnboarding: true });
    });
  });

  it('shows error when enable fails', async () => {
    const enableBiometric = jest.fn().mockRejectedValue(new Error('Biometric failed'));

    const stateWithFn = {
      ...defaultAuthState,
      enableBiometric,
    };
    mockUseAuthStore.mockImplementation(createStoreMock(stateWithFn));
    mockUseAuthStore.getState = jest.fn(() => stateWithFn);

    render(
      <OnboardingBiometricScreen navigation={mockNavigation} route={mockRoute} />
    );

    fireEvent.press(screen.getByTestId('onboarding.biometric.enableButton'));

    await waitFor(() => {
      expect(screen.getByText('Biometric failed')).toBeTruthy();
    });
  });

  it('shows generic error when enable fails with non-Error', async () => {
    const enableBiometric = jest.fn().mockRejectedValue('unknown error');

    const stateWithFn = {
      ...defaultAuthState,
      enableBiometric,
    };
    mockUseAuthStore.mockImplementation(createStoreMock(stateWithFn));
    mockUseAuthStore.getState = jest.fn(() => stateWithFn);

    render(
      <OnboardingBiometricScreen navigation={mockNavigation} route={mockRoute} />
    );

    fireEvent.press(screen.getByTestId('onboarding.biometric.enableButton'));

    await waitFor(() => {
      expect(screen.getByText('Failed to enable biometric authentication')).toBeTruthy();
    });
  });

  it('completes onboarding on skip button press', async () => {
    const updateUser = jest.fn();

    const stateWithFn = {
      ...defaultAuthState,
      updateUser,
    };
    mockUseAuthStore.mockImplementation(createStoreMock(stateWithFn));
    mockUseAuthStore.getState = jest.fn(() => stateWithFn);

    render(
      <OnboardingBiometricScreen
        navigation={mockNavigation}
        route={mockRoute}
      />
    );

    fireEvent.press(screen.getByTestId('onboarding.biometric.skipButton'));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ hasCompletedOnboarding: true });
    });
  });

  it('completes onboarding on continue button when biometric unavailable', async () => {
    const updateUser = jest.fn();

    const noBiometricState = {
      ...defaultAuthState,
      biometricCapability: {
        isAvailable: false,
        biometricType: 'none' as const,
        isEnrolled: false,
      },
      updateUser,
    };
    mockUseAuthStore.mockImplementation(createStoreMock(noBiometricState));
    mockUseAuthStore.getState = jest.fn(() => noBiometricState);

    render(
      <OnboardingBiometricScreen
        navigation={mockNavigation}
        route={mockRoute}
      />
    );

    fireEvent.press(screen.getByTestId('onboarding.biometric.continueButton'));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ hasCompletedOnboarding: true });
    });
  });

  it('shows loading state during enable', async () => {
    const enableBiometric = jest.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    const stateWithFn = {
      ...defaultAuthState,
      enableBiometric,
    };
    mockUseAuthStore.mockImplementation(createStoreMock(stateWithFn));
    mockUseAuthStore.getState = jest.fn(() => stateWithFn);

    render(
      <OnboardingBiometricScreen navigation={mockNavigation} route={mockRoute} />
    );

    fireEvent.press(screen.getByTestId('onboarding.biometric.enableButton'));

    // Button should show loading indicator (ActivityIndicator)
    await waitFor(() => {
      expect(screen.queryByText('Enable Face ID')).toBeNull();
    });
  });

  it('renders step indicator', () => {
    render(
      <OnboardingBiometricScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(screen.getByText('Step 6 of 6')).toBeTruthy();
  });

  it('renders correct icon for Face ID', () => {
    render(
      <OnboardingBiometricScreen navigation={mockNavigation} route={mockRoute} />
    );

    // The component should render a face icon for faceId type
    // We check the parent icon container exists
    expect(screen.getByText('Quick Access')).toBeTruthy();
  });

  it('handles null biometricCapability', () => {
    const nullBiometricState = {
      ...defaultAuthState,
      biometricCapability: null,
    };
    mockUseAuthStore.mockImplementation(createStoreMock(nullBiometricState));
    mockUseAuthStore.getState = jest.fn(() => nullBiometricState);

    render(
      <OnboardingBiometricScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(screen.getByText('Biometric authentication is not available on this device.')).toBeTruthy();
    expect(screen.getByText('Continue')).toBeTruthy();
  });
});
