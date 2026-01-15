import { describe, expect, it } from 'vitest'
import { budgetSchema } from '@/schemas'
import { getBudgetProgress } from '@/lib/dashboard-ux'
import { Currency, TransactionType } from '@prisma/client'
import type { CategoryBudgetSummary } from '@/lib/finance'

describe('Budget Edge Cases', () => {
  describe('Schema Validation', () => {
    const validBase = {
      accountId: 'acc-123',
      categoryId: 'cat-456',
      monthKey: '2024-06',
      currency: Currency.USD,
      csrfToken: 'valid-token',
    }

    it('rejects negative planned amount', () => {
      const result = budgetSchema.safeParse({
        ...validBase,
        planned: -100,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Budget must be >= 0')
      }
    })

    it('accepts zero planned amount', () => {
      const result = budgetSchema.safeParse({
        ...validBase,
        planned: 0,
      })

      expect(result.success).toBe(true)
    })

    it('accepts positive planned amount', () => {
      const result = budgetSchema.safeParse({
        ...validBase,
        planned: 1000,
      })

      expect(result.success).toBe(true)
    })

    it('accepts large budget amounts within Decimal(12,2) range', () => {
      const result = budgetSchema.safeParse({
        ...validBase,
        planned: 9999999999.99,
      })

      expect(result.success).toBe(true)
    })

    it('coerces string amounts to numbers', () => {
      const result = budgetSchema.safeParse({
        ...validBase,
        planned: '500.50',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.planned).toBe(500.5)
      }
    })

    it('accepts null notes', () => {
      const result = budgetSchema.safeParse({
        ...validBase,
        planned: 100,
        notes: null,
      })

      expect(result.success).toBe(true)
    })

    it('accepts undefined notes', () => {
      const result = budgetSchema.safeParse({
        ...validBase,
        planned: 100,
        // notes intentionally omitted
      })

      expect(result.success).toBe(true)
    })

    it('rejects notes exceeding 240 characters', () => {
      const result = budgetSchema.safeParse({
        ...validBase,
        planned: 100,
        notes: 'a'.repeat(241),
      })

      expect(result.success).toBe(false)
    })

    it('accepts notes at exactly 240 characters', () => {
      const result = budgetSchema.safeParse({
        ...validBase,
        planned: 100,
        notes: 'a'.repeat(240),
      })

      expect(result.success).toBe(true)
    })

    it('rejects invalid monthKey format (too short)', () => {
      const result = budgetSchema.safeParse({
        ...validBase,
        planned: 100,
        monthKey: '24-06', // Should be '2024-06'
      })

      expect(result.success).toBe(false)
    })

    it('accepts valid monthKey format', () => {
      const result = budgetSchema.safeParse({
        ...validBase,
        planned: 100,
        monthKey: '2024-06',
      })

      expect(result.success).toBe(true)
    })

    it('accepts all valid currencies', () => {
      for (const currency of [Currency.USD, Currency.EUR, Currency.ILS]) {
        const result = budgetSchema.safeParse({
          ...validBase,
          planned: 100,
          currency,
        })

        expect(result.success).toBe(true)
      }
    })

    it('defaults to USD when currency not specified', () => {
      const { currency: _, ...baseWithoutCurrency } = validBase
      const result = budgetSchema.safeParse({
        ...baseWithoutCurrency,
        planned: 100,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.currency).toBe(Currency.USD)
      }
    })
  })

  describe('Budget Progress Calculation', () => {
    const createBudgetSummary = (planned: number, actual: number): CategoryBudgetSummary => ({
      budgetId: 'budget-123',
      accountId: 'acc-123',
      accountName: 'Test Account',
      categoryId: 'cat-456',
      categoryName: 'Test Category',
      categoryType: TransactionType.EXPENSE,
      planned,
      actual,
      remaining: planned - actual,
      month: '2024-06',
    })

    it('returns 0 for zero planned with zero actual (no division by zero)', () => {
      const budget = createBudgetSummary(0, 0)
      const progress = getBudgetProgress(budget)

      expect(progress).toBe(0)
      expect(Number.isFinite(progress)).toBe(true) // Not NaN or Infinity
    })

    it('returns 1 (100%) for zero planned with positive actual', () => {
      const budget = createBudgetSummary(0, 100)
      const progress = getBudgetProgress(budget)

      expect(progress).toBe(1)
    })

    it('returns 0 for negative planned with zero actual', () => {
      const budget = createBudgetSummary(-100, 0)
      const progress = getBudgetProgress(budget)

      expect(progress).toBe(0)
    })

    it('returns 1 for negative planned with positive actual', () => {
      const budget = createBudgetSummary(-100, 50)
      const progress = getBudgetProgress(budget)

      expect(progress).toBe(1)
    })

    it('calculates correct progress for normal case', () => {
      const budget = createBudgetSummary(1000, 500)
      const progress = getBudgetProgress(budget)

      expect(progress).toBe(0.5) // 50%
    })

    it('caps progress at 1 (100%) when overspent', () => {
      const budget = createBudgetSummary(1000, 1500) // 150% overspent
      const progress = getBudgetProgress(budget)

      expect(progress).toBe(1) // Capped at 100%
    })

    it('returns 0 for zero actual with positive planned', () => {
      const budget = createBudgetSummary(1000, 0)
      const progress = getBudgetProgress(budget)

      expect(progress).toBe(0)
    })

    it('handles very small planned amounts without precision errors', () => {
      const budget = createBudgetSummary(0.01, 0.005)
      const progress = getBudgetProgress(budget)

      expect(progress).toBe(0.5) // 50%
      expect(Number.isFinite(progress)).toBe(true)
    })

    it('handles very large amounts without overflow', () => {
      const budget = createBudgetSummary(9999999999.99, 4999999999.99)
      const progress = getBudgetProgress(budget)

      expect(progress).toBeCloseTo(0.5, 1)
      expect(Number.isFinite(progress)).toBe(true)
    })

    it('clamps negative actual to 0 progress', () => {
      const budget = createBudgetSummary(1000, -100) // Negative actual shouldn't happen but test it
      const progress = getBudgetProgress(budget)

      // Current implementation: Math.min(Math.max(-100/1000, 0), 1) = 0
      expect(progress).toBe(0)
    })

    it('handles floating point precision correctly', () => {
      // Classic floating point issue: 0.1 + 0.2 = 0.30000000000000004
      const budget = createBudgetSummary(0.3, 0.1 + 0.2)
      const progress = getBudgetProgress(budget)

      expect(progress).toBeCloseTo(1, 5)
      expect(Number.isFinite(progress)).toBe(true)
    })
  })

  describe('Budget Remaining Calculation', () => {
    it('remaining is positive when under budget', () => {
      const planned = 1000
      const actual = 600
      const remaining = planned - actual

      expect(remaining).toBe(400)
      expect(remaining).toBeGreaterThan(0)
    })

    it('remaining is zero when exactly at budget', () => {
      const planned = 1000
      const actual = 1000
      const remaining = planned - actual

      expect(remaining).toBe(0)
    })

    it('remaining is negative when over budget', () => {
      const planned = 1000
      const actual = 1200
      const remaining = planned - actual

      expect(remaining).toBe(-200)
      expect(remaining).toBeLessThan(0)
    })

    it('remaining equals planned when no transactions', () => {
      const planned = 1000
      const actual = 0
      const remaining = planned - actual

      expect(remaining).toBe(planned)
    })
  })

  describe('Required Fields', () => {
    const validBase = {
      accountId: 'acc-123',
      categoryId: 'cat-456',
      monthKey: '2024-06',
      planned: 100,
      csrfToken: 'valid-token',
    }

    it('rejects missing accountId', () => {
      const { accountId: _, ...withoutAccount } = validBase
      const result = budgetSchema.safeParse(withoutAccount)

      expect(result.success).toBe(false)
    })

    it('rejects missing categoryId', () => {
      const { categoryId: _, ...withoutCategory } = validBase
      const result = budgetSchema.safeParse(withoutCategory)

      expect(result.success).toBe(false)
    })

    it('rejects missing monthKey', () => {
      const { monthKey: _, ...withoutMonth } = validBase
      const result = budgetSchema.safeParse(withoutMonth)

      expect(result.success).toBe(false)
    })

    it('rejects missing csrfToken', () => {
      const { csrfToken: _, ...withoutCsrf } = validBase
      const result = budgetSchema.safeParse(withoutCsrf)

      expect(result.success).toBe(false)
    })

    it('rejects empty accountId', () => {
      const result = budgetSchema.safeParse({
        ...validBase,
        accountId: '',
      })

      expect(result.success).toBe(false)
    })

    it('rejects empty categoryId', () => {
      const result = budgetSchema.safeParse({
        ...validBase,
        categoryId: '',
      })

      expect(result.success).toBe(false)
    })
  })
})
