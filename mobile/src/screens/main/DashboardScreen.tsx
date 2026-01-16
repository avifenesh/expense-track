import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MainTabScreenProps } from '../../navigation/types';

export function DashboardScreen(_props: MainTabScreenProps<'Dashboard'>) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Your financial overview</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>This Month</Text>
          <Text style={styles.cardAmount}>$1,234.56</Text>
          <Text style={styles.cardSubtext}>spent of $2,000 budget</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.incomeCard]}>
            <Text style={styles.statLabel}>Income</Text>
            <Text style={[styles.statAmount, styles.incomeAmount]}>+$3,500</Text>
          </View>
          <View style={[styles.statCard, styles.expenseCard]}>
            <Text style={styles.statLabel}>Expenses</Text>
            <Text style={[styles.statAmount, styles.expenseAmount]}>-$1,234</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              Transaction list will be implemented in task #75
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
  card: {
    padding: 24,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  cardAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  cardSubtext: {
    fontSize: 14,
    color: '#64748b',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
  },
  incomeCard: {
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  expenseCard: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  statLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
  },
  statAmount: {
    fontSize: 20,
    fontWeight: '700',
  },
  incomeAmount: {
    color: '#22c55e',
  },
  expenseAmount: {
    color: '#ef4444',
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
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  placeholderText: {
    color: '#64748b',
    textAlign: 'center',
  },
});
