export type ToastMessage = {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
  duration?: number
}

type ToastCallback = (toast: ToastMessage) => void

class ToastEventBus {
  private subscribers: Set<ToastCallback> = new Set()
  private messageCache: Map<string, number> = new Map()
  private readonly DEDUPE_WINDOW_MS = 500

  /**
   * Subscribe to toast events
   * @returns Unsubscribe function
   */
  subscribe(callback: ToastCallback): () => void {
    this.subscribers.add(callback)
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * Emit a toast event to all subscribers
   * Deduplicates identical messages within 500ms window
   */
  emit(toast: Omit<ToastMessage, 'id'>): void {
    // Deduplicate identical messages
    const cacheKey = `${toast.type}:${toast.message}`
    const lastEmitted = this.messageCache.get(cacheKey)
    const now = Date.now()

    if (lastEmitted && now - lastEmitted < this.DEDUPE_WINDOW_MS) {
      return // Skip duplicate within window
    }

    this.messageCache.set(cacheKey, now)

    // Clean up old cache entries
    setTimeout(() => {
      this.messageCache.delete(cacheKey)
    }, this.DEDUPE_WINDOW_MS)

    // Generate unique ID and emit
    const fullToast: ToastMessage = {
      ...toast,
      id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    }

    this.subscribers.forEach((callback) => {
      callback(fullToast)
    })
  }
}

export const toastBus = new ToastEventBus()
