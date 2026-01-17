import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthScreenProps } from '../../navigation/types';
import { useAuth } from '../../contexts';
import { validateEmail } from '../../lib/validation';
import { ApiError } from '../../services/api';
import { getBiometricTypeLabel } from '../../services/biometric';

export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const {
    login,
    loginWithBiometric,
    biometricCapability,
    isBiometricEnabled,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailError(null);
    setError(null);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setError(null);
  };

  const handleLogin = async () => {
    setError(null);
    setEmailError(null);

    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      setEmailError(emailValidationError);
      return;
    }

    if (!password) {
      setError('Password is required');
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'RATE_LIMITED') {
          setError('Too many attempts. Please try again later.');
        } else if (err.status === 401) {
          setError('Invalid email or password');
        } else if (err.details?.email) {
          setEmailError(err.details.email[0]);
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      await loginWithBiometric();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'BIOMETRIC_FAILED') {
          setError(err.message);
        } else if (err.code === 'NO_CREDENTIALS') {
          setError('No saved credentials. Please sign in with your password.');
        } else if (err.code === 'SESSION_EXPIRED') {
          setError('Session expired. Please sign in with your password.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Biometric authentication failed. Please use your password.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const biometricLabel = biometricCapability
    ? getBiometricTypeLabel(biometricCapability.biometricType)
    : 'Biometric';

  const showBiometricButton =
    biometricCapability?.isAvailable && isBiometricEnabled;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={styles.title}>Sign In</Text>
            <Text style={styles.subtitle}>Welcome back to Balance Beacon</Text>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, emailError && styles.inputError]}
                  value={email}
                  onChangeText={handleEmailChange}
                  placeholder="Enter your email"
                  placeholderTextColor="#64748b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                {emailError && (
                  <Text style={styles.fieldError}>{emailError}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={handlePasswordChange}
                  placeholder="Enter your password"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password"
                  editable={!isLoading}
                />
              </View>

              <Pressable
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
                testID="login-button"
              >
                {isLoading ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <Text style={styles.buttonText}>Sign In</Text>
                )}
              </Pressable>

              {showBiometricButton && (
                <Pressable
                  style={[styles.biometricButton, isLoading && styles.buttonDisabled]}
                  onPress={handleBiometricLogin}
                  disabled={isLoading}
                  testID="biometric-login-button"
                >
                  <Text style={styles.biometricIcon}>
                    {biometricCapability?.biometricType === 'faceId' ? '👤' : '👆'}
                  </Text>
                  <Text style={styles.biometricButtonText}>
                    Use {biometricLabel}
                  </Text>
                </Pressable>
              )}
            </View>

            <Pressable
              style={styles.link}
              onPress={() => navigation.navigate('Register')}
              disabled={isLoading}
            >
              <Text style={styles.linkText}>
                Don&apos;t have an account? Register
              </Text>
            </Pressable>

            <Pressable
              style={styles.link}
              onPress={() => navigation.navigate('ResetPassword', {})}
              disabled={isLoading}
            >
              <Text style={styles.linkText}>Forgot password?</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  fieldError: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  button: {
    backgroundColor: '#38bdf8',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  biometricButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  biometricIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  biometricButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    padding: 12,
  },
  linkText: {
    color: '#38bdf8',
    textAlign: 'center',
  },
});
