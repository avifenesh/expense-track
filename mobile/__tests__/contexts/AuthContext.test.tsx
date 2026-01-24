import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext';
import { ApiError } from '../../src/services/api';
import * as authService from '../../src/services/auth';
import * as biometricService from '../../src/services/biometric';
import { tokenStorage } from '../../src/lib/tokenStorage';

jest.mock('../../src/services/auth');
jest.mock('../../src/services/biometric');
jest.mock('../../src/lib/tokenStorage');

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockBiometricService = biometricService as jest.Mocked<typeof biometricService>;
const mockTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;

// Test component that uses the hook
function TestComponent() {
  const {
    isAuthenticated,
    isLoading,
    user,
    accessToken,
    biometricCapability,
    isBiometricEnabled,
    login,
    logout,
    register,
    refreshToken,
    updateUser,
    loginWithBiometric,
    enableBiometric,
    disableBiometric,
  } = useAuth();

  return (
    <>
      <Text testID="is-loading">{isLoading ? 'loading' : 'ready'}</Text>
      <Text testID="is-authenticated">{isAuthenticated ? 'authenticated' : 'not-authenticated'}</Text>
      <Text testID="user-email">{user?.email || 'no-email'}</Text>
      <Text testID="access-token">{accessToken || 'no-token'}</Text>
      <Text testID="biometric-type">{biometricCapability?.biometricType || 'none'}</Text>
      <Text testID="biometric-enabled">{isBiometricEnabled ? 'enabled' : 'disabled'}</Text>

      <Pressable
        testID="login-btn"
        onPress={() => login('test@example.com', 'password123').catch(() => {})}
      >
        <Text>Login</Text>
      </Pressable>

      <Pressable testID="logout-btn" onPress={() => logout()}>
        <Text>Logout</Text>
      </Pressable>

      <Pressable
        testID="register-btn"
        onPress={() => register('test@example.com', 'password123', 'Test User').catch(() => {})}
      >
        <Text>Register</Text>
      </Pressable>

      <Pressable testID="refresh-token-btn" onPress={() => refreshToken().catch(() => {})}>
        <Text>Refresh</Text>
      </Pressable>

      <Pressable
        testID="update-user-btn"
        onPress={() => updateUser({ displayName: 'Updated User' })}
      >
        <Text>Update User</Text>
      </Pressable>

      <Pressable testID="biometric-login-btn" onPress={() => loginWithBiometric().catch(() => {})}>
        <Text>Biometric Login</Text>
      </Pressable>

      <Pressable testID="enable-biometric-btn" onPress={() => enableBiometric().catch(() => {})}>
        <Text>Enable Biometric</Text>
      </Pressable>

      <Pressable testID="disable-biometric-btn" onPress={() => disableBiometric()}>
        <Text>Disable Biometric</Text>
      </Pressable>
    </>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mocks for biometric service
    mockBiometricService.checkBiometricCapability.mockResolvedValue({
      isAvailable: false,
      biometricType: 'none',
      isEnrolled: false,
    });
    mockBiometricService.isBiometricEnabled.mockResolvedValue(false);
    // Default mocks for token storage
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

  describe('Provider Initialization', () => {
    it('provides initial context values', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-email');
      expect(screen.getByTestId('access-token')).toHaveTextContent('no-token');
    });

    it('throws error when useAuth is used outside provider', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        function InvalidComponent() {
          useAuth();
          return null;
        }
        render(<InvalidComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      spy.mockRestore();
    });

    it('checks biometric capability on init', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: true,
        biometricType: 'faceId',
        isEnrolled: true,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });
      expect(screen.getByTestId('biometric-type')).toHaveTextContent('faceId');
    });

    it('does not auto-prompt on init (requires user action)', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: true,
        biometricType: 'faceId',
        isEnrolled: true,
      });
      mockBiometricService.isBiometricEnabled.mockResolvedValue(true);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });
      // Should not auto-prompt - user must initiate biometric login
      expect(mockBiometricService.promptBiometric).not.toHaveBeenCalled();
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('biometric-enabled')).toHaveTextContent('enabled');
    });
  });

  describe('Login', () => {
    it('successfully logs in with valid credentials', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
        expect(screen.getByTestId('access-token')).toHaveTextContent('access-123');
      });

      expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    it('handles API errors on login', async () => {
      const apiError = new ApiError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
      mockAuthService.login.mockRejectedValueOnce(apiError);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('not-authenticated');
      });
    });

    it('wraps non-API errors in ApiError', async () => {
      mockAuthService.login.mockRejectedValueOnce(new Error('Network error'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('not-authenticated');
      });
    });
  });

  describe('Logout', () => {
    it('clears auth state on logout', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('authenticated');
      });

      fireEvent.press(screen.getByTestId('logout-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('not-authenticated');
        expect(screen.getByTestId('user-email')).toHaveTextContent('no-email');
        expect(screen.getByTestId('access-token')).toHaveTextContent('no-token');
      });
    });

    it('clears biometric credentials on logout', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('authenticated');
      });

      fireEvent.press(screen.getByTestId('logout-btn'));

      await waitFor(() => {
        expect(mockBiometricService.clearStoredCredentials).toHaveBeenCalled();
      });
    });

    it('ignores errors from logout API call', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });

      mockAuthService.logout.mockRejectedValueOnce(new Error('Logout failed'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('authenticated');
      });

      fireEvent.press(screen.getByTestId('logout-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('not-authenticated');
      });
    });

    it('clears state even without refresh token', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('authenticated');
      });

      fireEvent.press(screen.getByTestId('logout-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('not-authenticated');
      });

      expect(mockAuthService.logout).toHaveBeenCalledWith('refresh-456');
    });
  });

  describe('Register', () => {
    it('successfully registers new user', async () => {
      mockAuthService.register.mockResolvedValueOnce({
        message: 'Registration successful',
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('register-btn'));

      await waitFor(() => {
        expect(mockAuthService.register).toHaveBeenCalledWith(
          'test@example.com',
          'password123',
          'Test User'
        );
      });
    });

    it('handles API errors on register', async () => {
      const apiError = new ApiError(
        'Email already in use',
        'EMAIL_EXISTS',
        400,
        { email: ['Email already registered'] }
      );
      mockAuthService.register.mockRejectedValueOnce(apiError);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('register-btn'));

      await waitFor(() => {
        expect(mockAuthService.register).toHaveBeenCalled();
      });
    });

    it('wraps non-API errors in ApiError', async () => {
      mockAuthService.register.mockRejectedValueOnce(new Error('Network error'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('register-btn'));

      await waitFor(() => {
        expect(mockAuthService.register).toHaveBeenCalled();
      });
    });
  });

  describe('Refresh Token', () => {
    it('refreshes tokens successfully', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });

      mockAuthService.refreshTokens.mockResolvedValueOnce({
        accessToken: 'new-access-789',
        refreshToken: 'new-refresh-012',
        expiresIn: 900,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('access-token')).toHaveTextContent('access-123');
      });

      fireEvent.press(screen.getByTestId('refresh-token-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('access-token')).toHaveTextContent('new-access-789');
      });

      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('refresh-456');
    });

    it('clears state on refresh token error', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });

      mockAuthService.refreshTokens.mockRejectedValueOnce(
        new ApiError('Token expired', 'TOKEN_EXPIRED', 401)
      );

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('authenticated');
      });

      fireEvent.press(screen.getByTestId('refresh-token-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('not-authenticated');
        expect(screen.getByTestId('access-token')).toHaveTextContent('no-token');
      });
    });

    it('throws error when no refresh token available', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('refresh-token-btn'));

      await waitFor(() => {
        expect(mockAuthService.refreshTokens).not.toHaveBeenCalled();
      });
    });

    it('updates stored credentials when biometric is enabled (token rotation)', async () => {
      mockBiometricService.isBiometricEnabled.mockResolvedValue(true);
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });

      mockAuthService.refreshTokens.mockResolvedValueOnce({
        accessToken: 'new-access-789',
        refreshToken: 'new-refresh-rotated',
        expiresIn: 900,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('access-token')).toHaveTextContent('access-123');
      });

      // Enable biometric after login
      mockBiometricService.promptBiometric.mockResolvedValue({ success: true });
      fireEvent.press(screen.getByTestId('enable-biometric-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('biometric-enabled')).toHaveTextContent('enabled');
      });

      // Clear the mock call from enableBiometric
      mockBiometricService.enableBiometric.mockClear();

      // Now refresh token - should update stored credentials
      fireEvent.press(screen.getByTestId('refresh-token-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('access-token')).toHaveTextContent('new-access-789');
      });

      // Verify stored credentials are updated with new rotated token
      expect(mockBiometricService.enableBiometric).toHaveBeenCalledWith(
        'new-refresh-rotated',
        'test@example.com'
      );
    });
  });

  describe('Update User', () => {
    it('updates user information', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('authenticated');
      });

      fireEvent.press(screen.getByTestId('update-user-btn'));

      expect(mockAuthService.login).toHaveBeenCalled();
    });

    it('handles updateUser when no user is logged in', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('update-user-btn'));

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('not-authenticated');
    });
  });

  describe('Authentication State', () => {
    it('sets isAuthenticated to true only when both user and token exist', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('not-authenticated');

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('authenticated');
      });
    });
  });

  describe('Token Persistence', () => {
    it('saves tokens to secure storage on login', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(mockTokenStorage.setStoredCredentials).toHaveBeenCalledWith(
          'access-123',
          'refresh-456',
          'test@example.com',
          false
        );
      });
    });

    it('clears tokens from secure storage on logout', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('authenticated');
      });

      fireEvent.press(screen.getByTestId('logout-btn'));

      await waitFor(() => {
        expect(mockTokenStorage.clearTokens).toHaveBeenCalled();
      });
    });

    it('restores tokens from secure storage on app start', async () => {
      mockTokenStorage.getStoredCredentials.mockResolvedValueOnce({
        accessToken: 'stored-access-123',
        refreshToken: 'stored-refresh-456',
        email: 'stored@example.com',
        hasCompletedOnboarding: true,
      });

      mockAuthService.refreshTokens.mockResolvedValueOnce({
        accessToken: 'new-access-789',
        refreshToken: 'new-refresh-012',
        expiresIn: 900,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('access-token')).toHaveTextContent('new-access-789');
        expect(screen.getByTestId('user-email')).toHaveTextContent('stored@example.com');
      });

      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('stored-refresh-456');
      expect(mockTokenStorage.setStoredCredentials).toHaveBeenCalledWith(
        'new-access-789',
        'new-refresh-012',
        'stored@example.com',
        true
      );
    });

    it('shows login screen when token restore fails', async () => {
      mockTokenStorage.getStoredCredentials.mockResolvedValueOnce({
        accessToken: 'stored-access-123',
        refreshToken: 'stored-refresh-456',
        email: 'stored@example.com',
        hasCompletedOnboarding: false,
      });

      mockAuthService.refreshTokens.mockRejectedValueOnce(
        new ApiError('Token expired', 'TOKEN_EXPIRED', 401)
      );

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('not-authenticated');
      });

      expect(mockTokenStorage.clearTokens).toHaveBeenCalled();
    });

    it('shows login screen when no tokens exist', async () => {
      mockTokenStorage.getStoredCredentials.mockResolvedValueOnce({
        accessToken: null,
        refreshToken: null,
        email: null,
        hasCompletedOnboarding: false,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('not-authenticated');
      });

      expect(mockAuthService.refreshTokens).not.toHaveBeenCalled();
    });

    it('updates secure storage on token refresh', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });

      mockAuthService.refreshTokens.mockResolvedValueOnce({
        accessToken: 'new-access-789',
        refreshToken: 'new-refresh-012',
        expiresIn: 900,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('authenticated');
      });

      mockTokenStorage.setTokens.mockClear();

      fireEvent.press(screen.getByTestId('refresh-token-btn'));

      await waitFor(() => {
        expect(mockTokenStorage.setTokens).toHaveBeenCalledWith('new-access-789', 'new-refresh-012');
      });
    });

    it('clears secure storage on token refresh failure', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });

      mockAuthService.refreshTokens.mockRejectedValueOnce(
        new ApiError('Token expired', 'TOKEN_EXPIRED', 401)
      );

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('authenticated');
      });

      mockTokenStorage.clearTokens.mockClear();

      fireEvent.press(screen.getByTestId('refresh-token-btn'));

      await waitFor(() => {
        expect(mockTokenStorage.clearTokens).toHaveBeenCalled();
      });
    });

    it('handles secure store access errors gracefully', async () => {
      mockTokenStorage.getStoredCredentials.mockRejectedValueOnce(new Error('SecureStore unavailable'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('not-authenticated');
      });
    });

    it('handles storage failure gracefully on login', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });
      mockTokenStorage.setStoredCredentials.mockRejectedValueOnce(new Error('Storage failed'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      // Should remain not authenticated because storage failed
      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('not-authenticated');
      });
    });

    it('does not block logout when clearTokens fails', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });
      mockTokenStorage.clearTokens.mockRejectedValueOnce(new Error('Storage failed'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('authenticated');
      });

      fireEvent.press(screen.getByTestId('logout-btn'));

      // Should still log out even if clearTokens fails
      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('not-authenticated');
      });
    });
  });

  describe('Biometric Login', () => {
    it('logs in with biometric successfully', async () => {
      mockBiometricService.promptBiometric.mockResolvedValue({ success: true });
      mockBiometricService.getStoredCredentials.mockResolvedValue({
        refreshToken: 'stored-refresh',
        email: 'biometric@example.com',
      });
      mockAuthService.refreshTokens.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresIn: 900,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('biometric-login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('user-email')).toHaveTextContent('biometric@example.com');
      });
    });

    it('throws error when biometric fails', async () => {
      mockBiometricService.promptBiometric.mockResolvedValue({
        success: false,
        error: 'User cancelled',
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('biometric-login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('not-authenticated');
      });
    });

    it('throws error when no stored credentials', async () => {
      mockBiometricService.promptBiometric.mockResolvedValue({ success: true });
      mockBiometricService.getStoredCredentials.mockResolvedValue(null);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('biometric-login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('not-authenticated');
      });
    });

    it('clears credentials and throws on refresh failure', async () => {
      mockBiometricService.promptBiometric.mockResolvedValue({ success: true });
      mockBiometricService.getStoredCredentials.mockResolvedValue({
        refreshToken: 'expired-refresh',
        email: 'biometric@example.com',
      });
      mockAuthService.refreshTokens.mockRejectedValue(new Error('Token expired'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('biometric-login-btn'));

      await waitFor(() => {
        expect(mockBiometricService.clearStoredCredentials).toHaveBeenCalled();
        expect(screen.getByTestId('biometric-enabled')).toHaveTextContent('disabled');
      });
    });

    it('updates stored credentials after successful biometric login (token rotation)', async () => {
      mockBiometricService.promptBiometric.mockResolvedValue({ success: true });
      mockBiometricService.getStoredCredentials.mockResolvedValue({
        refreshToken: 'old-refresh',
        email: 'biometric@example.com',
      });
      mockAuthService.refreshTokens.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh-rotated',
        expiresIn: 900,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('biometric-login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('authenticated');
      });

      // Verify stored credentials are updated with new rotated token
      expect(mockBiometricService.enableBiometric).toHaveBeenCalledWith(
        'new-refresh-rotated',
        'biometric@example.com'
      );
    });
  });

  describe('Enable Biometric', () => {
    it('enables biometric successfully when authenticated', async () => {
      mockAuthService.login.mockResolvedValue({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });
      mockBiometricService.promptBiometric.mockResolvedValue({ success: true });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('authenticated');
      });

      fireEvent.press(screen.getByTestId('enable-biometric-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('biometric-enabled')).toHaveTextContent('enabled');
      });
      expect(mockBiometricService.enableBiometric).toHaveBeenCalledWith('refresh-456', 'test@example.com');
    });

    it('throws error when not authenticated', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('enable-biometric-btn'));

      await waitFor(() => {
        expect(mockBiometricService.enableBiometric).not.toHaveBeenCalled();
      });
    });

    it('throws error when biometric confirmation fails', async () => {
      mockAuthService.login.mockResolvedValue({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });
      mockBiometricService.promptBiometric.mockResolvedValue({
        success: false,
        error: 'User cancelled',
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('authenticated');
      });

      fireEvent.press(screen.getByTestId('enable-biometric-btn'));

      await waitFor(() => {
        expect(mockBiometricService.enableBiometric).not.toHaveBeenCalled();
        expect(screen.getByTestId('biometric-enabled')).toHaveTextContent('disabled');
      });
    });
  });

  describe('Disable Biometric', () => {
    it('disables biometric successfully', async () => {
      mockBiometricService.isBiometricEnabled.mockResolvedValue(true);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('ready');
      });

      fireEvent.press(screen.getByTestId('disable-biometric-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('biometric-enabled')).toHaveTextContent('disabled');
      });
      expect(mockBiometricService.disableBiometric).toHaveBeenCalled();
    });
  });
});
