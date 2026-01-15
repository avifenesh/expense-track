import { describe, expect, it } from 'vitest'
import { transactionSchema, transactionRequestSchema, archiveCategorySchema } from '@/schemas'
import { TransactionType, Currency } from '@prisma/client'

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
      toId: 'partner-account',
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
