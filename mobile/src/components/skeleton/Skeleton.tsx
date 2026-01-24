import React, { useRef, useEffect } from 'react'
import { Animated, StyleSheet, ViewStyle, StyleProp, DimensionValue } from 'react-native'

interface SkeletonProps {
  width: number | string
  height: number
  borderRadius?: number
  style?: StyleProp<ViewStyle>
  testID?: string
}

const ANIMATION_DURATION = 800
const MIN_OPACITY = 0.3
const MAX_OPACITY = 0.7

export function Skeleton({ width, height, borderRadius = 4, style, testID }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(MIN_OPACITY)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: MAX_OPACITY,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: MIN_OPACITY,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ])
    )

    animation.start()

    return () => {
      animation.stop()
    }
  }, [opacity])

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as DimensionValue,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    />
  )
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#334155',
  },
})
