import { device } from 'detox';

/**
 * Biometric Authentication Helpers
 *
 * Provides utilities for testing Face ID / Touch ID / Fingerprint authentication.
 * Uses Detox's biometric simulation APIs.
 */

/**
 * Enable biometric authentication simulation for the current platform.
 * iOS: Enrolls Face ID
 * Android: Enrolls fingerprint
 */
export async function enableBiometric(): Promise<void> {
  await device.setBiometricEnrollment(true);
}

/**
 * Disable biometric authentication simulation.
 */
export async function disableBiometric(): Promise<void> {
  await device.setBiometricEnrollment(false);
}

/**
 * Simulate successful biometric authentication.
 */
export async function authenticateSuccess(): Promise<void> {
  if (device.getPlatform() === 'ios') {
    await device.matchFace();
  } else {
    await device.matchFinger();
  }
}

/**
 * Simulate failed biometric authentication.
 */
export async function authenticateFailure(): Promise<void> {
  if (device.getPlatform() === 'ios') {
    await device.unmatchFace();
  } else {
    await device.unmatchFinger();
  }
}

/**
 * BiometricHelpers namespace for convenient importing.
 */
export const BiometricHelpers = {
  enable: enableBiometric,
  disable: disableBiometric,
  authenticateSuccess,
  authenticateFailure,
};
