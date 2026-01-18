import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as authService from '../services/auth';
import * as biometricService from '../services/biometric';
import { ApiError } from '../services/api';
import { tokenStorage } from '../lib/tokenStorage';
import { logger } from '../lib/logger';
import type { BiometricCapability } from '../services/biometric';

export interface User {
  id: string | null;
  email: string;
  displayName?: string;
  hasCompletedOnboarding: boolean;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  accessToken: string | null;
  biometricCapability: BiometricCapability | null;
  isBiometricEnabled: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  refreshToken: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  loginWithBiometric: () => Promise<void>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshTokenValue, setRefreshTokenValue] = useState<string | null>(null);
  const [biometricCapability, setBiometricCapability] = useState<BiometricCapability | null>(null);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check biometric capability
        const capability = await biometricService.checkBiometricCapability();
        setBiometricCapability(capability);

        // Check if biometric is enabled
        const enabled = await biometricService.isBiometricEnabled();
        setIsBiometricEnabled(enabled);

        // Try to restore session from secure storage
        const storedCredentials = await tokenStorage.getStoredCredentials();

        if (storedCredentials.refreshToken && storedCredentials.email) {
          try {
            const response = await authService.refreshTokens(storedCredentials.refreshToken);
            await tokenStorage.setStoredCredentials(
              response.accessToken,
              response.refreshToken,
              storedCredentials.email,
              storedCredentials.hasCompletedOnboarding
            );
            setAccessToken(response.accessToken);
            setRefreshTokenValue(response.refreshToken);
            setUser({
              id: null,
              email: storedCredentials.email,
              hasCompletedOnboarding: storedCredentials.hasCompletedOnboarding,
            });
          } catch (error) {
            logger.error('Failed to restore session on app start', error);
            await tokenStorage.clearTokens();
          }
        }
      } catch (error) {
        // Initialization failed - continue without auth
        logger.error('Auth initialization failed', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);

      try {
        await tokenStorage.setStoredCredentials(
          response.accessToken,
          response.refreshToken,
          email.toLowerCase(),
          false
        );
      } catch (storageError) {
        // If we cannot securely store tokens, do not proceed with login
        logger.error('Failed to store tokens securely', storageError);
        // Try to clear any partial state
        try {
          await tokenStorage.clearTokens();
        } catch {
          // Ignore cleanup errors
        }
        throw new ApiError(
          'Unable to securely store your login session. Please try again.',
          'LOGIN_PERSIST_FAILED',
          0
        );
      }

      setAccessToken(response.accessToken);
      setRefreshTokenValue(response.refreshToken);

      setUser({
        id: null,
        email: email.toLowerCase(),
        hasCompletedOnboarding: false,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Login failed. Please try again.',
        'LOGIN_FAILED',
        0
      );
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (refreshTokenValue) {
        await authService.logout(refreshTokenValue);
      }
    } catch (error) {
      // Logout errors are intentionally not propagated to avoid blocking the user
      // from logging out if the server is unreachable. The client-side state will
      // be cleared regardless, and the server will eventually expire the token.
      logger.warn('Logout request failed', error);
    }

    // Clear tokens from secure storage - don't let errors block state reset
    try {
      await tokenStorage.clearTokens();
    } catch (storageError) {
      logger.error('Failed to clear tokens from secure storage', storageError);
    }

    // Clear biometric credentials on logout
    try {
      await biometricService.clearStoredCredentials();
    } catch (biometricError) {
      logger.error('Failed to clear biometric credentials', biometricError);
    }

    // Always clear in-memory state, even if storage clear failed
    setIsBiometricEnabled(false);
    setUser(null);
    setAccessToken(null);
    setRefreshTokenValue(null);
  }, [refreshTokenValue]);

  const register = useCallback(async (
    email: string,
    password: string,
    displayName: string
  ) => {
    try {
      await authService.register(email, password, displayName);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Registration failed. Please try again.',
        'REGISTRATION_FAILED',
        0
      );
    }
  }, []);

  const refreshToken = useCallback(async () => {
    if (!refreshTokenValue) {
      throw new ApiError('No refresh token available', 'NO_REFRESH_TOKEN', 401);
    }

    try {
      const response = await authService.refreshTokens(refreshTokenValue);

      try {
        // Update tokens in storage
        await tokenStorage.setTokens(response.accessToken, response.refreshToken);
      } catch (storageError) {
        logger.error('Failed to update tokens in storage', storageError);
        // Continue with in-memory tokens even if storage fails
        // On next app restart, user will need to re-login
      }

      setAccessToken(response.accessToken);
      setRefreshTokenValue(response.refreshToken);
      // Update stored refresh token if biometric is enabled
      if (isBiometricEnabled && user?.email) {
        await biometricService.enableBiometric(response.refreshToken, user.email);
      }
    } catch (error) {
      // Clear tokens on refresh failure
      try {
        await tokenStorage.clearTokens();
      } catch {
        // Ignore storage errors during cleanup
      }
      setUser(null);
      setAccessToken(null);
      setRefreshTokenValue(null);
      throw error;
    }
  }, [refreshTokenValue, isBiometricEnabled, user?.email]);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((currentUser) => {
      if (!currentUser) return null;
      const newUser = { ...currentUser, ...updates };

      // Persist onboarding state if it changed
      if ('hasCompletedOnboarding' in updates && updates.hasCompletedOnboarding !== undefined) {
        tokenStorage.setOnboardingComplete(updates.hasCompletedOnboarding).catch((error) => {
          logger.error('Failed to persist onboarding state', error);
        });
      }

      return newUser;
    });
  }, []);

  const loginWithBiometric = useCallback(async () => {
    const result = await biometricService.promptBiometric('Authenticate to sign in');
    if (!result.success) {
      throw new ApiError(
        result.error || 'Biometric authentication failed',
        'BIOMETRIC_FAILED',
        0
      );
    }

    const credentials = await biometricService.getStoredCredentials();
    if (!credentials) {
      throw new ApiError(
        'No stored credentials. Please sign in with your password.',
        'NO_CREDENTIALS',
        0
      );
    }

    try {
      const tokens = await authService.refreshTokens(credentials.refreshToken);

      // Store tokens in secure storage
      try {
        await tokenStorage.setStoredCredentials(
          tokens.accessToken,
          tokens.refreshToken,
          credentials.email,
          true // Biometric login implies completed onboarding
        );
      } catch (storageError) {
        logger.error('Failed to store tokens after biometric login', storageError);
        // Continue - at least in-memory auth works
      }

      setAccessToken(tokens.accessToken);
      setRefreshTokenValue(tokens.refreshToken);
      // Update stored refresh token since the old one was rotated
      await biometricService.enableBiometric(tokens.refreshToken, credentials.email);
      setUser({
        id: null,
        email: credentials.email,
        hasCompletedOnboarding: true,
      });
    } catch (error) {
      // Clear invalid credentials
      logger.error('Biometric login failed during token refresh', error);
      await biometricService.clearStoredCredentials();
      setIsBiometricEnabled(false);
      throw new ApiError(
        'Session expired. Please sign in with your password.',
        'SESSION_EXPIRED',
        401
      );
    }
  }, []);

  const enableBiometric = useCallback(async () => {
    if (!refreshTokenValue || !user?.email) {
      throw new ApiError(
        'Must be signed in to enable biometric authentication',
        'NOT_AUTHENTICATED',
        0
      );
    }

    const result = await biometricService.promptBiometric('Confirm your identity');
    if (!result.success) {
      throw new ApiError(
        result.error || 'Biometric confirmation failed',
        'BIOMETRIC_FAILED',
        0
      );
    }

    await biometricService.enableBiometric(refreshTokenValue, user.email);
    setIsBiometricEnabled(true);
  }, [refreshTokenValue, user?.email]);

  const disableBiometric = useCallback(async () => {
    await biometricService.disableBiometric();
    setIsBiometricEnabled(false);
  }, []);

  const value: AuthContextValue = {
    isAuthenticated: !!user && !!accessToken,
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
