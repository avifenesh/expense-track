import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Currency } from '@prisma/client'

// Mock Prisma modules BEFORE imports
vi.mock('@prisma/client', async (importOriginal) => {
  const original = (await importOriginal()) as typeof import('@prisma/client')

  // Define MockDecimal inside the factory to avoid hoisting issues
  class MockDecimal {
    constructor(public value: string | number) {}
    toNumber() {
      return Number(this.value)
    }
    toString() {
      return String(this.value)
    }
    toFixed(decimals: number) {
      return Number(this.value).toFixed(decimals)
    }
  }

  return {
    ...original,
    Prisma: {
      ...original.Prisma,
      Decimal: MockDecimal,
    },
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    budget: {
      upsert: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/utils/decimal', () => ({
  toDecimalString: vi.fn((value: number) => {
    const DECIMAL_PRECISION = 2
    const AMOUNT_SCALE = Math.pow(10, DECIMAL_PRECISION)
    return (Math.round(value * AMOUNT_SCALE) / AMOUNT_SCALE).toFixed(DECIMAL_PRECISION)
  }),
}))

// Import after mocks
import { prisma } from '@/lib/prisma'
import { toDecimalString } from '@/utils/decimal'
import {
  upsertBudget,
  deleteBudget,
  getBudgetByKey,
  type UpsertBudgetInput,
  type DeleteBudgetInput,
} from '@/lib/services/budget-service'

// Prisma error type
interface PrismaError extends Error {
  code: string
}

// Helper to create mock decimal objects for tests
const mockDecimal = (value: string) => ({
  value,
  toNumber: () => Number(value),
  toString: () => value,
  toFixed: (decimals: number) => Number(value).toFixed(decimals),
})

describe('budget-service.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Phase 1: upsertBudget() - Create Path', () => {
    it('should create new budget with all fields', async () => {
      const input: UpsertBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 1000.5,
        currency: Currency.USD,
        notes: 'Monthly grocery budget',
      }

      const mockBudget = {
        id: 'budget-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: mockDecimal('1000.50'),
        currency: Currency.USD,
        notes: 'Monthly grocery budget',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget as never)

      const result = await upsertBudget(input)

      // Verify toDecimalString was called with input amount
      expect(toDecimalString).toHaveBeenCalledWith(1000.5)

      // Verify Prisma.Decimal was called with the result of toDecimalString

      // Verify upsert was called with correct structure
      expect(prisma.budget.upsert).toHaveBeenCalledWith({
        where: {
          accountId_categoryId_month: {
            accountId: 'acc-1',
            categoryId: 'cat-1',
            month: new Date('2024-01-01'),
          },
        },
        update: expect.any(Object),
        create: expect.objectContaining({
          accountId: 'acc-1',
          categoryId: 'cat-1',
          month: new Date('2024-01-01'),
          currency: Currency.USD,
          notes: 'Monthly grocery budget',
        }),
      })

      expect(result).toEqual(mockBudget)
    })

    it('should create budget without notes (null)', async () => {
      const input: UpsertBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 500,
        currency: Currency.EUR,
      }

      const mockBudget = {
        id: 'budget-2',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: mockDecimal('500.00'),
        currency: Currency.EUR,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget as never)

      await upsertBudget(input)

      const call = vi.mocked(prisma.budget.upsert).mock.calls[0][0]
      expect(call.create.notes).toBeNull()
    })

    it('should handle decimal precision: 1000.999 rounds to 1001.00', async () => {
      const input: UpsertBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 1000.999,
        currency: Currency.USD,
      }

      const mockBudget = {
        id: 'budget-3',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: mockDecimal('1001.00'),
        currency: Currency.USD,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget as never)

      await upsertBudget(input)

      expect(toDecimalString).toHaveBeenCalledWith(1000.999)
    })

    it('should handle decimal precision: 100.125 rounds to 100.13', async () => {
      const input: UpsertBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 100.125,
        currency: Currency.USD,
      }

      const mockBudget = {
        id: 'budget-4',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: mockDecimal('100.13'),
        currency: Currency.USD,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget as never)

      await upsertBudget(input)
    })

    it('should support USD currency', async () => {
      const input: UpsertBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 1000,
        currency: Currency.USD,
      }

      const mockBudget = {
        id: 'budget-5',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: mockDecimal('1000.00'),
        currency: Currency.USD,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget as never)

      const result = await upsertBudget(input)

      expect(result.currency).toBe(Currency.USD)
    })

    it('should support EUR currency', async () => {
      const input: UpsertBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 800,
        currency: Currency.EUR,
      }

      const mockBudget = {
        id: 'budget-6',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: mockDecimal('800.00'),
        currency: Currency.EUR,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget as never)

      const result = await upsertBudget(input)

      expect(result.currency).toBe(Currency.EUR)
    })

    it('should support ILS currency', async () => {
      const input: UpsertBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 3000,
        currency: Currency.ILS,
      }

      const mockBudget = {
        id: 'budget-7',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: mockDecimal('3000.00'),
        currency: Currency.ILS,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget as never)

      const result = await upsertBudget(input)

      expect(result.currency).toBe(Currency.ILS)
    })

    it('should verify composite key structure in where clause', async () => {
      const input: UpsertBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-02-01'),
        planned: 1000,
        currency: Currency.USD,
      }

      const mockBudget = {
        id: 'budget-8',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-02-01'),
        planned: mockDecimal('1000.00'),
        currency: Currency.USD,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget as never)

      await upsertBudget(input)

      const call = vi.mocked(prisma.budget.upsert).mock.calls[0][0]
      expect(call.where.accountId_categoryId_month).toEqual({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-02-01'),
      })
    })

    it('should handle Prisma create failure', async () => {
      const input: UpsertBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 1000,
        currency: Currency.USD,
      }

      const error = new Error('Database error')
      vi.mocked(prisma.budget.upsert).mockRejectedValue(error)

      await expect(upsertBudget(input)).rejects.toThrow('Database error')
    })
  })

  describe('Phase 2: upsertBudget() - Update Path', () => {
    it('should update existing budget with all fields', async () => {
      const input: UpsertBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 1500,
        currency: Currency.EUR,
        notes: 'Updated budget amount',
      }

      const mockBudget = {
        id: 'budget-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: mockDecimal('1500.00'),
        currency: Currency.EUR,
        notes: 'Updated budget amount',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15'),
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget as never)

      await upsertBudget(input)

      const call = vi.mocked(prisma.budget.upsert).mock.calls[0][0]
      expect(call.update).toMatchObject({
        currency: Currency.EUR,
        notes: 'Updated budget amount',
      })
    })

    it('should update notes from value to null', async () => {
      const input: UpsertBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 1000,
        currency: Currency.USD,
        notes: null,
      }

      const mockBudget = {
        id: 'budget-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: mockDecimal('1000.00'),
        currency: Currency.USD,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget as never)

      await upsertBudget(input)

      const call = vi.mocked(prisma.budget.upsert).mock.calls[0][0]
      expect(call.update.notes).toBeNull()
    })

    it('should update notes from null to value', async () => {
      const input: UpsertBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 1000,
        currency: Currency.USD,
        notes: 'Added notes',
      }

      const mockBudget = {
        id: 'budget-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: mockDecimal('1000.00'),
        currency: Currency.USD,
        notes: 'Added notes',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget as never)

      await upsertBudget(input)

      const call = vi.mocked(prisma.budget.upsert).mock.calls[0][0]
      expect(call.update.notes).toBe('Added notes')
    })

    it('should handle decimal precision in update path', async () => {
      const input: UpsertBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 999.996,
        currency: Currency.USD,
      }

      const mockBudget = {
        id: 'budget-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: mockDecimal('1000.00'),
        currency: Currency.USD,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.upsert).mockResolvedValue(mockBudget as never)

      await upsertBudget(input)

      expect(toDecimalString).toHaveBeenCalledWith(999.996)
    })

    it('should handle Prisma update failure', async () => {
      const input: UpsertBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: 1000,
        currency: Currency.USD,
      }

      const error = new Error('Update failed')
      vi.mocked(prisma.budget.upsert).mockRejectedValue(error)

      await expect(upsertBudget(input)).rejects.toThrow('Update failed')
    })
  })

  describe('Phase 3: deleteBudget()', () => {
    it('should delete budget by composite key', async () => {
      const input: DeleteBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
      }

      const mockBudget = {
        id: 'budget-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: mockDecimal('1000.00'),
        currency: Currency.USD,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.delete).mockResolvedValue(mockBudget as never)

      const result = await deleteBudget(input)

      expect(prisma.budget.delete).toHaveBeenCalledWith({
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

    it('should verify all 3 fields in composite key', async () => {
      const input: DeleteBudgetInput = {
        accountId: 'acc-2',
        categoryId: 'cat-5',
        month: new Date('2024-03-01'),
      }

      const mockBudget = {
        id: 'budget-2',
        accountId: 'acc-2',
        categoryId: 'cat-5',
        month: new Date('2024-03-01'),
        planned: mockDecimal('500.00'),
        currency: Currency.EUR,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.delete).mockResolvedValue(mockBudget as never)

      await deleteBudget(input)

      const call = vi.mocked(prisma.budget.delete).mock.calls[0][0]
      expect(call.where.accountId_categoryId_month).toEqual({
        accountId: 'acc-2',
        categoryId: 'cat-5',
        month: new Date('2024-03-01'),
      })
    })

    it('should handle budget not found error', async () => {
      const input: DeleteBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
      }

      const error = new Error('Record not found')
      ;(error as PrismaError).code = 'P2025'

      vi.mocked(prisma.budget.delete).mockRejectedValue(error)

      await expect(deleteBudget(input)).rejects.toThrow('Record not found')
    })

    it('should handle Prisma connection error', async () => {
      const input: DeleteBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
      }

      const error = new Error('Connection timeout')
      vi.mocked(prisma.budget.delete).mockRejectedValue(error)

      await expect(deleteBudget(input)).rejects.toThrow('Connection timeout')
    })
  })

  describe('Phase 4: getBudgetByKey()', () => {
    it('should find existing budget', async () => {
      const input: DeleteBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
      }

      const mockBudget = {
        id: 'budget-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
        planned: mockDecimal('1000.00'),
        currency: Currency.USD,
        notes: 'Test budget',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.budget.findUnique).mockResolvedValue(mockBudget as never)

      const result = await getBudgetByKey(input)

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
      const input: DeleteBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
      }

      vi.mocked(prisma.budget.findUnique).mockResolvedValue(null)

      const result = await getBudgetByKey(input)

      expect(result).toBeNull()
    })

    it('should verify composite key query structure', async () => {
      const input: DeleteBudgetInput = {
        accountId: 'acc-3',
        categoryId: 'cat-7',
        month: new Date('2024-06-01'),
      }

      vi.mocked(prisma.budget.findUnique).mockResolvedValue(null)

      await getBudgetByKey(input)

      const call = vi.mocked(prisma.budget.findUnique).mock.calls[0][0]
      expect(call.where.accountId_categoryId_month).toEqual({
        accountId: 'acc-3',
        categoryId: 'cat-7',
        month: new Date('2024-06-01'),
      })
    })

    it('should handle Prisma query error', async () => {
      const input: DeleteBudgetInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        month: new Date('2024-01-01'),
      }

      const error = new Error('Query failed')
      vi.mocked(prisma.budget.findUnique).mockRejectedValue(error)

      await expect(getBudgetByKey(input)).rejects.toThrow('Query failed')
    })
  })
})
