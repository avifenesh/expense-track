import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OnboardingScreenProps } from '../../navigation/types';
import { useOnboardingStore } from '../../stores';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../../constants/categories';

const DEFAULT_CATEGORIES = [
  ...DEFAULT_EXPENSE_CATEGORIES.map(c => c.name),
  ...DEFAULT_INCOME_CATEGORIES.map(c => c.name),
];

export function OnboardingCategoriesScreen({
  navigation,
}: OnboardingScreenProps<'OnboardingCategories'>) {
  const { selectedCategories, toggleCategory } = useOnboardingStore();

  return (
    <SafeAreaView style={styles.container} testID="onboarding.categories.screen">
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} testID="onboarding.categories.scrollView">
        <Text style={styles.stepIndicator} testID="onboarding.categories.stepIndicator">Step 2 of 5</Text>
        <Text style={styles.title} testID="onboarding.categories.title">Categories</Text>
        <Text style={styles.subtitle} testID="onboarding.categories.subtitle">
          Select the expense categories you want to track
        </Text>

        <View style={styles.categoriesContainer} testID="onboarding.categories.list">
          {DEFAULT_CATEGORIES.map((category) => {
            const isSelected = selectedCategories.includes(category);
            return (
              <Pressable
                key={category}
                style={[styles.category, isSelected && styles.categorySelected]}
                onPress={() => toggleCategory(category)}
                testID={`onboarding.categories.item.${category.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
              >
                <Text style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>
                  {isSelected && '✓ '}
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={styles.button}
          onPress={() => navigation.navigate('OnboardingBudget')}
          testID="onboarding.categories.continueButton"
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
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
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 32,
    gap: 12,
  },
  category: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categorySelected: {
    backgroundColor: 'rgba(56,189,248,0.1)',
    borderColor: '#38bdf8',
  },
  categoryText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  categoryTextSelected: {
    color: '#38bdf8',
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
