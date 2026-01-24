import React from 'react'
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native'
import { Skeleton } from './Skeleton'

interface SkeletonStatCardProps {
  style?: StyleProp<ViewStyle>
  testID?: string
}

export function SkeletonStatCard({ style, testID }: SkeletonStatCardProps) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      <Skeleton
        width={60}
        height={14}
        borderRadius={4}
        style={styles.label}
        testID={testID ? `${testID}.label` : undefined}
      />
      <Skeleton
        width={90}
        height={20}
        borderRadius={4}
        testID={testID ? `${testID}.amount` : undefined}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
  },
  label: {
    marginBottom: 4,
  },
})
