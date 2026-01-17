import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export const STORAGE_KEYS = {
  BIOMETRIC_ENABLED: 'balance_beacon_biometric_enabled',
  REFRESH_TOKEN: 'balance_beacon_refresh_token',
  USER_EMAIL: 'balance_beacon_user_email',
} as const;

export type BiometricType = 'fingerprint' | 'faceId' | 'iris' | 'none';

export interface BiometricCapability {
  isAvailable: boolean;
  biometricType: BiometricType;
  isEnrolled: boolean;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
}

export interface StoredCredentials {
  refreshToken: string;
  email: string;
}

/**
 * Check what biometric capabilities are available on this device
 */
export async function checkBiometricCapability(): Promise<BiometricCapability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();

  if (!hasHardware) {
    return {
      isAvailable: false,
      biometricType: 'none',
      isEnrolled: false,
    };
  }

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  const supportedTypes =
    await LocalAuthentication.supportedAuthenticationTypesAsync();

  let biometricType: BiometricType = 'none';

  if (
    supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
  ) {
    biometricType = 'faceId';
  } else if (
    supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
  ) {
    biometricType = 'fingerprint';
  } else if (
    supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)
  ) {
    biometricType = 'iris';
  }

  return {
    isAvailable: hasHardware && isEnrolled,
    biometricType,
    isEnrolled,
  };
}

/**
 * Prompt the user for biometric authentication
 */
export async function promptBiometric(
  reason: string = 'Authenticate to continue'
): Promise<BiometricAuthResult> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    fallbackLabel: 'Use password',
    disableDeviceFallback: true,
  });

  if (result.success) {
    return { success: true };
  }

  let error: string;
  switch (result.error) {
    case 'user_cancel':
      error = 'Authentication was cancelled';
      break;
    case 'user_fallback':
      error = 'User chose to use password';
      break;
    case 'system_cancel':
      error = 'Authentication was cancelled by the system';
      break;
    case 'not_enrolled':
      error = 'No biometrics enrolled on this device';
      break;
    case 'lockout':
      error = 'Too many failed attempts. Please try again later.';
      break;
    case 'lockout_permanent':
      error = 'Biometric authentication is locked. Please use your password.';
      break;
    default:
      error = 'Authentication failed';
  }

  return { success: false, error };
}

/**
 * Enable biometric authentication by storing credentials securely
 */
export async function enableBiometric(
  refreshToken: string,
  userEmail: string
): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
    SecureStore.setItemAsync(STORAGE_KEYS.USER_EMAIL, userEmail),
    SecureStore.setItemAsync(STORAGE_KEYS.BIOMETRIC_ENABLED, 'true'),
  ]);
}

/**
 * Disable biometric authentication and clear stored credentials
 */
export async function disableBiometric(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
    SecureStore.deleteItemAsync(STORAGE_KEYS.USER_EMAIL),
    SecureStore.setItemAsync(STORAGE_KEYS.BIOMETRIC_ENABLED, 'false'),
  ]);
}

/**
 * Check if biometric authentication is enabled
 */
export async function isBiometricEnabled(): Promise<boolean> {
  const enabled = await SecureStore.getItemAsync(STORAGE_KEYS.BIOMETRIC_ENABLED);
  return enabled === 'true';
}

/**
 * Get stored credentials for biometric login
 */
export async function getStoredCredentials(): Promise<StoredCredentials | null> {
  const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
  const email = await SecureStore.getItemAsync(STORAGE_KEYS.USER_EMAIL);

  if (!refreshToken || !email) {
    return null;
  }

  return { refreshToken, email };
}

/**
 * Clear all stored credentials (used on logout or token expiry)
 */
export async function clearStoredCredentials(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
    SecureStore.deleteItemAsync(STORAGE_KEYS.USER_EMAIL),
    SecureStore.deleteItemAsync(STORAGE_KEYS.BIOMETRIC_ENABLED),
  ]);
}

/**
 * Get user-friendly label for biometric type
 */
export function getBiometricTypeLabel(type: BiometricType): string {
  switch (type) {
    case 'faceId':
      return 'Face ID';
    case 'fingerprint':
      return 'Fingerprint';
    case 'iris':
      return 'Iris';
    default:
      return 'Biometric';
  }
}
