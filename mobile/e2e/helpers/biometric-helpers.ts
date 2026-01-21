import { device } from 'detox';

/**
 * Biometric Mocking Helpers for E2E Tests
 *
 * Helpers for simulating biometric authentication scenarios in tests.
 * Note: iOS and Android have different biometric APIs.
 * - iOS: Face ID (matchFace/unmatchFace) and Touch ID (matchFinger/unmatchFinger)
 * - Android: Fingerprint (matchFinger/unmatchFinger)
 */

export type BiometricType = 'face' | 'fingerprint';

/**
 * Enable biometric capability on the device
 * Must be called before biometric tests to ensure device supports biometrics
 */
export async function mockBiometricAvailable(type: BiometricType = 'face'): Promise<void> {
  // Enable biometric enrollment
  await device.setBiometricEnrollment(true);

  // Note: The type parameter helps document test intent, but actual
  // biometric type is determined by simulator/emulator configuration
  // iOS simulators can be configured for Face ID or Touch ID
  // Android emulators use Fingerprint by default
}

/**
 * Disable biometric capability on the device
 * Simulates a device without biometric hardware or enrollment
 */
export async function mockBiometricUnavailable(): Promise<void> {
  await device.setBiometricEnrollment(false);
}

/**
 * Simulate successful biometric authentication
 * Call this after triggering a biometric prompt to simulate user success
 *
 * @param type - Type of biometric to simulate ('face' for Face ID, 'fingerprint' for Touch ID/Fingerprint)
 */
export async function mockBiometricSuccess(type: BiometricType = 'face'): Promise<void> {
  if (type === 'face') {
    // Face ID (iOS only)
    await device.matchFace();
  } else {
    // Touch ID (iOS) or Fingerprint (Android)
    await device.matchFinger();
  }
}

/**
 * Simulate failed biometric authentication
 * Call this after triggering a biometric prompt to simulate user failure
 *
 * @param type - Type of biometric to simulate ('face' for Face ID, 'fingerprint' for Touch ID/Fingerprint)
 */
export async function mockBiometricFailure(type: BiometricType = 'face'): Promise<void> {
  if (type === 'face') {
    // Face ID (iOS only)
    await device.unmatchFace();
  } else {
    // Touch ID (iOS) or Fingerprint (Android)
    await device.unmatchFinger();
  }
}

/**
 * Platform-aware biometric helpers that automatically detect the platform
 */
export const BiometricHelpers = {
  /**
   * Enable biometric for current platform
   * iOS: Uses Face ID by default (can be changed in simulator settings)
   * Android: Uses Fingerprint by default
   */
  async enableForPlatform(): Promise<void> {
    await mockBiometricAvailable(device.getPlatform() === 'ios' ? 'face' : 'fingerprint');
  },

  /**
   * Simulate successful authentication for current platform
   */
  async authenticateSuccess(): Promise<void> {
    await mockBiometricSuccess(device.getPlatform() === 'ios' ? 'face' : 'fingerprint');
  },

  /**
   * Simulate failed authentication for current platform
   */
  async authenticateFailure(): Promise<void> {
    await mockBiometricFailure(device.getPlatform() === 'ios' ? 'face' : 'fingerprint');
  },

  /**
   * Disable biometric for current platform
   */
  async disable(): Promise<void> {
    await mockBiometricUnavailable();
  },
};
