import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OnboardingScreenProps } from '../../navigation/types';

export function OnboardingWelcomeScreen({
  navigation,
}: OnboardingScreenProps<'OnboardingWelcome'>) {
  return (
    <SafeAreaView style={styles.container} testID="onboarding.welcome.screen">
      <View style={styles.content}>
        <Text style={styles.title} testID="onboarding.welcome.title">
          Welcome
        </Text>
        <Text style={styles.subtitle}>
          Let&apos;s set up your expense tracking
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            We&apos;ll guide you through a few steps to personalize your
            experience
          </Text>
        </View>

        <Pressable
          style={styles.button}
          onPress={() => navigation.navigate('OnboardingCurrency')}
          testID="onboarding.welcome.getStartedButton"
        >
          <Text style={styles.buttonText}>Get Started</Text>
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
  infoBox: {
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    marginBottom: 32,
  },
  infoText: {
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#38bdf8',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
});
