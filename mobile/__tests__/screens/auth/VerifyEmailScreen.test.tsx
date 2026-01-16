import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { VerifyEmailScreen } from '../../../src/screens/auth/VerifyEmailScreen';
import { ApiError } from '../../../src/services/api';
import * as authService from '../../../src/services/auth';
import type { AuthScreenProps } from '../../../src/navigation/types';

jest.mock('../../../src/services/auth');

const mockAuthService = authService as jest.Mocked<typeof authService>;

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
} as unknown as AuthScreenProps<'VerifyEmail'>['navigation'];

const mockRoute = {
  key: 'VerifyEmail',
  name: 'VerifyEmail' as const,
  params: { email: 'test@example.com' },
} as AuthScreenProps<'VerifyEmail'>['route'];

const renderVerifyEmailScreen = () => {
  return render(
    <NavigationContainer>
      <VerifyEmailScreen
        navigation={mockNavigation}
        route={mockRoute}
      />
    </NavigationContainer>
  );
};

describe('VerifyEmailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('displays email verification message', () => {
      renderVerifyEmailScreen();

      expect(screen.getByText('Check Your Email')).toBeTruthy();
      expect(screen.getByText(/We sent a verification link/i)).toBeTruthy();
      expect(screen.getByText('test@example.com')).toBeTruthy();
    });

    it('displays verification instructions', () => {
      renderVerifyEmailScreen();

      expect(screen.getByText(/Click the link in the email/i)).toBeTruthy();
      expect(screen.getByText(/spam folder/i)).toBeTruthy();
    });

    it('renders Resend Email button', () => {
      renderVerifyEmailScreen();

      expect(screen.getByText('Resend Email')).toBeTruthy();
    });

    it('renders back to sign in link', () => {
      renderVerifyEmailScreen();

      expect(screen.getByText('Back to Sign In')).toBeTruthy();
    });
  });

  describe('Resend Verification', () => {
    it('calls resendVerification with email', async () => {
      mockAuthService.resendVerification.mockResolvedValueOnce({
        message: 'Verification email sent',
      });

      renderVerifyEmailScreen();

      const resendButton = screen.getByText('Resend Email');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(mockAuthService.resendVerification).toHaveBeenCalledWith('test@example.com');
      });
    });

    it('displays success message after resend', async () => {
      mockAuthService.resendVerification.mockResolvedValueOnce({
        message: 'Verification email sent',
      });

      renderVerifyEmailScreen();

      const resendButton = screen.getByText('Resend Email');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(screen.getByText('Verification email sent. Please check your inbox.')).toBeTruthy();
      });
    });

    it('displays cooldown timer after successful resend', async () => {
      mockAuthService.resendVerification.mockResolvedValueOnce({
        message: 'Verification email sent',
      });

      renderVerifyEmailScreen();

      const resendButton = screen.getByText('Resend Email');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(screen.getByText(/Resend in \d+s/)).toBeTruthy();
      });
    });

    it('decrements cooldown timer', async () => {
      jest.useFakeTimers();
      mockAuthService.resendVerification.mockResolvedValueOnce({
        message: 'Verification email sent',
      });

      renderVerifyEmailScreen();

      const resendButton = screen.getByText('Resend Email');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(screen.getByText(/Resend in 60s/)).toBeTruthy();
      });

      jest.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(screen.getByText(/Resend in 58s/)).toBeTruthy();
      });

      jest.useRealTimers();
    });

    it('enables button after cooldown expires', async () => {
      jest.useFakeTimers();
      mockAuthService.resendVerification.mockResolvedValueOnce({
        message: 'Verification email sent',
      });

      renderVerifyEmailScreen();

      const resendButton = screen.getByText('Resend Email');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(screen.getByText(/Resend in \d+s/)).toBeTruthy();
      });

      jest.advanceTimersByTime(61000);

      await waitFor(() => {
        expect(screen.getByText('Resend Email')).toBeTruthy();
      });

      jest.useRealTimers();
    });

    it('disables button during resend', async () => {
      mockAuthService.resendVerification.mockImplementation(
        () => new Promise(resolve =>
          setTimeout(() =>
            resolve({ message: 'Verification email sent' }),
            100
          )
        )
      );

      renderVerifyEmailScreen();

      const resendButton = screen.getByText('Resend Email');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(mockAuthService.resendVerification).toHaveBeenCalled();
      });
    });

    it('prevents multiple resend attempts during cooldown', async () => {
      jest.useFakeTimers();
      mockAuthService.resendVerification.mockResolvedValueOnce({
        message: 'Verification email sent',
      });

      renderVerifyEmailScreen();

      const resendButton = screen.getByText('Resend Email');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(screen.getByText(/Resend in \d+s/)).toBeTruthy();
      });

      fireEvent.press(resendButton);

      expect(mockAuthService.resendVerification).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('displays rate limit error', async () => {
      mockAuthService.resendVerification.mockRejectedValueOnce(
        new ApiError('Too many requests', 'RATE_LIMITED', 429)
      );

      renderVerifyEmailScreen();

      const resendButton = screen.getByText('Resend Email');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(screen.getByText('Too many requests. Please wait before trying again.')).toBeTruthy();
      });
    });

    it('sets extended cooldown on rate limit error', async () => {
      jest.useFakeTimers();
      mockAuthService.resendVerification.mockRejectedValueOnce(
        new ApiError('Too many requests', 'RATE_LIMITED', 429)
      );

      renderVerifyEmailScreen();

      const resendButton = screen.getByText('Resend Email');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(screen.getByText(/Resend in 120s/)).toBeTruthy();
      });

      jest.useRealTimers();
    });

    it('displays generic API error', async () => {
      mockAuthService.resendVerification.mockRejectedValueOnce(
        new ApiError('Network error', 'NETWORK_ERROR', 0)
      );

      renderVerifyEmailScreen();

      const resendButton = screen.getByText('Resend Email');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeTruthy();
      });
    });

    it('displays generic message for non-ApiError exceptions', async () => {
      mockAuthService.resendVerification.mockRejectedValueOnce(
        new Error('Unexpected error')
      );

      renderVerifyEmailScreen();

      const resendButton = screen.getByText('Resend Email');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to resend email. Please try again.')).toBeTruthy();
      });
    });

    it('clears previous error message on new attempt', async () => {
      mockAuthService.resendVerification
        .mockRejectedValueOnce(new ApiError('Network error', 'NETWORK_ERROR', 0))
        .mockResolvedValueOnce({ message: 'Verification email sent' });

      renderVerifyEmailScreen();

      const resendButton = screen.getByText('Resend Email');

      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeTruthy();
      });

      jest.advanceTimersByTime(61000);

      fireEvent.press(resendButton);

      await waitFor(() => {
        const errors = screen.queryAllByText('Network error');
        expect(errors.length).toBe(0);
      });
    });
  });

  describe('Navigation', () => {
    it('navigates to Login on back link press', () => {
      renderVerifyEmailScreen();

      const backLink = screen.getByText('Back to Sign In');
      fireEvent.press(backLink);

      expect(mockNavigate).toHaveBeenCalledWith('Login');
    });
  });

  describe('Email Parameter Handling', () => {
    it('displays email from route params', () => {
      const customRoute = {
        key: 'VerifyEmail',
        name: 'VerifyEmail' as const,
        params: { email: 'user@example.com' },
      } as AuthScreenProps<'VerifyEmail'>['route'];

      render(
        <NavigationContainer>
          <VerifyEmailScreen
            navigation={mockNavigation}
            route={customRoute}
          />
        </NavigationContainer>
      );

      expect(screen.getByText('user@example.com')).toBeTruthy();
    });

    it('uses email for resend verification', async () => {
      mockAuthService.resendVerification.mockResolvedValueOnce({
        message: 'Verification email sent',
      });

      const customRoute = {
        key: 'VerifyEmail',
        name: 'VerifyEmail' as const,
        params: { email: 'custom@example.com' },
      } as AuthScreenProps<'VerifyEmail'>['route'];

      render(
        <NavigationContainer>
          <VerifyEmailScreen
            navigation={mockNavigation}
            route={customRoute}
          />
        </NavigationContainer>
      );

      const resendButton = screen.getByText('Resend Email');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(mockAuthService.resendVerification).toHaveBeenCalledWith('custom@example.com');
      });
    });
  });

  describe('State Management', () => {
    it('initializes with resend button enabled', () => {
      renderVerifyEmailScreen();

      expect(screen.getByText('Resend Email')).toBeTruthy();
    });

    it('manages resend message and error separately', async () => {
      mockAuthService.resendVerification
        .mockResolvedValueOnce({ message: 'Verification email sent' })
        .mockRejectedValueOnce(new ApiError('Rate limited', 'RATE_LIMITED', 429));

      renderVerifyEmailScreen();

      const resendButton = screen.getByText('Resend Email');

      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(screen.getByText('Verification email sent. Please check your inbox.')).toBeTruthy();
      });

      jest.advanceTimersByTime(61000);

      fireEvent.press(resendButton);

      await waitFor(() => {
        const successMessages = screen.queryAllByText('Verification email sent. Please check your inbox.');
        expect(successMessages.length).toBe(0);
        expect(screen.getByText('Too many requests. Please wait before trying again.')).toBeTruthy();
      });
    });
  });
});
