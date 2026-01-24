import React, { memo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SkeletonBudgetProgressCard } from './SkeletonBudgetProgressCard'
import { SkeletonBudgetCategoryCard } from './SkeletonBudgetCategoryCard'

interface BudgetsScreenSkeletonProps {
  testID?: string
}

function BudgetsScreenSkeletonComponent({ testID }: BudgetsScreenSkeletonProps) {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.monthSelector}>
        <Text style={styles.monthPlaceholder}>Loading...</Text>
      </View>

      <SkeletonBudgetProgressCard testID={testID ? `${testID}.budgetProgressCard` : undefined} />

      <Text style={styles.sectionTitle}>Category Budgets</Text>

      {[0, 1, 2, 3].map((index) => (
        <SkeletonBudgetCategoryCard
          key={index}
          testID={testID ? `${testID}.categoryCard.${index}` : undefined}
        />
      ))}
    </View>
  )
}

export const BudgetsScreenSkeleton = memo(BudgetsScreenSkeletonComponent)

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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    marginTop: 8,
  },
})
