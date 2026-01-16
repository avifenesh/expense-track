import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Category, Holding, RecurringTemplate, Transaction, Account } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  ensureApiCategoryOwnership,
  ensureApiHoldingOwnership,
  ensureApiRecurringOwnership,
  ensureApiTransactionOwnership,
  ensureApiAccountOwnership,
} from '@/lib/api-auth-helpers'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    category: { findFirst: vi.fn() },
    holding: { findFirst: vi.fn() },
    recurringTemplate: { findFirst: vi.fn() },
    transaction: { findFirst: vi.fn() },
    account: { findFirst: vi.fn() },
  },
}))

describe('api-auth-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ensureApiCategoryOwnership', () => {
    it('returns allowed=true when category belongs to user', async () => {
      vi.mocked(prisma.category.findFirst).mockResolvedValue({
        id: 'cat-1',
        userId: 'user-1',
        name: 'Groceries',
      } as Category)

      const result = await ensureApiCategoryOwnership('cat-1', 'user-1')

      expect(result).toEqual({ allowed: true })
      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: { id: 'cat-1', userId: 'user-1' },
      })
    })

    it('returns allowed=false when category does not exist', async () => {
      vi.mocked(prisma.category.findFirst).mockResolvedValue(null)

      const result = await ensureApiCategoryOwnership('nonexistent', 'user-1')

      expect(result).toEqual({ allowed: false, reason: 'Category not found or access denied' })
    })

    it('returns allowed=false when category belongs to different user', async () => {
      vi.mocked(prisma.category.findFirst).mockResolvedValue(null)

      const result = await ensureApiCategoryOwnership('cat-1', 'attacker-user')

      expect(result).toEqual({ allowed: false, reason: 'Category not found or access denied' })
      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: { id: 'cat-1', userId: 'attacker-user' },
      })
    })
  })

  describe('ensureApiHoldingOwnership', () => {
    it('returns allowed=true when holding belongs to user via account', async () => {
      vi.mocked(prisma.holding.findFirst).mockResolvedValue({
        id: 'holding-1',
        accountId: 'acc-1',
        symbol: 'AAPL',
      } as Holding)

      const result = await ensureApiHoldingOwnership('holding-1', 'user-1')

      expect(result).toEqual({ allowed: true })
      expect(prisma.holding.findFirst).toHaveBeenCalledWith({
        where: { id: 'holding-1', account: { userId: 'user-1' } },
      })
    })

    it('returns allowed=false when holding does not exist', async () => {
      vi.mocked(prisma.holding.findFirst).mockResolvedValue(null)

      const result = await ensureApiHoldingOwnership('nonexistent', 'user-1')

      expect(result).toEqual({ allowed: false, reason: 'Holding not found or access denied' })
    })

    it('returns allowed=false when holding belongs to different user', async () => {
      vi.mocked(prisma.holding.findFirst).mockResolvedValue(null)

      const result = await ensureApiHoldingOwnership('holding-1', 'attacker-user')

      expect(result).toEqual({ allowed: false, reason: 'Holding not found or access denied' })
    })
  })

  describe('ensureApiRecurringOwnership', () => {
    it('returns allowed=true when recurring template belongs to user via account', async () => {
      vi.mocked(prisma.recurringTemplate.findFirst).mockResolvedValue({
        id: 'rec-1',
        accountId: 'acc-1',
        description: 'Netflix',
      } as RecurringTemplate)

      const result = await ensureApiRecurringOwnership('rec-1', 'user-1')

      expect(result).toEqual({ allowed: true })
      expect(prisma.recurringTemplate.findFirst).toHaveBeenCalledWith({
        where: { id: 'rec-1', account: { userId: 'user-1' } },
      })
    })

    it('returns allowed=false when recurring template does not exist', async () => {
      vi.mocked(prisma.recurringTemplate.findFirst).mockResolvedValue(null)

      const result = await ensureApiRecurringOwnership('nonexistent', 'user-1')

      expect(result).toEqual({ allowed: false, reason: 'Recurring template not found or access denied' })
    })

    it('returns allowed=false when recurring template belongs to different user', async () => {
      vi.mocked(prisma.recurringTemplate.findFirst).mockResolvedValue(null)

      const result = await ensureApiRecurringOwnership('rec-1', 'attacker-user')

      expect(result).toEqual({ allowed: false, reason: 'Recurring template not found or access denied' })
    })
  })

  describe('ensureApiTransactionOwnership', () => {
    it('returns allowed=true when transaction belongs to user via account', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
        id: 'tx-1',
        accountId: 'acc-1',
        description: 'Lunch',
      } as Transaction)

      const result = await ensureApiTransactionOwnership('tx-1', 'user-1')

      expect(result).toEqual({ allowed: true })
      expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
        where: { id: 'tx-1', account: { userId: 'user-1' } },
      })
    })

    it('returns allowed=false when transaction does not exist', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)

      const result = await ensureApiTransactionOwnership('nonexistent', 'user-1')

      expect(result).toEqual({ allowed: false, reason: 'Transaction not found or access denied' })
    })

    it('returns allowed=false when transaction belongs to different user', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)

      const result = await ensureApiTransactionOwnership('tx-1', 'attacker-user')

      expect(result).toEqual({ allowed: false, reason: 'Transaction not found or access denied' })
    })
  })

  describe('ensureApiAccountOwnership', () => {
    it('returns allowed=true when account belongs to user', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        id: 'acc-1',
        userId: 'user-1',
        name: 'Main',
      } as Account)

      const result = await ensureApiAccountOwnership('acc-1', 'user-1')

      expect(result).toEqual({ allowed: true })
      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: { id: 'acc-1', userId: 'user-1' },
      })
    })

    it('returns allowed=false when account does not exist', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null)

      const result = await ensureApiAccountOwnership('nonexistent', 'user-1')

      expect(result).toEqual({ allowed: false, reason: 'Account not found or access denied' })
    })

    it('returns allowed=false when account belongs to different user', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null)

      const result = await ensureApiAccountOwnership('acc-1', 'attacker-user')

      expect(result).toEqual({ allowed: false, reason: 'Account not found or access denied' })
    })
  })
})
