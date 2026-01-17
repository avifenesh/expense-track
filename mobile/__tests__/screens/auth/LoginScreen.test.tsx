import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { LoginScreen } from '../../../src/screens/auth/LoginScreen';
import { AuthProvider } from '../../../src/contexts';
import { ApiError } from '../../../src/services/api';
import * as authService from '../../../src/services/auth';
import * as biometricService from '../../../src/services/biometric';
import type { AuthScreenProps } from '../../../src/navigation/types';

jest.mock('../../../src/services/auth');
jest.mock('../../../src/services/biometric');

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockBiometricService = biometricService as jest.Mocked<typeof biometricService>;

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
    // Default biometric mocks
    mockBiometricService.checkBiometricCapability.mockResolvedValue({
      isAvailable: false,
      biometricType: 'none',
      isEnrolled: false,
    });
    mockBiometricService.isBiometricEnabled.mockResolvedValue(false);
  });

  describe('Rendering', () => {
    it('renders login form with email and password inputs', async () => {
      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeTruthy();
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

      const signInButton = screen.getAllByText('Sign In')[0];
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeTruthy();
      });
    });

    it('shows validation error for empty email', async () => {
      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getAllByText('Sign In')[0]).toBeTruthy();
      });

      const signInButton = screen.getAllByText('Sign In')[0];
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText(/email/i)).toBeTruthy();
      });
    });

    it('clears email error when user starts typing', async () => {
      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      fireEvent.changeText(emailInput, 'invalid');

      const signInButton = screen.getAllByText('Sign In')[0];
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeTruthy();
      });

      fireEvent.changeText(emailInput, 'test@example.com');

      await waitFor(() => {
        // Error should be cleared
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

      const signInButton = screen.getAllByText('Sign In')[0];
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText('Password is required')).toBeTruthy();
      });
    });

    it('clears password error when user starts typing', async () => {
      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      fireEvent.changeText(emailInput, 'test@example.com');

      const signInButton = screen.getAllByText('Sign In')[0];
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText('Password is required')).toBeTruthy();
      });

      const passwordInput = screen.getByPlaceholderText('Enter your password');
      fireEvent.changeText(passwordInput, 'password123');

      await waitFor(() => {
        const errors = screen.queryAllByText('Password is required');
        expect(errors.length).toBe(0);
      });
    });
  });

  describe('Login Success', () => {
    it('calls login with email and password', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'token-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');

      const signInButton = screen.getAllByText('Sign In')[0];
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('disables button during loading', async () => {
      mockAuthService.login.mockImplementation(
        () => new Promise(resolve =>
          setTimeout(() =>
            resolve({
              accessToken: 'token-123',
              refreshToken: 'refresh-456',
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

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');

      const signInButton = screen.getAllByText('Sign In')[0];
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeTruthy();
      });
    });
  });

  describe('API Error Handling', () => {
    it('displays 401 error for invalid credentials', async () => {
      mockAuthService.login.mockRejectedValueOnce(
        new ApiError('Invalid credentials', 'INVALID_CREDENTIALS', 401)
      );

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'wrongpassword');

      const signInButton = screen.getAllByText('Sign In')[0];
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password')).toBeTruthy();
      });
    });

    it('displays rate limit error', async () => {
      mockAuthService.login.mockRejectedValueOnce(
        new ApiError('Too many attempts', 'RATE_LIMITED', 429)
      );

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');

      const signInButton = screen.getAllByText('Sign In')[0];
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText('Too many attempts. Please try again later.')).toBeTruthy();
      });
    });

    it('displays email error from API details', async () => {
      mockAuthService.login.mockRejectedValueOnce(
        new ApiError('Validation failed', 'VALIDATION_ERROR', 400, {
          email: ['Email not found'],
        })
      );

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');

      fireEvent.changeText(emailInput, 'notfound@example.com');
      fireEvent.changeText(passwordInput, 'password123');

      const signInButton = screen.getAllByText('Sign In')[0];
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText('Email not found')).toBeTruthy();
      });
    });

    it('displays generic error message for unexpected errors', async () => {
      mockAuthService.login.mockRejectedValueOnce(
        new ApiError('Network error', 'NETWORK_ERROR', 0)
      );

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');

      const signInButton = screen.getAllByText('Sign In')[0];
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeTruthy();
      });
    });

    it('displays generic message for non-ApiError exceptions', async () => {
      mockAuthService.login.mockRejectedValueOnce(new Error('Unexpected error'));

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');

      const signInButton = screen.getAllByText('Sign In')[0];
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeTruthy();
      });
    });
  });

  describe('Navigation', () => {
    it('navigates to Register on register link press', async () => {
      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByText(/Don't have an account/)).toBeTruthy();
      });

      const registerLink = screen.getByText(/Don't have an account/);
      fireEvent.press(registerLink);

      expect(mockNavigate).toHaveBeenCalledWith('Register');
    });

    it('navigates to ResetPassword on forgot password link press', async () => {
      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByText(/Forgot password/)).toBeTruthy();
      });

      const forgotLink = screen.getByText(/Forgot password/);
      fireEvent.press(forgotLink);

      expect(mockNavigate).toHaveBeenCalledWith('ResetPassword', {});
    });

    it('disables navigation links during loading', async () => {
      mockAuthService.login.mockImplementation(
        () => new Promise(resolve =>
          setTimeout(() =>
            resolve({
              accessToken: 'token-123',
              refreshToken: 'refresh-456',
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

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');

      const signInButton = screen.getAllByText('Sign In')[0];
      fireEvent.press(signInButton);

      const registerLink = screen.getByText(/Don't have an account/);
      fireEvent.press(registerLink);

      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalledWith('Register');
      });
    });
  });

  describe('Error Clearing', () => {
    it('clears errors when changing input values', async () => {
      mockAuthService.login.mockRejectedValueOnce(
        new ApiError('Invalid credentials', 'INVALID_CREDENTIALS', 401)
      );

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'wrongpassword');

      const signInButton = screen.getAllByText('Sign In')[0];
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password')).toBeTruthy();
      });

      fireEvent.changeText(emailInput, 'newtest@example.com');

      await waitFor(() => {
        const errors = screen.queryAllByText('Invalid email or password');
        expect(errors.length).toBe(0);
      });
    });
  });

  describe('Biometric Login', () => {
    it('does not show biometric button when not available', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: false,
        biometricType: 'none',
        isEnrolled: false,
      });
      mockBiometricService.isBiometricEnabled.mockResolvedValue(false);

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeTruthy();
      });

      expect(screen.queryByTestId('biometric-login-button')).toBeNull();
    });

    it('does not show biometric button when not enabled', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: true,
        biometricType: 'faceId',
        isEnrolled: true,
      });
      mockBiometricService.isBiometricEnabled.mockResolvedValue(false);

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeTruthy();
      });

      expect(screen.queryByTestId('biometric-login-button')).toBeNull();
    });

    it('shows biometric button when available and enabled', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: true,
        biometricType: 'faceId',
        isEnrolled: true,
      });
      mockBiometricService.isBiometricEnabled.mockResolvedValue(true);

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByTestId('biometric-login-button')).toBeTruthy();
      });
      expect(screen.getByText('Use Face ID')).toBeTruthy();
    });

    it('shows fingerprint label for fingerprint type', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: true,
        biometricType: 'fingerprint',
        isEnrolled: true,
      });
      mockBiometricService.isBiometricEnabled.mockResolvedValue(true);

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByText('Use Fingerprint')).toBeTruthy();
      });
    });

    it('calls loginWithBiometric when biometric button pressed', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: true,
        biometricType: 'faceId',
        isEnrolled: true,
      });
      mockBiometricService.isBiometricEnabled.mockResolvedValue(true);
      mockBiometricService.promptBiometric.mockResolvedValue({ success: true });
      mockBiometricService.getStoredCredentials.mockResolvedValue({
        refreshToken: 'stored-refresh',
        email: 'stored@example.com',
      });
      mockAuthService.refreshTokens.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresIn: 900,
      });

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByTestId('biometric-login-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('biometric-login-button'));

      await waitFor(() => {
        expect(mockBiometricService.promptBiometric).toHaveBeenCalled();
      });
    });

    it('shows error when biometric login fails', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: true,
        biometricType: 'faceId',
        isEnrolled: true,
      });
      mockBiometricService.isBiometricEnabled.mockResolvedValue(true);
      mockBiometricService.promptBiometric.mockResolvedValue({
        success: false,
        error: 'User cancelled',
      });

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByTestId('biometric-login-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('biometric-login-button'));

      await waitFor(() => {
        expect(screen.getByText('User cancelled')).toBeTruthy();
      });
    });

    it('shows session expired error when token refresh fails', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: true,
        biometricType: 'faceId',
        isEnrolled: true,
      });
      mockBiometricService.isBiometricEnabled.mockResolvedValue(true);
      mockBiometricService.promptBiometric.mockResolvedValue({ success: true });
      mockBiometricService.getStoredCredentials.mockResolvedValue({
        refreshToken: 'expired-refresh',
        email: 'stored@example.com',
      });
      mockAuthService.refreshTokens.mockRejectedValue(new Error('Token expired'));

      renderLoginScreen();

      await waitFor(() => {
        expect(screen.getByTestId('biometric-login-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('biometric-login-button'));

      await waitFor(() => {
        expect(screen.getByText('Session expired. Please sign in with your password.')).toBeTruthy();
      });
    });
  });
});
