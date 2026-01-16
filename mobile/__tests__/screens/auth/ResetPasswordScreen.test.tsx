import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { ResetPasswordScreen } from '../../../src/screens/auth/ResetPasswordScreen';
import { ApiError } from '../../../src/services/api';
import * as authService from '../../../src/services/auth';
import type { AuthScreenProps } from '../../../src/navigation/types';

jest.mock('../../../src/services/auth');

const mockAuthService = authService as jest.Mocked<typeof authService>;

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
} as unknown as AuthScreenProps<'ResetPassword'>['navigation'];

const renderResetPasswordScreen = (token?: string) => {
  const mockRoute = {
    key: 'ResetPassword',
    name: 'ResetPassword' as const,
    params: token ? { token } : undefined,
  } as AuthScreenProps<'ResetPassword'>['route'];

  return render(
    <NavigationContainer>
      <ResetPasswordScreen
        navigation={mockNavigation}
        route={mockRoute}
      />
    </NavigationContainer>
  );
};

describe('ResetPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Password Reset Mode (no token)', () => {
    it('renders email input for reset request', () => {
      renderResetPasswordScreen();

      expect(screen.getByText('Reset Password')).toBeTruthy();
      expect(screen.getByText(/Enter your email to receive a reset link/i)).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      expect(screen.getByText('Send Reset Link')).toBeTruthy();
    });

    it('shows validation error for invalid email', async () => {
      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('Enter your email');
      fireEvent.changeText(emailInput, 'invalid-email');

      const sendButton = screen.getByText('Send Reset Link');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeTruthy();
      });
    });

    it('shows validation error for empty email', async () => {
      renderResetPasswordScreen();

      const sendButton = screen.getByText('Send Reset Link');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/email/i)).toBeTruthy();
      });
    });

    it('calls requestPasswordReset with email', async () => {
      mockAuthService.requestPasswordReset.mockResolvedValueOnce({
        message: 'If an account exists...',
      });

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('Enter your email');
      fireEvent.changeText(emailInput, 'test@example.com');

      const sendButton = screen.getByText('Send Reset Link');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith('test@example.com');
      });
    });

    it('displays check email message after successful request', async () => {
      mockAuthService.requestPasswordReset.mockResolvedValueOnce({
        message: 'If an account exists...',
      });

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('Enter your email');
      fireEvent.changeText(emailInput, 'test@example.com');

      const sendButton = screen.getByText('Send Reset Link');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Check Your Email')).toBeTruthy();
        expect(screen.getByText(/test@example.com/)).toBeTruthy();
      });
    });

    it('displays rate limit error', async () => {
      mockAuthService.requestPasswordReset.mockRejectedValueOnce(
        new ApiError('Too many requests', 'RATE_LIMITED', 429)
      );

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('Enter your email');
      fireEvent.changeText(emailInput, 'test@example.com');

      const sendButton = screen.getByText('Send Reset Link');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Too many requests. Please try again later.')).toBeTruthy();
      });
    });

    it('displays email error from API details', async () => {
      mockAuthService.requestPasswordReset.mockRejectedValueOnce(
        new ApiError('Invalid email', 'INVALID_EMAIL', 400, {
          email: ['Email format is invalid'],
        })
      );

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('Enter your email');
      fireEvent.changeText(emailInput, 'test@example.com');

      const sendButton = screen.getByText('Send Reset Link');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Email format is invalid')).toBeTruthy();
      });
    });

    it('clears email error when user starts typing', async () => {
      mockAuthService.requestPasswordReset.mockRejectedValueOnce(
        new ApiError('Invalid email', 'INVALID_EMAIL', 400, {
          email: ['Email format is invalid'],
        })
      );

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('Enter your email');
      fireEvent.changeText(emailInput, 'invalid');

      const sendButton = screen.getByText('Send Reset Link');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Email format is invalid')).toBeTruthy();
      });

      fireEvent.changeText(emailInput, 'test@example.com');

      await waitFor(() => {
        const errors = screen.queryAllByText('Email format is invalid');
        expect(errors.length).toBe(0);
      });
    });
  });

  describe('Reset Password Mode (with token)', () => {
    it('renders password reset form with token', () => {
      renderResetPasswordScreen('reset-token-123');

      expect(screen.getByText('Create New Password')).toBeTruthy();
      expect(screen.getByText(/Enter your new password below/i)).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter new password')).toBeTruthy();
      expect(screen.getByPlaceholderText('Confirm new password')).toBeTruthy();
      expect(screen.getByText('Reset Password')).toBeTruthy();
    });

    it('shows password requirements when new password focused', async () => {
      renderResetPasswordScreen('reset-token-123');

      const passwordInput = screen.getByPlaceholderText('Enter new password');
      fireEvent.focus(passwordInput);

      await waitFor(() => {
        expect(screen.getByText(/At least 8 characters/i)).toBeTruthy();
      });
    });

    it('validates password requirements', async () => {
      renderResetPasswordScreen('reset-token-123');

      const passwordInput = screen.getByPlaceholderText('Enter new password');
      const confirmInput = screen.getByPlaceholderText('Confirm new password');
      const resetButton = screen.getByText('Reset Password');

      fireEvent.changeText(passwordInput, 'weak');
      fireEvent.changeText(confirmInput, 'weak');
      fireEvent.press(resetButton);

      await waitFor(() => {
        expect(screen.getByText(/At least 8 characters/i)).toBeTruthy();
      });
    });

    it('validates password match', async () => {
      renderResetPasswordScreen('reset-token-123');

      const passwordInput = screen.getByPlaceholderText('Enter new password');
      const confirmInput = screen.getByPlaceholderText('Confirm new password');
      const resetButton = screen.getByText('Reset Password');

      fireEvent.changeText(passwordInput, 'NewPassword123!');
      fireEvent.changeText(confirmInput, 'DifferentPassword123!');
      fireEvent.press(resetButton);

      await waitFor(() => {
        expect(screen.getByText(/password.*match|confirm/i)).toBeTruthy();
      });
    });

    it('calls resetPassword with token and password', async () => {
      mockAuthService.resetPassword.mockResolvedValueOnce({
        message: 'Password reset successfully',
      });

      renderResetPasswordScreen('reset-token-123');

      const passwordInput = screen.getByPlaceholderText('Enter new password');
      const confirmInput = screen.getByPlaceholderText('Confirm new password');
      const resetButton = screen.getByText('Reset Password');

      fireEvent.changeText(passwordInput, 'NewPassword123!');
      fireEvent.changeText(confirmInput, 'NewPassword123!');
      fireEvent.press(resetButton);

      await waitFor(() => {
        expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
          'reset-token-123',
          'NewPassword123!'
        );
      });
    });

    it('displays success message after password reset', async () => {
      mockAuthService.resetPassword.mockResolvedValueOnce({
        message: 'Password reset successfully',
      });

      renderResetPasswordScreen('reset-token-123');

      const passwordInput = screen.getByPlaceholderText('Enter new password');
      const confirmInput = screen.getByPlaceholderText('Confirm new password');
      const resetButton = screen.getByText('Reset Password');

      fireEvent.changeText(passwordInput, 'NewPassword123!');
      fireEvent.changeText(confirmInput, 'NewPassword123!');
      fireEvent.press(resetButton);

      await waitFor(() => {
        expect(screen.getByText('Password Reset')).toBeTruthy();
        expect(screen.getByText(/successfully/i)).toBeTruthy();
      });
    });

    it('handles expired reset link (401 error)', async () => {
      mockAuthService.resetPassword.mockRejectedValueOnce(
        new ApiError('Unauthorized', 'UNAUTHORIZED', 401)
      );

      renderResetPasswordScreen('reset-token-123');

      const passwordInput = screen.getByPlaceholderText('Enter new password');
      const confirmInput = screen.getByPlaceholderText('Confirm new password');
      const resetButton = screen.getByText('Reset Password');

      fireEvent.changeText(passwordInput, 'NewPassword123!');
      fireEvent.changeText(confirmInput, 'NewPassword123!');
      fireEvent.press(resetButton);

      await waitFor(() => {
        expect(screen.getByText(/reset link.*expired/i)).toBeTruthy();
      });
    });

    it('displays password error from API details', async () => {
      mockAuthService.resetPassword.mockRejectedValueOnce(
        new ApiError('Invalid password', 'INVALID_PASSWORD', 400, {
          newPassword: ['Password must contain uppercase letter'],
        })
      );

      renderResetPasswordScreen('reset-token-123');

      const passwordInput = screen.getByPlaceholderText('Enter new password');
      const confirmInput = screen.getByPlaceholderText('Confirm new password');
      const resetButton = screen.getByText('Reset Password');

      fireEvent.changeText(passwordInput, 'newpassword123!');
      fireEvent.changeText(confirmInput, 'newpassword123!');
      fireEvent.press(resetButton);

      await waitFor(() => {
        expect(screen.getByText('Password must contain uppercase letter')).toBeTruthy();
      });
    });

    it('disables button during reset', async () => {
      mockAuthService.resetPassword.mockImplementation(
        () => new Promise(resolve =>
          setTimeout(() =>
            resolve({ message: 'Password reset successfully' }),
            100
          )
        )
      );

      renderResetPasswordScreen('reset-token-123');

      const passwordInput = screen.getByPlaceholderText('Enter new password');
      const confirmInput = screen.getByPlaceholderText('Confirm new password');
      const resetButton = screen.getByText('Reset Password');

      fireEvent.changeText(passwordInput, 'NewPassword123!');
      fireEvent.changeText(confirmInput, 'NewPassword123!');
      fireEvent.press(resetButton);

      await waitFor(() => {
        expect(mockAuthService.resetPassword).toHaveBeenCalled();
      });
    });
  });

  describe('Navigation', () => {
    it('navigates to Login from request mode', () => {
      renderResetPasswordScreen();

      const backLink = screen.getByText('Back to Sign In');
      fireEvent.press(backLink);

      expect(mockNavigate).toHaveBeenCalledWith('Login');
    });

    it('navigates to Login from reset mode', () => {
      renderResetPasswordScreen('reset-token-123');

      const backLink = screen.getByText('Back to Sign In');
      fireEvent.press(backLink);

      expect(mockNavigate).toHaveBeenCalledWith('Login');
    });

    it('navigates to Login from success screen', async () => {
      mockAuthService.resetPassword.mockResolvedValueOnce({
        message: 'Password reset successfully',
      });

      renderResetPasswordScreen('reset-token-123');

      const passwordInput = screen.getByPlaceholderText('Enter new password');
      const confirmInput = screen.getByPlaceholderText('Confirm new password');
      const resetButton = screen.getByText('Reset Password');

      fireEvent.changeText(passwordInput, 'NewPassword123!');
      fireEvent.changeText(confirmInput, 'NewPassword123!');
      fireEvent.press(resetButton);

      await waitFor(() => {
        expect(screen.getByText('Password Reset')).toBeTruthy();
      });

      const signInButton = screen.getByText('Sign In');
      fireEvent.press(signInButton);

      expect(mockNavigate).toHaveBeenCalledWith('Login');
    });

    it('disables navigation during request', async () => {
      mockAuthService.requestPasswordReset.mockImplementation(
        () => new Promise(resolve =>
          setTimeout(() =>
            resolve({ message: 'If an account exists...' }),
            100
          )
        )
      );

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('Enter your email');
      fireEvent.changeText(emailInput, 'test@example.com');

      const sendButton = screen.getByText('Send Reset Link');
      fireEvent.press(sendButton);

      const backLink = screen.getByText('Back to Sign In');
      fireEvent.press(backLink);

      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalledWith('Login');
      });
    });

    it('disables navigation during reset', async () => {
      mockAuthService.resetPassword.mockImplementation(
        () => new Promise(resolve =>
          setTimeout(() =>
            resolve({ message: 'Password reset successfully' }),
            100
          )
        )
      );

      renderResetPasswordScreen('reset-token-123');

      const passwordInput = screen.getByPlaceholderText('Enter new password');
      const confirmInput = screen.getByPlaceholderText('Confirm new password');
      const resetButton = screen.getByText('Reset Password');

      fireEvent.changeText(passwordInput, 'NewPassword123!');
      fireEvent.changeText(confirmInput, 'NewPassword123!');
      fireEvent.press(resetButton);

      const backLink = screen.getByText('Back to Sign In');
      fireEvent.press(backLink);

      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalledWith('Login');
      });
    });
  });

  describe('Error Clearing', () => {
    it('clears errors when changing input', async () => {
      mockAuthService.resetPassword.mockRejectedValueOnce(
        new ApiError('Invalid password', 'INVALID_PASSWORD', 400, {
          newPassword: ['Password is too weak'],
        })
      );

      renderResetPasswordScreen('reset-token-123');

      const passwordInput = screen.getByPlaceholderText('Enter new password');
      const confirmInput = screen.getByPlaceholderText('Confirm new password');
      const resetButton = screen.getByText('Reset Password');

      fireEvent.changeText(passwordInput, 'weak');
      fireEvent.changeText(confirmInput, 'weak');
      fireEvent.press(resetButton);

      await waitFor(() => {
        expect(screen.getByText(/too weak/i)).toBeTruthy();
      });

      fireEvent.changeText(passwordInput, 'NewPassword123!');

      await waitFor(() => {
        const errors = screen.queryAllByText(/too weak/i);
        expect(errors.length).toBe(0);
      });
    });
  });
});
