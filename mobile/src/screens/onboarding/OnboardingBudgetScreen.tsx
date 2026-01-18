import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OnboardingScreenProps } from '../../navigation/types';
import { useOnboardingStore } from '../../stores';
import { CURRENCY_SYMBOLS } from '../../constants/categories';

export function OnboardingBudgetScreen({
  navigation,
}: OnboardingScreenProps<'OnboardingBudget'>) {
  const { selectedCurrency, monthlyBudget, setBudget } = useOnboardingStore();
  const [inputValue, setInputValue] = useState(
    monthlyBudget ? monthlyBudget.toString() : '2000'
  );

  const currencySymbol = CURRENCY_SYMBOLS[selectedCurrency];

  const handleSetBudget = () => {
    const amount = parseFloat(inputValue);
    if (!isNaN(amount) && amount >= 0) {
      setBudget(amount);
      navigation.navigate('OnboardingSampleData');
    }
  };

  const handleSkip = () => {
    setBudget(null);
    navigation.navigate('OnboardingSampleData');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.stepIndicator}>Step 3 of 5</Text>
        <Text style={styles.title}>Set Budget</Text>
        <Text style={styles.subtitle}>
          Set your monthly budget to track spending
        </Text>

        <View style={styles.budgetInput}>
          <Text style={styles.budgetSymbol}>{currencySymbol}</Text>
          <TextInput
            style={styles.budgetAmountInput}
            value={inputValue}
            onChangeText={setInputValue}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#64748b"
          />
          <Text style={styles.budgetPeriod}>/month</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            You can adjust this later and set category-specific budgets
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Pressable style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={handleSetBudget}>
            <Text style={styles.buttonText}>Set Budget</Text>
          </Pressable>
        </View>
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
  budgetInput: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    marginBottom: 16,
  },
  budgetSymbol: {
    fontSize: 32,
    fontWeight: '500',
    color: '#94a3b8',
    marginRight: 4,
  },
  budgetAmountInput: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    minWidth: 100,
    textAlign: 'center',
  },
  budgetPeriod: {
    fontSize: 16,
    color: '#94a3b8',
    marginLeft: 8,
  },
  infoBox: {
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 32,
  },
  infoText: {
    color: '#64748b',
    textAlign: 'center',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#38bdf8',
  },
  skipButtonText: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    flex: 1,
    backgroundColor: '#38bdf8',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
});
