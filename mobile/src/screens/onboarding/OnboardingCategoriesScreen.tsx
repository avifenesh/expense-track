import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OnboardingScreenProps } from '../../navigation/types';

const DEFAULT_CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Education',
  'Travel',
];

export function OnboardingCategoriesScreen({
  navigation,
}: OnboardingScreenProps<'OnboardingCategories'>) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.stepIndicator}>Step 2 of 5</Text>
        <Text style={styles.title}>Categories</Text>
        <Text style={styles.subtitle}>
          Select the expense categories you want to track
        </Text>

        <View style={styles.categoriesContainer}>
          {DEFAULT_CATEGORIES.map((category) => (
            <Pressable key={category} style={styles.category}>
              <Text style={styles.categoryText}>{category}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={styles.button}
          onPress={() => navigation.navigate('OnboardingBudget')}
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
    backgroundColor: 'rgba(56,189,248,0.1)',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#38bdf8',
  },
  categoryText: {
    fontSize: 14,
    color: '#38bdf8',
    fontWeight: '500',
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
