import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as authService from '../services/auth';
import { ApiError } from '../services/api';

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
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  refreshToken: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
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

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);

      setAccessToken(response.accessToken);
      setRefreshTokenValue(response.refreshToken);

      // Note: User ID is null until we fetch user profile from /me endpoint
      // For now, we set it to null and rely on the accessToken for auth
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
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('Logout request failed:', error);
      }
    } finally {
      setUser(null);
      setAccessToken(null);
      setRefreshTokenValue(null);
    }
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
      setAccessToken(response.accessToken);
      setRefreshTokenValue(response.refreshToken);
    } catch (error) {
      setUser(null);
      setAccessToken(null);
      setRefreshTokenValue(null);
      throw error;
    }
  }, [refreshTokenValue]);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((currentUser) => {
      if (!currentUser) return null;
      return { ...currentUser, ...updates };
    });
  }, []);

  const value: AuthContextValue = {
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    user,
    accessToken,
    login,
    logout,
    register,
    refreshToken,
    updateUser,
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
