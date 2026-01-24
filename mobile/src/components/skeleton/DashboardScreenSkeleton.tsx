import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SkeletonBudgetProgressCard } from './SkeletonBudgetProgressCard'
import { SkeletonStatCard } from './SkeletonStatCard'
import { SkeletonTransactionItem } from './SkeletonTransactionItem'

interface DashboardScreenSkeletonProps {
  testID?: string
}

export function DashboardScreenSkeleton({ testID }: DashboardScreenSkeletonProps) {
  return (
    <View
      style={styles.container}
      testID={testID}
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading dashboard"
    >
      <View style={styles.monthSelector}>
        <Text style={styles.monthPlaceholder}>Loading...</Text>
      </View>

      <SkeletonBudgetProgressCard testID={testID ? `${testID}.budgetProgressCard` : undefined} />

      <View style={styles.statsRow}>
        <SkeletonStatCard
          style={styles.incomeCard}
          testID={testID ? `${testID}.incomeCard` : undefined}
        />
        <SkeletonStatCard
          style={styles.expenseCard}
          testID={testID ? `${testID}.expenseCard` : undefined}
        />
      </View>

      <Text style={styles.sectionTitle}>Recent Transactions</Text>

      {[0, 1, 2, 3, 4].map((index) => (
        <SkeletonTransactionItem
          key={index}
          testID={testID ? `${testID}.transaction.${index}` : undefined}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  monthSelector: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  monthPlaceholder: {
    fontSize: 14,
    color: '#64748b',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  incomeCard: {
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  expenseCard: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    marginTop: 8,
  },
})
