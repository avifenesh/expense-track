import { useAuthStore } from '../../src/stores/authStore';
import { ApiError } from '../../src/services/api';
import * as authService from '../../src/services/auth';
import * as biometricService from '../../src/services/biometric';

jest.mock('../../src/services/auth');
jest.mock('../../src/services/biometric');

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockBiometricService = biometricService as jest.Mocked<typeof biometricService>;

describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().reset();
  });

  describe('initial state', () => {
    it('has correct initial values', () => {
      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(true);
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.biometricCapability).toBeNull();
      expect(state.isBiometricEnabled).toBe(false);
    });
  });

  describe('initialize', () => {
    it('checks biometric capability and sets isLoading to false', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        isAvailable: true,
        biometricType: 'faceId',
        isEnrolled: true,
      });
      mockBiometricService.isBiometricEnabled.mockResolvedValue(false);

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.biometricCapability).toEqual({
        isAvailable: true,
        biometricType: 'faceId',
        isEnrolled: true,
      });
      expect(state.isBiometricEnabled).toBe(false);
    });

    it('handles biometric check errors gracefully', async () => {
      mockBiometricService.checkBiometricCapability.mockRejectedValue(
        new Error('Biometric error')
      );

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.biometricCapability).toBeNull();
    });
  });

  describe('login', () => {
    it('successfully logs in and updates state', async () => {
      mockAuthService.login.mockResolvedValue({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        expiresIn: 900,
      });

      await useAuthStore.getState().login('test@example.com', 'password123');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe('access-token-123');
      expect(state.refreshToken).toBe('refresh-token-456');
      expect(state.user).toEqual({
        id: null,
        email: 'test@example.com',
        hasCompletedOnboarding: false,
      });
    });

    it('normalizes email to lowercase', async () => {
      mockAuthService.login.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 900,
      });

      await useAuthStore.getState().login('Test@Example.COM', 'password');

      const state = useAuthStore.getState();
      expect(state.user?.email).toBe('test@example.com');
    });

    it('throws ApiError on login failure', async () => {
      const apiError = new ApiError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
      mockAuthService.login.mockRejectedValue(apiError);

      await expect(
        useAuthStore.getState().login('test@example.com', 'wrong')
      ).rejects.toThrow(ApiError);

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });

    it('wraps non-API errors', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Network error'));

      await expect(
        useAuthStore.getState().login('test@example.com', 'password')
      ).rejects.toMatchObject({
        message: 'Login failed. Please try again.',
        code: 'LOGIN_FAILED',
      });
    });
  });

  describe('logout', () => {
    beforeEach(async () => {
      mockAuthService.login.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 900,
      });
      await useAuthStore.getState().login('test@example.com', 'password');
    });

    it('clears auth state on logout', async () => {
      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
    });

    it('calls authService.logout with refresh token', async () => {
      await useAuthStore.getState().logout();

      expect(mockAuthService.logout).toHaveBeenCalledWith('refresh');
    });

    it('clears biometric credentials on logout', async () => {
      await useAuthStore.getState().logout();

      expect(mockBiometricService.clearStoredCredentials).toHaveBeenCalled();
    });

    it('clears state even if logout API call fails', async () => {
      mockAuthService.logout.mockRejectedValue(new Error('Server error'));

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });
  });

  describe('register', () => {
    it('calls authService.register with correct params', async () => {
      mockAuthService.register.mockResolvedValue({ message: 'Success' });

      await useAuthStore.getState().register('test@example.com', 'password', 'Test User');

      expect(mockAuthService.register).toHaveBeenCalledWith(
        'test@example.com',
        'password',
        'Test User'
      );
    });

    it('throws ApiError on registration failure', async () => {
      const apiError = new ApiError('Email exists', 'EMAIL_EXISTS', 400);
      mockAuthService.register.mockRejectedValue(apiError);

      await expect(
        useAuthStore.getState().register('test@example.com', 'password', 'User')
      ).rejects.toThrow(ApiError);
    });

    it('wraps non-API errors', async () => {
      mockAuthService.register.mockRejectedValue(new Error('Network error'));

      await expect(
        useAuthStore.getState().register('test@example.com', 'password', 'User')
      ).rejects.toMatchObject({
        message: 'Registration failed. Please try again.',
        code: 'REGISTRATION_FAILED',
      });
    });
  });

  describe('refreshTokens', () => {
    beforeEach(async () => {
      mockAuthService.login.mockResolvedValue({
        accessToken: 'old-access',
        refreshToken: 'old-refresh',
        expiresIn: 900,
      });
      await useAuthStore.getState().login('test@example.com', 'password');
    });

    it('updates tokens on successful refresh', async () => {
      mockAuthService.refreshTokens.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresIn: 900,
      });

      await useAuthStore.getState().refreshTokens();

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe('new-access');
      expect(state.refreshToken).toBe('new-refresh');
    });

    it('throws error when no refresh token available', async () => {
      useAuthStore.setState({ refreshToken: null });

      await expect(useAuthStore.getState().refreshTokens()).rejects.toMatchObject({
        code: 'NO_REFRESH_TOKEN',
      });
    });

    it('clears state on refresh failure', async () => {
      mockAuthService.refreshTokens.mockRejectedValue(
        new ApiError('Token expired', 'TOKEN_EXPIRED', 401)
      );

      await expect(useAuthStore.getState().refreshTokens()).rejects.toThrow();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('updates biometric credentials if enabled', async () => {
      useAuthStore.setState({ isBiometricEnabled: true });
      mockAuthService.refreshTokens.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresIn: 900,
      });

      await useAuthStore.getState().refreshTokens();

      expect(mockBiometricService.enableBiometric).toHaveBeenCalledWith(
        'new-refresh',
        'test@example.com'
      );
    });
  });

  describe('updateUser', () => {
    beforeEach(async () => {
      mockAuthService.login.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 900,
      });
      await useAuthStore.getState().login('test@example.com', 'password');
    });

    it('updates user properties', () => {
      useAuthStore.getState().updateUser({ displayName: 'New Name' });

      const state = useAuthStore.getState();
      expect(state.user?.displayName).toBe('New Name');
      expect(state.user?.email).toBe('test@example.com');
    });

    it('updates hasCompletedOnboarding', () => {
      useAuthStore.getState().updateUser({ hasCompletedOnboarding: true });

      const state = useAuthStore.getState();
      expect(state.user?.hasCompletedOnboarding).toBe(true);
    });

    it('does nothing if user is null', () => {
      useAuthStore.setState({ user: null });

      useAuthStore.getState().updateUser({ displayName: 'Test' });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });
  });

  describe('loginWithBiometric', () => {
    it('logs in successfully with biometric', async () => {
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

      await useAuthStore.getState().loginWithBiometric();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe('biometric@example.com');
      expect(state.user?.hasCompletedOnboarding).toBe(true);
    });

    it('throws error when biometric prompt fails', async () => {
      mockBiometricService.promptBiometric.mockResolvedValue({
        success: false,
        error: 'User cancelled',
      });

      await expect(useAuthStore.getState().loginWithBiometric()).rejects.toMatchObject({
        code: 'BIOMETRIC_FAILED',
      });
    });

    it('throws error when no stored credentials', async () => {
      mockBiometricService.promptBiometric.mockResolvedValue({ success: true });
      mockBiometricService.getStoredCredentials.mockResolvedValue(null);

      await expect(useAuthStore.getState().loginWithBiometric()).rejects.toMatchObject({
        code: 'NO_CREDENTIALS',
      });
    });

    it('clears credentials on token refresh failure', async () => {
      mockBiometricService.promptBiometric.mockResolvedValue({ success: true });
      mockBiometricService.getStoredCredentials.mockResolvedValue({
        refreshToken: 'expired',
        email: 'test@example.com',
      });
      mockAuthService.refreshTokens.mockRejectedValue(new Error('Expired'));

      await expect(useAuthStore.getState().loginWithBiometric()).rejects.toMatchObject({
        code: 'SESSION_EXPIRED',
      });

      expect(mockBiometricService.clearStoredCredentials).toHaveBeenCalled();
      expect(useAuthStore.getState().isBiometricEnabled).toBe(false);
    });
  });

  describe('enableBiometric', () => {
    beforeEach(async () => {
      mockAuthService.login.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 900,
      });
      await useAuthStore.getState().login('test@example.com', 'password');
    });

    it('enables biometric when authenticated', async () => {
      mockBiometricService.promptBiometric.mockResolvedValue({ success: true });

      await useAuthStore.getState().enableBiometric();

      expect(mockBiometricService.enableBiometric).toHaveBeenCalledWith(
        'refresh',
        'test@example.com'
      );
      expect(useAuthStore.getState().isBiometricEnabled).toBe(true);
    });

    it('throws error when not authenticated', async () => {
      useAuthStore.setState({ refreshToken: null, user: null });

      await expect(useAuthStore.getState().enableBiometric()).rejects.toMatchObject({
        code: 'NOT_AUTHENTICATED',
      });
    });

    it('throws error when biometric confirmation fails', async () => {
      mockBiometricService.promptBiometric.mockResolvedValue({
        success: false,
        error: 'Cancelled',
      });

      await expect(useAuthStore.getState().enableBiometric()).rejects.toMatchObject({
        code: 'BIOMETRIC_FAILED',
      });
    });
  });

  describe('disableBiometric', () => {
    it('disables biometric', async () => {
      useAuthStore.setState({ isBiometricEnabled: true });

      await useAuthStore.getState().disableBiometric();

      expect(mockBiometricService.disableBiometric).toHaveBeenCalled();
      expect(useAuthStore.getState().isBiometricEnabled).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets to initial state', async () => {
      mockAuthService.login.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 900,
      });
      await useAuthStore.getState().login('test@example.com', 'password');

      useAuthStore.getState().reset();

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(true);
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });
  });
});
