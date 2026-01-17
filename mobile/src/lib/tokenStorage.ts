import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'balance_beacon_access_token';
const REFRESH_TOKEN_KEY = 'balance_beacon_refresh_token';
const USER_EMAIL_KEY = 'balance_beacon_user_email';
const ONBOARDING_COMPLETE_KEY = 'balance_beacon_onboarding_complete';

export interface StoredCredentials {
  accessToken: string | null;
  refreshToken: string | null;
  email: string | null;
  hasCompletedOnboarding: boolean;
}

export const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },

  async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },

  async getEmail(): Promise<string | null> {
    return SecureStore.getItemAsync(USER_EMAIL_KEY);
  },

  async setEmail(email: string): Promise<void> {
    await SecureStore.setItemAsync(USER_EMAIL_KEY, email);
  },

  async getOnboardingComplete(): Promise<boolean> {
    const value = await SecureStore.getItemAsync(ONBOARDING_COMPLETE_KEY);
    return value === 'true';
  },

  async setOnboardingComplete(complete: boolean): Promise<void> {
    await SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, complete ? 'true' : 'false');
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_EMAIL_KEY),
      SecureStore.deleteItemAsync(ONBOARDING_COMPLETE_KEY),
    ]);
  },

  async getTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    ]);
    return { accessToken, refreshToken };
  },

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
  },

  async getStoredCredentials(): Promise<StoredCredentials> {
    const [accessToken, refreshToken, email, onboardingComplete] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.getItemAsync(USER_EMAIL_KEY),
      SecureStore.getItemAsync(ONBOARDING_COMPLETE_KEY),
    ]);
    return {
      accessToken,
      refreshToken,
      email,
      hasCompletedOnboarding: onboardingComplete === 'true',
    };
  },

  async setStoredCredentials(
    accessToken: string,
    refreshToken: string,
    email: string,
    hasCompletedOnboarding: boolean
  ): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
      SecureStore.setItemAsync(USER_EMAIL_KEY, email),
      SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, hasCompletedOnboarding ? 'true' : 'false'),
    ]);
  },
};
