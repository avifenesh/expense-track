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

  // Sync with server items when they change
  useEffect(() => {
    setOptimisticItems(serverItems)
    previousItemsRef.current = serverItems
  }, [serverItems])

  const optimisticAdd = useCallback((item: T) => {
    setOptimisticItems((current) => {
      previousItemsRef.current = current
      return [...current, item]
    })
  }, [])

  const optimisticUpdate = useCallback((id: string, updates: Partial<T>) => {
    setOptimisticItems((current) => {
      previousItemsRef.current = current
      return current.map((item) => (item.id === id ? { ...item, ...updates } : item))
    })
  }, [])

  const optimisticDelete = useCallback((id: string) => {
    setOptimisticItems((current) => {
      previousItemsRef.current = current
      return current.filter((item) => item.id !== id)
    })
  }, [])

  const rollback = useCallback(() => {
    setOptimisticItems(previousItemsRef.current)
  }, [])

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
