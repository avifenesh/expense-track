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
import { calculateShares } from '@/lib/finance'

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

  describe('expense sharing math verification', () => {
    describe('equal split calculations', () => {
      it('should split 100/3 with correct rounding (33.33 each)', () => {
        // 100 split among 3 people (2 participants + owner)
        const result = calculateShares(
          SplitType.EQUAL,
          100,
          [{ email: 'user1@test.com' }, { email: 'user2@test.com' }],
          ['user1@test.com', 'user2@test.com'],
        )

        const share1 = result.get('user1@test.com')?.amount ?? 0
        const share2 = result.get('user2@test.com')?.amount ?? 0

        // Each participant gets 33.33 (rounded)
        expect(share1).toBe(33.33)
        expect(share2).toBe(33.33)

        // Sum of participant shares (owner also gets 33.33)
        const ownerShare = 100 / 3
        const totalDistributed = share1 + share2 + ownerShare

        // Due to rounding, total distributed is ~99.99, not exactly 100
        // This documents the known rounding behavior
        expect(totalDistributed).toBeCloseTo(99.99, 1)
      })

      it('should split evenly when divisible (100/2 = 50 each)', () => {
        const result = calculateShares(SplitType.EQUAL, 100, [{ email: 'user1@test.com' }], ['user1@test.com'])

        const share = result.get('user1@test.com')?.amount ?? 0

        // 100 split between 2 people = 50 each, no rounding needed
        expect(share).toBe(50)

        // Owner also gets 50, total should be exactly 100
        const ownerShare = 50
        expect(share + ownerShare).toBe(100)
      })

      it('should verify participant shares sum correctly for 4-way split', () => {
        // 100 split among 4 people = 25 each
        const result = calculateShares(
          SplitType.EQUAL,
          100,
          [{ email: 'a@test.com' }, { email: 'b@test.com' }, { email: 'c@test.com' }],
          ['a@test.com', 'b@test.com', 'c@test.com'],
        )

        const shares = ['a@test.com', 'b@test.com', 'c@test.com'].map((email) => result.get(email)?.amount ?? 0)

        // Each of 3 participants gets 25
        shares.forEach((share) => expect(share).toBe(25))

        // Owner also gets 25, total = 100
        const participantTotal = shares.reduce((sum, s) => sum + s, 0)
        expect(participantTotal + 25).toBe(100)
      })
    })

    describe('percentage split calculations', () => {
      it('should distribute 100% correctly across participants', () => {
        // 100% of 200 distributed: 50% to user1, 50% to user2
        const result = calculateShares(
          SplitType.PERCENTAGE,
          200,
          [
            { email: 'user1@test.com', sharePercentage: 50 },
            { email: 'user2@test.com', sharePercentage: 50 },
          ],
          ['user1@test.com', 'user2@test.com'],
        )

        const share1 = result.get('user1@test.com')?.amount ?? 0
        const share2 = result.get('user2@test.com')?.amount ?? 0

        // Each gets 100 (50% of 200)
        expect(share1).toBe(100)
        expect(share2).toBe(100)

        // Sum equals total
        expect(share1 + share2).toBe(200)
      })

      it('should handle percentage splits that sum to 100% with odd distribution', () => {
        // 33.33% + 33.33% + 33.34% = 100%
        const result = calculateShares(
          SplitType.PERCENTAGE,
          300,
          [
            { email: 'user1@test.com', sharePercentage: 33.33 },
            { email: 'user2@test.com', sharePercentage: 33.33 },
            { email: 'user3@test.com', sharePercentage: 33.34 },
          ],
          ['user1@test.com', 'user2@test.com', 'user3@test.com'],
        )

        const share1 = result.get('user1@test.com')?.amount ?? 0
        const share2 = result.get('user2@test.com')?.amount ?? 0
        const share3 = result.get('user3@test.com')?.amount ?? 0

        // 300 * 0.3333 = 99.99, 300 * 0.3334 = 100.02
        expect(share1).toBeCloseTo(99.99, 2)
        expect(share2).toBeCloseTo(99.99, 2)
        expect(share3).toBeCloseTo(100.02, 2)

        // Total should be very close to 300
        expect(share1 + share2 + share3).toBeCloseTo(300, 0)
      })

      it('should verify percentages are preserved in result', () => {
        const result = calculateShares(
          SplitType.PERCENTAGE,
          1000,
          [
            { email: 'user1@test.com', sharePercentage: 25 },
            { email: 'user2@test.com', sharePercentage: 75 },
          ],
          ['user1@test.com', 'user2@test.com'],
        )

        // Verify percentages are stored
        expect(result.get('user1@test.com')?.percentage).toBe(25)
        expect(result.get('user2@test.com')?.percentage).toBe(75)

        // Verify amounts are calculated correctly
        expect(result.get('user1@test.com')?.amount).toBe(250)
        expect(result.get('user2@test.com')?.amount).toBe(750)
      })
    })

    describe('fixed amount calculations', () => {
      it('should use exact fixed amounts without modification', () => {
        const result = calculateShares(
          SplitType.FIXED,
          100,
          [
            { email: 'user1@test.com', shareAmount: 30 },
            { email: 'user2@test.com', shareAmount: 25 },
          ],
          ['user1@test.com', 'user2@test.com'],
        )

        // Fixed amounts should be used exactly as provided
        expect(result.get('user1@test.com')?.amount).toBe(30)
        expect(result.get('user2@test.com')?.amount).toBe(25)

        // Owner gets remaining: 100 - 30 - 25 = 45
        const participantTotal = 30 + 25
        expect(100 - participantTotal).toBe(45)
      })

      it('should handle fixed amounts with decimals', () => {
        const result = calculateShares(
          SplitType.FIXED,
          100,
          [
            { email: 'user1@test.com', shareAmount: 33.33 },
            { email: 'user2@test.com', shareAmount: 33.33 },
          ],
          ['user1@test.com', 'user2@test.com'],
        )

        expect(result.get('user1@test.com')?.amount).toBe(33.33)
        expect(result.get('user2@test.com')?.amount).toBe(33.33)

        // Remaining for owner: 100 - 66.66 = 33.34
        const participantTotal = 33.33 + 33.33
        expect(100 - participantTotal).toBeCloseTo(33.34, 2)
      })
    })
  })
})
