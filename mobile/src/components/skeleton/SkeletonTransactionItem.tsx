import React, { memo } from 'react'
import { View, StyleSheet } from 'react-native'
import { Skeleton } from './Skeleton'

interface SkeletonTransactionItemProps {
  testID?: string
}

function SkeletonTransactionItemComponent({ testID }: SkeletonTransactionItemProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Skeleton
        width={10}
        height={10}
        borderRadius={5}
        style={styles.categoryDot}
        testID={testID ? `${testID}.categoryDot` : undefined}
      />
      <View style={styles.details}>
        <Skeleton
          width="60%"
          height={16}
          borderRadius={4}
          style={styles.description}
          testID={testID ? `${testID}.description` : undefined}
        />
        <Skeleton
          width={40}
          height={13}
          borderRadius={4}
          testID={testID ? `${testID}.date` : undefined}
        />
      </View>
      <Skeleton
        width={70}
        height={16}
        borderRadius={4}
        testID={testID ? `${testID}.amount` : undefined}
      />
    </View>
  )
}

export const SkeletonTransactionItem = memo(SkeletonTransactionItemComponent)

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 8,
  },
  categoryDot: {
    marginRight: 12,
  },
  details: {
    flex: 1,
    marginRight: 12,
  },
  description: {
    marginBottom: 4,
  },
})
