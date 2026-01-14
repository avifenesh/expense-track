'use client'

import { useEffect, useState, useCallback } from 'react'
import { toastBus, type ToastMessage } from '@/lib/toast-events'

const DEFAULT_DURATION = 4000 // 4 seconds (matches existing auto-dismiss pattern)
const MAX_TOASTS = 3 // Prevent spam

/**
 * Hook for managing toast notifications
 * Used by ToastContainer to render active toasts
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    const unsubscribe = toastBus.subscribe((toast) => {
      setToasts((prev) => {
        // Limit to MAX_TOASTS (remove oldest if needed)
        const newToasts = prev.length >= MAX_TOASTS ? prev.slice(-(MAX_TOASTS - 1)) : prev
        return [...newToasts, toast]
      })

      // Auto-dismiss after duration
      const duration = toast.duration ?? DEFAULT_DURATION
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, duration)
    })

    return unsubscribe
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, removeToast }
}

/**
 * Standalone toast methods - can be called from any component
 * Usage:
 *   import { toast } from '@/hooks/useToast'
 *   toast.success('Budget saved!')
 *   toast.error('Failed to delete category.')
 *   toast.info('Exchange rates updated.')
 */
export const toast = {
  success(message: string, duration?: number) {
    toastBus.emit({ type: 'success', message, duration })
  },

  error(message: string, duration?: number) {
    toastBus.emit({ type: 'error', message, duration })
  },

  info(message: string, duration?: number) {
    toastBus.emit({ type: 'info', message, duration })
  },
}
