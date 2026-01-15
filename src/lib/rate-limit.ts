import 'server-only'

/**
 * Rate limiting for API endpoints
 * In-memory sliding window implementation (resets on serverless cold start)
 *
 * For production multi-tenant deployment, consider Redis-backed rate limiting
 */

const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100 // 100 requests per minute

interface RateLimitEntry {
  count: number
  resetTime: Date
}

// Map: userId -> rate limit entry
const userQuotas = new Map<string, RateLimitEntry>()

/**
 * Clean up expired rate limit entries to prevent memory leaks
 */
function cleanupExpiredEntries(): void {
  const now = new Date()
  const expiredUsers: string[] = []

  userQuotas.forEach((entry, userId) => {
    if (now >= entry.resetTime) {
      expiredUsers.push(userId)
    }
  })

  expiredUsers.forEach((userId) => userQuotas.delete(userId))
}

/**
 * Check if user is within rate limit
 * Returns allowed status and metadata for headers
 */
export function checkRateLimit(userId: string): {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: Date
} {
  cleanupExpiredEntries()

  const now = new Date()
  const entry = userQuotas.get(userId)

  // No entry or expired - create new window
  if (!entry || now >= entry.resetTime) {
    const resetAt = new Date(now.getTime() + RATE_LIMIT_WINDOW_MS)
    userQuotas.set(userId, { count: 0, resetTime: resetAt })

    return {
      allowed: true,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining: RATE_LIMIT_MAX_REQUESTS,
      resetAt,
    }
  }

  // Check if under limit
  const allowed = entry.count < RATE_LIMIT_MAX_REQUESTS
  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count)

  return {
    allowed,
    limit: RATE_LIMIT_MAX_REQUESTS,
    remaining,
    resetAt: entry.resetTime,
  }
}

/**
 * Increment rate limit counter for user
 * Call this after successfully processing a request
 */
export function incrementRateLimit(userId: string): void {
  const entry = userQuotas.get(userId)
  if (entry) {
    entry.count++
  }
}

/**
 * Get rate limit headers for response
 * Should be included on all API responses for client visibility
 */
export function getRateLimitHeaders(userId: string): Record<string, string> {
  const rateLimit = checkRateLimit(userId)

  return {
    'X-RateLimit-Limit': rateLimit.limit.toString(),
    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(rateLimit.resetAt.getTime() / 1000).toString(),
  }
}

/**
 * Reset rate limit for a specific user (useful for testing)
 */
export function resetRateLimit(userId: string): void {
  userQuotas.delete(userId)
}

/**
 * Reset all rate limits (useful for testing)
 */
export function resetAllRateLimits(): void {
  userQuotas.clear()
}
