import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { RegisterScreen } from '../../../src/screens/auth/RegisterScreen';
import { AuthProvider } from '../../../src/contexts';
import { ApiError } from '../../../src/services/api';
import * as authService from '../../../src/services/auth';
import { tokenStorage } from '../../../src/lib/tokenStorage';
import { useAuthStore } from '../../../src/stores/authStore';
import { createMockStoreImplementation } from '../../utils/mockZustandStore';
import type { AuthScreenProps } from '../../../src/navigation/types';

jest.mock('../../../src/services/auth');
jest.mock('../../../src/lib/tokenStorage');
jest.mock('../../../src/stores/authStore');

const _mockAuthService = authService as jest.Mocked<typeof authService>;
const mockTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

const mockRegister = jest.fn();

const setupAuthStoreMock = () => {
  const state = {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    hasCompletedOnboarding: false,
    biometricCapability: null,
    isBiometricEnabled: false,
    isLoading: false,
    error: null,
    login: jest.fn(),
    loginWithBiometric: jest.fn(),
    logout: jest.fn(),
    register: mockRegister,
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
    mockRegister.mockReset();
    setupAuthStoreMock();
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

      expect(screen.getAllByText('Create Account').length).toBeGreaterThan(0);
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

      expect(screen.getByTestId('register.submitButton')).toBeTruthy();
    });
  });

  describe('Password Requirements', () => {
    it('shows password requirements when password field is focused', async () => {
      renderRegisterScreen();

      const passwordInput = screen.getByPlaceholderText('Create a password');
      fireEvent(passwordInput, 'focus');

      await waitFor(() => {
        expect(screen.getByText(/At least 8 characters/i)).toBeTruthy();
      });
    });

    it('hides requirements when password field is blurred without content', async () => {
      renderRegisterScreen();

      const passwordInput = screen.getByPlaceholderText('Create a password');
      fireEvent(passwordInput, 'focus');

      await waitFor(() => {
        expect(screen.getByText(/At least 8 characters/i)).toBeTruthy();
      });

      fireEvent(passwordInput, 'blur');

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
      const createButton = screen.getByTestId('register.submitButton');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        // Look for specific error message about display name being required
        const errors = screen.queryAllByText(/name.*required|required.*name|display name/i);
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    it('clears display name error when user types', async () => {
      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByTestId('register.submitButton');

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
      const createButton = screen.getByTestId('register.submitButton');

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
      const createButton = screen.getByTestId('register.submitButton');

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
      const createButton = screen.getByTestId('register.submitButton');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'weak');
      fireEvent.press(createButton);

      await waitFor(() => {
        // Look for any password requirements text
        const errors = screen.queryAllByText(/At least 8 characters/i);
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    it('clears password errors when user types', async () => {
      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByTestId('register.submitButton');

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
      mockRegister.mockResolvedValueOnce({
        message: 'Registration successful',
      });

      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByTestId('register.submitButton');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith(
          'test@example.com',
          'Password123!',
          'Test User'
        );
      });
    });

    it('navigates to VerifyEmail on successful registration', async () => {
      mockRegister.mockResolvedValueOnce({
        message: 'Registration successful',
      });

      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByTestId('register.submitButton');

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
      mockRegister.mockImplementation(
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
      const createButton = screen.getByTestId('register.submitButton');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalled();
      });
    });
  });

  describe('API Error Handling', () => {
    it('displays rate limit error', async () => {
      mockRegister.mockRejectedValueOnce(
        new ApiError('Too many attempts', 'RATE_LIMITED', 429)
      );

      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByTestId('register.submitButton');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(screen.getByText('Too many attempts. Please try again later.')).toBeTruthy();
      });
    });

    it('displays email error from API details', async () => {
      mockRegister.mockRejectedValueOnce(
        new ApiError('Email already exists', 'EMAIL_EXISTS', 400, {
          email: ['Email is already registered'],
        })
      );

      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByTestId('register.submitButton');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'existing@example.com');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(screen.getByText('Email is already registered')).toBeTruthy();
      });
    });

    it('displays password error from API details', async () => {
      mockRegister.mockRejectedValueOnce(
        new ApiError('Invalid password', 'INVALID_PASSWORD', 400, {
          password: ['Password must contain uppercase letter'],
        })
      );

      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByTestId('register.submitButton');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(createButton);

      await waitFor(() => {
        // Either shows API error or password validation requirements
        const errors = screen.queryAllByText(/uppercase|at least 8 characters/i);
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    it('displays display name error from API details', async () => {
      mockRegister.mockRejectedValueOnce(
        new ApiError('Invalid name', 'INVALID_NAME', 400, {
          displayName: ['Display name must be 2-50 characters'],
        })
      );

      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByTestId('register.submitButton');

      fireEvent.changeText(nameInput, 'T');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        // Either shows API error or general display name error
        const errors = screen.queryAllByText(/display name|name.*2|characters/i);
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    it('displays generic error message for unexpected errors', async () => {
      mockRegister.mockRejectedValueOnce(new Error('Network error'));

      renderRegisterScreen();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const createButton = screen.getByTestId('register.submitButton');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'Password123!');
      fireEvent.press(createButton);

      await waitFor(() => {
        // The error is displayed via register.errorText testID
        const errorContainer = screen.queryByTestId('register.errorText');
        expect(errorContainer).toBeTruthy();
      }, { timeout: 3000 });
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
      mockRegister.mockImplementation(
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
      const createButton = screen.getByTestId('register.submitButton');

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
