import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Currency, type DashboardCache } from '@prisma/client'
import {
  getCachedDashboardData,
  invalidateDashboardCache,
  invalidateAllDashboardCache,
  getCacheMetrics,
  resetCacheMetrics,
  clearInFlightRequests,
} from '@/lib/dashboard-cache'
import type { DashboardData, getAccounts } from '@/lib/finance'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    dashboardCache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

// Mock getDashboardData
vi.mock('@/lib/finance', async () => {
  const actual = await vi.importActual('@/lib/finance')
  return {
    ...actual,
    getDashboardData: vi.fn(),
  }
})

// Import mocked modules
import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/lib/finance'

// Mock dashboard data for testing
const mockDashboardData: DashboardData = {
  month: '2024-01',
  stats: [
    { label: 'Income', amount: 5000, variant: 'positive' },
    { label: 'Expenses', amount: 3000, variant: 'negative' },
    { label: 'Net', amount: 2000, variant: 'positive' },
  ],
  budgets: [],
  transactions: [],
  recurringTemplates: [],
  transactionRequests: [],
  accounts: [],
  categories: [],
  holdings: [],
  comparison: {
    previousMonth: '2023-12',
    previousNet: 1500,
    change: 500,
  },
  history: [],
  exchangeRateLastUpdate: null,
}

describe('dashboard-cache.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetCacheMetrics()
    clearInFlightRequests()
    vi.mocked(getDashboardData).mockResolvedValue(mockDashboardData)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getCachedDashboardData()', () => {
    it('should compute and cache on first request (cache miss)', async () => {
      vi.mocked(prisma.dashboardCache.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.dashboardCache.upsert).mockResolvedValue({} as DashboardCache)

      const result = await getCachedDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      expect(getDashboardData).toHaveBeenCalledTimes(1)
      expect(getDashboardData).toHaveBeenCalledWith({
        monthKey: '2024-01',
        accountId: 'acc1',
        preferredCurrency: undefined,
        accounts: undefined,
      })
      expect(prisma.dashboardCache.upsert).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockDashboardData)

      const metrics = getCacheMetrics()
      expect(metrics.cacheMiss).toBe(1)
      expect(metrics.cacheHit).toBe(0)
    })

    it('should return cached data on second request (cache hit)', async () => {
      const fetchedAt = new Date() // Fresh cache
      vi.mocked(prisma.dashboardCache.findUnique).mockResolvedValue({
        id: '1',
        cacheKey: 'dashboard:2024-01:acc1:DEFAULT',
        data: JSON.stringify(mockDashboardData),
        monthKey: '2024-01',
        accountId: 'acc1',
        preferredCurrency: null,
        fetchedAt,
        createdAt: fetchedAt,
        updatedAt: fetchedAt,
      } as DashboardCache)

      const result = await getCachedDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      expect(getDashboardData).not.toHaveBeenCalled()
      expect(result).toEqual(mockDashboardData)

      const metrics = getCacheMetrics()
      expect(metrics.cacheHit).toBe(1)
      expect(metrics.cacheMiss).toBe(0)
    })

    it('should recompute if cache is stale (>5min old)', async () => {
      const staleDate = new Date(Date.now() - 6 * 60 * 1000) // 6 minutes ago
      vi.mocked(prisma.dashboardCache.findUnique).mockResolvedValue({
        id: '1',
        cacheKey: 'dashboard:2024-01:acc1:DEFAULT',
        data: JSON.stringify(mockDashboardData),
        monthKey: '2024-01',
        accountId: 'acc1',
        preferredCurrency: null,
        fetchedAt: staleDate,
        createdAt: staleDate,
        updatedAt: staleDate,
      } as DashboardCache)
      vi.mocked(prisma.dashboardCache.upsert).mockResolvedValue({} as DashboardCache)

      const result = await getCachedDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      expect(getDashboardData).toHaveBeenCalledTimes(1)
      expect(prisma.dashboardCache.upsert).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockDashboardData)

      const metrics = getCacheMetrics()
      expect(metrics.cacheMiss).toBe(1)
    })

    it('should use fresh cache if within 5min (4min old)', async () => {
      const recentDate = new Date(Date.now() - 4 * 60 * 1000) // 4 minutes ago
      vi.mocked(prisma.dashboardCache.findUnique).mockResolvedValue({
        id: '1',
        cacheKey: 'dashboard:2024-01:acc1:DEFAULT',
        data: JSON.stringify(mockDashboardData),
        monthKey: '2024-01',
        accountId: 'acc1',
        preferredCurrency: null,
        fetchedAt: recentDate,
        createdAt: recentDate,
        updatedAt: recentDate,
      } as DashboardCache)

      await getCachedDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      expect(getDashboardData).not.toHaveBeenCalled()

      const metrics = getCacheMetrics()
      expect(metrics.cacheHit).toBe(1)
    })

    it('should generate different cache keys for different parameters', async () => {
      vi.mocked(prisma.dashboardCache.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.dashboardCache.upsert).mockResolvedValue({} as DashboardCache)

      await getCachedDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
        preferredCurrency: Currency.USD,
      })

      await getCachedDashboardData({
        monthKey: '2024-01',
        accountId: 'acc2',
        preferredCurrency: Currency.USD,
      })

      expect(getDashboardData).toHaveBeenCalledTimes(2)
      expect(prisma.dashboardCache.upsert).toHaveBeenCalledTimes(2)

      const call1 = vi.mocked(prisma.dashboardCache.upsert).mock.calls[0][0]
      const call2 = vi.mocked(prisma.dashboardCache.upsert).mock.calls[1][0]

      expect(call1.where.cacheKey).toBe('dashboard:2024-01:acc1:USD')
      expect(call2.where.cacheKey).toBe('dashboard:2024-01:acc2:USD')
    })

    it('should use "ALL" for undefined accountId in cache key', async () => {
      vi.mocked(prisma.dashboardCache.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.dashboardCache.upsert).mockResolvedValue({} as DashboardCache)

      await getCachedDashboardData({
        monthKey: '2024-01',
      })

      const call = vi.mocked(prisma.dashboardCache.upsert).mock.calls[0][0]
      expect(call.where.cacheKey).toBe('dashboard:2024-01:ALL:DEFAULT')
    })

    it('should handle cache read error and fall through to fresh computation', async () => {
      vi.mocked(prisma.dashboardCache.findUnique).mockRejectedValue(new Error('Database error'))
      vi.mocked(prisma.dashboardCache.upsert).mockResolvedValue({} as DashboardCache)

      const result = await getCachedDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      expect(getDashboardData).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockDashboardData)

      const metrics = getCacheMetrics()
      expect(metrics.cacheError).toBe(1)
      expect(metrics.cacheMiss).toBe(1)
    })

    it('should handle cache write error but return data', async () => {
      vi.mocked(prisma.dashboardCache.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.dashboardCache.upsert).mockRejectedValue(new Error('Write error'))

      const result = await getCachedDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      expect(result).toEqual(mockDashboardData)

      const metrics = getCacheMetrics()
      expect(metrics.cacheError).toBe(1)
      expect(metrics.cacheMiss).toBe(1)
    })

    it('should pass through preferredCurrency parameter', async () => {
      vi.mocked(prisma.dashboardCache.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.dashboardCache.upsert).mockResolvedValue({} as DashboardCache)

      await getCachedDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
        preferredCurrency: Currency.EUR,
      })

      expect(getDashboardData).toHaveBeenCalledWith({
        monthKey: '2024-01',
        accountId: 'acc1',
        preferredCurrency: Currency.EUR,
        accounts: undefined,
      })
    })

    it('should pass through accounts parameter', async () => {
      vi.mocked(prisma.dashboardCache.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.dashboardCache.upsert).mockResolvedValue({} as DashboardCache)

      const mockAccounts = [
        { id: 'acc1', name: 'Account 1' },
        { id: 'acc2', name: 'Account 2' },
      ] as Awaited<ReturnType<typeof getAccounts>>

      await getCachedDashboardData({
        monthKey: '2024-01',
        accounts: mockAccounts,
      })

      expect(getDashboardData).toHaveBeenCalledWith({
        monthKey: '2024-01',
        accountId: undefined,
        preferredCurrency: undefined,
        accounts: mockAccounts,
      })
    })
  })

  describe('invalidateDashboardCache()', () => {
    it('should invalidate specific month+account combination', async () => {
      vi.mocked(prisma.dashboardCache.deleteMany).mockResolvedValue({ count: 1 })

      await invalidateDashboardCache({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      expect(prisma.dashboardCache.deleteMany).toHaveBeenCalledWith({
        where: {
          monthKey: '2024-01',
          OR: [{ accountId: 'acc1' }, { accountId: null }],
        },
      })
    })

    it('should invalidate all accounts for a month', async () => {
      vi.mocked(prisma.dashboardCache.deleteMany).mockResolvedValue({ count: 3 })

      await invalidateDashboardCache({
        monthKey: '2024-01',
      })

      expect(prisma.dashboardCache.deleteMany).toHaveBeenCalledWith({
        where: { monthKey: '2024-01' },
      })
    })

    it('should invalidate all months for an account', async () => {
      vi.mocked(prisma.dashboardCache.deleteMany).mockResolvedValue({ count: 5 })

      await invalidateDashboardCache({
        accountId: 'acc1',
      })

      expect(prisma.dashboardCache.deleteMany).toHaveBeenCalledWith({
        where: { accountId: 'acc1' },
      })
    })

    it('should invalidate all cache when no params provided', async () => {
      vi.mocked(prisma.dashboardCache.deleteMany).mockResolvedValue({ count: 10 })

      await invalidateDashboardCache({})

      expect(prisma.dashboardCache.deleteMany).toHaveBeenCalledWith({})
    })
  })

  describe('invalidateAllDashboardCache()', () => {
    it('should clear all cache entries', async () => {
      vi.mocked(prisma.dashboardCache.deleteMany).mockResolvedValue({ count: 10 })

      await invalidateAllDashboardCache()

      expect(prisma.dashboardCache.deleteMany).toHaveBeenCalledWith({})
    })
  })

  describe('getCacheMetrics()', () => {
    it('should return correct metrics with zero requests', () => {
      const metrics = getCacheMetrics()

      expect(metrics.cacheHit).toBe(0)
      expect(metrics.cacheMiss).toBe(0)
      expect(metrics.cacheError).toBe(0)
      expect(metrics.total).toBe(0)
      expect(metrics.hitRate).toBe(0)
    })

    it('should calculate hit rate correctly', async () => {
      vi.mocked(prisma.dashboardCache.findUnique)
        .mockResolvedValueOnce(null) // Cache miss
        .mockResolvedValueOnce({
          id: '1',
          cacheKey: 'dashboard:2024-01:acc1:DEFAULT',
          data: JSON.stringify(mockDashboardData),
          monthKey: '2024-01',
          accountId: 'acc1',
          preferredCurrency: null,
          fetchedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as DashboardCache) // Cache hit
        .mockResolvedValueOnce({
          id: '1',
          cacheKey: 'dashboard:2024-01:acc1:DEFAULT',
          data: JSON.stringify(mockDashboardData),
          monthKey: '2024-01',
          accountId: 'acc1',
          preferredCurrency: null,
          fetchedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as DashboardCache) // Cache hit

      vi.mocked(prisma.dashboardCache.upsert).mockResolvedValue({} as DashboardCache)

      await getCachedDashboardData({ monthKey: '2024-01', accountId: 'acc1' })
      await getCachedDashboardData({ monthKey: '2024-01', accountId: 'acc1' })
      await getCachedDashboardData({ monthKey: '2024-01', accountId: 'acc1' })

      const metrics = getCacheMetrics()
      expect(metrics.cacheHit).toBe(2)
      expect(metrics.cacheMiss).toBe(1)
      expect(metrics.total).toBe(3)
      expect(metrics.hitRate).toBe(66.67) // 2/3 * 100 = 66.67
    })
  })

  describe('resetCacheMetrics()', () => {
    it('should reset all metrics to zero', async () => {
      vi.mocked(prisma.dashboardCache.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.dashboardCache.upsert).mockResolvedValue({} as DashboardCache)

      // Generate some metrics
      await getCachedDashboardData({ monthKey: '2024-01', accountId: 'acc1' })

      let metrics = getCacheMetrics()
      expect(metrics.cacheMiss).toBe(1)

      // Reset
      resetCacheMetrics()

      metrics = getCacheMetrics()
      expect(metrics.cacheHit).toBe(0)
      expect(metrics.cacheMiss).toBe(0)
      expect(metrics.cacheError).toBe(0)
      expect(metrics.total).toBe(0)
      expect(metrics.hitRate).toBe(0)
    })
  })
})
