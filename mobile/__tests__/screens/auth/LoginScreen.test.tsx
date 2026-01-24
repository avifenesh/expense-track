import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { LoginScreen } from '../../../src/screens/auth/LoginScreen';
import { AuthProvider } from '../../../src/contexts';
import { ApiError } from '../../../src/services/api';
import * as authService from '../../../src/services/auth';
import * as biometricService from '../../../src/services/biometric';
import { tokenStorage } from '../../../src/lib/tokenStorage';
import { useAuthStore } from '../../../src/stores/authStore';
import { createMockStoreImplementation } from '../../utils/mockZustandStore';
import type { AuthScreenProps } from '../../../src/navigation/types';

jest.mock('../../../src/services/auth');
jest.mock('../../../src/services/biometric');
jest.mock('../../../src/lib/tokenStorage');
jest.mock('../../../src/stores/authStore');

const _mockAuthService = authService as jest.Mocked<typeof authService>;
const mockBiometricService = biometricService as jest.Mocked<typeof biometricService>;
const mockTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

const mockLogin = jest.fn();
const mockLoginWithBiometric = jest.fn();

const setupAuthStoreMock = () => {
  const state = {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    hasCompletedOnboarding: false,
    biometricCapability: {
      isAvailable: false,
      biometricType: 'none' as const,
      isEnrolled: false,
    },
    isBiometricEnabled: false,
    isLoading: false,
    error: null,
    login: mockLogin,
    loginWithBiometric: mockLoginWithBiometric,
    logout: jest.fn(),
    register: jest.fn(),
    setOnboardingComplete: jest.fn(),
    checkBiometric: jest.fn(),
    enableBiometric: jest.fn(),
    disableBiometric: jest.fn(),
    refreshTokens: jest.fn(),
    setCredentials: jest.fn(),
    clearError: jest.fn(),
    reset: jest.fn(),
  };
  mockUseAuthStore.mockImplementation(createMockStoreImplementation(state));
  (mockUseAuthStore as jest.Mock & { getState: () => typeof state }).getState = jest.fn(() => state);
};

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
} as unknown as AuthScreenProps<'Login'>['navigation'];

const mockRoute = {
  key: 'Login',
  name: 'Login' as const,
  params: undefined,
} as AuthScreenProps<'Login'>['route'];

const renderLoginScreen = () => {
  return render(
    <AuthProvider>
      <NavigationContainer>
        <LoginScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      </NavigationContainer>
    </AuthProvider>
  );
};

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuthStoreMock();
    // Default biometric mocks
    mockBiometricService.checkBiometricCapability.mockResolvedValue({
      isAvailable: false,
      biometricType: 'none',
      isEnrolled: false,
    });
    mockBiometricService.isBiometricEnabled.mockResolvedValue(false);
    // Default token storage mocks
    mockTokenStorage.getStoredCredentials.mockResolvedValue({
      accessToken: null,
      refreshToken: null,
      email: null,
      hasCompletedOnboarding: false,
    });
    mockTokenStorage.setStoredCredentials.mockResolvedValue(undefined);
    mockTokenStorage.setTokens.mockResolvedValue(undefined);
    mockTokenStorage.clearTokens.mockResolvedValue(undefined);
    mockTokenStorage.setOnboardingComplete.mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('renders login form with email and password inputs', async () => {
      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getAllByText('Sign In').length).toBeGreaterThan(0);
      });
      expect(screen.getByText('Welcome back to Balance Beacon')).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter your password')).toBeTruthy();
    });

    it('renders navigation links', async () => {
      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByText(/Don't have an account/)).toBeTruthy();
      });
      expect(screen.getByText(/Forgot password/)).toBeTruthy();
    });

    it('renders Sign In button', async () => {
      renderLoginScreen();

      await waitFor(() => {
        const buttons = screen.getAllByText('Sign In');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Email Validation', () => {
    it('shows validation error for invalid email', async () => {
      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      fireEvent.changeText(emailInput, 'invalid-email');

      const signInButton = screen.getByTestId('login.submitButton');
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeTruthy();
      });
    });

    it('clears validation error when valid email entered', async () => {
      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      fireEvent.changeText(emailInput, 'invalid-email');

      const signInButton = screen.getByTestId('login.submitButton');
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeTruthy();
      });

      fireEvent.changeText(emailInput, 'valid@example.com');

      await waitFor(() => {
        const errors = screen.queryAllByText(/valid email/i);
        expect(errors.length).toBe(0);
      });
    });
  });

  describe('Password Validation', () => {
    it('shows validation error for empty password', async () => {
      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      fireEvent.changeText(emailInput, 'test@example.com');

      const signInButton = screen.getByTestId('login.submitButton');
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText(/password.*required/i)).toBeTruthy();
      });
    });
  });

  describe('Login Success', () => {
    it('calls login with email and password', async () => {
      mockLogin.mockResolvedValueOnce({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
      });

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const signInButton = screen.getByTestId('login.submitButton');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('disables Sign In button during login', async () => {
      mockLogin.mockImplementation(
        () => new Promise(resolve =>
          setTimeout(() =>
            resolve({
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
              expiresIn: 900,
            }),
            100
          )
        )
      );

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const signInButton = screen.getByTestId('login.submitButton');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });
    });
  });

  describe('API Error Handling', () => {
    it('displays rate limit error', async () => {
      mockLogin.mockRejectedValueOnce(
        new ApiError('Too many attempts', 'RATE_LIMITED', 429)
      );

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const signInButton = screen.getByTestId('login.submitButton');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText('Too many attempts. Please try again later.')).toBeTruthy();
      });
    });

    it('displays invalid credentials error', async () => {
      mockLogin.mockRejectedValueOnce(
        new ApiError('Invalid credentials', 'INVALID_CREDENTIALS', 401)
      );

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const signInButton = screen.getByTestId('login.submitButton');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'wrongpassword');
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password')).toBeTruthy();
      });
    });

    it('displays account locked error', async () => {
      mockLogin.mockRejectedValueOnce(
        new ApiError('Account locked', 'ACCOUNT_LOCKED', 403)
      );

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const signInButton = screen.getByTestId('login.submitButton');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText('Account locked')).toBeTruthy();
      });
    });

    it('displays generic error for unknown errors', async () => {
      mockLogin.mockRejectedValueOnce(new Error('Network error'));

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const signInButton = screen.getByTestId('login.submitButton');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeTruthy();
      });
    });

    it('displays email not verified error', async () => {
      mockLogin.mockRejectedValueOnce(
        new ApiError('Email not verified', 'EMAIL_NOT_VERIFIED', 403)
      );

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const signInButton = screen.getByTestId('login.submitButton');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText('Email not verified')).toBeTruthy();
      });
    });
  });

  describe('Navigation', () => {
    it('navigates to Register on sign up link press', async () => {
      renderLoginScreen();

      await waitFor(() => {
        const registerLink = screen.getByText(/Don't have an account/);
        fireEvent.press(registerLink);
      });

      expect(mockNavigate).toHaveBeenCalledWith('Register');
    });

    it('navigates to ResetPassword on forgot password link press', async () => {
      renderLoginScreen();

      await waitFor(() => {
        const forgotLink = screen.getByText(/Forgot password/);
        fireEvent.press(forgotLink);
      });

      expect(mockNavigate).toHaveBeenCalledWith('ResetPassword', {});
    });

    it('disables navigation links during login', async () => {
      mockLogin.mockImplementation(
        () => new Promise(resolve =>
          setTimeout(() =>
            resolve({
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
              expiresIn: 900,
            }),
            100
          )
        )
      );

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const signInButton = screen.getByTestId('login.submitButton');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(signInButton);

      const registerLink = screen.getByText(/Don't have an account/);
      fireEvent.press(registerLink);

      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalledWith('Register');
      });
    });
  });
});
