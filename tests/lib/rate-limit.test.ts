import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  checkRateLimit,
  incrementRateLimit,
  getRateLimitHeaders,
  resetRateLimit,
  resetAllRateLimits,
} from '@/lib/rate-limit'

describe('Rate Limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetAllRateLimits()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetAllRateLimits()
  })

  describe('checkRateLimit', () => {
    it('allows requests under limit', () => {
      const userId = 'user1'

      for (let i = 0; i < 100; i++) {
        const result = checkRateLimit(userId)
        expect(result.allowed).toBe(true)
        expect(result.limit).toBe(100)
        incrementRateLimit(userId)
      }
    })

    it('blocks 101st request', () => {
      const userId = 'user1'

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        checkRateLimit(userId)
        incrementRateLimit(userId)
      }

      // 101st request should be blocked
      const result = checkRateLimit(userId)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('returns correct remaining count', () => {
      const userId = 'user1'

      // First request
      let result = checkRateLimit(userId)
      expect(result.remaining).toBe(100)
      incrementRateLimit(userId)

      // Second request
      result = checkRateLimit(userId)
      expect(result.remaining).toBe(99)
      incrementRateLimit(userId)

      // After 50 requests
      for (let i = 2; i < 50; i++) {
        checkRateLimit(userId)
        incrementRateLimit(userId)
      }
      result = checkRateLimit(userId)
      expect(result.remaining).toBe(50)
    })

    it('resets after time window expires', () => {
      const userId = 'user1'

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        checkRateLimit(userId)
        incrementRateLimit(userId)
      }

      // Should be blocked
      let result = checkRateLimit(userId)
      expect(result.allowed).toBe(false)

      // Advance time by 61 seconds (past 60 second window)
      vi.advanceTimersByTime(61 * 1000)

      // Should be allowed again
      result = checkRateLimit(userId)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(100)
    })

    it('creates new window for first request', () => {
      const now = new Date('2024-01-15T12:00:00Z')
      vi.setSystemTime(now)

      const userId = 'user1'
      const result = checkRateLimit(userId)

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(100)
      expect(result.remaining).toBe(100)
      expect(result.resetAt.getTime()).toBe(now.getTime() + 60 * 1000)
    })
  })

  describe('incrementRateLimit', () => {
    it('increments counter correctly', () => {
      const userId = 'user1'

      checkRateLimit(userId)
      incrementRateLimit(userId)

      const result = checkRateLimit(userId)
      expect(result.remaining).toBe(99)
    })

    it('handles multiple increments', () => {
      const userId = 'user1'

      checkRateLimit(userId)

      for (let i = 0; i < 10; i++) {
        incrementRateLimit(userId)
      }

      const result = checkRateLimit(userId)
      expect(result.remaining).toBe(90)
    })
  })

  describe('getRateLimitHeaders', () => {
    it('returns correct headers for new user', () => {
      const now = new Date('2024-01-15T12:00:00Z')
      vi.setSystemTime(now)

      const userId = 'user1'
      const headers = getRateLimitHeaders(userId)

      expect(headers['X-RateLimit-Limit']).toBe('100')
      expect(headers['X-RateLimit-Remaining']).toBe('100')
      expect(headers['X-RateLimit-Reset']).toBe(String(Math.floor((now.getTime() + 60 * 1000) / 1000)))
    })

    it('returns updated headers after requests', () => {
      const userId = 'user1'

      checkRateLimit(userId)
      incrementRateLimit(userId)
      incrementRateLimit(userId)
      incrementRateLimit(userId)

      const headers = getRateLimitHeaders(userId)
      expect(headers['X-RateLimit-Remaining']).toBe('97')
    })

    it('returns zero remaining when at limit', () => {
      const userId = 'user1'

      for (let i = 0; i < 100; i++) {
        checkRateLimit(userId)
        incrementRateLimit(userId)
      }

      const headers = getRateLimitHeaders(userId)
      expect(headers['X-RateLimit-Remaining']).toBe('0')
    })
  })

  describe('auto-cleanup', () => {
    it('cleans up expired entries', () => {
      const user1 = 'user1'
      const user2 = 'user2'

      // Create entries for two users
      checkRateLimit(user1)
      incrementRateLimit(user1)

      vi.advanceTimersByTime(30 * 1000) // 30 seconds

      checkRateLimit(user2)
      incrementRateLimit(user2)

      // Advance time past user1's window but not user2's
      vi.advanceTimersByTime(31 * 1000) // Total: 61 seconds for user1, 31 for user2

      // Check user2 (should trigger cleanup of user1)
      const user2Result = checkRateLimit(user2)
      expect(user2Result.remaining).toBe(99) // user2 still has 99 remaining

      // Check user1 (should have new window)
      const user1Result = checkRateLimit(user1)
      expect(user1Result.remaining).toBe(100) // user1 has fresh window
    })
  })

  describe('user isolation', () => {
    it('tracks different users independently', () => {
      const user1 = 'user1'
      const user2 = 'user2'

      // User 1 makes 50 requests
      for (let i = 0; i < 50; i++) {
        checkRateLimit(user1)
        incrementRateLimit(user1)
      }

      // User 2 makes 10 requests
      for (let i = 0; i < 10; i++) {
        checkRateLimit(user2)
        incrementRateLimit(user2)
      }

      // Check remaining for each user
      const user1Result = checkRateLimit(user1)
      const user2Result = checkRateLimit(user2)

      expect(user1Result.remaining).toBe(50)
      expect(user2Result.remaining).toBe(90)
    })

    it('blocks one user without affecting another', () => {
      const user1 = 'user1'
      const user2 = 'user2'

      // User 1 hits limit
      for (let i = 0; i < 100; i++) {
        checkRateLimit(user1)
        incrementRateLimit(user1)
      }

      // User 1 should be blocked
      const user1Result = checkRateLimit(user1)
      expect(user1Result.allowed).toBe(false)

      // User 2 should still be allowed
      const user2Result = checkRateLimit(user2)
      expect(user2Result.allowed).toBe(true)
    })
  })

  describe('resetRateLimit', () => {
    it('resets rate limit for specific user', () => {
      const userId = 'user1'

      // Make some requests
      for (let i = 0; i < 50; i++) {
        checkRateLimit(userId)
        incrementRateLimit(userId)
      }

      // Verify partial usage
      let result = checkRateLimit(userId)
      expect(result.remaining).toBe(50)

      // Reset
      resetRateLimit(userId)

      // Should have fresh window
      result = checkRateLimit(userId)
      expect(result.remaining).toBe(100)
    })

    it('does not affect other users', () => {
      const user1 = 'user1'
      const user2 = 'user2'

      // Both make requests
      for (let i = 0; i < 50; i++) {
        checkRateLimit(user1)
        incrementRateLimit(user1)
        checkRateLimit(user2)
        incrementRateLimit(user2)
      }

      // Reset only user1
      resetRateLimit(user1)

      // User1 should be reset
      const user1Result = checkRateLimit(user1)
      expect(user1Result.remaining).toBe(100)

      // User2 should be unchanged
      const user2Result = checkRateLimit(user2)
      expect(user2Result.remaining).toBe(50)
    })
  })

  describe('resetAllRateLimits', () => {
    it('resets all users', () => {
      const user1 = 'user1'
      const user2 = 'user2'
      const user3 = 'user3'

      // All make requests
      for (let i = 0; i < 30; i++) {
        checkRateLimit(user1)
        incrementRateLimit(user1)
      }
      for (let i = 0; i < 60; i++) {
        checkRateLimit(user2)
        incrementRateLimit(user2)
      }
      for (let i = 0; i < 90; i++) {
        checkRateLimit(user3)
        incrementRateLimit(user3)
      }

      // Reset all
      resetAllRateLimits()

      // All should have fresh windows
      expect(checkRateLimit(user1).remaining).toBe(100)
      expect(checkRateLimit(user2).remaining).toBe(100)
      expect(checkRateLimit(user3).remaining).toBe(100)
    })
  })

  describe('edge cases', () => {
    it('handles exactly 100 requests', () => {
      const userId = 'user1'

      // Make exactly 100 requests
      for (let i = 0; i < 100; i++) {
        const result = checkRateLimit(userId)
        expect(result.allowed).toBe(true)
        incrementRateLimit(userId)
      }

      // 101st should be blocked
      const result = checkRateLimit(userId)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('handles rapid time advancement', () => {
      const userId = 'user1'

      checkRateLimit(userId)
      incrementRateLimit(userId)

      // Advance time in small increments (59 seconds total, still within window)
      for (let i = 0; i < 11; i++) {
        vi.advanceTimersByTime(5 * 1000) // 5 seconds each
      }
      vi.advanceTimersByTime(4 * 1000) // 4 more seconds = 59 seconds total

      // Total: 59 seconds, should still be in window
      let result = checkRateLimit(userId)
      expect(result.remaining).toBe(99)

      // Two more seconds to expire window (total 61 seconds)
      vi.advanceTimersByTime(2 * 1000)

      // Should have new window
      result = checkRateLimit(userId)
      expect(result.remaining).toBe(100)
    })
  })
})
