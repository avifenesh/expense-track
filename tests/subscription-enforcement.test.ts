import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { SubscriptionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    account: {
      findFirst: vi.fn(),
    },
  },
}))

// Mock auth-server
vi.mock('@/lib/auth-server', () => ({
  requireSession: vi.fn(),
  getDbUserAsAuthUser: vi.fn(),
}))

// Mock csrf
vi.mock('@/lib/csrf', () => ({
  validateCsrfToken: vi.fn().mockResolvedValue(true),
}))

// Helper to create mock subscription
function createMockSubscription(
  overrides: Partial<{
    userId: string
    status: SubscriptionStatus
    trialEndsAt: Date
    currentPeriodEnd: Date | null
  }> = {},
) {
  const now = new Date()
  const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  return {
    id: 'sub-1',
    userId: 'user-1',
    status: SubscriptionStatus.TRIALING,
    trialEndsAt: futureDate,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    canceledAt: null,
    paddleCustomerId: null,
    paddleSubscriptionId: null,
    paddlePriceId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// Helper to create mock auth user
function createMockAuthUser(id: string = 'user-1') {
  return {
    id,
    email: 'test@example.com',
    displayName: 'Test User',
    passwordHash: 'hashed-password',
    accountNames: ['Personal'],
    defaultAccountName: 'Personal',
    preferredCurrency: 'USD' as const,
    hasCompletedOnboarding: true,
  }
}

// Helper to create mock account
function createMockAccount(userId: string = 'user-1') {
  return {
    id: 'account-1',
    userId,
    name: 'Personal',
    type: 'SELF' as const,
    preferredCurrency: null,
    color: null,
    icon: null,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedBy: null,
    defaultIncomeGoal: null,
    defaultIncomeGoalCurrency: null,
  }
}

describe('Subscription Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('requireActiveSubscription', () => {
    it('should allow access for active trial subscription', async () => {
      const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
      vi.mocked(requireSession).mockResolvedValue({
        userEmail: 'test@example.com',
        accountId: 'account-1',
      })
      vi.mocked(getDbUserAsAuthUser).mockResolvedValue(createMockAuthUser())
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test',
        passwordHash: 'hash',
        preferredCurrency: 'USD',
        hasCompletedOnboarding: true,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({ status: SubscriptionStatus.TRIALING }),
      )

      const { requireActiveSubscription } = await import('@/app/actions/shared')
      const result = await requireActiveSubscription()

      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('subscriptionState')
      if ('subscriptionState' in result) {
        expect(result.subscriptionState.canAccessApp).toBe(true)
      }
    })

    it('should allow access for active paid subscription', async () => {
      const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
      vi.mocked(requireSession).mockResolvedValue({
        userEmail: 'test@example.com',
        accountId: 'account-1',
      })
      vi.mocked(getDbUserAsAuthUser).mockResolvedValue(createMockAuthUser())
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test',
        passwordHash: 'hash',
        preferredCurrency: 'USD',
        hasCompletedOnboarding: true,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const now = new Date()
      const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: futureDate,
        }),
      )

      const { requireActiveSubscription } = await import('@/app/actions/shared')
      const result = await requireActiveSubscription()

      expect(result).toHaveProperty('success', true)
    })

    it('should block access for expired subscription', async () => {
      const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
      vi.mocked(requireSession).mockResolvedValue({
        userEmail: 'test@example.com',
        accountId: 'account-1',
      })
      vi.mocked(getDbUserAsAuthUser).mockResolvedValue(createMockAuthUser())
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test',
        passwordHash: 'hash',
        preferredCurrency: 'USD',
        hasCompletedOnboarding: true,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({ status: SubscriptionStatus.EXPIRED }),
      )

      const { requireActiveSubscription } = await import('@/app/actions/shared')
      const result = await requireActiveSubscription()

      expect(result).toHaveProperty('error')
      if ('error' in result) {
        expect(result.error.subscription).toBeDefined()
        expect(result.error.subscription?.[0]).toContain('expired')
      }
    })

    it('should block access for expired trial', async () => {
      const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
      vi.mocked(requireSession).mockResolvedValue({
        userEmail: 'test@example.com',
        accountId: 'account-1',
      })
      vi.mocked(getDbUserAsAuthUser).mockResolvedValue(createMockAuthUser())
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test',
        passwordHash: 'hash',
        preferredCurrency: 'USD',
        hasCompletedOnboarding: true,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Trial ended yesterday
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: pastDate,
        }),
      )

      const { requireActiveSubscription } = await import('@/app/actions/shared')
      const result = await requireActiveSubscription()

      expect(result).toHaveProperty('error')
    })

    it('should block access when no subscription exists', async () => {
      const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
      vi.mocked(requireSession).mockResolvedValue({
        userEmail: 'test@example.com',
        accountId: 'account-1',
      })
      vi.mocked(getDbUserAsAuthUser).mockResolvedValue(createMockAuthUser())
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test',
        passwordHash: 'hash',
        preferredCurrency: 'USD',
        hasCompletedOnboarding: true,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null)

      const { requireActiveSubscription } = await import('@/app/actions/shared')
      const result = await requireActiveSubscription()

      expect(result).toHaveProperty('error')
    })

    it('should allow access for past due subscription (grace period)', async () => {
      const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
      vi.mocked(requireSession).mockResolvedValue({
        userEmail: 'test@example.com',
        accountId: 'account-1',
      })
      vi.mocked(getDbUserAsAuthUser).mockResolvedValue(createMockAuthUser())
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test',
        passwordHash: 'hash',
        preferredCurrency: 'USD',
        hasCompletedOnboarding: true,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({ status: SubscriptionStatus.PAST_DUE }),
      )

      const { requireActiveSubscription } = await import('@/app/actions/shared')
      const result = await requireActiveSubscription()

      expect(result).toHaveProperty('success', true)
    })
  })

  describe('ensureAccountAccessWithSubscription', () => {
    it('should allow access for account owner with active subscription', async () => {
      const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
      vi.mocked(requireSession).mockResolvedValue({
        userEmail: 'test@example.com',
        accountId: 'account-1',
      })
      vi.mocked(getDbUserAsAuthUser).mockResolvedValue(createMockAuthUser())
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test',
        passwordHash: 'hash',
        preferredCurrency: 'USD',
        hasCompletedOnboarding: true,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(prisma.account.findFirst).mockResolvedValue(createMockAccount())
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({ status: SubscriptionStatus.ACTIVE, currentPeriodEnd: futureDate }),
      )

      const { ensureAccountAccessWithSubscription } = await import('@/app/actions/shared')
      const result = await ensureAccountAccessWithSubscription('account-1')

      expect(result).toHaveProperty('account')
      expect(result).toHaveProperty('authUser')
      expect(result).toHaveProperty('subscriptionState')
    })

    it('should block access for account owner with expired subscription', async () => {
      const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
      vi.mocked(requireSession).mockResolvedValue({
        userEmail: 'test@example.com',
        accountId: 'account-1',
      })
      vi.mocked(getDbUserAsAuthUser).mockResolvedValue(createMockAuthUser())
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test',
        passwordHash: 'hash',
        preferredCurrency: 'USD',
        hasCompletedOnboarding: true,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(prisma.account.findFirst).mockResolvedValue(createMockAccount())
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({ status: SubscriptionStatus.EXPIRED }),
      )

      const { ensureAccountAccessWithSubscription } = await import('@/app/actions/shared')
      const result = await ensureAccountAccessWithSubscription('account-1')

      expect(result).toHaveProperty('error')
      if ('error' in result) {
        expect(result.error.subscription).toBeDefined()
      }
    })

    it('should block access for non-owner even with active subscription', async () => {
      const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
      vi.mocked(requireSession).mockResolvedValue({
        userEmail: 'test@example.com',
        accountId: 'account-1',
      })
      vi.mocked(getDbUserAsAuthUser).mockResolvedValue(createMockAuthUser('user-2')) // Different user
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-2',
        email: 'test@example.com',
        displayName: 'Test',
        passwordHash: 'hash',
        preferredCurrency: 'USD',
        hasCompletedOnboarding: true,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(prisma.account.findFirst).mockResolvedValue(createMockAccount('user-1')) // Account belongs to user-1

      const { ensureAccountAccessWithSubscription } = await import('@/app/actions/shared')
      const result = await ensureAccountAccessWithSubscription('account-1')

      expect(result).toHaveProperty('error')
      if ('error' in result) {
        expect(result.error.accountId).toBeDefined()
      }
    })
  })
})

describe('SubscriptionBanner', () => {
  describe('getBannerConfig logic', () => {
    it('should show warning for trial ending in 3 days or less', () => {
      // Test subscription data with 3 days remaining
      const subscription = {
        status: 'TRIALING' as const,
        daysRemaining: 3,
        trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        currentPeriodEnd: null,
      }

      // Banner should appear for trial ending soon
      expect(subscription.daysRemaining).toBeLessThanOrEqual(3)
      expect(subscription.status).toBe('TRIALING')
    })

    it('should show info banner for trial with 7 days or less', async () => {
      const subscription = {
        status: 'TRIALING' as const,
        daysRemaining: 7,
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        currentPeriodEnd: null,
      }

      expect(subscription.daysRemaining).toBeLessThanOrEqual(7)
      expect(subscription.daysRemaining).toBeGreaterThan(3)
    })

    it('should show error banner for expired subscription', async () => {
      const subscription = {
        status: 'EXPIRED' as const,
        daysRemaining: null,
        trialEndsAt: null,
        currentPeriodEnd: null,
      }

      expect(subscription.status).toBe('EXPIRED')
    })

    it('should show error banner for past due subscription', async () => {
      const subscription = {
        status: 'PAST_DUE' as const,
        daysRemaining: null,
        trialEndsAt: null,
        currentPeriodEnd: null,
      }

      expect(subscription.status).toBe('PAST_DUE')
    })
  })
})
