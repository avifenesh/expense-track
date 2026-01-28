import React, { useEffect } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer } from './src/navigation'
import { useAuthStore, useOfflineQueueStore, useSubscriptionStore } from './src/stores'
import { networkStatus } from './src/services/networkStatus'
import { Toast } from './src/components'

export default function App() {
  useEffect(() => {
    let networkUnsubscribe: (() => void) | undefined
    let appStateSubscription: { remove: () => void } | undefined
    let debounceTimeout: NodeJS.Timeout | undefined

    const initializeApp = async () => {
      // Initialize auth store on app startup
      useAuthStore.getState().initialize()

      // Initialize network monitoring
      networkStatus.initialize()

      // Load offline queue from storage before subscribing to network changes
      await useOfflineQueueStore.getState().loadFromStorage()

      // Initialize subscription state (loads from cache, then fetches fresh in background)
      // Must happen after auth initialize since subscription fetch requires auth token
      useSubscriptionStore.getState().loadFromCache()

      // Subscribe to network changes and process queue when online (with debounce)
      networkUnsubscribe = networkStatus.subscribe((status) => {
        if (status.isConnected && (status.isInternetReachable === null || status.isInternetReachable)) {
          // Clear any pending debounce
          if (debounceTimeout) {
            clearTimeout(debounceTimeout)
          }

          // Debounce queue processing to prevent race conditions
          debounceTimeout = setTimeout(() => {
            useOfflineQueueStore.getState().processQueue()
          }, 500)
        }
      })

      // Explicitly trigger queue processing if already online after load
      const currentStatus = networkStatus.getStatus()
      if (
        currentStatus.isConnected &&
        (currentStatus.isInternetReachable === null || currentStatus.isInternetReachable)
      ) {
        useOfflineQueueStore.getState().processQueue()
      }

      // Subscribe to app state changes to refresh subscription when app comes to foreground
      const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          // Only refresh if user is authenticated
          const { isAuthenticated } = useAuthStore.getState()
          if (isAuthenticated) {
            // fetchSubscription respects the 5-minute TTL cache
            useSubscriptionStore.getState().fetchSubscription()
          }
        }
      }

      appStateSubscription = AppState.addEventListener('change', handleAppStateChange)
    }

    initializeApp()

    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout)
      }
      networkUnsubscribe?.()
      appStateSubscription?.remove()
      networkStatus.cleanup()
    }
  }, [])

  return (
    <SafeAreaProvider>
      <NavigationContainer />
      <Toast />
      <StatusBar style="light" />
    </SafeAreaProvider>
  )
}
