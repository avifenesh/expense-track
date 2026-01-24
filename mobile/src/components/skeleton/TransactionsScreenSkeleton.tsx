import React, { memo } from 'react'
import { View, StyleSheet } from 'react-native'
import { SkeletonDateSectionHeader } from './SkeletonDateSectionHeader'
import { SkeletonTransactionItem } from './SkeletonTransactionItem'

interface TransactionsScreenSkeletonProps {
  testID?: string
}

function TransactionsScreenSkeletonComponent({ testID }: TransactionsScreenSkeletonProps) {
  return (
    <View style={styles.container} testID={testID}>
      <SkeletonDateSectionHeader testID={testID ? `${testID}.section.0.header` : undefined} />
      {[0, 1, 2].map((index) => (
        <SkeletonTransactionItem
          key={`section-0-${index}`}
          testID={testID ? `${testID}.section.0.transaction.${index}` : undefined}
        />
      ))}

      <SkeletonDateSectionHeader testID={testID ? `${testID}.section.1.header` : undefined} />
      {[0, 1, 2].map((index) => (
        <SkeletonTransactionItem
          key={`section-1-${index}`}
          testID={testID ? `${testID}.section.1.transaction.${index}` : undefined}
        />
      ))}
    </View>
  )
}

export const TransactionsScreenSkeleton = memo(TransactionsScreenSkeletonComponent)

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
