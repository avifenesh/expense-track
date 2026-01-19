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
import { requestPasswordReset, resetPassword } from '../../services/auth';
import {
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  getPasswordRequirements,
} from '../../lib/validation';
import { ApiError } from '../../services/api';

export function ResetPasswordScreen({
  route,
  navigation,
}: AuthScreenProps<'ResetPassword'>) {
  const token = route.params?.token;
  const hasToken = !!token;

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordRequirements = getPasswordRequirements(newPassword);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailError(null);
    setError(null);
  };

  const handleNewPasswordChange = (value: string) => {
    setNewPassword(value);
    setPasswordErrors([]);
    setError(null);
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    setConfirmPasswordError(null);
    setError(null);
  };

  const handleRequestReset = async () => {
    setError(null);
    setEmailError(null);

    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      setEmailError(emailValidationError);
      return;
    }

    setIsLoading(true);

    try {
      await requestPasswordReset(email);
      setRequestSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'RATE_LIMITED') {
          setError('Too many requests. Please try again later.');
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

  const handleResetPassword = async () => {
    if (!token) return;

    setError(null);
    setPasswordErrors([]);
    setConfirmPasswordError(null);

    const passwordValidationErrors = validatePassword(newPassword);
    if (passwordValidationErrors.length > 0) {
      setPasswordErrors(passwordValidationErrors);
      return;
    }

    const matchError = validatePasswordMatch(newPassword, confirmPassword);
    if (matchError) {
      setConfirmPasswordError(matchError);
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(token, newPassword);
      setResetComplete(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('This reset link has expired. Please request a new one.');
        } else if (err.details?.newPassword) {
          setPasswordErrors(err.details.newPassword);
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

  if (resetComplete) {
    return (
      <SafeAreaView style={styles.container} testID="resetPassword.completeScreen">
        <View style={styles.centerContent}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>*</Text>
          </View>
          <Text style={styles.title} testID="resetPassword.completeTitle">Password Reset</Text>
          <Text style={styles.subtitle} testID="resetPassword.completeSubtitle">
            Your password has been reset successfully.
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => navigation.navigate('Login')}
            testID="resetPassword.completeSignInButton"
          >
            <Text style={styles.buttonText}>Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (requestSent) {
    return (
      <SafeAreaView style={styles.container} testID="resetPassword.sentScreen">
        <View style={styles.centerContent}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>@</Text>
          </View>
          <Text style={styles.title} testID="resetPassword.sentTitle">Check Your Email</Text>
          <Text style={styles.subtitle} testID="resetPassword.sentSubtitle">
            If an account exists with {email}, you will receive a password reset link.
          </Text>
          <Pressable
            style={styles.link}
            onPress={() => navigation.navigate('Login')}
            testID="resetPassword.sentBackButton"
          >
            <Text style={styles.linkText}>Back to Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (hasToken) {
    return (
      <SafeAreaView style={styles.container} testID="resetPassword.newPasswordScreen">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            testID="resetPassword.newPasswordScrollView"
          >
            <View style={styles.content}>
              <Text style={styles.title} testID="resetPassword.newPasswordTitle">Create New Password</Text>
              <Text style={styles.subtitle} testID="resetPassword.newPasswordSubtitle">
                Enter your new password below
              </Text>

              {error && (
                <View style={styles.errorContainer} testID="resetPassword.newPasswordErrorContainer">
                  <Text style={styles.errorText} testID="resetPassword.newPasswordErrorText">{error}</Text>
                </View>
              )}

              <View style={styles.form} testID="resetPassword.newPasswordForm">
                <View style={styles.inputGroup}>
                  <Text style={styles.label} testID="resetPassword.newPasswordLabel">New Password</Text>
                  <TextInput
                    style={[
                      styles.input,
                      passwordErrors.length > 0 && styles.inputError,
                    ]}
                    value={newPassword}
                    onChangeText={handleNewPasswordChange}
                    onFocus={() => setShowPasswordRequirements(true)}
                    onBlur={() => setShowPasswordRequirements(false)}
                    placeholder="Enter new password"
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="password-new"
                    editable={!isLoading}
                    testID="resetPassword.newPasswordInput"
                  />
                  {(showPasswordRequirements || newPassword.length > 0) && (
                    <View style={styles.requirementsContainer} testID="resetPassword.passwordRequirements">
                      {passwordRequirements.map((req, index) => (
                        <View key={index} style={styles.requirement}>
                          <Text
                            style={[
                              styles.requirementText,
                              req.met && styles.requirementMet,
                            ]}
                            testID={`resetPassword.passwordRequirement.${index}`}
                          >
                            {req.met ? '\u2713' : '\u2022'} {req.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label} testID="resetPassword.confirmPasswordLabel">Confirm Password</Text>
                  <TextInput
                    style={[
                      styles.input,
                      confirmPasswordError && styles.inputError,
                    ]}
                    value={confirmPassword}
                    onChangeText={handleConfirmPasswordChange}
                    placeholder="Confirm new password"
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="password-new"
                    editable={!isLoading}
                    testID="resetPassword.confirmPasswordInput"
                  />
                  {confirmPasswordError && (
                    <Text style={styles.fieldError} testID="resetPassword.confirmPasswordInput-error">{confirmPasswordError}</Text>
                  )}
                </View>

                <Pressable
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleResetPassword}
                  disabled={isLoading}
                  testID="resetPassword.submitButton"
                >
                  {isLoading ? (
                    <ActivityIndicator color="#0f172a" testID="resetPassword.submitButton-loading" />
                  ) : (
                    <Text style={styles.buttonText}>Reset Password</Text>
                  )}
                </Pressable>
              </View>

              <Pressable
                style={styles.link}
                onPress={() => navigation.navigate('Login')}
                disabled={isLoading}
                testID="resetPassword.newPasswordBackButton"
              >
                <Text style={styles.linkText}>Back to Sign In</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} testID="resetPassword.screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          testID="resetPassword.scrollView"
        >
          <View style={styles.content}>
            <Text style={styles.title} testID="resetPassword.title">Reset Password</Text>
            <Text style={styles.subtitle} testID="resetPassword.subtitle">
              Enter your email to receive a reset link
            </Text>

            {error && (
              <View style={styles.errorContainer} testID="resetPassword.errorContainer">
                <Text style={styles.errorText} testID="resetPassword.errorText">{error}</Text>
              </View>
            )}

            <View style={styles.form} testID="resetPassword.form">
              <View style={styles.inputGroup}>
                <Text style={styles.label} testID="resetPassword.emailLabel">Email</Text>
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
                  testID="resetPassword.emailInput"
                />
                {emailError && (
                  <Text style={styles.fieldError} testID="resetPassword.emailInput-error">{emailError}</Text>
                )}
              </View>

              <Pressable
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleRequestReset}
                disabled={isLoading}
                testID="resetPassword.requestButton"
              >
                {isLoading ? (
                  <ActivityIndicator color="#0f172a" testID="resetPassword.requestButton-loading" />
                ) : (
                  <Text style={styles.buttonText}>Send Reset Link</Text>
                )}
              </Pressable>
            </View>

            <Pressable
              style={styles.link}
              onPress={() => navigation.navigate('Login')}
              disabled={isLoading}
              testID="resetPassword.backButton"
            >
              <Text style={styles.linkText}>Back to Sign In</Text>
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
  centerContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 36,
    color: '#38bdf8',
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
