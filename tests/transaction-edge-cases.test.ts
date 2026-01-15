import { describe, expect, it } from 'vitest'
import { transactionSchema, transactionRequestSchema, archiveCategorySchema } from '@/schemas'
import { TransactionType, Currency } from '@prisma/client'
import { getMonthStart, getMonthStartFromKey, getMonthKey, shiftMonth, normalizeDateInput } from '@/utils/date'

describe('Transaction Edge Cases', () => {
  const validBase = {
    accountId: 'acc-123',
    categoryId: 'cat-456',
    type: TransactionType.EXPENSE,
    currency: Currency.USD,
    date: new Date('2024-06-15'),
    csrfToken: 'valid-token',
  }

  describe('Amount Validation', () => {
    it('rejects negative amounts', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: -100,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Amount must be positive')
      }
    })

    it('rejects zero amount', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 0,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Amount must be positive')
      }
    })

    it('rejects amounts below minimum (0.01)', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 0.001,
      })

      expect(result.success).toBe(false)
    })

    it('accepts minimum valid amount (0.01)', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 0.01,
      })

      expect(result.success).toBe(true)
    })

    it('accepts large amounts within Decimal(12,2) range', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 9999999999.99, // Max for Decimal(12,2)
      })

      expect(result.success).toBe(true)
    })

    it('coerces string amounts to numbers', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: '150.50',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.amount).toBe(150.5)
      }
    })

    it('handles floating point precision correctly', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 0.1 + 0.2, // Classic floating point issue
      })

      expect(result.success).toBe(true)
    })
  })

  describe('Description Validation', () => {
    it('accepts null description', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 100,
        description: null,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.description).toBeNull()
      }
    })

    it('accepts undefined description', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 100,
        // description intentionally omitted
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.description).toBeUndefined()
      }
    })

    it('accepts empty string description', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 100,
        description: '',
      })

      expect(result.success).toBe(true)
    })

    it('rejects description exceeding 240 characters', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 100,
        description: 'a'.repeat(241),
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('short')
      }
    })

    it('accepts description at exactly 240 characters', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 100,
        description: 'a'.repeat(240),
      })

      expect(result.success).toBe(true)
    })
  })

  describe('Date Validation', () => {
    it('coerces valid date string to Date object', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 100,
        date: '2024-06-15',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.date).toBeInstanceOf(Date)
      }
    })

    it('handles month boundary dates (Jan 31)', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 100,
        date: new Date('2024-01-31'),
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.date.getDate()).toBe(31)
      }
    })

    it('handles leap year date (Feb 29)', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 100,
        date: new Date('2024-02-29'), // 2024 is a leap year
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.date.getMonth()).toBe(1) // February
        expect(result.data.date.getDate()).toBe(29)
      }
    })

    it('handles end of year date (Dec 31)', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 100,
        date: new Date('2024-12-31'),
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.date.getMonth()).toBe(11) // December
        expect(result.data.date.getDate()).toBe(31)
      }
    })

    it('handles start of year date (Jan 1)', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 100,
        date: new Date('2024-01-01'),
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.date.getMonth()).toBe(0) // January
        expect(result.data.date.getDate()).toBe(1)
      }
    })

    it('rejects invalid date string', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 100,
        date: 'not-a-date',
      })

      expect(result.success).toBe(false)
    })
  })

  describe('Currency Validation', () => {
    it('accepts all valid currencies', () => {
      for (const currency of [Currency.USD, Currency.EUR, Currency.ILS]) {
        const result = transactionSchema.safeParse({
          ...validBase,
          amount: 100,
          currency,
        })

        expect(result.success).toBe(true)
      }
    })

    it('defaults to USD when currency not specified', () => {
      const { currency: _, ...baseWithoutCurrency } = validBase
      const result = transactionSchema.safeParse({
        ...baseWithoutCurrency,
        amount: 100,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.currency).toBe(Currency.USD)
      }
    })

    it('rejects invalid currency', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 100,
        currency: 'INVALID',
      })

      expect(result.success).toBe(false)
    })
  })

  describe('TransactionRequest Edge Cases', () => {
    const requestBase = {
      toId: 'recipient-account',
      categoryId: 'cat-456',
      currency: Currency.USD,
      date: new Date('2024-06-15'),
      csrfToken: 'valid-token',
    }

    it('rejects negative amounts in transaction requests', () => {
      const result = transactionRequestSchema.safeParse({
        ...requestBase,
        amount: -50,
      })

      expect(result.success).toBe(false)
    })

    it('rejects zero amount in transaction requests', () => {
      const result = transactionRequestSchema.safeParse({
        ...requestBase,
        amount: 0,
      })

      expect(result.success).toBe(false)
    })

    it('accepts null description in transaction requests', () => {
      const result = transactionRequestSchema.safeParse({
        ...requestBase,
        amount: 100,
        description: null,
      })

      expect(result.success).toBe(true)
    })
  })

  describe('Date/Timezone Edge Cases', () => {
    it('getMonthStart normalizes to first day of month', () => {
      const midMonth = new Date('2024-06-15')
      const result = getMonthStart(midMonth)

      expect(result.getDate()).toBe(1)
      expect(result.getMonth()).toBe(5) // June
    })

    it('getMonthStart handles last day of month', () => {
      const lastDay = new Date('2024-01-31')
      const result = getMonthStart(lastDay)

      expect(result.getDate()).toBe(1)
      expect(result.getMonth()).toBe(0) // January
    })

    it('getMonthStartFromKey returns UTC date', () => {
      const result = getMonthStartFromKey('2024-06')

      expect(result.getUTCFullYear()).toBe(2024)
      expect(result.getUTCMonth()).toBe(5) // June (0-indexed)
      expect(result.getUTCDate()).toBe(1)
    })

    it('getMonthKey formats date correctly', () => {
      const date = new Date('2024-06-15')
      const result = getMonthKey(date)

      expect(result).toBe('2024-06')
    })

    it('getMonthKey handles year boundary (Dec 31)', () => {
      const yearEnd = new Date('2024-12-31')
      const result = getMonthKey(yearEnd)

      expect(result).toBe('2024-12')
    })

    it('getMonthKey handles year boundary (Jan 1)', () => {
      const yearStart = new Date('2025-01-01')
      const result = getMonthKey(yearStart)

      expect(result).toBe('2025-01')
    })

    it('shiftMonth handles forward shift within year', () => {
      const result = shiftMonth('2024-06', 3)
      expect(result).toBe('2024-09')
    })

    it('shiftMonth handles backward shift within year', () => {
      const result = shiftMonth('2024-06', -3)
      expect(result).toBe('2024-03')
    })

    it('shiftMonth handles year boundary crossing forward', () => {
      const result = shiftMonth('2024-11', 3)
      expect(result).toBe('2025-02')
    })

    it('shiftMonth handles year boundary crossing backward', () => {
      const result = shiftMonth('2024-02', -3)
      expect(result).toBe('2023-11')
    })

    it('shiftMonth handles December to January', () => {
      const result = shiftMonth('2024-12', 1)
      expect(result).toBe('2025-01')
    })

    it('shiftMonth handles January to December', () => {
      const result = shiftMonth('2024-01', -1)
      expect(result).toBe('2023-12')
    })

    it('normalizeDateInput parses valid date string', () => {
      const result = normalizeDateInput('2024-06-15')

      expect(result).not.toBeNull()
      expect(result?.getUTCFullYear()).toBe(2024)
      expect(result?.getUTCMonth()).toBe(5)
      expect(result?.getUTCDate()).toBe(15)
    })

    it('normalizeDateInput returns null for empty string', () => {
      expect(normalizeDateInput('')).toBeNull()
    })

    it('normalizeDateInput returns null for null input', () => {
      expect(normalizeDateInput(null)).toBeNull()
    })

    it('normalizeDateInput returns null for invalid format', () => {
      expect(normalizeDateInput('06-15-2024')).toBeNull()
      expect(normalizeDateInput('2024/06/15')).toBeNull()
      expect(normalizeDateInput('invalid')).toBeNull()
    })

    it('normalizeDateInput returns null for invalid month', () => {
      expect(normalizeDateInput('2024-13-15')).toBeNull()
      expect(normalizeDateInput('2024-00-15')).toBeNull()
    })

    it('normalizeDateInput returns null for invalid day', () => {
      expect(normalizeDateInput('2024-06-32')).toBeNull()
      expect(normalizeDateInput('2024-06-00')).toBeNull()
    })

    it('normalizeDateInput validates February 29 in leap year', () => {
      const result = normalizeDateInput('2024-02-29')
      expect(result).not.toBeNull()
      expect(result?.getUTCDate()).toBe(29)
    })

    it('normalizeDateInput rejects February 29 in non-leap year', () => {
      const result = normalizeDateInput('2023-02-29')
      expect(result).toBeNull()
    })

    it('normalizeDateInput handles end of year', () => {
      const result = normalizeDateInput('2024-12-31')
      expect(result).not.toBeNull()
      expect(result?.getUTCMonth()).toBe(11)
      expect(result?.getUTCDate()).toBe(31)
    })

    it('normalizeDateInput handles start of year', () => {
      const result = normalizeDateInput('2024-01-01')
      expect(result).not.toBeNull()
      expect(result?.getUTCMonth()).toBe(0)
      expect(result?.getUTCDate()).toBe(1)
    })
  })

  describe('Category Archiving (Soft Delete)', () => {
    // Categories use soft-delete via isArchived flag to prevent orphaning transactions
    // This is the safe pattern instead of hard deletes with cascade

    it('archiveCategorySchema validates archive operation', () => {
      const result = archiveCategorySchema.safeParse({
        id: 'cat-123',
        isArchived: true,
        csrfToken: 'valid-token',
      })

      expect(result.success).toBe(true)
    })

    it('archiveCategorySchema allows unarchiving', () => {
      const result = archiveCategorySchema.safeParse({
        id: 'cat-123',
        isArchived: false,
        csrfToken: 'valid-token',
      })

      expect(result.success).toBe(true)
    })

    it('archiveCategorySchema requires valid id', () => {
      const result = archiveCategorySchema.safeParse({
        id: '',
        isArchived: true,
        csrfToken: 'valid-token',
      })

      expect(result.success).toBe(false)
    })
  })

  describe('Required Fields', () => {
    it('rejects missing accountId', () => {
      const { accountId: _, ...withoutAccount } = validBase
      const result = transactionSchema.safeParse({
        ...withoutAccount,
        amount: 100,
      })

      expect(result.success).toBe(false)
    })

    it('rejects missing categoryId', () => {
      const { categoryId: _, ...withoutCategory } = validBase
      const result = transactionSchema.safeParse({
        ...withoutCategory,
        amount: 100,
      })

      expect(result.success).toBe(false)
    })

    it('rejects missing csrfToken', () => {
      const { csrfToken: _, ...withoutCsrf } = validBase
      const result = transactionSchema.safeParse({
        ...withoutCsrf,
        amount: 100,
      })

      expect(result.success).toBe(false)
    })

    it('rejects empty accountId', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 100,
        accountId: '',
      })

      expect(result.success).toBe(false)
    })

    it('rejects empty categoryId', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        amount: 100,
        categoryId: '',
      })

      expect(result.success).toBe(false)
    })
  })
})
