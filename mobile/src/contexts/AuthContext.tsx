import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as authService from '../services/auth';
import { ApiError } from '../services/api';

/**
 * User interface representing the authenticated user
 */
export interface User {
  id: string;
  email: string;
  displayName?: string;
  hasCompletedOnboarding: boolean;
}

/**
 * Auth context value interface
 */
export interface AuthContextValue {
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Whether the auth state is still being loaded */
  isLoading: boolean;
  /** The current user, if authenticated */
  user: User | null;
  /** The current access token, if authenticated */
  accessToken: string | null;
  /** Log in with email and password */
  login: (email: string, password: string) => Promise<void>;
  /** Log out and clear tokens */
  logout: () => Promise<void>;
  /** Register a new account */
  register: (email: string, password: string, displayName: string) => Promise<void>;
  /** Refresh the access token */
  refreshToken: () => Promise<void>;
  /** Update user data (e.g., after onboarding) */
  updateUser: (updates: Partial<User>) => void;
}

// Create context with undefined default (must be used within provider)
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Auth provider props
 */
interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider component that manages authentication state
 *
 * Note: This is an in-memory implementation. Task #71 will add
 * secure token persistence using expo-secure-store.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshTokenValue, setRefreshTokenValue] = useState<string | null>(null);

  // Initialize auth state (currently just marks as loaded)
  // Task #71 will implement secure token persistence and auto-login
  useEffect(() => {
    const initializeAuth = async () => {
      // TODO: Task #71 - Check for stored tokens in expo-secure-store
      // and validate them with the API
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);

      // Store tokens in memory
      setAccessToken(response.accessToken);
      setRefreshTokenValue(response.refreshToken);

      // TODO: Task #71 - Store tokens in expo-secure-store
      // TODO: Decode JWT to get user info or make a /me API call
      // For now, create a minimal user from the email
      setUser({
        id: '', // Will be populated from JWT or /me endpoint
        email: email.toLowerCase(),
        hasCompletedOnboarding: false, // Will be fetched from API
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
      // Call logout API if we have a refresh token
      if (refreshTokenValue) {
        await authService.logout(refreshTokenValue);
      }
    } catch {
      // Ignore errors during logout - still clear local state
    } finally {
      // Clear all auth state
      setUser(null);
      setAccessToken(null);
      setRefreshTokenValue(null);
      // TODO: Task #71 - Clear expo-secure-store
    }
  }, [refreshTokenValue]);

  const register = useCallback(async (
    email: string,
    password: string,
    displayName: string
  ) => {
    try {
      await authService.register(email, password, displayName);
      // Registration doesn't log the user in - they need to verify email first
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
      // TODO: Task #71 - Update tokens in expo-secure-store
    } catch (error) {
      // If refresh fails, log out
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

/**
 * Hook to access auth context
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
