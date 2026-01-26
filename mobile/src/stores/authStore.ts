import { create } from 'zustand';
import * as authService from '../services/auth';
import type { RegisterResponse } from '../services/auth';
import * as biometricService from '../services/biometric';
import { ApiError } from '../services/api';
import type { BiometricCapability } from '../services/biometric';
import { resetAllStores } from './storeRegistry';

export interface User {
  id: string | null;
  email: string;
  displayName?: string;
  hasCompletedOnboarding: boolean;
}

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  biometricCapability: BiometricCapability | null;
  isBiometricEnabled: boolean;
}

interface AuthActions {
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<RegisterResponse>;
  refreshTokens: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  loginWithBiometric: () => Promise<void>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  reset: () => void;
}

export type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  isLoading: false, // Start with false - biometric check happens in background
  isAuthenticated: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  biometricCapability: null,
  isBiometricEnabled: false,
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  ...initialState,

  initialize: async () => {
    // Biometric capabilities will be loaded in background; isLoading starts as false
    // Load biometric capabilities asynchronously (non-blocking)
    try {
      const capability = await biometricService.checkBiometricCapability();
      const enabled = await biometricService.isBiometricEnabled();
      set({
        biometricCapability: capability,
        isBiometricEnabled: enabled,
      });
    } catch {
      // Biometric init failed - app continues without biometric support
    }
  },

  login: async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);

      // User data is included in login response - no separate call needed
      set({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        user: {
          id: response.user?.id ?? null,
          email: email.toLowerCase(),
          displayName: response.user?.displayName ?? undefined,
          hasCompletedOnboarding: response.user?.hasCompletedOnboarding ?? false,
        },
        isAuthenticated: true,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Login failed. Please try again.', 'LOGIN_FAILED', 0);
    }
  },

  logout: async () => {
    const { refreshToken } = get();

    try {
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch {
      // Logout errors are not propagated to avoid blocking the user
    } finally {
      await biometricService.clearStoredCredentials();
      // Reset all stores to clear user data
      resetAllStores();
      set({
        ...initialState,
        isLoading: false,
        biometricCapability: get().biometricCapability,
      });
    }
  },

  register: async (email: string, password: string, displayName: string) => {
    try {
      const response = await authService.register(email, password, displayName);
      return response;
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
  },

  refreshTokens: async () => {
    const { refreshToken, isBiometricEnabled, user } = get();

    if (!refreshToken) {
      throw new ApiError('No refresh token available', 'NO_REFRESH_TOKEN', 401);
    }

    try {
      const response = await authService.refreshTokens(refreshToken);
      set({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });

      if (isBiometricEnabled && user?.email) {
        await biometricService.enableBiometric(response.refreshToken, user.email);
      }
    } catch (error) {
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });
      throw error;
    }
  },

  updateUser: (updates: Partial<User>) => {
    set((state) => {
      if (!state.user) return state;
      return {
        user: { ...state.user, ...updates },
      };
    });
  },

  loginWithBiometric: async () => {
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
      await biometricService.enableBiometric(tokens.refreshToken, credentials.email);

      // Fetch user profile to get actual user data
      let userProfile;
      try {
        userProfile = await authService.getProfile(tokens.accessToken);
      } catch {
        userProfile = null;
      }

      set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: userProfile?.id ?? null,
          email: credentials.email,
          displayName: userProfile?.displayName ?? undefined,
          hasCompletedOnboarding: userProfile?.hasCompletedOnboarding ?? true,
        },
        isAuthenticated: true,
      });
    } catch {
      await biometricService.clearStoredCredentials();
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isBiometricEnabled: false,
      });
      throw new ApiError(
        'Session expired. Please sign in with your password.',
        'SESSION_EXPIRED',
        401
      );
    }
  },

  enableBiometric: async () => {
    const { refreshToken, user } = get();

    if (!refreshToken || !user?.email) {
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

    await biometricService.enableBiometric(refreshToken, user.email);
    set({ isBiometricEnabled: true });
  },

  disableBiometric: async () => {
    await biometricService.disableBiometric();
    set({ isBiometricEnabled: false });
  },

  reset: () => {
    set({ ...initialState });
  },
}));
