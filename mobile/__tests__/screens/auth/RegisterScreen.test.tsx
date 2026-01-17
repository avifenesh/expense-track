import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { RegisterScreen } from '../../../src/screens/auth/RegisterScreen';
import { AuthProvider } from '../../../src/contexts';
import { ApiError } from '../../../src/services/api';
import * as authService from '../../../src/services/auth';
import { tokenStorage } from '../../../src/lib/tokenStorage';
import type { AuthScreenProps } from '../../../src/navigation/types';

jest.mock('../../../src/services/auth');
jest.mock('../../../src/lib/tokenStorage');

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
} as unknown as AuthScreenProps<'Register'>['navigation'];

const mockRoute = {
  key: 'Register',
  name: 'Register' as const,
  params: undefined,
} as AuthScreenProps<'Register'>['route'];

const renderRegisterScreen = () => {
  return render(
    <AuthProvider>
      <NavigationContainer>
        <RegisterScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      </NavigationContainer>
    </AuthProvider>
  );
};

describe('RegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    it('renders all form fields', () => {
      renderRegisterScreen();

      expect(screen.getByText('Create Account')).toBeTruthy();
      expect(screen.getByText('Start tracking your expenses')).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter your name')).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      expect(screen.getByPlaceholderText('Create a password')).toBeTruthy();
    });

    it('renders navigation link to login', () => {
      renderRegisterScreen();

      expect(screen.getByText(/Already have an account/)).toBeTruthy();
    });

    it('renders Create Account button', () => {
      renderRegisterScreen();

      expect(screen.getByText('Create Account')).toBeTruthy();
    });
  });

  describe('Password Requirements', () => {
    it('shows password requirements when password field is focused', async () => {
      renderRegisterScreen();

      const passwordInput = screen.getByPlaceholderText('Create a password');
      fireEvent.focus(passwordInput);

      await waitFor(() => {
        expect(screen.getByText(/At least 8 characters/i)).toBeTruthy();
      });
    });

    it('hides requirements when password field is blurred without content', async () => {
      renderRegisterScreen();

      const passwordInput = screen.getByPlaceholderText('Create a password');
      fireEvent.focus(passwordInput);

      await waitFor(() => {
        expect(screen.getByText(/At least 8 characters/i)).toBeTruthy();
      });

      fireEvent.blur(passwordInput);

      await waitFor(() => {
        const requirements = screen.queryAllByText(/At least 8 characters/i);
        expect(requirements.length).toBe(0);
      });
    });

    it('shows requirements even when blurred if password has content', async () => {
      renderRegisterScreen();

      const passwordInput = screen.getByPlaceholderText('Create a password');
      fireEvent.changeText(passwordInput, 'Pass');

      await waitFor(() => {
        expect(screen.getByText(/At least 8 characters/i)).toBeTruthy();
      });
    });
  });

  describe('Display Name Validation', () => {
    it('shows error for empty display name', async () => {
      renderRegisterScreen();

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByText('Create Account');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(screen.getByText(/name|required/i)).toBeTruthy();
      });
    });

    it('clears display name error when user types', async () => {
      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByText('Create Account');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        const errors = screen.queryAllByText(/name|required/i);
        expect(errors.length).toBeGreaterThan(0);
      });

      fireEvent.changeText(nameInput, 'Test User');

      await waitFor(() => {
        const updatedErrors = screen.queryAllByText(/name.*required/i);
        expect(updatedErrors.length).toBe(0);
      });
    });
  });

  describe('Email Validation', () => {
    it('shows error for invalid email', async () => {
      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByText('Create Account');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'invalid-email');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeTruthy();
      });
    });

    it('clears email error when user types', async () => {
      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByText('Create Account');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'invalid');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeTruthy();
      });

      fireEvent.changeText(emailInput, 'test@example.com');

      await waitFor(() => {
        const errors = screen.queryAllByText(/valid email/i);
        expect(errors.length).toBe(0);
      });
    });
  });

  describe('Password Validation', () => {
    it('shows errors for weak password', async () => {
      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByText('Create Account');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'weak');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(screen.getByText(/At least 8 characters/i)).toBeTruthy();
      });
    });

    it('clears password errors when user types', async () => {
      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByText('Create Account');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'weak');
      fireEvent.press(createButton);

      await waitFor(() => {
        const errors = screen.queryAllByText(/At least 8 characters/i);
        expect(errors.length).toBeGreaterThan(0);
      });

      fireEvent.changeText(passwordInput, 'StrongPassword123!');

      await waitFor(() => {
        const updatedErrors = screen.queryAllByText(/At least 8 characters/i);
        expect(updatedErrors.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Registration Success', () => {
    it('calls register with all credentials', async () => {
      mockAuthService.register.mockResolvedValueOnce({
        message: 'Registration successful',
      });

      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByText('Create Account');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(mockAuthService.register).toHaveBeenCalledWith(
          'test@example.com',
          'Password123!',
          'Test User'
        );
      });
    });

    it('navigates to VerifyEmail on successful registration', async () => {
      mockAuthService.register.mockResolvedValueOnce({
        message: 'Registration successful',
      });

      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByText('Create Account');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('VerifyEmail', {
          email: 'test@example.com',
        });
      });
    });

    it('disables button during registration', async () => {
      mockAuthService.register.mockImplementation(
        () => new Promise(resolve =>
          setTimeout(() =>
            resolve({ message: 'Registration successful' }),
            100
          )
        )
      );

      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByText('Create Account');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(mockAuthService.register).toHaveBeenCalled();
      });
    });
  });

  describe('API Error Handling', () => {
    it('displays rate limit error', async () => {
      mockAuthService.register.mockRejectedValueOnce(
        new ApiError('Too many attempts', 'RATE_LIMITED', 429)
      );

      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByText('Create Account');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(screen.getByText('Too many attempts. Please try again later.')).toBeTruthy();
      });
    });

    it('displays email error from API details', async () => {
      mockAuthService.register.mockRejectedValueOnce(
        new ApiError('Email already exists', 'EMAIL_EXISTS', 400, {
          email: ['Email is already registered'],
        })
      );

      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByText('Create Account');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'existing@example.com');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(screen.getByText('Email is already registered')).toBeTruthy();
      });
    });

    it('displays password error from API details', async () => {
      mockAuthService.register.mockRejectedValueOnce(
        new ApiError('Invalid password', 'INVALID_PASSWORD', 400, {
          password: ['Password must contain uppercase letter'],
        })
      );

      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByText('Create Account');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(screen.getByText('Password must contain uppercase letter')).toBeTruthy();
      });
    });

    it('displays display name error from API details', async () => {
      mockAuthService.register.mockRejectedValueOnce(
        new ApiError('Invalid name', 'INVALID_NAME', 400, {
          displayName: ['Display name must be 2-50 characters'],
        })
      );

      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByText('Create Account');

      fireEvent.changeText(nameInput, 'T');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(screen.getByText('Display name must be 2-50 characters')).toBeTruthy();
      });
    });

    it('displays generic error message for unexpected errors', async () => {
      mockAuthService.register.mockRejectedValueOnce(new Error('Network error'));

      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByText('Create Account');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeTruthy();
      });
    });
  });

  describe('Navigation', () => {
    it('navigates to Login on sign in link press', () => {
      renderRegisterScreen();

      const signInLink = screen.getByText(/Already have an account/);
      fireEvent.press(signInLink);

      expect(mockNavigate).toHaveBeenCalledWith('Login');
    });

    it('disables navigation link during registration', async () => {
      mockAuthService.register.mockImplementation(
        () => new Promise(resolve =>
          setTimeout(() =>
            resolve({ message: 'Registration successful' }),
            100
          )
        )
      );

      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByText('Create Account');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      const signInLink = screen.getByText(/Already have an account/);
      fireEvent.press(signInLink);

      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalledWith('Login');
      });
    });
  });
});
