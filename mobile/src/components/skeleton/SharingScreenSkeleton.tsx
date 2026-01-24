import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SkeletonBalanceCard } from './SkeletonBalanceCard'
import { SkeletonSharedExpenseCard } from './SkeletonSharedExpenseCard'

interface SharingScreenSkeletonProps {
  testID?: string
}

export function SharingScreenSkeleton({ testID }: SharingScreenSkeletonProps) {
  return (
    <View
      style={styles.container}
      testID={testID}
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading sharing"
    >
      <View style={styles.balanceGroup}>
        <SkeletonBalanceCard testID={testID ? `${testID}.balanceCard` : undefined} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Shared With You</Text>
        {[0, 1].map((index) => (
          <SkeletonSharedExpenseCard
            key={`shared-with-${index}`}
            testID={testID ? `${testID}.sharedWithMe.${index}` : undefined}
          />
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>You Shared</Text>
        {[0, 1].map((index) => (
          <SkeletonSharedExpenseCard
            key={`shared-by-${index}`}
            testID={testID ? `${testID}.sharedByMe.${index}` : undefined}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  balanceGroup: {
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
})
