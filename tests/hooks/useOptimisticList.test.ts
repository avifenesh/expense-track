/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOptimisticList, generateTempId } from '@/hooks/useOptimisticList'

type TestItem = { id: string; name: string; value: number }

describe('useOptimisticList', () => {
  const createTestItems = (): TestItem[] => [
    { id: '1', name: 'Item 1', value: 100 },
    { id: '2', name: 'Item 2', value: 200 },
    { id: '3', name: 'Item 3', value: 300 },
  ]

  describe('initial state', () => {
    it('should return server items as initial state', () => {
      const serverItems = createTestItems()
      const { result } = renderHook(() => useOptimisticList(serverItems))

      expect(result.current.items).toEqual(serverItems)
    })

    it('should handle empty initial state', () => {
      const { result } = renderHook(() => useOptimisticList<TestItem>([]))

      expect(result.current.items).toEqual([])
    })
  })

  describe('optimisticAdd', () => {
    it('should add item optimistically', () => {
      const serverItems = createTestItems()
      const { result } = renderHook(() => useOptimisticList(serverItems))

      const newItem = { id: '4', name: 'Item 4', value: 400 }

      act(() => {
        result.current.optimisticAdd(newItem)
      })

      expect(result.current.items).toHaveLength(4)
      expect(result.current.items[3]).toEqual(newItem)
    })

    it('should preserve existing items when adding', () => {
      const serverItems = createTestItems()
      const { result } = renderHook(() => useOptimisticList(serverItems))

      const newItem = { id: '4', name: 'Item 4', value: 400 }

      act(() => {
        result.current.optimisticAdd(newItem)
      })

      expect(result.current.items.slice(0, 3)).toEqual(serverItems)
    })
  })

  describe('optimisticUpdate', () => {
    it('should update item optimistically', () => {
      const serverItems = createTestItems()
      const { result } = renderHook(() => useOptimisticList(serverItems))

      act(() => {
        result.current.optimisticUpdate('2', { name: 'Updated Item 2', value: 999 })
      })

      expect(result.current.items[1]).toEqual({
        id: '2',
        name: 'Updated Item 2',
        value: 999,
      })
    })

    it('should only update specified fields', () => {
      const serverItems = createTestItems()
      const { result } = renderHook(() => useOptimisticList(serverItems))

      act(() => {
        result.current.optimisticUpdate('2', { name: 'New Name' })
      })

      expect(result.current.items[1]).toEqual({
        id: '2',
        name: 'New Name',
        value: 200, // Original value preserved
      })
    })

    it('should not affect other items', () => {
      const serverItems = createTestItems()
      const { result } = renderHook(() => useOptimisticList(serverItems))

      act(() => {
        result.current.optimisticUpdate('2', { name: 'Updated' })
      })

      expect(result.current.items[0]).toEqual(serverItems[0])
      expect(result.current.items[2]).toEqual(serverItems[2])
    })

    it('should handle non-existent id gracefully', () => {
      const serverItems = createTestItems()
      const { result } = renderHook(() => useOptimisticList(serverItems))

      act(() => {
        result.current.optimisticUpdate('non-existent', { name: 'Updated' })
      })

      // Items should remain unchanged
      expect(result.current.items).toEqual(serverItems)
    })
  })

  describe('optimisticDelete', () => {
    it('should delete item optimistically', () => {
      const serverItems = createTestItems()
      const { result } = renderHook(() => useOptimisticList(serverItems))

      act(() => {
        result.current.optimisticDelete('2')
      })

      expect(result.current.items).toHaveLength(2)
      expect(result.current.items.find((item) => item.id === '2')).toBeUndefined()
    })

    it('should preserve other items when deleting', () => {
      const serverItems = createTestItems()
      const { result } = renderHook(() => useOptimisticList(serverItems))

      act(() => {
        result.current.optimisticDelete('2')
      })

      expect(result.current.items[0]).toEqual(serverItems[0])
      expect(result.current.items[1]).toEqual(serverItems[2])
    })

    it('should handle non-existent id gracefully', () => {
      const serverItems = createTestItems()
      const { result } = renderHook(() => useOptimisticList(serverItems))

      act(() => {
        result.current.optimisticDelete('non-existent')
      })

      expect(result.current.items).toEqual(serverItems)
    })
  })

  describe('rollback', () => {
    it('should rollback after optimistic add', () => {
      const serverItems = createTestItems()
      const { result } = renderHook(() => useOptimisticList(serverItems))

      const newItem = { id: '4', name: 'Item 4', value: 400 }

      act(() => {
        result.current.optimisticAdd(newItem)
      })

      expect(result.current.items).toHaveLength(4)

      act(() => {
        result.current.rollback()
      })

      expect(result.current.items).toHaveLength(3)
      expect(result.current.items).toEqual(serverItems)
    })

    it('should rollback after optimistic update', () => {
      const serverItems = createTestItems()
      const { result } = renderHook(() => useOptimisticList(serverItems))

      act(() => {
        result.current.optimisticUpdate('2', { name: 'Changed' })
      })

      expect(result.current.items[1].name).toBe('Changed')

      act(() => {
        result.current.rollback()
      })

      expect(result.current.items[1].name).toBe('Item 2')
    })

    it('should rollback after optimistic delete', () => {
      const serverItems = createTestItems()
      const { result } = renderHook(() => useOptimisticList(serverItems))

      act(() => {
        result.current.optimisticDelete('2')
      })

      expect(result.current.items).toHaveLength(2)

      act(() => {
        result.current.rollback()
      })

      expect(result.current.items).toHaveLength(3)
      expect(result.current.items[1].id).toBe('2')
    })
  })

  describe('server data updates', () => {
    it('should update when server data changes', () => {
      const initialItems = createTestItems()
      const { result, rerender } = renderHook(({ items }: { items: TestItem[] }) => useOptimisticList(items), {
        initialProps: { items: initialItems },
      })

      expect(result.current.items).toHaveLength(3)

      const updatedItems = [...initialItems, { id: '4', name: 'New Server Item', value: 400 }]
      rerender({ items: updatedItems })

      expect(result.current.items).toHaveLength(4)
    })
  })

  describe('multiple operations', () => {
    it('should handle add then delete', () => {
      const serverItems = createTestItems()
      const { result } = renderHook(() => useOptimisticList(serverItems))

      act(() => {
        result.current.optimisticAdd({ id: '4', name: 'New', value: 400 })
      })

      expect(result.current.items).toHaveLength(4)

      act(() => {
        result.current.optimisticDelete('4')
      })

      expect(result.current.items).toHaveLength(3)
    })

    it('should handle update then delete', () => {
      const serverItems = createTestItems()
      const { result } = renderHook(() => useOptimisticList(serverItems))

      act(() => {
        result.current.optimisticUpdate('2', { name: 'Updated' })
      })

      expect(result.current.items[1].name).toBe('Updated')

      act(() => {
        result.current.optimisticDelete('2')
      })

      expect(result.current.items).toHaveLength(2)
      expect(result.current.items.find((i) => i.id === '2')).toBeUndefined()
    })
  })
})

describe('generateTempId', () => {
  it('should generate unique IDs', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateTempId())
    }
    expect(ids.size).toBe(100)
  })

  it('should start with "temp-"', () => {
    const id = generateTempId()
    expect(id.startsWith('temp-')).toBe(true)
  })

  it('should include timestamp', () => {
    const before = Date.now()
    const id = generateTempId()
    const after = Date.now()

    const parts = id.split('-')
    const timestamp = parseInt(parts[1], 10)

    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(after)
  })
})
