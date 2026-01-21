import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores';
import { getBiometricTypeLabel } from '../../services/biometric';
import type { OnboardingScreenProps } from '../../navigation/types';

export function OnboardingBiometricScreen({
  navigation,
}: OnboardingScreenProps<'OnboardingBiometric'>) {
  const biometricCapability = useAuthStore((state) => state.biometricCapability);
  const enableBiometric = useAuthStore((state) => state.enableBiometric);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const biometricLabel = biometricCapability
    ? getBiometricTypeLabel(biometricCapability.biometricType)
    : 'Biometric';

  const handleEnable = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await enableBiometric();
      completeOnboarding();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to enable biometric authentication');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  const completeOnboarding = () => {
    updateUser({ hasCompletedOnboarding: true });
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: 'App' }],
    });
  };

  const biometricAvailable = biometricCapability?.isAvailable;

  return (
    <SafeAreaView style={styles.container} testID="onboarding.biometric.screen">
      <View style={styles.content}>
        <Text style={styles.stepIndicator}>Step 6 of 6</Text>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>
            {biometricCapability?.biometricType === 'faceId' ? '👤' : '👆'}
          </Text>
        </View>
        <Text style={styles.title}>Quick Access</Text>
        <Text style={styles.subtitle}>
          {biometricAvailable
            ? `Use ${biometricLabel} to quickly unlock the app without entering your password.`
            : 'Biometric authentication is not available on this device.'}
        </Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {biometricAvailable ? (
          <>
            <Pressable
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleEnable}
              disabled={isLoading}
              testID="onboarding.biometric.enableButton"
            >
              {isLoading ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.buttonText}>Enable {biometricLabel}</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.skipButton}
              onPress={handleSkip}
              disabled={isLoading}
              testID="onboarding.biometric.skipButton"
            >
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={styles.button}
            onPress={handleSkip}
            testID="onboarding.biometric.continueButton"
          >
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIndicator: {
    fontSize: 14,
    color: '#38bdf8',
    marginBottom: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(56,189,248,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorContainer: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    backgroundColor: '#38bdf8',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 12,
  },
  skipButtonText: {
    color: '#94a3b8',
    fontSize: 16,
  },
});
