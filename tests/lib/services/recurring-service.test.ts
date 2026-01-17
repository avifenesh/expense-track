import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TransactionType, Currency } from '@prisma/client'

// Mock Prisma.Decimal
vi.mock('@prisma/client', async (importOriginal) => {
  const original = (await importOriginal()) as typeof import('@prisma/client')

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
    recurringTemplate: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

vi.mock('@/utils/date', () => ({
  getMonthStartFromKey: vi.fn((key: string) => {
    const [year, month] = key.split('-')
    return new Date(Date.UTC(Number(year), Number(month) - 1, 1))
  }),
}))

vi.mock('date-fns', () => ({
  getDaysInMonth: vi.fn((date: Date) => {
    const month = date.getUTCMonth()
    const year = date.getUTCFullYear()
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  }),
}))

vi.mock('@/app/actions/shared', () => ({
  toDecimalString: vi.fn((value: number) => {
    const DECIMAL_PRECISION = 2
    const AMOUNT_SCALE = Math.pow(10, DECIMAL_PRECISION)
    return (Math.round(value * AMOUNT_SCALE) / AMOUNT_SCALE).toFixed(DECIMAL_PRECISION)
  }),
}))

// Import after mocks
import { prisma } from '@/lib/prisma'
import { getMonthStartFromKey } from '@/utils/date'
import {
  upsertRecurringTemplate,
  toggleRecurringTemplate,
  getRecurringTemplateById,
  applyRecurringTemplates,
  type UpsertRecurringTemplateInput,
  type ToggleRecurringTemplateInput,
  type ApplyRecurringTemplatesInput,
} from '@/lib/services/recurring-service'

const mockDecimal = (value: string) => ({
  value,
  toNumber: () => Number(value),
  toString: () => value,
  toFixed: (decimals: number) => Number(value).toFixed(decimals),
})

describe('recurring-service.ts', () => {
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

  describe('Phase 1: upsertRecurringTemplate() - Create', () => {
    it('should create template with all fields', async () => {
      const input: UpsertRecurringTemplateInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: Currency.USD,
        dayOfMonth: 15,
        description: 'Monthly bill',
        startMonth: new Date('2024-01-01'),
        endMonth: new Date('2024-12-01'),
        isActive: true,
      }

      const mockTemplate = {
        id: 'tmpl-1',
        ...input,
        amount: mockDecimal('100.00'),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.recurringTemplate.create).mockResolvedValue(mockTemplate as never)

      await upsertRecurringTemplate(input)

      expect(prisma.recurringTemplate.create).toHaveBeenCalled()
    })

    it('should default isActive to true', async () => {
      const input: UpsertRecurringTemplateInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: Currency.USD,
        dayOfMonth: 15,
        startMonth: new Date('2024-01-01'),
      }

      const mockTemplate = {
        id: 'tmpl-2',
        ...input,
        amount: mockDecimal('100.00'),
        description: null,
        endMonth: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.recurringTemplate.create).mockResolvedValue(mockTemplate as never)

      await upsertRecurringTemplate(input)

      const call = vi.mocked(prisma.recurringTemplate.create).mock.calls[0][0]
      expect(call.data.isActive).toBe(true)
    })

    it('should create without endMonth (null)', async () => {
      const input: UpsertRecurringTemplateInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: Currency.USD,
        dayOfMonth: 15,
        startMonth: new Date('2024-01-01'),
      }

      const mockTemplate = {
        id: 'tmpl-3',
        ...input,
        amount: mockDecimal('100.00'),
        description: null,
        endMonth: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.recurringTemplate.create).mockResolvedValue(mockTemplate as never)

      await upsertRecurringTemplate(input)

      const call = vi.mocked(prisma.recurringTemplate.create).mock.calls[0][0]
      expect(call.data.endMonth).toBeNull()
    })
  })

  describe('Phase 2: upsertRecurringTemplate() - Update', () => {
    it('should update when ID provided', async () => {
      const input: UpsertRecurringTemplateInput = {
        id: 'tmpl-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 150,
        currency: Currency.USD,
        dayOfMonth: 20,
        description: 'Updated',
        startMonth: new Date('2024-01-01'),
        isActive: true,
      }

      const mockTemplate = {
        ...input,
        amount: mockDecimal('150.00'),
        endMonth: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.recurringTemplate.update).mockResolvedValue(mockTemplate as never)

      await upsertRecurringTemplate(input)

      expect(prisma.recurringTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tmpl-1' },
        data: expect.any(Object),
      })
    })
  })

  describe('Phase 3: toggleRecurringTemplate()', () => {
    it('should toggle isActive to true', async () => {
      const input: ToggleRecurringTemplateInput = {
        id: 'tmpl-1',
        isActive: true,
      }

      const mockTemplate = {
        id: 'tmpl-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: mockDecimal('100.00'),
        currency: Currency.USD,
        dayOfMonth: 15,
        description: null,
        startMonth: new Date('2024-01-01'),
        endMonth: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.recurringTemplate.update).mockResolvedValue(mockTemplate as never)

      await toggleRecurringTemplate(input)

      expect(prisma.recurringTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tmpl-1' },
        data: { isActive: true },
      })
    })

    it('should toggle isActive to false', async () => {
      const input: ToggleRecurringTemplateInput = {
        id: 'tmpl-1',
        isActive: false,
      }

      const mockTemplate = {
        id: 'tmpl-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: mockDecimal('100.00'),
        currency: Currency.USD,
        dayOfMonth: 15,
        description: null,
        startMonth: new Date('2024-01-01'),
        endMonth: null,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.recurringTemplate.update).mockResolvedValue(mockTemplate as never)

      await toggleRecurringTemplate(input)

      expect(prisma.recurringTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tmpl-1' },
        data: { isActive: false },
      })
    })
  })

  describe('Phase 4: getRecurringTemplateById()', () => {
    it('should find existing template', async () => {
      const mockTemplate = {
        id: 'tmpl-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: mockDecimal('100.00'),
        currency: Currency.USD,
        dayOfMonth: 15,
        description: 'Test',
        startMonth: new Date('2024-01-01'),
        endMonth: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.recurringTemplate.findFirst).mockResolvedValue(mockTemplate as never)

      const result = await getRecurringTemplateById('tmpl-1')

      expect(prisma.recurringTemplate.findFirst).toHaveBeenCalledWith({ where: { id: 'tmpl-1', deletedAt: null } })
      expect(result).toEqual(mockTemplate)
    })

    it('should return null when not found', async () => {
      vi.mocked(prisma.recurringTemplate.findFirst).mockResolvedValue(null)

      const result = await getRecurringTemplateById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('Phase 5: applyRecurringTemplates() - Complex', () => {
    it('should parse month key and find templates', async () => {
      const input: ApplyRecurringTemplatesInput = {
        monthKey: '2024-02',
        accountId: 'acc-1',
      }

      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([])

      await applyRecurringTemplates(input)

      expect(getMonthStartFromKey).toHaveBeenCalledWith('2024-02')
      expect(prisma.recurringTemplate.findMany).toHaveBeenCalled()
    })

    it('should return 0 when no templates found', async () => {
      const input: ApplyRecurringTemplatesInput = {
        monthKey: '2024-02',
        accountId: 'acc-1',
      }

      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([])

      const result = await applyRecurringTemplates(input)

      expect(result.created).toBe(0)
    })

    it('should clip dayOfMonth=31 to 28 in February', async () => {
      const input: ApplyRecurringTemplatesInput = {
        monthKey: '2024-02',
        accountId: 'acc-1',
      }

      const mockTemplate = {
        id: 'tmpl-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: mockDecimal('100.00'),
        currency: Currency.USD,
        dayOfMonth: 31,
        description: 'Monthly',
        startMonth: new Date('2024-01-01'),
        endMonth: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([mockTemplate] as never[])
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([])
      vi.mocked(prisma.transaction.createMany).mockResolvedValue({ count: 1 } as never)

      await applyRecurringTemplates(input)

      const call = vi.mocked(prisma.transaction.createMany).mock.calls[0]?.[0]
      const data = Array.isArray(call?.data) ? call.data : []
      const transaction = data[0] as { date: Date }
      expect(transaction.date.getUTCDate()).toBe(29) // 2024 is leap year
    })

    it('should handle deduplication - skip existing', async () => {
      const input: ApplyRecurringTemplatesInput = {
        monthKey: '2024-02',
        accountId: 'acc-1',
      }

      const mockTemplate = {
        id: 'tmpl-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: mockDecimal('100.00'),
        currency: Currency.USD,
        dayOfMonth: 15,
        description: 'Monthly',
        startMonth: new Date('2024-01-01'),
        endMonth: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([mockTemplate] as never[])
      // Template already has transaction this month
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([{ recurringTemplateId: 'tmpl-1' }] as never[])

      const result = await applyRecurringTemplates(input)

      expect(result.created).toBe(0)
      expect(prisma.transaction.createMany).not.toHaveBeenCalled()
    })

    it('should create transaction with isRecurring=true', async () => {
      const input: ApplyRecurringTemplatesInput = {
        monthKey: '2024-02',
        accountId: 'acc-1',
      }

      const mockTemplate = {
        id: 'tmpl-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: mockDecimal('100.00'),
        currency: Currency.USD,
        dayOfMonth: 15,
        description: 'Monthly',
        startMonth: new Date('2024-01-01'),
        endMonth: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([mockTemplate] as never[])
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([])
      vi.mocked(prisma.transaction.createMany).mockResolvedValue({ count: 1 } as never)

      await applyRecurringTemplates(input)

      const call = vi.mocked(prisma.transaction.createMany).mock.calls[0]?.[0]
      const data = Array.isArray(call?.data) ? call.data : []
      const transaction = data[0] as { isRecurring: boolean }
      expect(transaction.isRecurring).toBe(true)
    })

    it('should filter by templateIds when provided', async () => {
      const input: ApplyRecurringTemplatesInput = {
        monthKey: '2024-02',
        accountId: 'acc-1',
        templateIds: ['tmpl-1', 'tmpl-2'],
      }

      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([])

      await applyRecurringTemplates(input)

      const call = vi.mocked(prisma.recurringTemplate.findMany).mock.calls[0]?.[0]
      expect(call?.where?.id).toEqual({ in: ['tmpl-1', 'tmpl-2'] })
    })

    it('should return created count', async () => {
      const input: ApplyRecurringTemplatesInput = {
        monthKey: '2024-02',
        accountId: 'acc-1',
      }

      const mockTemplates = [
        {
          id: 'tmpl-1',
          accountId: 'acc-1',
          categoryId: 'cat-1',
          type: TransactionType.EXPENSE,
          amount: mockDecimal('100.00'),
          currency: Currency.USD,
          dayOfMonth: 15,
          description: 'Bill 1',
          startMonth: new Date('2024-01-01'),
          endMonth: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'tmpl-2',
          accountId: 'acc-1',
          categoryId: 'cat-2',
          type: TransactionType.EXPENSE,
          amount: mockDecimal('200.00'),
          currency: Currency.USD,
          dayOfMonth: 20,
          description: 'Bill 2',
          startMonth: new Date('2024-01-01'),
          endMonth: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue(mockTemplates as never[])
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([])
      vi.mocked(prisma.transaction.createMany).mockResolvedValue({ count: 2 } as never)

      const result = await applyRecurringTemplates(input)

      expect(result.created).toBe(2)
    })
  })
})
