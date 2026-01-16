import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthScreenProps } from '../../navigation/types';

export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Sign In</Text>
        <Text style={styles.subtitle}>Welcome back to Expense Track</Text>

        <View style={styles.formPlaceholder}>
          <Text style={styles.placeholderText}>
            Login form will be implemented in task #70
          </Text>
        </View>

        <Pressable
          style={styles.link}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.linkText}>Don&apos;t have an account? Register</Text>
        </Pressable>

        <Pressable
          style={styles.link}
          onPress={() => navigation.navigate('ResetPassword', {})}
        >
          <Text style={styles.linkText}>Forgot password?</Text>
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
  formPlaceholder: {
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    marginBottom: 24,
  },
  placeholderText: {
    color: '#64748b',
    textAlign: 'center',
  },
  link: {
    padding: 12,
  },
  linkText: {
    color: '#38bdf8',
    textAlign: 'center',
  },
});
