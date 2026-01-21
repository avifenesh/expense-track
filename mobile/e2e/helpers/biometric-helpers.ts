import { device } from 'detox';


export type BiometricType = 'face' | 'fingerprint';

export async function mockBiometricAvailable(_type: BiometricType = 'face'): Promise<void> {
  await device.setBiometricEnrollment(true);

  // biometric type is determined by simulator/emulator configuration
  // iOS simulators can be configured for Face ID or Touch ID
}

export async function mockBiometricUnavailable(): Promise<void> {
  await device.setBiometricEnrollment(false);
}

export async function mockBiometricSuccess(type: BiometricType = 'face'): Promise<void> {
  if (type === 'face') {
      await device.matchFace();
  } else {
      await device.matchFinger();
  }
}

export async function mockBiometricFailure(type: BiometricType = 'face'): Promise<void> {
  if (type === 'face') {
      await device.unmatchFace();
  } else {
      await device.unmatchFinger();
  }
}

export const BiometricHelpers = {
  async enableForPlatform(): Promise<void> {
    await mockBiometricAvailable(device.getPlatform() === 'ios' ? 'face' : 'fingerprint');
  },

  async authenticateSuccess(): Promise<void> {
    await mockBiometricSuccess(device.getPlatform() === 'ios' ? 'face' : 'fingerprint');
  },

  async authenticateFailure(): Promise<void> {
    await mockBiometricFailure(device.getPlatform() === 'ios' ? 'face' : 'fingerprint');
  },

  async disable(): Promise<void> {
    await mockBiometricUnavailable();
  },
};
