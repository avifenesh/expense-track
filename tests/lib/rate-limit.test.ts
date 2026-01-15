import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  checkRateLimit,
  incrementRateLimit,
  getRateLimitHeaders,
  resetRateLimit,
  resetAllRateLimits,
  checkRateLimitTyped,
  incrementRateLimitTyped,
  resetRateLimitTyped,
  type RateLimitType,
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

  describe('checkRateLimitTyped - auth-specific limits', () => {
    const testCases: Array<{ type: RateLimitType; maxRequests: number; windowMs: number; description: string }> = [
      { type: 'login', maxRequests: 5, windowMs: 60 * 1000, description: '5/min for brute force protection' },
      { type: 'registration', maxRequests: 3, windowMs: 60 * 1000, description: '3/min for spam prevention' },
      { type: 'password_reset', maxRequests: 3, windowMs: 60 * 60 * 1000, description: '3/hour for abuse prevention' },
      {
        type: 'resend_verification',
        maxRequests: 3,
        windowMs: 15 * 60 * 1000,
        description: '3/15min for spam prevention',
      },
    ]

    testCases.forEach(({ type, maxRequests, windowMs, description }) => {
      describe(`${type} (${description})`, () => {
        it(`allows ${maxRequests} requests then blocks`, () => {
          const identifier = `test-${type}@example.com`

          // Make maxRequests requests - all should be allowed
          for (let i = 0; i < maxRequests; i++) {
            const result = checkRateLimitTyped(identifier, type)
            expect(result.allowed).toBe(true)
            expect(result.limit).toBe(maxRequests)
            incrementRateLimitTyped(identifier, type)
          }

          // Next request should be blocked
          const result = checkRateLimitTyped(identifier, type)
          expect(result.allowed).toBe(false)
          expect(result.remaining).toBe(0)
        })

        it(`resets after ${windowMs / 1000} seconds`, () => {
          const identifier = `test-${type}@example.com`

          // Hit the limit
          for (let i = 0; i < maxRequests; i++) {
            checkRateLimitTyped(identifier, type)
            incrementRateLimitTyped(identifier, type)
          }

          // Should be blocked
          let result = checkRateLimitTyped(identifier, type)
          expect(result.allowed).toBe(false)

          // Advance time past window
          vi.advanceTimersByTime(windowMs + 1000)

          // Should be allowed again
          result = checkRateLimitTyped(identifier, type)
          expect(result.allowed).toBe(true)
          expect(result.remaining).toBe(maxRequests)
        })
      })
    })

    it('isolates rate limits by type', () => {
      const identifier = 'user@example.com'

      // Hit login limit (5 requests)
      for (let i = 0; i < 5; i++) {
        checkRateLimitTyped(identifier, 'login')
        incrementRateLimitTyped(identifier, 'login')
      }

      // Login should be blocked
      expect(checkRateLimitTyped(identifier, 'login').allowed).toBe(false)

      // But registration should still be allowed (different type bucket)
      expect(checkRateLimitTyped(identifier, 'registration').allowed).toBe(true)

      // And password reset should be allowed
      expect(checkRateLimitTyped(identifier, 'password_reset').allowed).toBe(true)
    })

    it('isolates rate limits by identifier', () => {
      // Hit login limit for user1
      for (let i = 0; i < 5; i++) {
        checkRateLimitTyped('user1@example.com', 'login')
        incrementRateLimitTyped('user1@example.com', 'login')
      }

      // user1 should be blocked
      expect(checkRateLimitTyped('user1@example.com', 'login').allowed).toBe(false)

      // user2 should still be allowed
      expect(checkRateLimitTyped('user2@example.com', 'login').allowed).toBe(true)
    })
  })

  describe('resetRateLimitTyped', () => {
    it('resets only the specific type for an identifier', () => {
      const identifier = 'user@example.com'

      // Hit both login and registration limits
      for (let i = 0; i < 5; i++) {
        checkRateLimitTyped(identifier, 'login')
        incrementRateLimitTyped(identifier, 'login')
      }
      for (let i = 0; i < 3; i++) {
        checkRateLimitTyped(identifier, 'registration')
        incrementRateLimitTyped(identifier, 'registration')
      }

      // Both should be blocked
      expect(checkRateLimitTyped(identifier, 'login').allowed).toBe(false)
      expect(checkRateLimitTyped(identifier, 'registration').allowed).toBe(false)

      // Reset only login
      resetRateLimitTyped(identifier, 'login')

      // Login should be allowed, registration still blocked
      expect(checkRateLimitTyped(identifier, 'login').allowed).toBe(true)
      expect(checkRateLimitTyped(identifier, 'registration').allowed).toBe(false)
    })
  })
})
