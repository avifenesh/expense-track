import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OnboardingScreenProps } from '../../navigation/types';

export function OnboardingSampleDataScreen({
  navigation,
}: OnboardingScreenProps<'OnboardingSampleData'>) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.stepIndicator}>Step 4 of 5</Text>
        <Text style={styles.title}>Sample Data</Text>
        <Text style={styles.subtitle}>
          Want to explore with sample transactions?
        </Text>

        <View style={styles.optionsContainer}>
          <Pressable style={[styles.option, styles.optionSelected]}>
            <Text style={styles.optionTitle}>Yes, add samples</Text>
            <Text style={styles.optionDescription}>
              See how the app works with realistic data
            </Text>
          </Pressable>
          <Pressable style={styles.option}>
            <Text style={styles.optionTitle}>No, start fresh</Text>
            <Text style={styles.optionDescription}>
              Begin with a clean slate
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.button}
          onPress={() => navigation.navigate('OnboardingComplete')}
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
  },
  stepIndicator: {
    fontSize: 14,
    color: '#38bdf8',
    marginBottom: 8,
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
  optionsContainer: {
    marginBottom: 32,
  },
  option: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56,189,248,0.1)',
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#94a3b8',
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
