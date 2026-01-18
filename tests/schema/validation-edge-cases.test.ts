import { describe, expect, it } from 'vitest'
import { TransactionType, Currency } from '@prisma/client'
import {
  transactionSchema,
  transactionUpdateSchema,
  budgetSchema,
  recurringTemplateSchema,
  categorySchema,
  holdingSchema,
  updateHoldingSchema,
  registrationSchema,
  loginSchema,
  resetPasswordSchema,
} from '@/schemas'

describe('Transaction Schema Edge Cases', () => {
  describe('amount validation', () => {
    it('should accept minimum valid amount (0.01)', () => {
      const result = transactionSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: 0.01,
        currency: Currency.USD,
        date: new Date(),
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject zero amount', () => {
      const result = transactionSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: 0,
        currency: Currency.USD,
        date: new Date(),
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(false)
    })

    it('should reject negative amount', () => {
      const result = transactionSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: -10,
        currency: Currency.USD,
        date: new Date(),
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(false)
    })

    it('should accept large amount', () => {
      const result = transactionSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.INCOME,
        amount: 999999999.99,
        currency: Currency.USD,
        date: new Date(),
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should coerce string amount to number', () => {
      const result = transactionSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: '125.50',
        currency: Currency.USD,
        date: new Date(),
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.amount).toBe(125.5)
      }
    })
  })

  describe('description validation', () => {
    it('should accept null description', () => {
      const result = transactionSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: Currency.USD,
        date: new Date(),
        description: null,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should accept empty string description', () => {
      const result = transactionSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: Currency.USD,
        date: new Date(),
        description: '',
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should accept 240 character description (max)', () => {
      const result = transactionSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: Currency.USD,
        date: new Date(),
        description: 'a'.repeat(240),
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject description over 240 characters', () => {
      const result = transactionSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: Currency.USD,
        date: new Date(),
        description: 'a'.repeat(241),
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('date validation', () => {
    it('should coerce ISO string to Date', () => {
      const result = transactionSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: Currency.USD,
        date: '2024-01-15',
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.date instanceof Date).toBe(true)
      }
    })

    it('should accept Date object', () => {
      const result = transactionSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })
  })
})

describe('Budget Schema Edge Cases', () => {
  describe('planned amount', () => {
    it('should accept zero budget', () => {
      const result = budgetSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        monthKey: '2024-01',
        planned: 0,
        currency: Currency.USD,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject negative budget', () => {
      const result = budgetSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        monthKey: '2024-01',
        planned: -100,
        currency: Currency.USD,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(false)
    })

    it('should coerce string to number', () => {
      const result = budgetSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        monthKey: '2024-01',
        planned: '500.50',
        currency: Currency.USD,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.planned).toBe(500.5)
      }
    })
  })

  describe('monthKey format', () => {
    it('should accept valid YYYY-MM format', () => {
      const result = budgetSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        monthKey: '2024-01',
        planned: 500,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject short monthKey', () => {
      const result = budgetSchema.safeParse({
        accountId: 'acc-123',
        categoryId: 'cat-123',
        monthKey: '24-01',
        planned: 500,
        csrfToken: 'token-123',
      })
      expect(result.success).toBe(false)
    })
  })
})

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

describe('Registration Schema Edge Cases', () => {
  describe('password validation', () => {
    it('should accept valid password', () => {
      const result = registrationSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1',
        displayName: 'Test User',
      })
      expect(result.success).toBe(true)
    })

    it('should reject password under 8 characters', () => {
      const result = registrationSchema.safeParse({
        email: 'test@example.com',
        password: 'Pass1',
        displayName: 'Test User',
      })
      expect(result.success).toBe(false)
    })

    it('should reject password without uppercase', () => {
      const result = registrationSchema.safeParse({
        email: 'test@example.com',
        password: 'password1',
        displayName: 'Test User',
      })
      expect(result.success).toBe(false)
    })

    it('should reject password without lowercase', () => {
      const result = registrationSchema.safeParse({
        email: 'test@example.com',
        password: 'PASSWORD1',
        displayName: 'Test User',
      })
      expect(result.success).toBe(false)
    })

    it('should reject password without number', () => {
      const result = registrationSchema.safeParse({
        email: 'test@example.com',
        password: 'PasswordABC',
        displayName: 'Test User',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('displayName validation', () => {
    it('should accept 2 character displayName (minimum)', () => {
      const result = registrationSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1',
        displayName: 'Jo',
      })
      expect(result.success).toBe(true)
    })

    it('should reject 1 character displayName', () => {
      const result = registrationSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1',
        displayName: 'J',
      })
      expect(result.success).toBe(false)
    })

    it('should accept 100 character displayName (maximum)', () => {
      const result = registrationSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1',
        displayName: 'J'.repeat(100),
      })
      expect(result.success).toBe(true)
    })

    it('should reject displayName over 100 characters', () => {
      const result = registrationSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1',
        displayName: 'J'.repeat(101),
      })
      expect(result.success).toBe(false)
    })
  })
})

describe('Login Schema Edge Cases', () => {
  it('should accept valid email and password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'anypassword',
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'anypassword',
    })
    expect(result.success).toBe(false)
  })

  it('should reject empty password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
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
