import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { Currency, TransactionType, AccountType, SubscriptionStatus } from '@prisma/client'

function mockDecimal(value: number) {
  return { toNumber: () => value }
}

vi.mock('@/lib/api-auth', () => ({
  requireJwtAuth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    account: {
      findMany: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
    },
    budget: {
      findMany: vi.fn(),
    },
    holding: {
      findMany: vi.fn(),
    },
    recurringTemplate: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitTyped: vi.fn().mockReturnValue({ allowed: true, limit: 3, remaining: 2, resetAt: new Date() }),
  incrementRateLimitTyped: vi.fn(),
  resetAllRateLimits: vi.fn(),
  getRateLimitHeaders: vi.fn().mockReturnValue({
    'X-RateLimit-Limit': '3',
    'X-RateLimit-Remaining': '2',
    'X-RateLimit-Reset': '1234567890',
  }),
}))

vi.mock('@/lib/server-logger', () => ({
  serverLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

import { GET } from '@/app/api/v1/auth/export/route'
import { requireJwtAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimitTyped, incrementRateLimitTyped, resetAllRateLimits } from '@/lib/rate-limit'
import { serverLogger } from '@/lib/server-logger'

describe('GET /api/v1/auth/export', () => {
  const mockAuthUser = {
    userId: 'user-123',
    email: 'test@example.com',
  }

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    preferredCurrency: Currency.USD,
    emailVerified: true,
    hasCompletedOnboarding: true,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  }

  const mockAccounts = [
    {
      id: 'acc-1',
      name: 'Personal',
      type: AccountType.SELF,
      preferredCurrency: Currency.USD,
      color: '#4CAF50',
      icon: 'wallet',
      description: 'My personal account',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    },
  ]

  const mockSubscription = {
    id: 'sub-1',
    status: SubscriptionStatus.TRIALING,
    trialEndsAt: new Date('2024-01-15T00:00:00.000Z'),
    currentPeriodStart: null,
    currentPeriodEnd: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  }

  const mockCategories = [
    {
      id: 'cat-1',
      name: 'Food',
      type: TransactionType.EXPENSE,
      color: '#FF5722',
      isHolding: false,
      isArchived: false,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    },
  ]

  const mockTransactions = [
    {
      id: 'tx-1',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: mockDecimal(50.0),
      currency: Currency.USD,
      date: new Date('2024-01-10T00:00:00.000Z'),
      month: new Date('2024-01-01T00:00:00.000Z'),
      description: 'Groceries',
      isRecurring: false,
      isMutual: false,
      createdAt: new Date('2024-01-10T00:00:00.000Z'),
    },
  ]

  const mockBudgets = [
    {
      id: 'budget-1',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      month: new Date('2024-01-01T00:00:00.000Z'),
      planned: mockDecimal(500.0),
      currency: Currency.USD,
      notes: 'Monthly food budget',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    },
  ]

  const mockHoldings = [
    {
      id: 'hold-1',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      symbol: 'AAPL',
      quantity: mockDecimal(10.5),
      averageCost: mockDecimal(150.0),
      currency: Currency.USD,
      notes: 'Apple stock',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    },
  ]

  const mockRecurringTemplates = [
    {
      id: 'rec-1',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: mockDecimal(15.0),
      currency: Currency.USD,
      dayOfMonth: 1,
      description: 'Netflix',
      isActive: true,
      startMonth: new Date('2024-01-01T00:00:00.000Z'),
      endMonth: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    },
  ]

  const buildRequest = (format?: string) => {
    const url = format
      ? `http://localhost/api/v1/auth/export?format=${format}`
      : 'http://localhost/api/v1/auth/export'
    return new NextRequest(url, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer valid-token',
      },
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    resetAllRateLimits()
    vi.mocked(checkRateLimitTyped).mockReturnValue({
      allowed: true,
      limit: 3,
      remaining: 2,
      resetAt: new Date(),
    })

    // Default mock implementations for successful export
    vi.mocked(requireJwtAuth).mockReturnValue(mockAuthUser)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never)
    vi.mocked(prisma.account.findMany).mockResolvedValue(mockAccounts as never)
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(mockSubscription as never)
    vi.mocked(prisma.category.findMany).mockResolvedValue(mockCategories as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTransactions as never)
    vi.mocked(prisma.budget.findMany).mockResolvedValue(mockBudgets as never)
    vi.mocked(prisma.holding.findMany).mockResolvedValue(mockHoldings as never)
    vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue(mockRecurringTemplates as never)
  })

  describe('authentication', () => {
    it('should return 401 if no authorization token provided', async () => {
      vi.mocked(requireJwtAuth).mockImplementation(() => {
        throw new Error('Missing authorization token')
      })

      const response = await GET(buildRequest())

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Missing authorization token')
    })

    it('should return 401 if token is expired', async () => {
      vi.mocked(requireJwtAuth).mockImplementation(() => {
        throw new Error('Token expired')
      })

      const response = await GET(buildRequest())

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Token expired')
    })

    it('should return 401 if token is invalid', async () => {
      vi.mocked(requireJwtAuth).mockImplementation(() => {
        throw new Error('Invalid token')
      })

      const response = await GET(buildRequest())

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Invalid token')
    })

    it('should return 401 if user not found in database', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const response = await GET(buildRequest())

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('User not found')
    })
  })

  describe('rate limiting', () => {
    it('should return 429 when rate limited', async () => {
      const resetAt = new Date(Date.now() + 3600000) // 1 hour from now
      vi.mocked(checkRateLimitTyped).mockReturnValue({
        allowed: false,
        limit: 3,
        remaining: 0,
        resetAt,
      })

      const response = await GET(buildRequest())

      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBeTruthy()
    })

    it('should use data_export rate limit type', async () => {
      await GET(buildRequest())

      expect(checkRateLimitTyped).toHaveBeenCalledWith('user-123', 'data_export')
    })

    it('should increment rate limit after successful export', async () => {
      await GET(buildRequest())

      expect(incrementRateLimitTyped).toHaveBeenCalledWith('user-123', 'data_export')
    })

    it('should not increment rate limit if export fails', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      await GET(buildRequest())

      expect(incrementRateLimitTyped).not.toHaveBeenCalled()
    })
  })

  describe('validation', () => {
    it('should return 400 for invalid format parameter', async () => {
      const response = await GET(buildRequest('xml'))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.fields?.format).toBeDefined()
    })

    it('should accept json format', async () => {
      const response = await GET(buildRequest('json'))

      expect(response.status).toBe(200)
    })

    it('should accept csv format', async () => {
      const response = await GET(buildRequest('csv'))

      expect(response.status).toBe(200)
    })

    it('should default to json when format not specified', async () => {
      const response = await GET(buildRequest())

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.exportedAt).toBeDefined() // JSON format has exportedAt at top level
    })
  })

  describe('successful JSON export', () => {
    it('should return 200 with user data', async () => {
      const response = await GET(buildRequest('json'))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.user.id).toBe('user-123')
      expect(body.data.user.email).toBe('test@example.com')
      expect(body.data.user.displayName).toBe('Test User')
    })

    it('should return subscription data', async () => {
      const response = await GET(buildRequest('json'))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.subscription).not.toBeNull()
      expect(body.data.subscription.status).toBe('TRIALING')
    })

    it('should return accounts data', async () => {
      const response = await GET(buildRequest('json'))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.accounts).toHaveLength(1)
      expect(body.data.accounts[0].name).toBe('Personal')
    })

    it('should return categories data', async () => {
      const response = await GET(buildRequest('json'))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.categories).toHaveLength(1)
      expect(body.data.categories[0].name).toBe('Food')
    })

    it('should return transactions data with proper serialization', async () => {
      const response = await GET(buildRequest('json'))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.transactions).toHaveLength(1)
      expect(body.data.transactions[0].amount).toBe(50)
      expect(body.data.transactions[0].description).toBe('Groceries')
    })

    it('should return budgets data', async () => {
      const response = await GET(buildRequest('json'))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.budgets).toHaveLength(1)
      expect(body.data.budgets[0].planned).toBe(500)
    })

    it('should return holdings data', async () => {
      const response = await GET(buildRequest('json'))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.holdings).toHaveLength(1)
      expect(body.data.holdings[0].symbol).toBe('AAPL')
      expect(body.data.holdings[0].quantity).toBe(10.5)
    })

    it('should return recurring templates data', async () => {
      const response = await GET(buildRequest('json'))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.recurringTemplates).toHaveLength(1)
      expect(body.data.recurringTemplates[0].description).toBe('Netflix')
    })

    it('should include exportedAt timestamp', async () => {
      const response = await GET(buildRequest('json'))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.exportedAt).toBeDefined()
      // Should be a valid ISO date string
      expect(new Date(body.data.exportedAt).toISOString()).toBe(body.data.exportedAt)
    })

    it('should handle user with no subscription', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null)

      const response = await GET(buildRequest('json'))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.subscription).toBeNull()
    })

    it('should handle user with no accounts', async () => {
      vi.mocked(prisma.account.findMany).mockResolvedValue([])

      const response = await GET(buildRequest('json'))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.accounts).toHaveLength(0)
      expect(body.data.transactions).toHaveLength(0)
      expect(body.data.budgets).toHaveLength(0)
      expect(body.data.holdings).toHaveLength(0)
      expect(body.data.recurringTemplates).toHaveLength(0)
    })
  })

  describe('successful CSV export', () => {
    it('should return 200 with CSV data', async () => {
      const response = await GET(buildRequest('csv'))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.format).toBe('csv')
      expect(typeof body.data.data).toBe('string')
    })

    it('should include USER section in CSV', async () => {
      const response = await GET(buildRequest('csv'))

      const body = await response.json()
      const csvData = body.data.data as string
      expect(csvData).toContain('=== USER ===')
      expect(csvData).toContain('id,email,displayName')
      expect(csvData).toContain('test@example.com')
    })

    it('should include SUBSCRIPTION section in CSV', async () => {
      const response = await GET(buildRequest('csv'))

      const body = await response.json()
      const csvData = body.data.data as string
      expect(csvData).toContain('=== SUBSCRIPTION ===')
      expect(csvData).toContain('TRIALING')
    })

    it('should include ACCOUNTS section in CSV', async () => {
      const response = await GET(buildRequest('csv'))

      const body = await response.json()
      const csvData = body.data.data as string
      expect(csvData).toContain('=== ACCOUNTS ===')
      expect(csvData).toContain('Personal')
    })

    it('should include TRANSACTIONS section in CSV', async () => {
      const response = await GET(buildRequest('csv'))

      const body = await response.json()
      const csvData = body.data.data as string
      expect(csvData).toContain('=== TRANSACTIONS ===')
      expect(csvData).toContain('Groceries')
    })

    it('should properly escape CSV values with quotes', async () => {
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([
        {
          ...mockTransactions[0],
          description: 'Item with "quotes" and, comma',
        },
      ] as never)

      const response = await GET(buildRequest('csv'))

      const body = await response.json()
      const csvData = body.data.data as string
      // Should escape double quotes by doubling them
      expect(csvData).toContain('""quotes""')
    })

    it('should omit SUBSCRIPTION section when user has no subscription', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null)

      const response = await GET(buildRequest('csv'))

      const body = await response.json()
      const csvData = body.data.data as string
      expect(csvData).not.toContain('=== SUBSCRIPTION ===')
    })
  })

  describe('data filtering', () => {
    it('should only fetch accounts for the authenticated user', async () => {
      await GET(buildRequest())

      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', deletedAt: null },
        }),
      )
    })

    it('should only fetch categories for the authenticated user', async () => {
      await GET(buildRequest())

      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123' },
        }),
      )
    })

    it('should only fetch transactions for user accounts', async () => {
      await GET(buildRequest())

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accountId: { in: ['acc-1'] }, deletedAt: null },
        }),
      )
    })

    it('should filter out deleted transactions', async () => {
      await GET(buildRequest())

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      )
    })

    it('should filter out deleted budgets', async () => {
      await GET(buildRequest())

      expect(prisma.budget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      )
    })

    it('should filter out deleted recurring templates', async () => {
      await GET(buildRequest())

      expect(prisma.recurringTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      )
    })
  })

  describe('logging', () => {
    it('should log successful export with counts', async () => {
      await GET(buildRequest('json'))

      expect(serverLogger.info).toHaveBeenCalledWith(
        'User data exported (GDPR)',
        expect.objectContaining({
          userId: 'user-123',
          format: 'json',
          counts: expect.objectContaining({
            accounts: 1,
            categories: 1,
            transactions: 1,
            budgets: 1,
            holdings: 1,
            recurringTemplates: 1,
          }),
        }),
      )
    })

    it('should log CSV export with correct format', async () => {
      await GET(buildRequest('csv'))

      expect(serverLogger.info).toHaveBeenCalledWith(
        'User data exported (GDPR)',
        expect.objectContaining({
          format: 'csv',
        }),
      )
    })
  })

  describe('error handling', () => {
    it('should return 500 when database query fails', async () => {
      vi.mocked(prisma.account.findMany).mockRejectedValue(new Error('Database error'))

      const response = await GET(buildRequest())

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('Data export failed')
    })

    it('should log errors when export fails', async () => {
      vi.mocked(prisma.account.findMany).mockRejectedValue(new Error('Database error'))

      await GET(buildRequest())

      expect(serverLogger.error).toHaveBeenCalledWith(
        'Data export failed',
        expect.objectContaining({
          error: 'Database error',
        }),
      )
    })
  })

  describe('rate limit headers', () => {
    it('should include rate limit headers in successful response', async () => {
      const response = await GET(buildRequest())

      expect(response.status).toBe(200)
      // Headers are set by successResponseWithRateLimit
      expect(response.headers.get('X-RateLimit-Limit')).toBe('3')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('2')
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy()
    })
  })
})
