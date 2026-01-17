import * as SecureStore from 'expo-secure-store';
import { tokenStorage } from '../../src/lib/tokenStorage';

jest.mock('expo-secure-store');

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('tokenStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAccessToken', () => {
    it('returns access token from secure store', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce('access-token-123');

      const result = await tokenStorage.getAccessToken();

      expect(result).toBe('access-token-123');
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('balance_beacon_access_token');
    });

    it('returns null when no token exists', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null);

      const result = await tokenStorage.getAccessToken();

      expect(result).toBeNull();
    });
  });

  describe('setAccessToken', () => {
    it('stores access token in secure store', async () => {
      mockSecureStore.setItemAsync.mockResolvedValueOnce(undefined);

      await tokenStorage.setAccessToken('new-access-token');

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'balance_beacon_access_token',
        'new-access-token'
      );
    });
  });

  describe('getRefreshToken', () => {
    it('returns refresh token from secure store', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce('refresh-token-456');

      const result = await tokenStorage.getRefreshToken();

      expect(result).toBe('refresh-token-456');
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('balance_beacon_refresh_token');
    });

    it('returns null when no token exists', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null);

      const result = await tokenStorage.getRefreshToken();

      expect(result).toBeNull();
    });
  });

  describe('setRefreshToken', () => {
    it('stores refresh token in secure store', async () => {
      mockSecureStore.setItemAsync.mockResolvedValueOnce(undefined);

      await tokenStorage.setRefreshToken('new-refresh-token');

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'balance_beacon_refresh_token',
        'new-refresh-token'
      );
    });
  });

  describe('getEmail', () => {
    it('returns email from secure store', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce('user@example.com');

      const result = await tokenStorage.getEmail();

      expect(result).toBe('user@example.com');
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('balance_beacon_user_email');
    });

    it('returns null when no email exists', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null);

      const result = await tokenStorage.getEmail();

      expect(result).toBeNull();
    });
  });

  describe('setEmail', () => {
    it('stores email in secure store', async () => {
      mockSecureStore.setItemAsync.mockResolvedValueOnce(undefined);

      await tokenStorage.setEmail('user@example.com');

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'balance_beacon_user_email',
        'user@example.com'
      );
    });
  });

  describe('getOnboardingComplete', () => {
    it('returns true when stored value is "true"', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce('true');

      const result = await tokenStorage.getOnboardingComplete();

      expect(result).toBe(true);
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('balance_beacon_onboarding_complete');
    });

    it('returns false when stored value is "false"', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce('false');

      const result = await tokenStorage.getOnboardingComplete();

      expect(result).toBe(false);
    });

    it('returns false when no value exists', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null);

      const result = await tokenStorage.getOnboardingComplete();

      expect(result).toBe(false);
    });
  });

  describe('setOnboardingComplete', () => {
    it('stores "true" when passed true', async () => {
      mockSecureStore.setItemAsync.mockResolvedValueOnce(undefined);

      await tokenStorage.setOnboardingComplete(true);

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'balance_beacon_onboarding_complete',
        'true'
      );
    });

    it('stores "false" when passed false', async () => {
      mockSecureStore.setItemAsync.mockResolvedValueOnce(undefined);

      await tokenStorage.setOnboardingComplete(false);

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'balance_beacon_onboarding_complete',
        'false'
      );
    });
  });

  describe('clearTokens', () => {
    it('deletes all stored credentials from secure store', async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

      await tokenStorage.clearTokens();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('balance_beacon_access_token');
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('balance_beacon_refresh_token');
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('balance_beacon_user_email');
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('balance_beacon_onboarding_complete');
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledTimes(4);
    });
  });

  describe('getTokens', () => {
    it('returns both tokens from secure store', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('access-token-123')
        .mockResolvedValueOnce('refresh-token-456');

      const result = await tokenStorage.getTokens();

      expect(result).toEqual({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
      });
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('balance_beacon_access_token');
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('balance_beacon_refresh_token');
    });

    it('returns null for missing tokens', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const result = await tokenStorage.getTokens();

      expect(result).toEqual({
        accessToken: null,
        refreshToken: null,
      });
    });

    it('handles partial token availability', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('access-token-123')
        .mockResolvedValueOnce(null);

      const result = await tokenStorage.getTokens();

      expect(result).toEqual({
        accessToken: 'access-token-123',
        refreshToken: null,
      });
    });
  });

  describe('setTokens', () => {
    it('stores both tokens in secure store', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      await tokenStorage.setTokens('access-token-123', 'refresh-token-456');

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'balance_beacon_access_token',
        'access-token-123'
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'balance_beacon_refresh_token',
        'refresh-token-456'
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStoredCredentials', () => {
    it('returns all stored credentials', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('access-token-123')
        .mockResolvedValueOnce('refresh-token-456')
        .mockResolvedValueOnce('user@example.com')
        .mockResolvedValueOnce('true');

      const result = await tokenStorage.getStoredCredentials();

      expect(result).toEqual({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        email: 'user@example.com',
        hasCompletedOnboarding: true,
      });
    });

    it('returns null and false defaults for missing values', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const result = await tokenStorage.getStoredCredentials();

      expect(result).toEqual({
        accessToken: null,
        refreshToken: null,
        email: null,
        hasCompletedOnboarding: false,
      });
    });

    it('handles hasCompletedOnboarding as false when stored', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('access-token-123')
        .mockResolvedValueOnce('refresh-token-456')
        .mockResolvedValueOnce('user@example.com')
        .mockResolvedValueOnce('false');

      const result = await tokenStorage.getStoredCredentials();

      expect(result.hasCompletedOnboarding).toBe(false);
    });
  });

  describe('setStoredCredentials', () => {
    it('stores all credentials in secure store', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      await tokenStorage.setStoredCredentials(
        'access-token-123',
        'refresh-token-456',
        'user@example.com',
        true
      );

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'balance_beacon_access_token',
        'access-token-123'
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'balance_beacon_refresh_token',
        'refresh-token-456'
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'balance_beacon_user_email',
        'user@example.com'
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'balance_beacon_onboarding_complete',
        'true'
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(4);
    });

    it('stores hasCompletedOnboarding as "false" when passed false', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      await tokenStorage.setStoredCredentials(
        'access-token-123',
        'refresh-token-456',
        'user@example.com',
        false
      );

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'balance_beacon_onboarding_complete',
        'false'
      );
    });
  });

  describe('error handling', () => {
    it('propagates errors from getItemAsync', async () => {
      const error = new Error('SecureStore unavailable');
      mockSecureStore.getItemAsync.mockRejectedValueOnce(error);

      await expect(tokenStorage.getAccessToken()).rejects.toThrow('SecureStore unavailable');
    });

    it('propagates errors from setItemAsync', async () => {
      const error = new Error('SecureStore unavailable');
      mockSecureStore.setItemAsync.mockRejectedValueOnce(error);

      await expect(tokenStorage.setAccessToken('token')).rejects.toThrow('SecureStore unavailable');
    });

    it('propagates errors from deleteItemAsync', async () => {
      const error = new Error('SecureStore unavailable');
      mockSecureStore.deleteItemAsync.mockRejectedValueOnce(error);

      await expect(tokenStorage.clearTokens()).rejects.toThrow('SecureStore unavailable');
    });
  });
});
