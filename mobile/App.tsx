import React, { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer } from './src/navigation'
import { useAuthStore, useOfflineQueueStore } from './src/stores'
import { networkStatus } from './src/services/networkStatus'
import { Toast } from './src/components'

export default function App() {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let debounceTimeout: NodeJS.Timeout | undefined

    const initializeApp = async () => {
      // Initialize auth store on app startup
      useAuthStore.getState().initialize()

      // Initialize network monitoring
      networkStatus.initialize()

      // Load offline queue from storage before subscribing to network changes
      await useOfflineQueueStore.getState().loadFromStorage()

      // Subscribe to network changes and process queue when online (with debounce)
      unsubscribe = networkStatus.subscribe((status) => {
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
    }

    initializeApp()

    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout)
      }
      unsubscribe?.()
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
