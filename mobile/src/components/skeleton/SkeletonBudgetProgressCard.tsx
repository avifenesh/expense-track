import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Skeleton } from './Skeleton'

interface SkeletonBudgetProgressCardProps {
  testID?: string
}

export function SkeletonBudgetProgressCard({ testID }: SkeletonBudgetProgressCardProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Skeleton
        width={80}
        height={14}
        borderRadius={4}
        style={styles.label}
        testID={testID ? `${testID}.label` : undefined}
      />
      <Skeleton
        width={150}
        height={36}
        borderRadius={4}
        style={styles.spent}
        testID={testID ? `${testID}.spent` : undefined}
      />
      <Skeleton
        width={120}
        height={14}
        borderRadius={4}
        style={styles.budgetText}
        testID={testID ? `${testID}.budgetText` : undefined}
      />
      <View style={styles.progressContainer}>
        <Skeleton
          width="40%"
          height={8}
          borderRadius={4}
          testID={testID ? `${testID}.progress` : undefined}
        />
      </View>
      <Skeleton
        width={100}
        height={13}
        borderRadius={4}
        testID={testID ? `${testID}.remaining` : undefined}
      />
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
    marginBottom: 8,
  },
  spent: {
    marginBottom: 4,
  },
  budgetText: {
    marginBottom: 12,
  },
  progressContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
})
