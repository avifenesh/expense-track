import React, { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer } from './src/navigation'
import { useAuthStore, useOfflineQueueStore } from './src/stores'
import { networkStatus } from './src/services/networkStatus'

export default function App() {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let debounceTimeout: NodeJS.Timeout | undefined

    const processQueueIfOnline = () => {
      if (networkStatus.isOnline()) {
        useOfflineQueueStore.getState().processQueue()
      }
    }

    const scheduleQueueProcessing = () => {
      if (!networkStatus.isOnline()) {
        return
      }

      // Clear any pending debounce
      if (debounceTimeout) {
        clearTimeout(debounceTimeout)
      }

      // Debounce queue processing to prevent race conditions
      debounceTimeout = setTimeout(() => {
        useOfflineQueueStore.getState().processQueue()
      }, 500)
    }

    const initializeApp = async () => {
      // Initialize auth store on app startup
      useAuthStore.getState().initialize()

      // Initialize network monitoring
      networkStatus.initialize()

      // Load offline queue from storage before subscribing to network changes
      await useOfflineQueueStore.getState().loadFromStorage()

      // Subscribe to network changes and process queue when online (with debounce)
      unsubscribe = networkStatus.subscribe(() => {
        scheduleQueueProcessing()
      })

      // Explicitly trigger queue processing if already online after load
      processQueueIfOnline()
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
      <StatusBar style="light" />
    </SafeAreaProvider>
  )
}
