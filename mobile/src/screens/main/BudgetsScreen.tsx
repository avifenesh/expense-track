import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MainTabScreenProps } from '../../navigation/types';

export function BudgetsScreen(_props: MainTabScreenProps<'Budgets'>) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Budgets</Text>
        <Text style={styles.subtitle}>Track your spending by category</Text>

        <View style={styles.overviewCard}>
          <Text style={styles.overviewLabel}>Monthly Budget</Text>
          <Text style={styles.overviewAmount}>$2,000.00</Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '62%' }]} />
            </View>
            <Text style={styles.progressText}>62% spent</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category Budgets</Text>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              Budget list will be implemented in task #77
            </Text>
          </View>
        </View>
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
    paddingBottom: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 24,
  },
  overviewCard: {
    padding: 24,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 24,
  },
  overviewLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  overviewAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#38bdf8',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  placeholder: {
    padding: 48,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  placeholderText: {
    color: '#64748b',
    textAlign: 'center',
  },
});
