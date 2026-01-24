import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { OnboardingScreenProps } from '../../navigation/types'
import { useOnboardingStore } from '../../stores'
import { CURRENCY_SYMBOLS } from '../../constants/categories'

export function OnboardingBudgetScreen({ navigation }: OnboardingScreenProps<'OnboardingBudget'>) {
  // Select only STATE values, not functions, to prevent re-render loops
  // Functions are accessed via getState() within callbacks
  const selectedCurrency = useOnboardingStore((state) => state.selectedCurrency)
  const monthlyBudget = useOnboardingStore((state) => state.monthlyBudget)
  const [inputValue, setInputValue] = useState(monthlyBudget ? monthlyBudget.toString() : '')

  const currencySymbol = CURRENCY_SYMBOLS[selectedCurrency]

  const handleSetBudget = () => {
    const amount = parseFloat(inputValue)
    if (!isNaN(amount) && amount >= 0) {
      useOnboardingStore.getState().setBudget(amount)
      navigation.navigate('OnboardingSampleData')
    }
  }

  const handleSkip = () => {
    useOnboardingStore.getState().setBudget(null)
    navigation.navigate('OnboardingSampleData')
  }

  return (
    <SafeAreaView style={styles.container} testID="onboarding.budget.screen">
      <View style={styles.content} testID="onboarding.budget.content">
        <Text style={styles.stepIndicator} testID="onboarding.budget.stepIndicator">
          Step 3 of 5
        </Text>
        <Text style={styles.title} testID="onboarding.budget.title">
          Set Budget
        </Text>
        <Text style={styles.subtitle} testID="onboarding.budget.subtitle">
          Set your monthly budget to track spending
        </Text>

        <View style={styles.budgetInput} testID="onboarding.budget.inputContainer">
          <Text style={styles.budgetSymbol} testID="onboarding.budget.currencySymbol">
            {currencySymbol}
          </Text>
          <TextInput
            style={styles.budgetAmountInput}
            value={inputValue}
            onChangeText={setInputValue}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#64748b"
            testID="onboarding.budget.amountInput"
          />
          <Text style={styles.budgetPeriod}>/month</Text>
        </View>

        <View style={styles.infoBox} testID="onboarding.budget.infoBox">
          <Text style={styles.infoText}>You can adjust this later and set category-specific budgets</Text>
        </View>

        <View style={styles.buttonContainer}>
          <Pressable style={styles.skipButton} onPress={handleSkip} testID="onboarding.budget.skipButton">
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={handleSetBudget} testID="onboarding.budget.setBudgetButton">
            <Text style={styles.buttonText}>Set Budget</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
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
})
