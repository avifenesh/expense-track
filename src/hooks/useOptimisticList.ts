import { useState, useCallback, useRef, useEffect } from 'react'

export type OptimisticListResult<T> = {
  items: T[]
  optimisticAdd: (item: T) => void
  optimisticUpdate: (id: string, updates: Partial<T>) => void
  optimisticDelete: (id: string) => void
  rollback: () => void
}

export function useOptimisticList<T extends { id: string }>(serverItems: T[]): OptimisticListResult<T> {
  const [optimisticItems, setOptimisticItems] = useState<T[]>(serverItems)
  const previousItemsRef = useRef<T[]>(serverItems)
  const mountedRef = useRef(true)

  // Track mounted state to prevent updates after unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Safe setState that checks mounted state
  const safeSetItems = useCallback((updater: T[] | ((current: T[]) => T[])) => {
    if (mountedRef.current) {
      setOptimisticItems(updater)
    }
  }, [])

  // Sync with server items when they change
  useEffect(() => {
    safeSetItems(serverItems)
    previousItemsRef.current = serverItems
  }, [serverItems, safeSetItems])

  const optimisticAdd = useCallback((item: T) => {
    safeSetItems((current) => {
      previousItemsRef.current = current
      return [...current, item]
    })
  }, [safeSetItems])

  const optimisticUpdate = useCallback((id: string, updates: Partial<T>) => {
    safeSetItems((current) => {
      previousItemsRef.current = current
      return current.map((item) => (item.id === id ? { ...item, ...updates } : item))
    })
  }, [safeSetItems])

  const optimisticDelete = useCallback((id: string) => {
    safeSetItems((current) => {
      previousItemsRef.current = current
      return current.filter((item) => item.id !== id)
    })
  }, [safeSetItems])

  const rollback = useCallback(() => {
    safeSetItems(previousItemsRef.current)
  }, [safeSetItems])

  return {
    items: optimisticItems,
    optimisticAdd,
    optimisticUpdate,
    optimisticDelete,
    rollback,
  }
}

export function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
