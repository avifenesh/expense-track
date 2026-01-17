import 'server-only'

/**
 * Rate limiting for API endpoints
 *
 * ## Implementation Details
 * - Uses in-memory sliding window algorithm
 * - Each request type has its own window and max requests configuration
 * - Automatic cleanup of expired entries to prevent memory leaks
 *
 * ## Known Limitations
 *
 * ### Cold Start Reset (IMPORTANT)
 * In serverless environments (Vercel, AWS Lambda), rate limit counters reset
 * when the function cold starts. This means:
 * - Rate limits are NOT persistent across deployments
 * - High-traffic periods may trigger more frequent cold starts
 * - An attacker could theoretically bypass limits by waiting for cold starts
 *
 * ### Single-Instance Only
 * This implementation does NOT work correctly with multiple server instances:
 * - Each instance maintains its own in-memory store
 * - Total allowed requests = maxRequests × number of instances
 *
 * ### Mitigation Strategies
 * For production deployments requiring strict rate limiting:
 * 1. Use Redis-backed rate limiting (recommended for multi-instance)
 * 2. Use Vercel Edge Middleware with KV storage
 * 3. Use Cloudflare Rate Limiting at the edge
 * 4. Implement database-backed rate limiting for critical endpoints
 *
 * @see docs/RATE_LIMITING.md for full documentation
 */

/**
 * Rate limit configurations for different endpoint types
 * Each type has its own window and max requests
 */
export type RateLimitType =
  | 'default'
  | 'login'
  | 'registration'
  | 'password_reset'
  | 'resend_verification'
  | 'account_deletion'
  | 'data_export'
  | 'ai_chat'

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
  account_deletion: { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3/hour - abuse prevention
  data_export: { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3/hour - GDPR export rate limit
  ai_chat: { windowMs: 60 * 1000, maxRequests: 20 }, // 20/min - AI chat API
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

/** Check if user is within rate limit (uses 'default' type) */
export function checkRateLimit(userId: string): RateLimitResult {
  return checkRateLimitTyped(userId, 'default')
}

/** Increment rate limit counter for user (uses 'default' type) */
export function incrementRateLimit(userId: string): void {
  incrementRateLimitTyped(userId, 'default')
}

/** Get rate limit headers for response */
export function getRateLimitHeaders(userId: string, type: RateLimitType = 'default'): Record<string, string> {
  const rateLimit = checkRateLimitTyped(userId, type)

  return {
    'X-RateLimit-Limit': rateLimit.limit.toString(),
    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(rateLimit.resetAt.getTime() / 1000).toString(),
  }
}

/** Reset rate limit for a specific user (uses 'default' type) */
export function resetRateLimit(userId: string): void {
  resetRateLimitTyped(userId, 'default')
}

/**
 * Reset all rate limits (useful for testing)
 */
export function resetAllRateLimits(): void {
  rateLimitStore.clear()
}

// ============================================================================
// Cron endpoint rate limiting
// ============================================================================

/**
 * In-memory rate limiter for cron endpoints.
 * Separate from the main rate limiter as cron has different requirements:
 * - Simpler time-window based limiting (1 request per window)
 * - Keyed by IP address, not user ID
 * - Shorter cleanup cycle
 */
const cronRateLimitStore = new Map<string, number>()
const CRON_RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const CRON_RATE_LIMIT_MAX_ENTRIES = 1000

/**
 * Check if a cron request is allowed based on IP-based rate limiting.
 * Allows 1 request per minute per identifier (typically IP address).
 *
 * @param identifier - Unique identifier for rate limiting (e.g., IP address)
 * @returns true if request is allowed, false if rate limited
 */
export function checkCronRateLimit(identifier: string): boolean {
  const now = Date.now()
  const lastRequest = cronRateLimitStore.get(identifier)

  // Cleanup old entries if store is getting large
  if (cronRateLimitStore.size > CRON_RATE_LIMIT_MAX_ENTRIES) {
    const cutoff = now - 5 * 60 * 1000 // 5 minutes
    for (const [key, timestamp] of cronRateLimitStore) {
      if (timestamp < cutoff) cronRateLimitStore.delete(key)
    }
  }

  if (lastRequest && now - lastRequest < CRON_RATE_LIMIT_WINDOW_MS) {
    return false // Rate limited
  }

  cronRateLimitStore.set(identifier, now)
  return true // Allowed
}

/**
 * Reset cron rate limits (useful for testing)
 */
export function resetCronRateLimits(): void {
  cronRateLimitStore.clear()
}
