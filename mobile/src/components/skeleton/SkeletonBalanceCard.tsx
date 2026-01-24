import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Skeleton } from './Skeleton'

interface SkeletonBalanceCardProps {
  testID?: string
}

export function SkeletonBalanceCard({ testID }: SkeletonBalanceCardProps) {
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
        width={180}
        height={36}
        borderRadius={4}
        style={styles.amount}
        testID={testID ? `${testID}.amount` : undefined}
      />
      <Skeleton
        width={140}
        height={14}
        borderRadius={4}
        testID={testID ? `${testID}.subtext` : undefined}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  label: {
    marginBottom: 8,
  },
  amount: {
    marginBottom: 4,
  },
})
