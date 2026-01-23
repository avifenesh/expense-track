import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { Currency } from '../types'
import { formatCurrency } from '../utils/format'
import { getBudgetProgress, isBudgetOver } from '../utils/budget'

interface BudgetProgressCardProps {
  totalPlanned: number
  totalSpent: number
  currency: Currency
  testID?: string
}

export function BudgetProgressCard({ totalPlanned, totalSpent, currency, testID }: BudgetProgressCardProps) {
  const progress = getBudgetProgress(totalPlanned, totalSpent)
  const isOverBudget = isBudgetOver(totalPlanned, totalSpent)
  const progressColor = isOverBudget ? '#ef4444' : '#38bdf8'
  const remaining = totalPlanned - totalSpent
  const showBudgetDetails = totalPlanned > 0 || totalSpent > 0

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.label}>This Month</Text>
      <Text style={styles.spent}>{formatCurrency(totalSpent, currency)}</Text>
      {showBudgetDetails ? (
        <>
          <Text style={styles.budgetText}>of {formatCurrency(totalPlanned, currency)} budget</Text>
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: progressColor,
                },
              ]}
            />
          </View>
          <Text style={[styles.remainingText, isOverBudget && styles.overBudget]}>
            {isOverBudget
              ? `${formatCurrency(Math.abs(remaining), currency)} over budget`
              : `${formatCurrency(remaining, currency)} remaining`}
          </Text>
        </>
      ) : (
        <Text style={styles.noBudgetText}>No budget set for this month</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  spent: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  budgetText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  progressContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  remainingText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  overBudget: {
    color: '#ef4444',
  },
  noBudgetText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
})
