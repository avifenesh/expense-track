import React, { useEffect, useRef, useCallback, useState } from 'react'
import { Animated, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useToastStore, type ToastType } from '../stores/toastStore'

const TOAST_COLORS: Record<ToastType, string> = {
  success: '#22c55e',
  error: '#ef4444',
  info: '#38bdf8',
}

const ANIMATION_DURATION = 250

export function Toast() {
  const insets = useSafeAreaInsets()
  // Use individual selectors to prevent unnecessary re-renders
  const visible = useToastStore((state) => state.visible)
  const message = useToastStore((state) => state.message)
  const type = useToastStore((state) => state.type)
  const duration = useToastStore((state) => state.duration)
  const toastId = useToastStore((state) => state.toastId)

  const translateY = useRef(new Animated.Value(-100)).current
  const opacity = useRef(new Animated.Value(0)).current
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const toastIdRef = useRef(toastId) // Track which toast we're animating
  const [isRendered, setIsRendered] = useState(false)

  const animateOut = useCallback(() => {
    // Capture current toast ID to check in animation callback
    const animatingToastId = toastIdRef.current
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Only hide if this is still the current toast (no newer toast was shown)
      if (useToastStore.getState().toastId === animatingToastId) {
        setIsRendered(false)
        useToastStore.getState().hideToast()
      }
    })
  }, [translateY, opacity])

  useEffect(() => {
    // Keep the ref in sync with the current toast ID
    toastIdRef.current = toastId
  }, [toastId])

  useEffect(() => {
    if (visible) {
      setIsRendered(true)

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Animate in
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start()

      // Auto-dismiss after duration
      timeoutRef.current = setTimeout(() => {
        animateOut()
      }, duration)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [visible, duration, toastId, translateY, opacity, animateOut])

  const handlePress = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    animateOut()
  }, [animateOut])

  if (!isRendered) {
    return null
  }

  const backgroundColor = TOAST_COLORS[type]

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + (Platform.OS === 'android' ? 10 : 0),
          backgroundColor,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      testID="toast-container"
    >
      <TouchableOpacity
        style={styles.touchable}
        onPress={handlePress}
        activeOpacity={0.8}
        accessibilityRole="alert"
        accessibilityLabel={message}
        testID="toast-touchable"
      >
        <Text style={styles.message} testID="toast-message" numberOfLines={2}>
          {message}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  touchable: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  message: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
})
