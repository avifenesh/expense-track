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
import { useAuthStore } from '../../stores';
import {
  validateEmail,
  validatePassword,
  validateDisplayName,
  getPasswordRequirements,
} from '../../lib/validation';
import { ApiError } from '../../services/api';

export function RegisterScreen({ navigation }: AuthScreenProps<'Register'>) {
  const register = useAuthStore((state) => state.register);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);

  const passwordRequirements = getPasswordRequirements(password);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailError(null);
    setError(null);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordErrors([]);
    setError(null);
  };

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    setDisplayNameError(null);
    setError(null);
  };

  const handleRegister = async () => {
    setError(null);
    setEmailError(null);
    setPasswordErrors([]);
    setDisplayNameError(null);

    let hasErrors = false;

    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      setEmailError(emailValidationError);
      hasErrors = true;
    }

    const passwordValidationErrors = validatePassword(password);
    if (passwordValidationErrors.length > 0) {
      setPasswordErrors(passwordValidationErrors);
      hasErrors = true;
    }

    const displayNameValidationError = validateDisplayName(displayName);
    if (displayNameValidationError) {
      setDisplayNameError(displayNameValidationError);
      hasErrors = true;
    }

    if (hasErrors) {
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password, displayName);
      navigation.navigate('VerifyEmail', { email: email.trim().toLowerCase() });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'RATE_LIMITED') {
          setError('Too many attempts. Please try again later.');
        } else if (err.details?.email) {
          setEmailError(err.details.email[0]);
        } else if (err.details?.password) {
          setPasswordErrors(err.details.password);
        } else if (err.details?.displayName) {
          setDisplayNameError(err.details.displayName[0]);
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
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Start tracking your expenses</Text>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Display Name</Text>
                <TextInput
                  style={[styles.input, displayNameError && styles.inputError]}
                  value={displayName}
                  onChangeText={handleDisplayNameChange}
                  placeholder="Enter your name"
                  placeholderTextColor="#64748b"
                  autoCapitalize="words"
                  autoComplete="name"
                  editable={!isLoading}
                />
                {displayNameError && (
                  <Text style={styles.fieldError}>{displayNameError}</Text>
                )}
              </View>

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
                  style={[
                    styles.input,
                    passwordErrors.length > 0 && styles.inputError,
                  ]}
                  value={password}
                  onChangeText={handlePasswordChange}
                  onFocus={() => setShowPasswordRequirements(true)}
                  onBlur={() => setShowPasswordRequirements(false)}
                  placeholder="Create a password"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password-new"
                  editable={!isLoading}
                />
                {(showPasswordRequirements || password.length > 0) && (
                  <View style={styles.requirementsContainer}>
                    {passwordRequirements.map((req, index) => (
                      <View key={index} style={styles.requirement}>
                        <Text
                          style={[
                            styles.requirementText,
                            req.met && styles.requirementMet,
                          ]}
                        >
                          {req.met ? '\u2713' : '\u2022'} {req.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                {passwordErrors.length > 0 && !showPasswordRequirements && (
                  <Text style={styles.fieldError}>
                    {passwordErrors.join(', ')}
                  </Text>
                )}
              </View>

              <Pressable
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <Text style={styles.buttonText}>Create Account</Text>
                )}
              </Pressable>
            </View>

            <Pressable
              style={styles.link}
              onPress={() => navigation.navigate('Login')}
              disabled={isLoading}
            >
              <Text style={styles.linkText}>
                Already have an account? Sign in
              </Text>
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
  requirementsContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  requirement: {
    marginVertical: 2,
  },
  requirementText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  requirementMet: {
    color: '#22c55e',
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
  link: {
    padding: 12,
  },
  linkText: {
    color: '#38bdf8',
    textAlign: 'center',
  },
});
