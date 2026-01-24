import React, { memo } from 'react'
import { View, StyleSheet } from 'react-native'
import { Skeleton } from './Skeleton'

interface SkeletonSharedExpenseCardProps {
  testID?: string
}

function SkeletonSharedExpenseCardComponent({ testID }: SkeletonSharedExpenseCardProps) {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <Skeleton
          width="70%"
          height={16}
          borderRadius={4}
          testID={testID ? `${testID}.title` : undefined}
        />
        <Skeleton
          width={60}
          height={20}
          borderRadius={4}
          testID={testID ? `${testID}.status` : undefined}
        />
      </View>
      <Skeleton
        width={150}
        height={13}
        borderRadius={4}
        style={styles.subtitle}
        testID={testID ? `${testID}.subtitle` : undefined}
      />
      <View style={styles.footer}>
        <Skeleton
          width={80}
          height={13}
          borderRadius={4}
          testID={testID ? `${testID}.category` : undefined}
        />
        <Skeleton
          width={70}
          height={15}
          borderRadius={4}
          testID={testID ? `${testID}.amount` : undefined}
        />
      </View>
    </View>
  )
}

export const SkeletonSharedExpenseCard = memo(SkeletonSharedExpenseCardComponent)

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
})
