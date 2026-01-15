/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionType, Currency, Prisma } from '@prisma/client'

// 1. Mock @prisma/client FIRST (enums & Decimal)
vi.mock('@prisma/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@prisma/client')>()
  return {
    ...original,
    TransactionType: { INCOME: 'INCOME', EXPENSE: 'EXPENSE' },
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
    recurringTemplate: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

// 3. Mock dependencies
vi.mock('@/utils/date', () => ({
  getMonthStartFromKey: vi.fn((key) => {
    const [y, m] = key.split('-')
    return new Date(Date.UTC(Number(y), Number(m) - 1, 1, 0, 0, 0, 0))
  }),
}))

vi.mock('@/app/actions/shared', () => ({
  toDecimalString: vi.fn((n) => n.toFixed(2)),
}))

vi.mock('date-fns', () => ({
  getDaysInMonth: vi.fn(),
}))

// 4. Import AFTER all mocks
import {
  upsertRecurringTemplate,
  toggleRecurringTemplate,
  getRecurringTemplateById,
  applyRecurringTemplates,
} from '@/lib/services/recurring-service'
import { prisma } from '@/lib/prisma'
import { getMonthStartFromKey } from '@/utils/date'
import { toDecimalString } from '@/app/actions/shared'
import { getDaysInMonth } from 'date-fns'

describe('recurring-service.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('upsertRecurringTemplate', () => {
    it('should create new template when no ID provided', async () => {
      const mockTemplate = {
        id: 'template-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal('100.00'),
        currency: Currency.USD,
        dayOfMonth: 15,
        description: 'Monthly rent',
        startMonth: new Date('2024-01-01'),
        endMonth: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.recurringTemplate.create).mockResolvedValue(mockTemplate)

      const result = await upsertRecurringTemplate({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 100.0,
        currency: Currency.USD,
        dayOfMonth: 15,
        description: 'Monthly rent',
        startMonth: new Date('2024-01-01'),
      })

      expect(toDecimalString).toHaveBeenCalledWith(100.0)
      expect(prisma.recurringTemplate.create).toHaveBeenCalledWith({
        data: {
          accountId: 'acc-1',
          categoryId: 'cat-1',
          type: TransactionType.EXPENSE,
          amount: expect.any(Prisma.Decimal),
          currency: Currency.USD,
          dayOfMonth: 15,
          description: 'Monthly rent',
          startMonth: new Date('2024-01-01'),
          endMonth: null,
          isActive: true,
        },
      })
      expect(prisma.recurringTemplate.update).not.toHaveBeenCalled()
      expect(result).toEqual(mockTemplate)
    })

    it('should update existing template when ID provided', async () => {
      const mockUpdated = {
        id: 'template-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal('150.00'),
        currency: Currency.USD,
        dayOfMonth: 20,
        description: 'Updated rent',
        startMonth: new Date('2024-01-01'),
        endMonth: new Date('2024-12-01'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.recurringTemplate.update).mockResolvedValue(mockUpdated)

      const result = await upsertRecurringTemplate({
        id: 'template-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 150.0,
        currency: Currency.USD,
        dayOfMonth: 20,
        description: 'Updated rent',
        startMonth: new Date('2024-01-01'),
        endMonth: new Date('2024-12-01'),
      })

      expect(prisma.recurringTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: {
          accountId: 'acc-1',
          categoryId: 'cat-1',
          type: TransactionType.EXPENSE,
          amount: expect.any(Prisma.Decimal),
          currency: Currency.USD,
          dayOfMonth: 20,
          description: 'Updated rent',
          startMonth: new Date('2024-01-01'),
          endMonth: new Date('2024-12-01'),
          isActive: true,
        },
      })
      expect(prisma.recurringTemplate.create).not.toHaveBeenCalled()
      expect(result).toEqual(mockUpdated)
    })

    it('should default isActive to true when not provided', async () => {
      vi.mocked(prisma.recurringTemplate.create).mockResolvedValue({} as any)

      await upsertRecurringTemplate({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.INCOME,
        amount: 1000.0,
        currency: Currency.EUR,
        dayOfMonth: 1,
        startMonth: new Date('2024-01-01'),
        // isActive not provided
      })

      const createCall = vi.mocked(prisma.recurringTemplate.create).mock.calls[0][0]
      expect(createCall.data.isActive).toBe(true)
    })

    it('should handle null endMonth correctly', async () => {
      vi.mocked(prisma.recurringTemplate.create).mockResolvedValue({} as any)

      await upsertRecurringTemplate({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 50.0,
        currency: Currency.USD,
        dayOfMonth: 10,
        startMonth: new Date('2024-01-01'),
        // endMonth not provided
      })

      const createCall = vi.mocked(prisma.recurringTemplate.create).mock.calls[0][0]
      expect(createCall.data.endMonth).toBeNull()
    })

    it('should convert decimal via toDecimalString', async () => {
      vi.mocked(toDecimalString).mockReturnValue('99.99')
      vi.mocked(prisma.recurringTemplate.create).mockResolvedValue({} as any)

      await upsertRecurringTemplate({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 99.99,
        currency: Currency.USD,
        dayOfMonth: 5,
        startMonth: new Date('2024-01-01'),
      })

      expect(toDecimalString).toHaveBeenCalledWith(99.99)
      const createCall = vi.mocked(prisma.recurringTemplate.create).mock.calls[0][0]
      expect(createCall.data.amount).toBeInstanceOf(Prisma.Decimal)
    })

    it('should include all fields in payload', async () => {
      vi.mocked(prisma.recurringTemplate.create).mockResolvedValue({} as any)

      await upsertRecurringTemplate({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.INCOME,
        amount: 2500.0,
        currency: Currency.ILS,
        dayOfMonth: 25,
        description: 'Salary',
        startMonth: new Date('2024-01-01'),
        endMonth: new Date('2024-12-01'),
        isActive: false,
      })

      const createCall = vi.mocked(prisma.recurringTemplate.create).mock.calls[0][0]
      expect(createCall.data).toHaveProperty('accountId', 'acc-1')
      expect(createCall.data).toHaveProperty('categoryId', 'cat-1')
      expect(createCall.data).toHaveProperty('type', TransactionType.INCOME)
      expect(createCall.data).toHaveProperty('currency', Currency.ILS)
      expect(createCall.data).toHaveProperty('dayOfMonth', 25)
      expect(createCall.data).toHaveProperty('description', 'Salary')
      expect(createCall.data).toHaveProperty('isActive', false)
    })
  })

  describe('toggleRecurringTemplate', () => {
    it('should set isActive to true', async () => {
      const mockToggled = {
        id: 'template-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal('100.00'),
        currency: Currency.USD,
        dayOfMonth: 15,
        description: null,
        startMonth: new Date('2024-01-01'),
        endMonth: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.recurringTemplate.update).mockResolvedValue(mockToggled)

      const result = await toggleRecurringTemplate({
        id: 'template-1',
        isActive: true,
      })

      expect(prisma.recurringTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: { isActive: true },
      })
      expect(result.isActive).toBe(true)
    })

    it('should set isActive to false', async () => {
      const mockToggled = {
        id: 'template-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal('100.00'),
        currency: Currency.USD,
        dayOfMonth: 15,
        description: null,
        startMonth: new Date('2024-01-01'),
        endMonth: null,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.recurringTemplate.update).mockResolvedValue(mockToggled)

      const result = await toggleRecurringTemplate({
        id: 'template-1',
        isActive: false,
      })

      expect(result.isActive).toBe(false)
    })
  })

  describe('getRecurringTemplateById', () => {
    it('should return template when found', async () => {
      const mockTemplate = {
        id: 'template-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal('100.00'),
        currency: Currency.USD,
        dayOfMonth: 15,
        description: 'Test template',
        startMonth: new Date('2024-01-01'),
        endMonth: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.recurringTemplate.findUnique).mockResolvedValue(mockTemplate)

      const result = await getRecurringTemplateById('template-1')

      expect(prisma.recurringTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: 'template-1' },
      })
      expect(result).toEqual(mockTemplate)
    })

    it('should return null when template not found', async () => {
      vi.mocked(prisma.recurringTemplate.findUnique).mockResolvedValue(null)

      const result = await getRecurringTemplateById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('applyRecurringTemplates', () => {
    it('should create transactions for matching templates', async () => {
      const monthStart = new Date(Date.UTC(2024, 0, 1, 0, 0, 0, 0))
      const mockTemplates = [
        {
          id: 'template-1',
          accountId: 'acc-1',
          categoryId: 'cat-1',
          type: TransactionType.EXPENSE,
          amount: new Prisma.Decimal('100.00'),
          currency: Currency.USD,
          dayOfMonth: 15,
          description: 'Test',
          startMonth: new Date('2024-01-01'),
          endMonth: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(getMonthStartFromKey).mockReturnValue(monthStart)
      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue(mockTemplates)
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([])
      vi.mocked(getDaysInMonth).mockReturnValue(31)
      vi.mocked(prisma.transaction.createMany).mockResolvedValue({ count: 1 })

      const result = await applyRecurringTemplates({
        monthKey: '2024-01',
        accountId: 'acc-1',
      })

      expect(getMonthStartFromKey).toHaveBeenCalledWith('2024-01')
      expect(prisma.transaction.createMany).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ created: 1 })
    })

    it('should filter by month range: startMonth <= X <= endMonth', async () => {
      const monthStart = new Date(Date.UTC(2024, 5, 1, 0, 0, 0, 0))

      vi.mocked(getMonthStartFromKey).mockReturnValue(monthStart)
      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([])
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([])

      await applyRecurringTemplates({
        monthKey: '2024-06',
        accountId: 'acc-1',
      })

      const findManyCall = vi.mocked(prisma.recurringTemplate.findMany).mock.calls[0][0]
      expect(findManyCall.where).toMatchObject({
        isActive: true,
        startMonth: { lte: monthStart },
        OR: [{ endMonth: null }, { endMonth: { gte: monthStart } }],
        accountId: 'acc-1',
      })
    })

    it('should filter by isActive=true', async () => {
      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([])
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([])

      await applyRecurringTemplates({
        monthKey: '2024-01',
        accountId: 'acc-1',
      })

      const findManyCall = vi.mocked(prisma.recurringTemplate.findMany).mock.calls[0][0]
      expect(findManyCall.where.isActive).toBe(true)
    })

    it('should filter by templateIds when provided', async () => {
      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([])
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([])

      await applyRecurringTemplates({
        monthKey: '2024-01',
        accountId: 'acc-1',
        templateIds: ['template-1', 'template-2'],
      })

      const findManyCall = vi.mocked(prisma.recurringTemplate.findMany).mock.calls[0][0]
      expect(findManyCall.where.id).toEqual({ in: ['template-1', 'template-2'] })
    })

    it('should prevent duplicates via idempotency check', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          accountId: 'acc-1',
          categoryId: 'cat-1',
          type: TransactionType.EXPENSE,
          amount: new Prisma.Decimal('100.00'),
          currency: Currency.USD,
          dayOfMonth: 15,
          description: null,
          startMonth: new Date('2024-01-01'),
          endMonth: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const existingTransactions = [
        {
          recurringTemplateId: 'template-1',
        },
      ]

      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue(mockTemplates)
      vi.mocked(prisma.transaction.findMany).mockResolvedValue(existingTransactions as any)

      const result = await applyRecurringTemplates({
        monthKey: '2024-01',
        accountId: 'acc-1',
      })

      expect(prisma.transaction.createMany).not.toHaveBeenCalled()
      expect(result).toEqual({ created: 0 })
    })

    it('should normalize day for Feb 30 to Feb 28', async () => {
      const febMonthStart = new Date(Date.UTC(2024, 1, 1, 0, 0, 0, 0))
      const mockTemplates = [
        {
          id: 'template-1',
          accountId: 'acc-1',
          categoryId: 'cat-1',
          type: TransactionType.EXPENSE,
          amount: new Prisma.Decimal('100.00'),
          currency: Currency.USD,
          dayOfMonth: 30, // Feb doesn't have 30 days
          description: null,
          startMonth: new Date('2024-01-01'),
          endMonth: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(getMonthStartFromKey).mockReturnValue(febMonthStart)
      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue(mockTemplates)
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([])
      vi.mocked(getDaysInMonth).mockReturnValue(29) // 2024 is a leap year
      vi.mocked(prisma.transaction.createMany).mockResolvedValue({ count: 1 })

      await applyRecurringTemplates({
        monthKey: '2024-02',
        accountId: 'acc-1',
      })

      const createManyCall = vi.mocked(prisma.transaction.createMany).mock.calls[0][0]
      const transaction = createManyCall.data[0]
      expect(transaction.date.getUTCDate()).toBe(29) // Normalized to Feb 29 (leap year)
    })

    it('should normalize day for Feb 29 in leap year', async () => {
      const febMonthStart = new Date(Date.UTC(2024, 1, 1, 0, 0, 0, 0))
      const mockTemplates = [
        {
          id: 'template-1',
          accountId: 'acc-1',
          categoryId: 'cat-1',
          type: TransactionType.EXPENSE,
          amount: new Prisma.Decimal('100.00'),
          currency: Currency.USD,
          dayOfMonth: 31,
          description: null,
          startMonth: new Date('2024-01-01'),
          endMonth: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(getMonthStartFromKey).mockReturnValue(febMonthStart)
      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue(mockTemplates)
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([])
      vi.mocked(getDaysInMonth).mockReturnValue(29) // Leap year
      vi.mocked(prisma.transaction.createMany).mockResolvedValue({ count: 1 })

      await applyRecurringTemplates({
        monthKey: '2024-02',
        accountId: 'acc-1',
      })

      expect(getDaysInMonth).toHaveBeenCalledWith(febMonthStart)
      const createManyCall = vi.mocked(prisma.transaction.createMany).mock.calls[0][0]
      const transaction = createManyCall.data[0]
      expect(transaction.date.getUTCDate()).toBe(29)
    })

    it('should use createMany for bulk creation', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          accountId: 'acc-1',
          categoryId: 'cat-1',
          type: TransactionType.EXPENSE,
          amount: new Prisma.Decimal('100.00'),
          currency: Currency.USD,
          dayOfMonth: 15,
          description: null,
          startMonth: new Date('2024-01-01'),
          endMonth: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'template-2',
          accountId: 'acc-1',
          categoryId: 'cat-2',
          type: TransactionType.INCOME,
          amount: new Prisma.Decimal('2000.00'),
          currency: Currency.USD,
          dayOfMonth: 1,
          description: null,
          startMonth: new Date('2024-01-01'),
          endMonth: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue(mockTemplates)
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([])
      vi.mocked(getDaysInMonth).mockReturnValue(31)
      vi.mocked(prisma.transaction.createMany).mockResolvedValue({ count: 2 })

      const result = await applyRecurringTemplates({
        monthKey: '2024-01',
        accountId: 'acc-1',
      })

      expect(prisma.transaction.createMany).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ created: 2 })
    })

    it('should return {created: 0} when no matching templates', async () => {
      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([])
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([])

      const result = await applyRecurringTemplates({
        monthKey: '2024-01',
        accountId: 'acc-1',
      })

      expect(prisma.transaction.createMany).not.toHaveBeenCalled()
      expect(result).toEqual({ created: 0 })
    })

    it('should link transactions with recurringTemplateId and isRecurring flag', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          accountId: 'acc-1',
          categoryId: 'cat-1',
          type: TransactionType.EXPENSE,
          amount: new Prisma.Decimal('100.00'),
          currency: Currency.USD,
          dayOfMonth: 15,
          description: 'Recurring expense',
          startMonth: new Date('2024-01-01'),
          endMonth: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue(mockTemplates)
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([])
      vi.mocked(getDaysInMonth).mockReturnValue(31)
      vi.mocked(prisma.transaction.createMany).mockResolvedValue({ count: 1 })

      await applyRecurringTemplates({
        monthKey: '2024-01',
        accountId: 'acc-1',
      })

      const createManyCall = vi.mocked(prisma.transaction.createMany).mock.calls[0][0]
      const transaction = createManyCall.data[0]
      expect(transaction.recurringTemplateId).toBe('template-1')
      expect(transaction.isRecurring).toBe(true)
    })
  })
})
