import { describe, expect, it, vi } from 'vitest'
import { SplitType } from '@prisma/client'

// Mock all dependencies before importing the module
vi.mock('@/lib/prisma', () => ({
  prisma: {},
}))

vi.mock('@/lib/server-logger', () => ({
  serverLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/auth-server', () => ({
  requireSession: vi.fn(),
  getDbUserAsAuthUser: vi.fn(),
}))

vi.mock('@/lib/csrf', () => ({
  validateCsrfToken: vi.fn(),
}))

vi.mock('@/lib/subscription', () => ({
  hasActiveSubscription: vi.fn(),
  getSubscriptionState: vi.fn(),
}))

vi.mock('@/lib/email', () => ({
  sendExpenseSharedEmail: vi.fn(),
  sendPaymentReminderEmail: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Import after mocks are set up
import { calculateShares } from '@/app/actions/expense-sharing'

describe('calculateShares', () => {
  describe('EQUAL split type', () => {
    it('calculates equal shares for 2 participants', () => {
      const result = calculateShares(
        SplitType.EQUAL,
        100,
        [{ email: 'user1@test.com' }, { email: 'user2@test.com' }],
        ['user1@test.com', 'user2@test.com'],
      )

      expect(result.size).toBe(2)
      // Total 100, split among 3 (2 participants + owner) = 33.33 each
      expect(result.get('user1@test.com')?.amount).toBeCloseTo(33.33, 2)
      expect(result.get('user2@test.com')?.amount).toBeCloseTo(33.33, 2)
      expect(result.get('user1@test.com')?.percentage).toBeNull()
    })

    it('calculates equal shares for single participant', () => {
      const result = calculateShares(SplitType.EQUAL, 100, [{ email: 'user1@test.com' }], ['user1@test.com'])

      expect(result.size).toBe(1)
      // Total 100, split among 2 (1 participant + owner) = 50 each
      expect(result.get('user1@test.com')?.amount).toBe(50)
    })

    it('handles rounding for uneven splits', () => {
      const result = calculateShares(
        SplitType.EQUAL,
        100,
        [{ email: 'a@test.com' }, { email: 'b@test.com' }, { email: 'c@test.com' }, { email: 'd@test.com' }],
        ['a@test.com', 'b@test.com', 'c@test.com', 'd@test.com'],
      )

      // 100 / 5 = 20 each
      expect(result.get('a@test.com')?.amount).toBe(20)
      expect(result.get('b@test.com')?.amount).toBe(20)
    })

    it('handles case-insensitive emails', () => {
      const result = calculateShares(SplitType.EQUAL, 100, [{ email: 'USER1@TEST.COM' }], ['user1@test.com'])

      expect(result.size).toBe(1)
      expect(result.get('user1@test.com')?.amount).toBe(50)
    })
  })

  describe('PERCENTAGE split type', () => {
    it('calculates percentage-based shares', () => {
      const result = calculateShares(
        SplitType.PERCENTAGE,
        200,
        [
          { email: 'user1@test.com', sharePercentage: 25 },
          { email: 'user2@test.com', sharePercentage: 15 },
        ],
        ['user1@test.com', 'user2@test.com'],
      )

      expect(result.get('user1@test.com')?.amount).toBe(50) // 200 * 0.25
      expect(result.get('user1@test.com')?.percentage).toBe(25)
      expect(result.get('user2@test.com')?.amount).toBe(30) // 200 * 0.15
      expect(result.get('user2@test.com')?.percentage).toBe(15)
    })

    it('handles missing percentage as 0', () => {
      const result = calculateShares(SplitType.PERCENTAGE, 100, [{ email: 'user1@test.com' }], ['user1@test.com'])

      expect(result.get('user1@test.com')?.amount).toBe(0)
      expect(result.get('user1@test.com')?.percentage).toBe(0)
    })

    it('handles decimal percentages', () => {
      const result = calculateShares(
        SplitType.PERCENTAGE,
        1000,
        [{ email: 'user1@test.com', sharePercentage: 33.33 }],
        ['user1@test.com'],
      )

      expect(result.get('user1@test.com')?.amount).toBeCloseTo(333.3, 1)
      expect(result.get('user1@test.com')?.percentage).toBe(33.33)
    })

    it('ignores participants not in validEmails', () => {
      const result = calculateShares(
        SplitType.PERCENTAGE,
        100,
        [
          { email: 'valid@test.com', sharePercentage: 50 },
          { email: 'invalid@test.com', sharePercentage: 50 },
        ],
        ['valid@test.com'],
      )

      expect(result.size).toBe(1)
      expect(result.has('invalid@test.com')).toBe(false)
    })
  })

  describe('FIXED split type', () => {
    it('uses fixed amounts directly', () => {
      const result = calculateShares(
        SplitType.FIXED,
        100,
        [
          { email: 'user1@test.com', shareAmount: 30 },
          { email: 'user2@test.com', shareAmount: 45 },
        ],
        ['user1@test.com', 'user2@test.com'],
      )

      expect(result.get('user1@test.com')?.amount).toBe(30)
      expect(result.get('user2@test.com')?.amount).toBe(45)
      expect(result.get('user1@test.com')?.percentage).toBeNull()
    })

    it('handles missing amount as 0', () => {
      const result = calculateShares(SplitType.FIXED, 100, [{ email: 'user1@test.com' }], ['user1@test.com'])

      expect(result.get('user1@test.com')?.amount).toBe(0)
    })

    it('allows amounts exceeding total (validation happens elsewhere)', () => {
      const result = calculateShares(
        SplitType.FIXED,
        100,
        [{ email: 'user1@test.com', shareAmount: 150 }],
        ['user1@test.com'],
      )

      expect(result.get('user1@test.com')?.amount).toBe(150)
    })
  })

  describe('edge cases', () => {
    it('returns empty map for empty participants', () => {
      const result = calculateShares(SplitType.EQUAL, 100, [], [])

      expect(result.size).toBe(0)
    })

    it('handles zero total amount', () => {
      const result = calculateShares(SplitType.EQUAL, 0, [{ email: 'user1@test.com' }], ['user1@test.com'])

      expect(result.get('user1@test.com')?.amount).toBe(0)
    })

    it('handles very small amounts', () => {
      const result = calculateShares(SplitType.EQUAL, 0.01, [{ email: 'user1@test.com' }], ['user1@test.com'])

      expect(result.get('user1@test.com')?.amount).toBeCloseTo(0.01, 2)
    })

    it('handles large amounts', () => {
      const result = calculateShares(SplitType.EQUAL, 1000000, [{ email: 'user1@test.com' }], ['user1@test.com'])

      expect(result.get('user1@test.com')?.amount).toBe(500000)
    })
  })
})
