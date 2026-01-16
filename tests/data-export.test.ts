import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Currency, TransactionType, Prisma } from '@prisma/client'

const { Decimal } = Prisma

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    account: {
      findMany: vi.fn(),
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

vi.mock('@/lib/auth', () => ({
  SESSION_COOKIE: 'balance_session',
  USER_COOKIE: 'balance_user',
  ACCOUNT_COOKIE: 'balance_account',
  SESSION_TS_COOKIE: 'balance_session_ts',
  SESSION_MAX_AGE_MS: 30 * 24 * 60 * 60 * 1000,
}))

vi.mock('@/lib/auth-server', () => ({
  verifyCredentials: vi.fn(),
  getDbUserAsAuthUser: vi.fn(),
  requireSession: vi.fn(),
  establishSession: vi.fn().mockResolvedValue(undefined),
  clearSession: vi.fn().mockResolvedValue(undefined),
  updateSessionAccount: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/csrf', () => ({
  validateCsrfToken: vi.fn().mockResolvedValue(true),
  rotateCsrfToken: vi.fn().mockResolvedValue('new-token'),
  requireCsrfToken: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitTyped: vi.fn().mockReturnValue({ allowed: true, limit: 3, remaining: 3, resetAt: new Date() }),
  incrementRateLimitTyped: vi.fn(),
  resetRateLimitTyped: vi.fn(),
  resetAllRateLimits: vi.fn(),
}))

vi.mock('@/app/actions/shared', () => ({
  parseInput: vi.fn((schema, input) => {
    const parsed = schema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    return { data: parsed.data }
  }),
  ensureAccountAccess: vi.fn().mockResolvedValue({
    account: { id: 'acc-1', name: 'Test1', type: 'SELF' },
  }),
  requireCsrfToken: vi.fn().mockResolvedValue({ success: true }),
  requireAuthUser: vi.fn(),
}))

vi.mock('@/lib/server-logger', () => ({
  serverLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { requireCsrfToken, requireAuthUser } from '@/app/actions/shared'
import { checkRateLimitTyped, incrementRateLimitTyped } from '@/lib/rate-limit'
import { exportUserDataAction } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { serverLogger } from '@/lib/server-logger'

const TEST_USER = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  passwordHash: 'hashed-password',
  accountNames: ['Personal'],
  defaultAccountName: 'Personal',
  preferredCurrency: Currency.USD,
  hasCompletedOnboarding: true,
}

const now = new Date()

describe('exportUserDataAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthUser).mockResolvedValue({
      authUser: { ...TEST_USER },
    })
    vi.mocked(requireCsrfToken).mockResolvedValue({ success: true })
    vi.mocked(checkRateLimitTyped).mockReturnValue({
      allowed: true,
      limit: 3,
      remaining: 3,
      resetAt: new Date(),
    })

    // Setup default mock returns
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: TEST_USER.id,
      email: TEST_USER.email,
      displayName: TEST_USER.displayName,
      preferredCurrency: TEST_USER.preferredCurrency,
      emailVerified: true,
      hasCompletedOnboarding: true,
      createdAt: now,
    } as never)

    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      id: 'sub-1',
      status: 'TRIAL',
      trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      currentPeriodStart: null,
      currentPeriodEnd: null,
      createdAt: now,
    } as never)

    vi.mocked(prisma.account.findMany).mockResolvedValue([
      {
        id: 'acc-1',
        name: 'Personal',
        type: 'SELF',
        preferredCurrency: Currency.USD,
        color: '#3b82f6',
        icon: null,
        description: 'My personal account',
        createdAt: now,
      },
    ] as never)

    vi.mocked(prisma.category.findMany).mockResolvedValue([
      {
        id: 'cat-1',
        name: 'Groceries',
        type: TransactionType.EXPENSE,
        color: '#22c55e',
        isHolding: false,
        isArchived: false,
        createdAt: now,
      },
    ] as never)

    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      {
        id: 'txn-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: new Decimal(50.25),
        currency: Currency.USD,
        date: now,
        month: now,
        description: 'Weekly groceries',
        isRecurring: false,
        isMutual: false,
        createdAt: now,
      },
    ] as never)

    vi.mocked(prisma.budget.findMany).mockResolvedValue([
      {
        id: 'budget-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: now,
        planned: new Decimal(500),
        currency: Currency.USD,
        notes: 'Monthly grocery budget',
        createdAt: now,
      },
    ] as never)

    vi.mocked(prisma.holding.findMany).mockResolvedValue([
      {
        id: 'holding-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'AAPL',
        quantity: new Decimal(10),
        averageCost: new Decimal(150),
        currency: Currency.USD,
        notes: 'Tech stocks',
        createdAt: now,
      },
    ] as never)

    vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([
      {
        id: 'recurring-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: new Decimal(100),
        currency: Currency.USD,
        dayOfMonth: 1,
        description: 'Monthly subscription',
        isActive: true,
        startMonth: now,
        endMonth: null,
        createdAt: now,
      },
    ] as never)
  })

  describe('JSON format export', () => {
    it('exports all user data successfully in JSON format', async () => {
      const result = await exportUserDataAction({
        format: 'json',
        csrfToken: 'valid-token',
      })

      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('data')
      if ('data' in result && result.data) {
        expect(result.data.format).toBe('json')
        expect(result.data.data).toHaveProperty('user')
        expect(result.data.data).toHaveProperty('accounts')
        expect(result.data.data).toHaveProperty('categories')
        expect(result.data.data).toHaveProperty('transactions')
        expect(result.data.data).toHaveProperty('budgets')
        expect(result.data.data).toHaveProperty('holdings')
        expect(result.data.data).toHaveProperty('recurringTemplates')
        expect(result.data.data).toHaveProperty('subscription')
        expect(result.data.data).toHaveProperty('exportedAt')
      }
    })

    it('serializes Decimal amounts to numbers', async () => {
      const result = await exportUserDataAction({
        format: 'json',
        csrfToken: 'valid-token',
      })

      if ('data' in result && result.data && result.data.format === 'json') {
        const data = result.data.data
        expect(typeof data.transactions[0].amount).toBe('number')
        expect(data.transactions[0].amount).toBe(50.25)
        expect(typeof data.budgets[0].planned).toBe('number')
        expect(data.budgets[0].planned).toBe(500)
        expect(typeof data.holdings[0].quantity).toBe('number')
        expect(data.holdings[0].quantity).toBe(10)
      }
    })

    it('serializes dates to ISO strings', async () => {
      const result = await exportUserDataAction({
        format: 'json',
        csrfToken: 'valid-token',
      })

      if ('data' in result && result.data && result.data.format === 'json') {
        const data = result.data.data
        expect(typeof data.user.createdAt).toBe('string')
        expect(data.user.createdAt).toBe(now.toISOString())
        expect(typeof data.transactions[0].date).toBe('string')
        expect(data.transactions[0].date).toBe(now.toISOString())
      }
    })

    it('includes user profile without sensitive fields', async () => {
      const result = await exportUserDataAction({
        format: 'json',
        csrfToken: 'valid-token',
      })

      if ('data' in result && result.data && result.data.format === 'json') {
        const user = result.data.data.user
        expect(user.id).toBe(TEST_USER.id)
        expect(user.email).toBe(TEST_USER.email)
        expect(user.displayName).toBe(TEST_USER.displayName)
        expect(user).not.toHaveProperty('passwordHash')
        expect(user).not.toHaveProperty('emailVerificationToken')
      }
    })
  })

  describe('CSV format export', () => {
    it('exports all user data successfully in CSV format', async () => {
      const result = await exportUserDataAction({
        format: 'csv',
        csrfToken: 'valid-token',
      })

      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('data')
      if ('data' in result && result.data) {
        expect(result.data.format).toBe('csv')
        expect(typeof result.data.data).toBe('string')
      }
    })

    it('includes section headers for each data type', async () => {
      const result = await exportUserDataAction({
        format: 'csv',
        csrfToken: 'valid-token',
      })

      if ('data' in result && result.data && result.data.format === 'csv') {
        const csvContent = result.data.data
        expect(csvContent).toContain('=== USER ===')
        expect(csvContent).toContain('=== ACCOUNTS ===')
        expect(csvContent).toContain('=== CATEGORIES ===')
        expect(csvContent).toContain('=== TRANSACTIONS ===')
        expect(csvContent).toContain('=== BUDGETS ===')
        expect(csvContent).toContain('=== HOLDINGS ===')
        expect(csvContent).toContain('=== RECURRING TEMPLATES ===')
      }
    })

    it('includes proper CSV headers for each section', async () => {
      const result = await exportUserDataAction({
        format: 'csv',
        csrfToken: 'valid-token',
      })

      if ('data' in result && result.data && result.data.format === 'csv') {
        const csvContent = result.data.data
        expect(csvContent).toContain('id,email,displayName,preferredCurrency,emailVerified,hasCompletedOnboarding,createdAt')
        expect(csvContent).toContain('id,name,type,preferredCurrency,color,icon,description,createdAt')
        expect(csvContent).toContain('id,accountId,categoryId,type,amount,currency,date,month,description,isRecurring,isMutual,createdAt')
      }
    })

    it('escapes quotes in descriptions', async () => {
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([
        {
          id: 'txn-1',
          accountId: 'acc-1',
          categoryId: 'cat-1',
          type: TransactionType.EXPENSE,
          amount: new Decimal(50.25),
          currency: Currency.USD,
          date: now,
          month: now,
          description: 'Test "quoted" description',
          isRecurring: false,
          isMutual: false,
          createdAt: now,
        },
      ] as never)

      const result = await exportUserDataAction({
        format: 'csv',
        csrfToken: 'valid-token',
      })

      if ('data' in result && result.data && result.data.format === 'csv') {
        const csvContent = result.data.data
        expect(csvContent).toContain('""quoted""')
      }
    })
  })

  describe('authentication and authorization', () => {
    it('requires valid CSRF token', async () => {
      vi.mocked(requireCsrfToken).mockResolvedValueOnce({
        error: { general: ['Security validation failed. Please refresh the page and try again.'] },
      })

      const result = await exportUserDataAction({
        format: 'json',
        csrfToken: 'invalid-token',
      })

      expect('error' in result).toBe(true)
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('requires authenticated user', async () => {
      vi.mocked(requireAuthUser).mockResolvedValueOnce({
        error: { general: ['Your session expired. Please sign in again.'] },
      })

      const result = await exportUserDataAction({
        format: 'json',
        csrfToken: 'valid-token',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general).toContain('Your session expired. Please sign in again.')
      }
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('rate limiting', () => {
    it('enforces rate limit', async () => {
      vi.mocked(checkRateLimitTyped).mockReturnValueOnce({
        allowed: false,
        limit: 3,
        remaining: 0,
        resetAt: new Date(),
      })

      const result = await exportUserDataAction({
        format: 'json',
        csrfToken: 'valid-token',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general).toContain('Too many export requests. Please try again later.')
      }
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('increments rate limit counter on successful export', async () => {
      await exportUserDataAction({
        format: 'json',
        csrfToken: 'valid-token',
      })

      expect(incrementRateLimitTyped).toHaveBeenCalledWith(TEST_USER.id, 'data_export')
    })

    it('uses data_export rate limit type', async () => {
      await exportUserDataAction({
        format: 'json',
        csrfToken: 'valid-token',
      })

      expect(checkRateLimitTyped).toHaveBeenCalledWith(TEST_USER.id, 'data_export')
    })
  })

  describe('logging', () => {
    it('logs successful export with counts', async () => {
      await exportUserDataAction({
        format: 'json',
        csrfToken: 'valid-token',
      })

      expect(serverLogger.info).toHaveBeenCalledWith(
        'User data exported (GDPR)',
        expect.objectContaining({
          action: 'exportUserDataAction',
          userId: TEST_USER.id,
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
  })

  describe('edge cases', () => {
    it('handles user with no data', async () => {
      vi.mocked(prisma.account.findMany).mockResolvedValue([])
      vi.mocked(prisma.category.findMany).mockResolvedValue([])
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null)

      const result = await exportUserDataAction({
        format: 'json',
        csrfToken: 'valid-token',
      })

      expect(result).toHaveProperty('success', true)
      if ('data' in result && result.data && result.data.format === 'json') {
        expect(result.data.data.accounts).toEqual([])
        expect(result.data.data.categories).toEqual([])
        expect(result.data.data.transactions).toEqual([])
        expect(result.data.data.subscription).toBeNull()
      }
    })

    it('handles user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const result = await exportUserDataAction({
        format: 'json',
        csrfToken: 'valid-token',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general).toContain('User not found')
      }
    })

    it('defaults to JSON format when format not specified', async () => {
      const result = await exportUserDataAction({
        csrfToken: 'valid-token',
      } as never)

      expect(result).toHaveProperty('success', true)
      if ('data' in result && result.data) {
        expect(result.data.format).toBe('json')
      }
    })
  })

  describe('schema validation', () => {
    it('rejects invalid format', async () => {
      const result = await exportUserDataAction({
        format: 'xml' as never,
        csrfToken: 'valid-token',
      })

      expect('error' in result).toBe(true)
    })

    it('requires csrfToken', async () => {
      const result = await exportUserDataAction({
        format: 'json',
        csrfToken: '',
      })

      expect('error' in result).toBe(true)
    })
  })
})
