import 'server-only'

/**
 * Rate limiting for API endpoints
 * In-memory sliding window implementation (resets on serverless cold start)
 *
 * For production multi-tenant deployment, consider Redis-backed rate limiting
 */

/**
 * Rate limit configurations for different endpoint types
 * Each type has its own window and max requests
 */
export type RateLimitType = 'default' | 'login' | 'registration' | 'password_reset' | 'resend_verification'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

const RATE_LIMIT_CONFIGS: Record<RateLimitType, RateLimitConfig> = {
  default: { windowMs: 60 * 1000, maxRequests: 100 }, // 100/min - general API
  login: { windowMs: 60 * 1000, maxRequests: 5 }, // 5/min - brute force protection
  registration: { windowMs: 60 * 1000, maxRequests: 3 }, // 3/min - spam prevention
  password_reset: { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3/hour - abuse prevention
  resend_verification: { windowMs: 15 * 60 * 1000, maxRequests: 3 }, // 3/15min - spam prevention
}

interface RateLimitEntry {
  count: number
  resetTime: Date
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: Date
}

// Map: `${type}:${key}` -> rate limit entry
const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Clean up expired rate limit entries to prevent memory leaks
 */
function cleanupExpiredEntries(): void {
  const now = new Date()
  const expiredKeys: string[] = []

  rateLimitStore.forEach((entry, key) => {
    if (now >= entry.resetTime) {
      expiredKeys.push(key)
    }
  })

  expiredKeys.forEach((key) => rateLimitStore.delete(key))
}

/**
 * Build storage key for rate limit entry
 */
function buildKey(identifier: string, type: RateLimitType): string {
  return `${type}:${identifier}`
}

/**
 * Check if identifier is within rate limit for a specific type
 * Returns allowed status and metadata for headers
 */
export function checkRateLimitTyped(identifier: string, type: RateLimitType): RateLimitResult {
  cleanupExpiredEntries()

  const config = RATE_LIMIT_CONFIGS[type]
  const key = buildKey(identifier, type)
  const now = new Date()
  const entry = rateLimitStore.get(key)

  // No entry or expired - create new window
  if (!entry || now >= entry.resetTime) {
    const resetAt = new Date(now.getTime() + config.windowMs)
    rateLimitStore.set(key, { count: 0, resetTime: resetAt })

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetAt,
    }
  }

  // Check if under limit
  const allowed = entry.count < config.maxRequests
  const remaining = Math.max(0, config.maxRequests - entry.count)

  return {
    allowed,
    limit: config.maxRequests,
    remaining,
    resetAt: entry.resetTime,
  }
}

/**
 * Increment rate limit counter for identifier
 * Call this after processing a request (success or failure for auth endpoints)
 */
export function incrementRateLimitTyped(identifier: string, type: RateLimitType): void {
  const key = buildKey(identifier, type)
  const entry = rateLimitStore.get(key)
  if (entry) {
    entry.count++
  }
}

/**
 * Reset rate limit for a specific identifier and type (useful for testing)
 */
export function resetRateLimitTyped(identifier: string, type: RateLimitType): void {
  const key = buildKey(identifier, type)
  rateLimitStore.delete(key)
}

// ============================================================================
// Legacy API - backwards compatible with existing code using 'default' type
// ============================================================================

/**
 * Check if user is within rate limit (legacy API - uses 'default' type)
 * @deprecated Use checkRateLimitTyped for new code
 */
export function checkRateLimit(userId: string): RateLimitResult {
  return checkRateLimitTyped(userId, 'default')
}

/**
 * Increment rate limit counter for user (legacy API - uses 'default' type)
 * @deprecated Use incrementRateLimitTyped for new code
 */
export function incrementRateLimit(userId: string): void {
  incrementRateLimitTyped(userId, 'default')
}

/**
 * Get rate limit headers for response
 * Should be included on all API responses for client visibility
 */
export function getRateLimitHeaders(userId: string, type: RateLimitType = 'default'): Record<string, string> {
  const rateLimit = checkRateLimitTyped(userId, type)

  return {
    'X-RateLimit-Limit': rateLimit.limit.toString(),
    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(rateLimit.resetAt.getTime() / 1000).toString(),
  }
}

/**
 * Reset rate limit for a specific user (legacy API - uses 'default' type)
 * @deprecated Use resetRateLimitTyped for new code
 */
export function resetRateLimit(userId: string): void {
  resetRateLimitTyped(userId, 'default')
}

/**
 * Reset all rate limits (useful for testing)
 */
export function resetAllRateLimits(): void {
  rateLimitStore.clear()
}
