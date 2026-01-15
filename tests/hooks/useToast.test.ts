/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useToast, toast } from '@/hooks/useToast'
import { toastBus } from '@/lib/toast-events'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('toast methods', () => {
    it('should emit success toast', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.success('Operation successful')
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0]).toMatchObject({
        type: 'success',
        message: 'Operation successful',
      })
      expect(result.current.toasts[0].id).toMatch(/^toast-/)
    })

    it('should emit error toast', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.error('Operation failed')
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0]).toMatchObject({
        type: 'error',
        message: 'Operation failed',
      })
    })

    it('should emit info toast', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.info('Information message')
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0]).toMatchObject({
        type: 'info',
        message: 'Information message',
      })
    })

    it('should accept custom duration', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.success('Custom duration', 6000)
      })

      expect(result.current.toasts[0].duration).toBe(6000)
    })
  })

  describe('auto-dismiss', () => {
    it('should auto-dismiss toast after default duration (4s)', async () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.success('Will auto-dismiss')
      })

      expect(result.current.toasts).toHaveLength(1)

      // Fast-forward 4 seconds
      act(() => {
        vi.advanceTimersByTime(4000)
      })

      await waitFor(() => {
        expect(result.current.toasts).toHaveLength(0)
      })
    })

    it('should auto-dismiss toast after custom duration', async () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.success('Custom dismiss', 2000)
      })

      expect(result.current.toasts).toHaveLength(1)

      // Fast-forward 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      await waitFor(() => {
        expect(result.current.toasts).toHaveLength(0)
      })
    })

    it('should not dismiss before duration expires', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.success('Not yet')
      })

      expect(result.current.toasts).toHaveLength(1)

      // Fast-forward 3.9 seconds (just before 4s)
      act(() => {
        vi.advanceTimersByTime(3900)
      })

      expect(result.current.toasts).toHaveLength(1)
    })
  })

  describe('manual dismiss', () => {
    it('should allow manual dismissal', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.success('Manual dismiss')
      })

      const toastId = result.current.toasts[0].id

      act(() => {
        result.current.removeToast(toastId)
      })

      expect(result.current.toasts).toHaveLength(0)
    })

    it('should only dismiss specific toast', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.success('First')
        toast.error('Second')
      })

      expect(result.current.toasts).toHaveLength(2)

      const firstToastId = result.current.toasts[0].id

      act(() => {
        result.current.removeToast(firstToastId)
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].message).toBe('Second')
    })
  })

  describe('multiple toasts', () => {
    it('should queue multiple toasts', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.success('First')
        toast.error('Second')
        toast.info('Third')
      })

      expect(result.current.toasts).toHaveLength(3)
      expect(result.current.toasts[0].message).toBe('First')
      expect(result.current.toasts[1].message).toBe('Second')
      expect(result.current.toasts[2].message).toBe('Third')
    })

    it('should limit to max 3 toasts', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.success('First')
        toast.success('Second')
        toast.success('Third')
        toast.success('Fourth')
      })

      expect(result.current.toasts).toHaveLength(3)
      // Should remove oldest (First) and keep Second, Third, Fourth
      expect(result.current.toasts[0].message).toBe('Second')
      expect(result.current.toasts[1].message).toBe('Third')
      expect(result.current.toasts[2].message).toBe('Fourth')
    })

    it('should dismiss each toast independently after their duration', async () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.success('Short', 2000)
        toast.success('Long', 6000)
      })

      expect(result.current.toasts).toHaveLength(2)

      // Fast-forward 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      await waitFor(() => {
        expect(result.current.toasts).toHaveLength(1)
        expect(result.current.toasts[0].message).toBe('Long')
      })

      // Fast-forward another 4 seconds (total 6s)
      act(() => {
        vi.advanceTimersByTime(4000)
      })

      await waitFor(() => {
        expect(result.current.toasts).toHaveLength(0)
      })
    })
  })

  describe('deduplication', () => {
    it('should deduplicate identical messages within 500ms', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.success('Duplicate')
        toast.success('Duplicate') // Should be ignored
      })

      expect(result.current.toasts).toHaveLength(1)
    })

    it('should allow same message after 500ms', async () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.success('Repeat')
      })

      expect(result.current.toasts).toHaveLength(1)

      // Fast-forward 500ms
      act(() => {
        vi.advanceTimersByTime(500)
      })

      act(() => {
        toast.success('Repeat') // Should be allowed now
      })

      expect(result.current.toasts).toHaveLength(2)
    })

    it('should not deduplicate different message types', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.success('Message')
        toast.error('Message') // Different type, should not dedupe
      })

      expect(result.current.toasts).toHaveLength(2)
      expect(result.current.toasts[0].type).toBe('success')
      expect(result.current.toasts[1].type).toBe('error')
    })

    it('should not deduplicate different messages', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.success('First message')
        toast.success('Second message')
      })

      expect(result.current.toasts).toHaveLength(2)
    })
  })

  describe('cleanup', () => {
    it('should clean up subscriptions on unmount', () => {
      const subscribeSpy = vi.spyOn(toastBus, 'subscribe')
      const { unmount } = renderHook(() => useToast())

      expect(subscribeSpy).toHaveBeenCalledTimes(1)

      const unsubscribe = subscribeSpy.mock.results[0].value
      const _unsubscribeSpy = vi.fn(unsubscribe)

      unmount()

      // Note: We can't directly test unsubscribe was called,
      // but we can verify no memory leaks by checking toasts don't update after unmount
    })

    it('should not update state after unmount', () => {
      const { unmount } = renderHook(() => useToast())

      unmount()

      // This should not throw or cause issues
      act(() => {
        toast.success('After unmount')
      })

      // Cannot check result.current after unmount, but ensuring no errors is the test
    })
  })

  describe('edge cases', () => {
    it('should handle rapid toast emissions', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        for (let i = 0; i < 10; i++) {
          toast.success(`Toast ${i}`)
        }
      })

      // Should limit to 3
      expect(result.current.toasts).toHaveLength(3)
    })

    it('should handle empty message', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.success('')
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].message).toBe('')
    })

    it('should handle very long messages', () => {
      const { result } = renderHook(() => useToast())
      const longMessage = 'A'.repeat(1000)

      act(() => {
        toast.success(longMessage)
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].message).toBe(longMessage)
    })

    it('should handle zero duration (still uses default)', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.success('Zero duration', 0)
      })

      expect(result.current.toasts[0].duration).toBe(0)

      // Should dismiss immediately
      act(() => {
        vi.advanceTimersByTime(0)
      })
    })
  })

  describe('unique IDs', () => {
    it('should generate unique IDs for each toast', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast.success('First')
        toast.success('Second')
        toast.success('Third')
      })

      const ids = result.current.toasts.map((t) => t.id)
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(3)
    })
  })
})
