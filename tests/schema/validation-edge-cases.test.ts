import { describe, expect, it } from 'vitest'
import { TransactionType, Currency } from '@prisma/client'
import {
  recurringTemplateSchema,
  categorySchema,
  holdingSchema,
  resetPasswordSchema,
} from '@/schemas'

/**
 * Schema Edge Case Tests - Unique Coverage
 *
 * This file contains schema validation tests for edge cases NOT covered
 * in other test files:
 * - Recurring Template: dayOfMonth bounds, endMonthKey validation
 * - Category: name whitespace validation
 * - Holding: symbol format, quantity bounds
 * - Reset Password: token and password validation
 *
 * Tests for Transaction and Budget schemas are in:
 * - tests/transaction-edge-cases.test.ts
 * - tests/budget-edge-cases.test.ts
 *
 * Tests for Registration/Login schemas are in:
 * - tests/api/v1/auth-register.test.ts
 * - tests/api/v1/auth-password-reset.test.ts
 */

describe('Recurring Template Schema Edge Cases', () => {
  describe('dayOfMonth validation', () => {
    it('should accept day 1 (minimum)', () => {
      const result = recurringTemplateSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: 50,
        currency: Currency.USD,
        dayOfMonth: 1,
        startMonthKey: '2024-01',
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should accept day 31 (maximum)', () => {
      const result = recurringTemplateSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: 50,
        currency: Currency.USD,
        dayOfMonth: 31,
        startMonthKey: '2024-01',
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject day 0', () => {
      const result = recurringTemplateSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: 50,
        currency: Currency.USD,
        dayOfMonth: 0,
        startMonthKey: '2024-01',
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(false)
    })

    it('should reject day 32', () => {
      const result = recurringTemplateSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: 50,
        currency: Currency.USD,
        dayOfMonth: 32,
        startMonthKey: '2024-01',
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(false)
    })

    it('should coerce string dayOfMonth to number', () => {
      const result = recurringTemplateSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: 50,
        currency: Currency.USD,
        dayOfMonth: '15',
        startMonthKey: '2024-01',
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.dayOfMonth).toBe(15)
      }
    })
  })

  describe('endMonthKey validation', () => {
    it('should accept endMonthKey equal to startMonthKey', () => {
      const result = recurringTemplateSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: 50,
        currency: Currency.USD,
        dayOfMonth: 15,
        startMonthKey: '2024-01',
        endMonthKey: '2024-01',
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should accept endMonthKey after startMonthKey', () => {
      const result = recurringTemplateSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: 50,
        currency: Currency.USD,
        dayOfMonth: 15,
        startMonthKey: '2024-01',
        endMonthKey: '2024-12',
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject endMonthKey before startMonthKey', () => {
      const result = recurringTemplateSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: 50,
        currency: Currency.USD,
        dayOfMonth: 15,
        startMonthKey: '2024-06',
        endMonthKey: '2024-01',
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(false)
    })

    it('should accept null endMonthKey', () => {
      const result = recurringTemplateSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: 50,
        currency: Currency.USD,
        dayOfMonth: 15,
        startMonthKey: '2024-01',
        endMonthKey: null,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })
  })
})

describe('Category Schema Edge Cases', () => {
  describe('name validation', () => {
    it('should accept 2 character name (minimum)', () => {
      const result = categorySchema.safeParse({
        name: 'AB',
        type: TransactionType.EXPENSE,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject 1 character name', () => {
      const result = categorySchema.safeParse({
        name: 'A',
        type: TransactionType.EXPENSE,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(false)
    })

    it('should accept 100 character name (maximum)', () => {
      const result = categorySchema.safeParse({
        name: 'A' + 'b'.repeat(98) + 'C',
        type: TransactionType.EXPENSE,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject 101 character name', () => {
      const result = categorySchema.safeParse({
        name: 'a'.repeat(101),
        type: TransactionType.EXPENSE,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(false)
    })

    it('should accept alphanumeric name', () => {
      const result = categorySchema.safeParse({
        name: 'Food123',
        type: TransactionType.EXPENSE,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should accept name with spaces in middle', () => {
      const result = categorySchema.safeParse({
        name: 'Fast Food',
        type: TransactionType.EXPENSE,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject name starting with space', () => {
      const result = categorySchema.safeParse({
        name: ' Food',
        type: TransactionType.EXPENSE,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(false)
    })

    it('should reject name ending with space', () => {
      const result = categorySchema.safeParse({
        name: 'Food ',
        type: TransactionType.EXPENSE,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(false)
    })
  })
})

describe('Holding Schema Edge Cases', () => {
  describe('symbol validation', () => {
    it('should accept 1 character symbol', () => {
      const result = holdingSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        symbol: 'A',
        quantity: 10,
        averageCost: 100,
        currency: Currency.USD,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should accept 5 character symbol (maximum)', () => {
      const result = holdingSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        symbol: 'GOOGL',
        quantity: 10,
        averageCost: 100,
        currency: Currency.USD,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject 6 character symbol', () => {
      const result = holdingSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        symbol: 'ABCDEF',
        quantity: 10,
        averageCost: 100,
        currency: Currency.USD,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(false)
    })

    it('should reject lowercase symbol', () => {
      const result = holdingSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        symbol: 'aapl',
        quantity: 10,
        averageCost: 100,
        currency: Currency.USD,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(false)
    })

    it('should reject symbol with numbers', () => {
      const result = holdingSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        symbol: 'AAP1',
        quantity: 10,
        averageCost: 100,
        currency: Currency.USD,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('quantity validation', () => {
    it('should accept minimum quantity (0.000001)', () => {
      const result = holdingSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        symbol: 'AAPL',
        quantity: 0.000001,
        averageCost: 100,
        currency: Currency.USD,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should accept maximum quantity (999999999)', () => {
      const result = holdingSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        symbol: 'AAPL',
        quantity: 999999999,
        averageCost: 100,
        currency: Currency.USD,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject quantity exceeding maximum', () => {
      const result = holdingSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        symbol: 'AAPL',
        quantity: 1000000000,
        averageCost: 100,
        currency: Currency.USD,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('averageCost validation', () => {
    it('should accept zero averageCost', () => {
      const result = holdingSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        symbol: 'AAPL',
        quantity: 10,
        averageCost: 0,
        currency: Currency.USD,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject negative averageCost', () => {
      const result = holdingSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        symbol: 'AAPL',
        quantity: 10,
        averageCost: -50,
        currency: Currency.USD,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(false)
    })
  })
})

describe('Reset Password Schema Edge Cases', () => {
  it('should accept valid token and password', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'valid-reset-token',
      newPassword: 'NewPassword1',
    })
    expect(result.success).toBe(true)
  })

  it('should reject empty token', () => {
    const result = resetPasswordSchema.safeParse({
      token: '',
      newPassword: 'NewPassword1',
    })
    expect(result.success).toBe(false)
  })

  it('should reject weak password', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'valid-reset-token',
      newPassword: 'weak',
    })
    expect(result.success).toBe(false)
  })
})
