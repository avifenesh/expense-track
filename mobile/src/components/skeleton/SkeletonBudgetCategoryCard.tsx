import React, { memo } from 'react'
import { View, StyleSheet } from 'react-native'
import { Skeleton } from './Skeleton'

interface SkeletonBudgetCategoryCardProps {
  testID?: string
}

function SkeletonBudgetCategoryCardComponent({ testID }: SkeletonBudgetCategoryCardProps) {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <View style={styles.categoryInfo}>
          <Skeleton
            width={10}
            height={10}
            borderRadius={5}
            style={styles.categoryDot}
            testID={testID ? `${testID}.categoryDot` : undefined}
          />
          <Skeleton
            width="50%"
            height={15}
            borderRadius={4}
            testID={testID ? `${testID}.categoryName` : undefined}
          />
        </View>
        <Skeleton
          width={100}
          height={14}
          borderRadius={4}
          testID={testID ? `${testID}.amounts` : undefined}
        />
      </View>
      <View style={styles.progressContainer}>
        <Skeleton
          width="35%"
          height={6}
          borderRadius={3}
          testID={testID ? `${testID}.progress` : undefined}
        />
      </View>
    </View>
  )
}

export const SkeletonBudgetCategoryCard = memo(SkeletonBudgetCategoryCardComponent)

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  categoryDot: {
    marginRight: 10,
  },
  progressContainer: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
})
