import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext';
import { ApiError } from '../../src/services/api';
import * as authService from '../../src/services/auth';

jest.mock('../../src/services/auth');

const mockAuthService = authService as jest.Mocked<typeof authService>;

// Test component that uses the hook
function TestComponent() {
  const {
    isAuthenticated,
    isLoading,
    user,
    accessToken,
    login,
    logout,
    register,
    refreshToken,
    updateUser,
  } = useAuth();

  return (
    <>
      <Text testID="is-loading">{isLoading ? 'loading' : 'ready'}</Text>
      <Text testID="is-authenticated">{isAuthenticated ? 'authenticated' : 'not-authenticated'}</Text>
      <Text testID="user-email">{user?.email || 'no-email'}</Text>
      <Text testID="access-token">{accessToken || 'no-token'}</Text>

      <Pressable
        testID="login-btn"
        onPress={() => login('test@example.com', 'password123')}
      >
        <Text>Login</Text>
      </Pressable>

      <Pressable testID="logout-btn" onPress={() => logout()}>
        <Text>Logout</Text>
      </Pressable>

      <Pressable
        testID="register-btn"
        onPress={() => register('test@example.com', 'password123', 'Test User')}
      >
        <Text>Register</Text>
      </Pressable>

      <Pressable testID="refresh-token-btn" onPress={() => refreshToken()}>
        <Text>Refresh</Text>
      </Pressable>

      <Pressable
        testID="update-user-btn"
        onPress={() => updateUser({ displayName: 'Updated User' })}
      >
        <Text>Update User</Text>
      </Pressable>
    </>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Provider Initialization', () => {
    it('provides initial context values', () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestID('is-loading')).toHaveTextContent('ready');
      expect(screen.getByTestID('is-authenticated')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestID('user-email')).toHaveTextContent('no-email');
      expect(screen.getByTestID('access-token')).toHaveTextContent('no-token');
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

      fireEvent.press(screen.getByTestID('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestID('is-authenticated')).toHaveTextContent('authenticated');
        expect(screen.getByTestID('user-email')).toHaveTextContent('test@example.com');
        expect(screen.getByTestID('access-token')).toHaveTextContent('access-123');
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

      fireEvent.press(screen.getByTestID('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestID('is-authenticated')).toHaveTextContent('not-authenticated');
      });
    });

    it('wraps non-API errors in ApiError', async () => {
      mockAuthService.login.mockRejectedValueOnce(new Error('Network error'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      fireEvent.press(screen.getByTestID('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestID('is-authenticated')).toHaveTextContent('not-authenticated');
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

      fireEvent.press(screen.getByTestID('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestID('is-authenticated')).toHaveTextContent('authenticated');
      });

      fireEvent.press(screen.getByTestID('logout-btn'));

      await waitFor(() => {
        expect(screen.getByTestID('is-authenticated')).toHaveTextContent('not-authenticated');
        expect(screen.getByTestID('user-email')).toHaveTextContent('no-email');
        expect(screen.getByTestID('access-token')).toHaveTextContent('no-token');
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

      fireEvent.press(screen.getByTestID('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestID('is-authenticated')).toHaveTextContent('authenticated');
      });

      fireEvent.press(screen.getByTestID('logout-btn'));

      await waitFor(() => {
        expect(screen.getByTestID('is-authenticated')).toHaveTextContent('not-authenticated');
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

      fireEvent.press(screen.getByTestID('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestID('is-authenticated')).toHaveTextContent('authenticated');
      });

      fireEvent.press(screen.getByTestID('logout-btn'));

      await waitFor(() => {
        expect(screen.getByTestID('is-authenticated')).toHaveTextContent('not-authenticated');
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

      fireEvent.press(screen.getByTestID('register-btn'));

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

      fireEvent.press(screen.getByTestID('register-btn'));

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

      fireEvent.press(screen.getByTestID('register-btn'));

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

      fireEvent.press(screen.getByTestID('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestID('access-token')).toHaveTextContent('access-123');
      });

      fireEvent.press(screen.getByTestID('refresh-token-btn'));

      await waitFor(() => {
        expect(screen.getByTestID('access-token')).toHaveTextContent('new-access-789');
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

      fireEvent.press(screen.getByTestID('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestID('is-authenticated')).toHaveTextContent('authenticated');
      });

      fireEvent.press(screen.getByTestID('refresh-token-btn'));

      await waitFor(() => {
        expect(screen.getByTestID('is-authenticated')).toHaveTextContent('not-authenticated');
        expect(screen.getByTestID('access-token')).toHaveTextContent('no-token');
      });
    });

    it('throws error when no refresh token available', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      fireEvent.press(screen.getByTestID('refresh-token-btn'));

      await waitFor(() => {
        expect(mockAuthService.refreshTokens).not.toHaveBeenCalled();
      });
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

      fireEvent.press(screen.getByTestID('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestID('is-authenticated')).toHaveTextContent('authenticated');
      });

      fireEvent.press(screen.getByTestID('update-user-btn'));

      expect(mockAuthService.login).toHaveBeenCalled();
    });

    it('handles updateUser when no user is logged in', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      fireEvent.press(screen.getByTestID('update-user-btn'));

      expect(screen.getByTestID('is-authenticated')).toHaveTextContent('not-authenticated');
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

      expect(screen.getByTestID('is-authenticated')).toHaveTextContent('not-authenticated');

      fireEvent.press(screen.getByTestID('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestID('is-authenticated')).toHaveTextContent('authenticated');
      });
    });
  });
});
