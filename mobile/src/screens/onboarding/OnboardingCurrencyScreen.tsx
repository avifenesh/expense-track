import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OnboardingScreenProps } from '../../navigation/types';
import { useOnboardingStore, type Currency } from '../../stores';

const CURRENCIES = [
  { code: 'USD' as Currency, symbol: '$', name: 'USD - US Dollar' },
  { code: 'EUR' as Currency, symbol: '€', name: 'EUR - Euro' },
  { code: 'ILS' as Currency, symbol: '₪', name: 'ILS - Israeli Shekel' },
];

export function OnboardingCurrencyScreen({
  navigation,
}: OnboardingScreenProps<'OnboardingCurrency'>) {
  const { selectedCurrency, setCurrency } = useOnboardingStore();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.stepIndicator}>Step 1 of 5</Text>
        <Text style={styles.title}>Choose Currency</Text>
        <Text style={styles.subtitle}>
          Select your preferred currency for tracking expenses
        </Text>

        <View style={styles.optionsContainer}>
          {CURRENCIES.map((currency) => (
            <Pressable
              key={currency.code}
              style={[
                styles.option,
                selectedCurrency === currency.code && styles.optionSelected,
              ]}
              onPress={() => setCurrency(currency.code)}
            >
              <Text style={styles.optionSymbol}>{currency.symbol}</Text>
              <Text style={styles.optionText}>{currency.name}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={styles.button}
          onPress={() => navigation.navigate('OnboardingCategories')}
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56,189,248,0.1)',
  },
  optionSymbol: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    width: 48,
  },
  optionText: {
    fontSize: 16,
    color: '#fff',
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
