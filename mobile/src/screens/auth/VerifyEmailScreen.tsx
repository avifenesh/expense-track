import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthScreenProps } from '../../navigation/types';
import { resendVerification } from '../../services/auth';
import { ApiError } from '../../services/api';

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmailScreen({
  route,
  navigation,
}: AuthScreenProps<'VerifyEmail'>) {
  const { email } = route.params;
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setCooldownSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleResendEmail = useCallback(async () => {
    if (cooldownSeconds > 0 || isResending) return;

    setIsResending(true);
    setResendMessage(null);
    setResendError(null);

    try {
      await resendVerification(email);
      setResendMessage('Verification email sent. Please check your inbox.');
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'RATE_LIMITED') {
          setResendError('Too many requests. Please wait before trying again.');
          setCooldownSeconds(RESEND_COOLDOWN_SECONDS * 2);
        } else {
          setResendError(err.message);
        }
      } else {
        setResendError('Failed to resend email. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  }, [email, cooldownSeconds, isResending]);

  return (
    <SafeAreaView style={styles.container} testID="verifyEmail.screen">
      <View style={styles.content}>
        <View style={styles.iconContainer} testID="verifyEmail.icon">
          <Text style={styles.icon}>@</Text>
        </View>

        <Text style={styles.title} testID="verifyEmail.title">Check Your Email</Text>
        <Text style={styles.subtitle} testID="verifyEmail.subtitle">
          We sent a verification link to{'\n'}
          <Text style={styles.email} testID="verifyEmail.email">{email}</Text>
        </Text>

        <View style={styles.instructionsContainer} testID="verifyEmail.instructions">
          <Text style={styles.instructionsText}>
            Click the link in the email to verify your account. If you don&apos;t see it, check your spam folder.
          </Text>
        </View>

        {resendMessage && (
          <View style={styles.successContainer} testID="verifyEmail.successContainer">
            <Text style={styles.successText} testID="verifyEmail.successText">{resendMessage}</Text>
          </View>
        )}

        {resendError && (
          <View style={styles.errorContainer} testID="verifyEmail.errorContainer">
            <Text style={styles.errorText} testID="verifyEmail.errorText">{resendError}</Text>
          </View>
        )}

        <Pressable
          style={[
            styles.resendButton,
            (isResending || cooldownSeconds > 0) && styles.resendButtonDisabled,
          ]}
          onPress={handleResendEmail}
          disabled={isResending || cooldownSeconds > 0}
          testID="verifyEmail.resendButton"
        >
          {isResending ? (
            <ActivityIndicator color="#38bdf8" testID="verifyEmail.resendButton-loading" />
          ) : cooldownSeconds > 0 ? (
            <Text style={styles.resendButtonTextDisabled} testID="verifyEmail.resendCooldown">
              Resend in {cooldownSeconds}s
            </Text>
          ) : (
            <Text style={styles.resendButtonText}>Resend Email</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.link}
          onPress={() => navigation.navigate('Login')}
          testID="verifyEmail.backButton"
        >
          <Text style={styles.linkText}>Back to Sign In</Text>
        </Pressable>
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
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  email: {
    color: '#fff',
    fontWeight: '600',
  },
  instructionsContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  instructionsText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
  successContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  successText: {
    color: '#22c55e',
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  resendButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  resendButtonDisabled: {
    borderColor: '#64748b',
  },
  resendButtonText: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButtonTextDisabled: {
    color: '#64748b',
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
