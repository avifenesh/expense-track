/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Currency, Prisma } from '@prisma/client'

// 1. Mock @prisma/client FIRST (enums & Decimal)
vi.mock('@prisma/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@prisma/client')>()
  return {
    ...original,
    Currency: { USD: 'USD', EUR: 'EUR', ILS: 'ILS' },
    Prisma: {
      Decimal: class {
        constructor(public value: any) {}
        toNumber() {
          return Number(this.value)
        }
        toFixed(decimals: number) {
          return Number(this.value).toFixed(decimals)
        }
      },
    },
  }
})

// 2. Mock @/lib/prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    budget: {
      upsert: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

// 3. Mock dependencies
vi.mock('@/app/actions/shared', () => ({
  toDecimalString: vi.fn((n) => n.toFixed(2)),
}))

// 4. Import AFTER all mocks
import { upsertBudget, deleteBudget, getBudgetByKey } from '@/lib/services/budget-service'
import { prisma } from '@/lib/prisma'
import { toDecimalString } from '@/app/actions/shared'

describe('budget-service.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('upsertBudget', () => {
    it('should create new budget with Prisma upsert', async () => {
      const mockBudget = {
        id: 'budget-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: new Prisma.Decimal('1000.00'),
        currency: Currency.USD,
        notes: 'Monthly grocery budget',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget)

      const result = await upsertBudget({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 1000.0,
        currency: Currency.USD,
        notes: 'Monthly grocery budget',
      })

      expect(toDecimalString).toHaveBeenCalledWith(1000.0)
      expect(prisma.budget.upsert).toHaveBeenCalledWith({
        where: {
          accountId_categoryId_month: {
            accountId: 'acc-1',
            categoryId: 'cat-1',
            month: new Date('2024-01-01'),
          },
        },
        update: {
          planned: expect.any(Prisma.Decimal),
          currency: Currency.USD,
          notes: 'Monthly grocery budget',
        },
        create: {
          accountId: 'acc-1',
          categoryId: 'cat-1',
          month: new Date('2024-01-01'),
          planned: expect.any(Prisma.Decimal),
          currency: Currency.USD,
          notes: 'Monthly grocery budget',
        },
      })
      expect(result).toEqual(mockBudget)
    })

    it('should update existing budget', async () => {
      const mockUpdatedBudget = {
        id: 'budget-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: new Prisma.Decimal('1500.00'),
        currency: Currency.USD,
        notes: 'Updated budget',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockUpdatedBudget)

      const result = await upsertBudget({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 1500.0,
        currency: Currency.USD,
        notes: 'Updated budget',
      })

      expect(result.planned).toEqual(new Prisma.Decimal('1500.00'))
      expect(result.notes).toBe('Updated budget')
    })

    it('should convert decimal precision correctly via toDecimalString', async () => {
      const mockBudget = {
        id: 'budget-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: new Prisma.Decimal('1000.46'),
        currency: Currency.USD,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget)
      vi.mocked(toDecimalString).mockReturnValue('1000.46')

      await upsertBudget({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 1000.456,
        currency: Currency.USD,
      })

      // Verify toDecimalString was called with the original number
      expect(toDecimalString).toHaveBeenCalledWith(1000.456)

      // Verify Prisma.Decimal was constructed with the rounded string
      const upsertCall = vi.mocked(prisma.budget.upsert).mock.calls[0][0]
      expect(upsertCall.create.planned).toBeInstanceOf(Prisma.Decimal)
      expect(upsertCall.update.planned).toBeInstanceOf(Prisma.Decimal)
    })

    it('should handle null notes correctly', async () => {
      const mockBudget = {
        id: 'budget-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: new Prisma.Decimal('500.00'),
        currency: Currency.EUR,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget)

      await upsertBudget({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 500.0,
        currency: Currency.EUR,
        // notes is undefined
      })

      const upsertCall = vi.mocked(prisma.budget.upsert).mock.calls[0][0]
      expect(upsertCall.create.notes).toBeNull()
      expect(upsertCall.update.notes).toBeNull()
    })

    it('should use composite key for uniqueness', async () => {
      const mockBudget = {
        id: 'budget-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: new Prisma.Decimal('300.00'),
        currency: Currency.ILS,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget)

      await upsertBudget({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 300.0,
        currency: Currency.ILS,
      })

      const upsertCall = vi.mocked(prisma.budget.upsert).mock.calls[0][0]
      expect(upsertCall.where).toEqual({
        accountId_categoryId_month: {
          accountId: 'acc-1',
          categoryId: 'cat-1',
          month: new Date('2024-01-01'),
        },
      })
    })
  })

  describe('deleteBudget', () => {
    it('should delete budget by composite key', async () => {
      const mockDeletedBudget = {
        id: 'budget-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: new Prisma.Decimal('1000.00'),
        currency: Currency.USD,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.delete).mockResolvedValue(mockDeletedBudget)

      const result = await deleteBudget({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
      })

      expect(prisma.budget.delete).toHaveBeenCalledWith({
        where: {
          accountId_categoryId_month: {
            accountId: 'acc-1',
            categoryId: 'cat-1',
            month: new Date('2024-01-01'),
          },
        },
      })
      expect(result).toEqual(mockDeletedBudget)
    })

    it('should propagate Prisma error for non-existent budget', async () => {
      const prismaError = new Error('Record to delete does not exist')
      prismaError.name = 'PrismaClientKnownRequestError'

      vi.mocked(prisma.budget.delete).mockRejectedValue(prismaError)

      await expect(
        deleteBudget({
          accountId: 'non-existent',
          categoryId: 'cat-1',
          month: new Date('2024-01-01'),
        }),
      ).rejects.toThrow('Record to delete does not exist')
    })

    it('should handle Date object in where clause correctly', async () => {
      const testDate = new Date('2024-02-01T00:00:00.000Z')
      const mockBudget = {
        id: 'budget-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: testDate,
        planned: new Prisma.Decimal('750.00'),
        currency: Currency.USD,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.delete).mockResolvedValue(mockBudget)

      await deleteBudget({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: testDate,
      })

      const deleteCall = vi.mocked(prisma.budget.delete).mock.calls[0][0]
      expect(deleteCall.where.accountId_categoryId_month.month).toBe(testDate)
      expect(deleteCall.where.accountId_categoryId_month.month).toBeInstanceOf(Date)
    })
  })

  describe('getBudgetByKey', () => {
    it('should return budget when found', async () => {
      const mockBudget = {
        id: 'budget-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: new Prisma.Decimal('1000.00'),
        currency: Currency.USD,
        notes: 'Test budget',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.findUnique).mockResolvedValue(mockBudget)

      const result = await getBudgetByKey({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
      })

      expect(prisma.budget.findUnique).toHaveBeenCalledWith({
        where: {
          accountId_categoryId_month: {
            accountId: 'acc-1',
            categoryId: 'cat-1',
            month: new Date('2024-01-01'),
          },
        },
      })
      expect(result).toEqual(mockBudget)
    })

    it('should return null when budget not found', async () => {
      vi.mocked(prisma.budget.findUnique).mockResolvedValue(null)

      const result = await getBudgetByKey({
        accountId: 'non-existent',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
      })

      expect(result).toBeNull()
    })

    it('should use correct composite key structure', async () => {
      vi.mocked(prisma.budget.findUnique).mockResolvedValue(null)

      await getBudgetByKey({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
      })

      const findCall = vi.mocked(prisma.budget.findUnique).mock.calls[0][0]
      expect(findCall.where).toHaveProperty('accountId_categoryId_month')
      expect(findCall.where.accountId_categoryId_month).toEqual({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
      })
    })

    it('should return all Budget fields when found', async () => {
      const mockBudget = {
        id: 'budget-123',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-03-01'),
        planned: new Prisma.Decimal('2500.50'),
        currency: Currency.EUR,
        notes: 'Detailed notes',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-20'),
      }

      vi.mocked(prisma.budget.findUnique).mockResolvedValue(mockBudget)

      const result = await getBudgetByKey({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-03-01'),
      })

      // Verify all fields are present
      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('accountId')
      expect(result).toHaveProperty('categoryId')
      expect(result).toHaveProperty('month')
      expect(result).toHaveProperty('planned')
      expect(result).toHaveProperty('currency')
      expect(result).toHaveProperty('notes')
      expect(result).toHaveProperty('createdAt')
      expect(result).toHaveProperty('updatedAt')
      expect(result).toEqual(mockBudget)
    })
  })
})
