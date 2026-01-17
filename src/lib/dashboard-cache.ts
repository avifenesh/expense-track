// Dashboard caching module - caches expensive dashboard aggregations
import { Currency } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Cache TTL: 5 minutes
const CACHE_TTL_SECONDS = 5 * 60

// In-memory request deduplication (per-process)
// Using 'unknown' for generic deduplication across different data types
const inFlightRequests = new Map<string, Promise<unknown>>()

// Cache metrics (per-process)
const metrics = {
  cacheHit: 0,
  cacheMiss: 0,
  cacheError: 0,
  lastReset: new Date(),
}

/**
 * Generate cache key from dashboard parameters
 */
function generateCacheKey(params: {
  monthKey: string
  accountId?: string
  preferredCurrency?: Currency
  userId?: string
}): string {
  const account = params.accountId || 'ALL'
  const currency = params.preferredCurrency || 'DEFAULT'
  const user = params.userId || 'ANON'
  return `dashboard:${user}:${params.monthKey}:${account}:${currency}`
}

/**
 * Generic cache function that accepts a compute function.
 * Decouples caching logic from specific data computation.
 *
 * @param cacheKey - Unique key for this cached data
 * @param computeFn - Function that computes the data if cache miss
 * @param metadata - Optional metadata for cache storage (monthKey, accountId, preferredCurrency)
 * @returns The cached or freshly computed data
 */
export async function getCachedData<T>(
  cacheKey: string,
  computeFn: () => Promise<T>,
  metadata?: {
    monthKey?: string
    accountId?: string | null
    preferredCurrency?: Currency | null
  },
): Promise<T> {
  // 1. Check in-flight request deduplication
  const existing = inFlightRequests.get(cacheKey)
  if (existing) {
    return existing as Promise<T>
  }

  // 2. Check database cache (with TTL)
  const TTL_THRESHOLD = new Date(Date.now() - CACHE_TTL_SECONDS * 1000)

  try {
    const cached = await prisma.dashboardCache.findUnique({
      where: { cacheKey },
    })

    if (cached && cached.fetchedAt > TTL_THRESHOLD) {
      // Cache hit - return cached data
      metrics.cacheHit++
      return JSON.parse(cached.data as string) as T
    }
  } catch {
    // Cache read error - fall through to fresh computation
    metrics.cacheError++
  }

  // 3. Cache miss or stale - compute fresh data with deduplication
  const computePromise = (async () => {
    try {
      const data = await computeFn()

      // Store in cache
      try {
        const dataJson = JSON.stringify(data)
        await prisma.dashboardCache.upsert({
          where: { cacheKey },
          update: {
            data: dataJson,
            fetchedAt: new Date(),
          },
          create: {
            cacheKey,
            data: dataJson,
            monthKey: metadata?.monthKey || '',
            accountId: metadata?.accountId || null,
            preferredCurrency: metadata?.preferredCurrency || null,
            fetchedAt: new Date(),
          },
        })
      } catch {
        // Cache write error - don't fail the request
        metrics.cacheError++
      }

      metrics.cacheMiss++
      return data
    } finally {
      // Clean up in-flight tracking
      inFlightRequests.delete(cacheKey)
    }
  })()

  inFlightRequests.set(cacheKey, computePromise)
  return computePromise
}

// Lazy import to break circular dependency
let getDashboardDataFn: typeof import('@/lib/finance').getDashboardData | null = null
let getAccountsFn: typeof import('@/lib/finance').getAccounts | null = null

async function ensureFinanceImports() {
  if (!getDashboardDataFn || !getAccountsFn) {
    const finance = await import('@/lib/finance')
    getDashboardDataFn = finance.getDashboardData
    getAccountsFn = finance.getAccounts
  }
  return { getDashboardData: getDashboardDataFn, getAccounts: getAccountsFn }
}

// Import the DashboardData type for backward compatibility
type DashboardData = import('@/lib/finance').DashboardData
type AccountsResult = Awaited<ReturnType<typeof import('@/lib/finance').getAccounts>>

/**
 * Get cached dashboard data or compute and cache if missing/stale
 * Implements request deduplication to prevent thundering herd
 *
 * Note: If accounts are pre-fetched and provided, caching is bypassed
 * to avoid cache key complexity with arrays
 */
export async function getCachedDashboardData(params: {
  monthKey: string
  accountId: string
  preferredCurrency?: Currency
  accounts?: AccountsResult
  userId?: string
}): Promise<DashboardData> {
  const { getDashboardData } = await ensureFinanceImports()

  // If accounts are explicitly provided, bypass cache (used for pre-fetched data optimization)
  if (params.accounts) {
    return getDashboardData(params)
  }

  const cacheKey = generateCacheKey(params)

  return getCachedData<DashboardData>(
    cacheKey,
    () => getDashboardData(params),
    {
      monthKey: params.monthKey,
      accountId: params.accountId || null,
      preferredCurrency: params.preferredCurrency || null,
    },
  )
}

/**
 * Invalidate dashboard cache entries
 * Supports targeted invalidation by monthKey and/or accountId
 * Falls back to broad invalidation if context is unclear
 */
export async function invalidateDashboardCache(params: { monthKey?: string; accountId?: string }): Promise<void> {
  // Clear matching in-flight requests to prevent race conditions
  // Cache key format: dashboard:userId:monthKey:accountId:currency
  Array.from(inFlightRequests.keys()).forEach((key) => {
    const [, , monthKey, accountId] = key.split(':')
    const matches =
      (!params.monthKey || monthKey === params.monthKey) &&
      (!params.accountId || accountId === params.accountId || accountId === 'ALL')
    if (matches) {
      inFlightRequests.delete(key)
    }
  })

  if (params.monthKey && params.accountId) {
    // Most precise: invalidate specific month+account combinations
    // Also invalidate "ALL accounts" view since changes affect aggregate totals
    await prisma.dashboardCache.deleteMany({
      where: {
        monthKey: params.monthKey,
        OR: [
          { accountId: params.accountId },
          { accountId: null }, // "ALL accounts" view
        ],
      },
    })
  } else if (params.monthKey) {
    // Invalidate all accounts for this month
    await prisma.dashboardCache.deleteMany({
      where: { monthKey: params.monthKey },
    })
  } else if (params.accountId) {
    // Invalidate all months for this account
    await prisma.dashboardCache.deleteMany({
      where: { accountId: params.accountId },
    })
  } else {
    // Fallback: clear all cache (safest when context unknown)
    await prisma.dashboardCache.deleteMany({})
  }
}

/**
 * Clear all dashboard cache entries
 * Use when broad invalidation is needed (e.g., holdings updates)
 */
export async function invalidateAllDashboardCache(): Promise<void> {
  inFlightRequests.clear()
  await prisma.dashboardCache.deleteMany({})
}

/**
 * Get cache performance metrics
 */
export function getCacheMetrics() {
  const total = metrics.cacheHit + metrics.cacheMiss
  const hitRate = total > 0 ? (metrics.cacheHit / total) * 100 : 0

  return {
    ...metrics,
    hitRate: Math.round(hitRate * 100) / 100,
    total,
  }
}

/**
 * Reset cache metrics counters
 * Useful for testing and periodic reset
 */
export function resetCacheMetrics(): void {
  metrics.cacheHit = 0
  metrics.cacheMiss = 0
  metrics.cacheError = 0
  metrics.lastReset = new Date()
}

/**
 * Get in-flight requests count (for testing)
 */
export function getInFlightRequestsCount(): number {
  return inFlightRequests.size
}

/**
 * Clear in-flight requests (for testing)
 */
export function clearInFlightRequests(): void {
  inFlightRequests.clear()
}
