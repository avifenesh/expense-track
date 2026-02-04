import React, { useRef, useEffect } from 'react'
import { Animated, StyleSheet, ViewStyle, StyleProp, DimensionValue } from 'react-native'

interface SkeletonProps {
  width: number | string
  height: number
  borderRadius?: number
  style?: StyleProp<ViewStyle>
  testID?: string
  /** Set to false to hide from accessibility tree (for nested skeletons) */
  accessible?: boolean
}

const ANIMATION_DURATION = 800
const MIN_OPACITY = 0.3
const MAX_OPACITY = 0.7

export function Skeleton({ width, height, borderRadius = 4, style, testID, accessible = false }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(MIN_OPACITY)).current

  useEffect(() => {
    // Using useNativeDriver: false to avoid blocking Detox synchronization.
    // Native driver animations run on the UI thread and keep Fabric UI Manager
    // in a "busy" state, preventing Detox from ever reaching "idle" state.
    // For skeleton loading indicators, JS-driven opacity animation has
    // negligible performance difference and allows E2E tests to run correctly.
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: MAX_OPACITY,
          duration: ANIMATION_DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: MIN_OPACITY,
          duration: ANIMATION_DURATION,
          useNativeDriver: false,
        }),
      ]),
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
      accessible={accessible}
      accessibilityRole={accessible ? 'progressbar' : undefined}
      accessibilityLabel={accessible ? 'Loading' : undefined}
    />
  )
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#334155',
  },
})
