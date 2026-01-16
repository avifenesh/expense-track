import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { SubscriptionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  getSubscriptionState,
  createTrialSubscription,
  activateSubscription,
  markSubscriptionPastDue,
  cancelSubscription,
  expireSubscription,
  hasActiveSubscription,
  getExpiredSubscriptions,
  processExpiredSubscriptions,
  TRIAL_DURATION_DAYS,
  SUBSCRIPTION_PRICE_CENTS,
} from '@/lib/subscription'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

function createMockSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    userId: 'user-1',
    status: SubscriptionStatus.TRIALING,
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    currentPeriodStart: null,
    currentPeriodEnd: null,
    canceledAt: null,
    paymentProvider: null,
    paymentProviderId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('Subscription Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('constants', () => {
    it('should have correct trial duration', () => {
      expect(TRIAL_DURATION_DAYS).toBe(14)
    })

    it('should have correct subscription price', () => {
      expect(SUBSCRIPTION_PRICE_CENTS).toBe(500) // $5.00
    })
  })

  describe('getSubscriptionState', () => {
    it('should return expired state when no subscription exists', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null)

      const state = await getSubscriptionState('user-1')

      expect(state.status).toBe(SubscriptionStatus.EXPIRED)
      expect(state.isActive).toBe(false)
      expect(state.canAccessApp).toBe(false)
      expect(state.trialEndsAt).toBeNull()
      expect(state.daysRemaining).toBeNull()
    })

    it('should return active trial state', async () => {
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.TRIALING,
          trialEndsAt,
        }),
      )

      const state = await getSubscriptionState('user-1')

      expect(state.status).toBe(SubscriptionStatus.TRIALING)
      expect(state.isActive).toBe(true)
      expect(state.canAccessApp).toBe(true)
      expect(state.daysRemaining).toBe(7)
    })

    it('should return expired trial state when trial ended', async () => {
      const trialEndsAt = new Date(Date.now() - 1000) // Already passed
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.TRIALING,
          trialEndsAt,
        }),
      )

      const state = await getSubscriptionState('user-1')

      expect(state.status).toBe(SubscriptionStatus.TRIALING)
      expect(state.isActive).toBe(false)
      expect(state.canAccessApp).toBe(false)
    })

    it('should return active subscription state', async () => {
      const periodEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.ACTIVE,
          trialEndsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        }),
      )

      const state = await getSubscriptionState('user-1')

      expect(state.status).toBe(SubscriptionStatus.ACTIVE)
      expect(state.isActive).toBe(true)
      expect(state.canAccessApp).toBe(true)
      expect(state.daysRemaining).toBe(15)
    })

    it('should allow access during past due grace period', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.PAST_DUE,
        }),
      )

      const state = await getSubscriptionState('user-1')

      expect(state.status).toBe(SubscriptionStatus.PAST_DUE)
      expect(state.canAccessApp).toBe(true)
    })

    it('should allow access when canceled with valid period remaining', async () => {
      const periodEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // 10 days from now
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.CANCELED,
          canceledAt: new Date(),
          currentPeriodEnd: periodEnd,
        }),
      )

      const state = await getSubscriptionState('user-1')

      expect(state.status).toBe(SubscriptionStatus.CANCELED)
      expect(state.canAccessApp).toBe(true)
    })

    it('should deny access when canceled with expired period', async () => {
      const periodEnd = new Date(Date.now() - 1000) // Already passed
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.CANCELED,
          canceledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          currentPeriodEnd: periodEnd,
        }),
      )

      const state = await getSubscriptionState('user-1')

      expect(state.status).toBe(SubscriptionStatus.CANCELED)
      expect(state.canAccessApp).toBe(false)
    })

    it('should deny access when canceled with no period end', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.CANCELED,
          canceledAt: new Date(),
          currentPeriodEnd: null,
        }),
      )

      const state = await getSubscriptionState('user-1')

      expect(state.status).toBe(SubscriptionStatus.CANCELED)
      expect(state.canAccessApp).toBe(false)
    })

    it('should deny access when expired', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.EXPIRED,
        }),
      )

      const state = await getSubscriptionState('user-1')

      expect(state.status).toBe(SubscriptionStatus.EXPIRED)
      expect(state.canAccessApp).toBe(false)
    })
  })

  describe('createTrialSubscription', () => {
    it('should create trial with correct duration', async () => {
      vi.mocked(prisma.subscription.create).mockResolvedValue(createMockSubscription())

      await createTrialSubscription('user-1')

      expect(prisma.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: expect.any(Date),
        }),
      })

      const createCall = vi.mocked(prisma.subscription.create).mock.calls[0][0]
      const trialEndsAt = createCall.data.trialEndsAt as Date
      const now = new Date()
      const diffDays = Math.round((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      expect(diffDays).toBe(TRIAL_DURATION_DAYS)
    })
  })

  describe('activateSubscription', () => {
    it('should activate subscription with period dates', async () => {
      vi.mocked(prisma.subscription.upsert).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.ACTIVE,
        }),
      )

      const periodStart = new Date('2024-06-15T00:00:00Z')
      const periodEnd = new Date('2024-07-15T00:00:00Z')

      await activateSubscription('user-1', periodStart, periodEnd)

      expect(prisma.subscription.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        create: expect.objectContaining({
          userId: 'user-1',
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        }),
        update: expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          canceledAt: null,
        }),
      })
    })
  })

  describe('markSubscriptionPastDue', () => {
    it('should mark subscription as past due', async () => {
      vi.mocked(prisma.subscription.update).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.PAST_DUE,
        }),
      )

      await markSubscriptionPastDue('user-1')

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { status: SubscriptionStatus.PAST_DUE },
      })
    })
  })

  describe('cancelSubscription', () => {
    it('should cancel subscription with timestamp', async () => {
      vi.mocked(prisma.subscription.update).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.CANCELED,
        }),
      )

      await cancelSubscription('user-1')

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          status: SubscriptionStatus.CANCELED,
          canceledAt: expect.any(Date),
        },
      })
    })
  })

  describe('expireSubscription', () => {
    it('should expire subscription', async () => {
      vi.mocked(prisma.subscription.update).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.EXPIRED,
        }),
      )

      await expireSubscription('user-1')

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { status: SubscriptionStatus.EXPIRED },
      })
    })
  })

  describe('hasActiveSubscription', () => {
    it('should return true for active trial', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }),
      )

      const result = await hasActiveSubscription('user-1')
      expect(result).toBe(true)
    })

    it('should return true for active subscription with valid period', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        }),
      )

      const result = await hasActiveSubscription('user-1')
      expect(result).toBe(true)
    })

    it('should return false for active subscription with expired period', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: new Date(Date.now() - 1000), // Already expired
        }),
      )

      const result = await hasActiveSubscription('user-1')
      expect(result).toBe(false)
    })

    it('should return false for active subscription with no period end', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: null,
        }),
      )

      const result = await hasActiveSubscription('user-1')
      expect(result).toBe(false)
    })

    it('should return false for expired subscription', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.EXPIRED,
        }),
      )

      const result = await hasActiveSubscription('user-1')
      expect(result).toBe(false)
    })

    it('should return false for no subscription', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null)

      const result = await hasActiveSubscription('user-1')
      expect(result).toBe(false)
    })
  })

  describe('getExpiredSubscriptions', () => {
    it('should find expired trials', async () => {
      vi.mocked(prisma.subscription.findMany)
        .mockResolvedValueOnce([
          createMockSubscription({ userId: 'user-1' }),
          createMockSubscription({ userId: 'user-2' }),
        ])
        .mockResolvedValueOnce([])

      const result = await getExpiredSubscriptions()

      expect(result).toContain('user-1')
      expect(result).toContain('user-2')
      expect(prisma.subscription.findMany).toHaveBeenCalledWith({
        where: {
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: { lt: expect.any(Date) },
        },
        select: { userId: true },
      })
    })

    it('should find expired periods for active and canceled subscriptions', async () => {
      vi.mocked(prisma.subscription.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([createMockSubscription({ userId: 'user-3' })])

      const result = await getExpiredSubscriptions()

      expect(result).toContain('user-3')
      expect(prisma.subscription.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED] },
          currentPeriodEnd: { lt: expect.any(Date) },
        },
        select: { userId: true },
      })
    })

    it('should return empty array when no expired subscriptions', async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([])

      const result = await getExpiredSubscriptions()

      expect(result).toHaveLength(0)
    })
  })

  describe('processExpiredSubscriptions', () => {
    it('should expire all found expired subscriptions', async () => {
      vi.mocked(prisma.subscription.findMany)
        .mockResolvedValueOnce([
          createMockSubscription({ userId: 'user-1' }),
          createMockSubscription({ userId: 'user-2' }),
        ])
        .mockResolvedValueOnce([createMockSubscription({ userId: 'user-3' })])
      vi.mocked(prisma.subscription.updateMany).mockResolvedValue({ count: 3 })

      const count = await processExpiredSubscriptions()

      expect(count).toBe(3)
      expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { userId: { in: ['user-1', 'user-2', 'user-3'] } },
        data: { status: SubscriptionStatus.EXPIRED },
      })
    })

    it('should return 0 when no expired subscriptions', async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([])

      const count = await processExpiredSubscriptions()

      expect(count).toBe(0)
      expect(prisma.subscription.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle trial ending exactly now', async () => {
      const now = new Date()
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: now,
        }),
      )

      const state = await getSubscriptionState('user-1')

      expect(state.isActive).toBe(false)
      expect(state.canAccessApp).toBe(false)
    })

    it('should calculate days remaining correctly at day boundary', async () => {
      const trialEndsAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) // Exactly 1 day
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.TRIALING,
          trialEndsAt,
        }),
      )

      const state = await getSubscriptionState('user-1')

      expect(state.daysRemaining).toBe(1)
    })

    it('should handle partial days correctly (round up)', async () => {
      const trialEndsAt = new Date(Date.now() + 1.5 * 24 * 60 * 60 * 1000) // 1.5 days
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
        createMockSubscription({
          status: SubscriptionStatus.TRIALING,
          trialEndsAt,
        }),
      )

      const state = await getSubscriptionState('user-1')

      expect(state.daysRemaining).toBe(2) // Rounds up
    })
  })
})
