import React, { memo } from 'react'
import { View, StyleSheet } from 'react-native'
import { Skeleton } from './Skeleton'

interface SkeletonDateSectionHeaderProps {
  testID?: string
}

function SkeletonDateSectionHeaderComponent({ testID }: SkeletonDateSectionHeaderProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Skeleton
        width={120}
        height={14}
        borderRadius={4}
        testID={testID ? `${testID}.title` : undefined}
      />
    </View>
  )
}

export const SkeletonDateSectionHeader = memo(SkeletonDateSectionHeaderComponent)

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 4,
  },
})
