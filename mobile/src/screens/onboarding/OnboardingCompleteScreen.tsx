import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OnboardingScreenProps } from '../../navigation/types';

export function OnboardingCompleteScreen({
  navigation,
}: OnboardingScreenProps<'OnboardingComplete'>) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.stepIndicator}>Step 5 of 6</Text>
        <View style={styles.successIcon}>
          <Text style={styles.successEmoji}>✓</Text>
        </View>
        <Text style={styles.title}>All Set!</Text>
        <Text style={styles.subtitle}>
          Your expense tracker is ready to use
        </Text>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Currency</Text>
            <Text style={styles.summaryValue}>USD</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Categories</Text>
            <Text style={styles.summaryValue}>8 selected</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Monthly Budget</Text>
            <Text style={styles.summaryValue}>$2,000</Text>
          </View>
        </View>

        <Pressable
          style={styles.button}
          onPress={() => navigation.navigate('OnboardingBiometric')}
          testID="continue-button"
        >
          <Text style={styles.buttonText}>Continue</Text>
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
  stepIndicator: {
    fontSize: 14,
    color: '#38bdf8',
    marginBottom: 24,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34,197,94,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successEmoji: {
    fontSize: 40,
    color: '#22c55e',
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
  },
  summaryContainer: {
    width: '100%',
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    marginBottom: 32,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  summaryLabel: {
    fontSize: 16,
    color: '#94a3b8',
  },
  summaryValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  button: {
    width: '100%',
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
