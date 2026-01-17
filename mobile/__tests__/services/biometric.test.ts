import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import {
  checkBiometricCapability,
  promptBiometric,
  enableBiometric,
  disableBiometric,
  isBiometricEnabled,
  getStoredCredentials,
  clearStoredCredentials,
  getBiometricTypeLabel,
  STORAGE_KEYS,
} from '../../src/services/biometric';

jest.mock('expo-local-authentication');
jest.mock('expo-secure-store');

const mockLocalAuth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('biometric service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkBiometricCapability', () => {
    it('returns not available when no hardware', async () => {
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(false);

      const result = await checkBiometricCapability();

      expect(result).toEqual({
        isAvailable: false,
        biometricType: 'none',
        isEnrolled: false,
      });
    });

    it('returns Face ID type when available', async () => {
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(true);
      mockLocalAuth.supportedAuthenticationTypesAsync.mockResolvedValue([
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      ]);

      const result = await checkBiometricCapability();

      expect(result).toEqual({
        isAvailable: true,
        biometricType: 'faceId',
        isEnrolled: true,
      });
    });

    it('returns fingerprint type when available', async () => {
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(true);
      mockLocalAuth.supportedAuthenticationTypesAsync.mockResolvedValue([
        LocalAuthentication.AuthenticationType.FINGERPRINT,
      ]);

      const result = await checkBiometricCapability();

      expect(result).toEqual({
        isAvailable: true,
        biometricType: 'fingerprint',
        isEnrolled: true,
      });
    });

    it('returns iris type when available', async () => {
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(true);
      mockLocalAuth.supportedAuthenticationTypesAsync.mockResolvedValue([
        LocalAuthentication.AuthenticationType.IRIS,
      ]);

      const result = await checkBiometricCapability();

      expect(result).toEqual({
        isAvailable: true,
        biometricType: 'iris',
        isEnrolled: true,
      });
    });

    it('prefers Face ID when multiple types available', async () => {
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(true);
      mockLocalAuth.supportedAuthenticationTypesAsync.mockResolvedValue([
        LocalAuthentication.AuthenticationType.FINGERPRINT,
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      ]);

      const result = await checkBiometricCapability();

      expect(result.biometricType).toBe('faceId');
    });

    it('returns not available when hardware exists but not enrolled', async () => {
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(false);
      mockLocalAuth.supportedAuthenticationTypesAsync.mockResolvedValue([
        LocalAuthentication.AuthenticationType.FINGERPRINT,
      ]);

      const result = await checkBiometricCapability();

      expect(result).toEqual({
        isAvailable: false,
        biometricType: 'fingerprint',
        isEnrolled: false,
      });
    });

    it('returns none type when no supported types', async () => {
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(true);
      mockLocalAuth.supportedAuthenticationTypesAsync.mockResolvedValue([]);

      const result = await checkBiometricCapability();

      expect(result.biometricType).toBe('none');
    });
  });

  describe('promptBiometric', () => {
    it('returns success on successful authentication', async () => {
      mockLocalAuth.authenticateAsync.mockResolvedValue({
        success: true,
      });

      const result = await promptBiometric();

      expect(result).toEqual({ success: true });
      expect(mockLocalAuth.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Authenticate to continue',
        fallbackLabel: 'Use password',
        disableDeviceFallback: true,
      });
    });

    it('uses custom reason when provided', async () => {
      mockLocalAuth.authenticateAsync.mockResolvedValue({
        success: true,
      });

      await promptBiometric('Unlock Balance Beacon');

      expect(mockLocalAuth.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Unlock Balance Beacon',
        fallbackLabel: 'Use password',
        disableDeviceFallback: true,
      });
    });

    it('returns error on user cancel', async () => {
      mockLocalAuth.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'user_cancel',
      });

      const result = await promptBiometric();

      expect(result).toEqual({
        success: false,
        error: 'Authentication was cancelled',
      });
    });

    it('returns error on user fallback', async () => {
      mockLocalAuth.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'user_fallback',
      });

      const result = await promptBiometric();

      expect(result).toEqual({
        success: false,
        error: 'User chose to use password',
      });
    });

    it('returns error on system cancel', async () => {
      mockLocalAuth.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'system_cancel',
      });

      const result = await promptBiometric();

      expect(result).toEqual({
        success: false,
        error: 'Authentication was cancelled by the system',
      });
    });

    it('returns error when not enrolled', async () => {
      mockLocalAuth.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'not_enrolled',
      });

      const result = await promptBiometric();

      expect(result).toEqual({
        success: false,
        error: 'No biometrics enrolled on this device',
      });
    });

    it('returns error on lockout', async () => {
      mockLocalAuth.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'lockout',
      });

      const result = await promptBiometric();

      expect(result).toEqual({
        success: false,
        error: 'Too many failed attempts. Please try again later.',
      });
    });

    it('returns error on permanent lockout', async () => {
      mockLocalAuth.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'lockout_permanent',
      });

      const result = await promptBiometric();

      expect(result).toEqual({
        success: false,
        error: 'Biometric authentication is locked. Please use your password.',
      });
    });

    it('returns generic error on unknown error', async () => {
      mockLocalAuth.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'unknown_error',
      });

      const result = await promptBiometric();

      expect(result).toEqual({
        success: false,
        error: 'Authentication failed',
      });
    });
  });

  describe('enableBiometric', () => {
    it('stores credentials and enables flag', async () => {
      await enableBiometric('refresh-token-123', 'user@example.com');

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(3);
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.REFRESH_TOKEN,
        'refresh-token-123'
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.USER_EMAIL,
        'user@example.com'
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.BIOMETRIC_ENABLED,
        'true'
      );
    });
  });

  describe('disableBiometric', () => {
    it('clears credentials and sets flag to false', async () => {
      await disableBiometric();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.REFRESH_TOKEN
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.USER_EMAIL
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.BIOMETRIC_ENABLED,
        'false'
      );
    });
  });

  describe('isBiometricEnabled', () => {
    it('returns true when enabled', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('true');

      const result = await isBiometricEnabled();

      expect(result).toBe(true);
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.BIOMETRIC_ENABLED
      );
    });

    it('returns false when disabled', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('false');

      const result = await isBiometricEnabled();

      expect(result).toBe(false);
    });

    it('returns false when not set', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const result = await isBiometricEnabled();

      expect(result).toBe(false);
    });
  });

  describe('getStoredCredentials', () => {
    it('returns credentials when stored', async () => {
      mockSecureStore.getItemAsync.mockImplementation(async (key) => {
        if (key === STORAGE_KEYS.REFRESH_TOKEN) return 'stored-refresh-token';
        if (key === STORAGE_KEYS.USER_EMAIL) return 'stored@example.com';
        return null;
      });

      const result = await getStoredCredentials();

      expect(result).toEqual({
        refreshToken: 'stored-refresh-token',
        email: 'stored@example.com',
      });
    });

    it('returns null when refresh token missing', async () => {
      mockSecureStore.getItemAsync.mockImplementation(async (key) => {
        if (key === STORAGE_KEYS.USER_EMAIL) return 'stored@example.com';
        return null;
      });

      const result = await getStoredCredentials();

      expect(result).toBeNull();
    });

    it('returns null when email missing', async () => {
      mockSecureStore.getItemAsync.mockImplementation(async (key) => {
        if (key === STORAGE_KEYS.REFRESH_TOKEN) return 'stored-refresh-token';
        return null;
      });

      const result = await getStoredCredentials();

      expect(result).toBeNull();
    });

    it('returns null when nothing stored', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const result = await getStoredCredentials();

      expect(result).toBeNull();
    });
  });

  describe('clearStoredCredentials', () => {
    it('removes all stored data', async () => {
      await clearStoredCredentials();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.REFRESH_TOKEN
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.USER_EMAIL
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.BIOMETRIC_ENABLED
      );
    });
  });

  describe('getBiometricTypeLabel', () => {
    it('returns Face ID for faceId type', () => {
      expect(getBiometricTypeLabel('faceId')).toBe('Face ID');
    });

    it('returns Fingerprint for fingerprint type', () => {
      expect(getBiometricTypeLabel('fingerprint')).toBe('Fingerprint');
    });

    it('returns Iris for iris type', () => {
      expect(getBiometricTypeLabel('iris')).toBe('Iris');
    });

    it('returns Biometric for none type', () => {
      expect(getBiometricTypeLabel('none')).toBe('Biometric');
    });
  });
});
