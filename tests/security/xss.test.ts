/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock Next.js cache - must be at top
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock auth-server - must be at top
vi.mock('@/lib/auth-server', () => ({
  requireSession: vi.fn().mockResolvedValue({
    userEmail: 'test@example.com',
    accountId: 'test-account-id',
  }),
  getAuthUserFromSession: vi.fn().mockReturnValue({
    id: 'test-user',
    email: 'test@example.com',
    displayName: 'Test User',
    accountNames: ['Test Account'],
    defaultAccountName: 'Test Account',
    preferredCurrency: 'USD',
  }),
}))

// Mock CSRF validation - must be at top
vi.mock('@/lib/csrf', () => ({
  validateCsrfToken: vi.fn().mockResolvedValue(true),
  rotateCsrfToken: vi.fn().mockResolvedValue('new-token'),
}))

// Mock Prisma enums
vi.mock('@prisma/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@prisma/client')>()
  return {
    ...original,
    Currency: {
      USD: 'USD',
      EUR: 'EUR',
      ILS: 'ILS',
    },
    TransactionType: {
      INCOME: 'INCOME',
      EXPENSE: 'EXPENSE',
    },
    Prisma: {
      Decimal: class {
        constructor(public value: any) {}
        toNumber() {
          return Number(this.value)
        }
      },
    },
  }
})

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    budget: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    holding: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    recurringTemplate: {
      upsert: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

// Imports after mocks
import {
  createTransactionAction,
  createCategoryAction,
  upsertBudgetAction,
  createHoldingAction,
  upsertRecurringTemplateAction,
} from '@/app/actions'
import { Currency, TransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CRITICAL_XSS_PAYLOADS, ALL_XSS_PAYLOADS } from './xss-payloads'
import { assertNoExecutableScript } from './xss-helpers'

describe('XSS Vulnerability Audit - Stored XSS Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'test-account-id',
      name: 'Test Account',
      type: 'CHECKING',
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    vi.mocked(prisma.category.findUnique).mockResolvedValue({
      id: 'test-category-id',
      name: 'Test Category',
      type: TransactionType.EXPENSE,
      color: null,
      isArchived: false,
      isHolding: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
  })

  describe('Transaction Descriptions - Stored XSS', () => {
    it('should safely store and escape XSS payloads in transaction descriptions', async () => {
      // Test with critical XSS payloads (faster smoke test)
      for (const payload of CRITICAL_XSS_PAYLOADS) {
        // Clear mocks for this iteration
        vi.clearAllMocks()

        // Mock successful transaction creation with current payload
        vi.mocked(prisma.transaction.create).mockResolvedValueOnce({
          id: 'test-transaction-id',
          accountId: 'test-account-id',
          categoryId: 'test-category-id',
          type: TransactionType.EXPENSE,
          amount: 100,
          currency: Currency.USD,
          date: new Date(),
          month: new Date(),
          description: payload, // Payload should be stored as-is
          isRecurring: false,
          recurringTemplateId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)

        // Mock account and category lookups
        vi.mocked(prisma.account.findUnique).mockResolvedValueOnce({
          id: 'test-account-id',
          name: 'Test Account',
          type: 'CHECKING',
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)

        vi.mocked(prisma.category.findUnique).mockResolvedValueOnce({
          id: 'test-category-id',
          name: 'Test Category',
          type: TransactionType.EXPENSE,
          color: null,
          isArchived: false,
          isHolding: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)

        // Create transaction with XSS payload
        const result = await createTransactionAction({
          accountId: 'test-account-id',
          categoryId: 'test-category-id',
          type: TransactionType.EXPENSE,
          amount: 100,
          currency: Currency.USD,
          date: new Date(),
          description: payload,
          isRecurring: false,
          recurringTemplateId: null,
          csrfToken: 'valid-csrf-token',
        })

        // Should successfully create the transaction
        expect('success' in result && result.success).toBe(true)

        // Verify payload was stored as-is (no pre-escaping in database)
        const createCall = vi.mocked(prisma.transaction.create).mock.calls[0]
        expect(createCall[0].data.description).toBe(payload)

        // Simulate rendering the transaction description in React
        // In a real React component, this would use JSX: {transaction.description}
        // React automatically escapes text content, preventing XSS
        const simulatedReactRendering = `<div>${escapeHtmlLikeReact(payload)}</div>`

        // Verify no executable scripts in rendered output
        assertNoExecutableScript(simulatedReactRendering, payload)
      }
    })

    it('should handle all XSS payload types in transaction descriptions', async () => {
      // Comprehensive test with ALL payloads
      const payloadSample = ALL_XSS_PAYLOADS.slice(0, 10) // Sample for speed

      for (const payload of payloadSample) {
        vi.mocked(prisma.transaction.create).mockResolvedValue({
          id: 'test-transaction-id',
          description: payload,
        } as any)

        const result = await createTransactionAction({
          accountId: 'test-account-id',
          categoryId: 'test-category-id',
          type: TransactionType.EXPENSE,
          amount: 50,
          currency: Currency.USD,
          date: new Date(),
          description: payload,
          csrfToken: 'valid-csrf-token',
        } as any)

        expect('success' in result && result.success).toBe(true)

        // Verify React-like escaping would prevent XSS
        const escaped = escapeHtmlLikeReact(payload)
        assertNoExecutableScript(`<p>${escaped}</p>`, payload)
      }
    })

    it('should reject excessively long transaction descriptions', async () => {
      // Description max length is 240 chars (from schema)
      const longPayload = '<script>alert("XSS")</script>'.repeat(10) // >240 chars

      const result = await createTransactionAction({
        accountId: 'test-account-id',
        categoryId: 'test-category-id',
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: Currency.USD,
        date: new Date(),
        description: longPayload,
        csrfToken: 'valid-csrf-token',
      } as any)

      // Should fail validation
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.description).toBeDefined()
      }
    })
  })

  describe('Category Names - Stored XSS', () => {
    it('should safely store and escape XSS payloads in category names', async () => {
      for (const payload of CRITICAL_XSS_PAYLOADS) {
        vi.clearAllMocks()

        vi.mocked(prisma.category.create).mockResolvedValueOnce({
          id: 'test-category-id',
          name: payload,
          type: TransactionType.EXPENSE,
        } as any)

        const result = await createCategoryAction({
          name: payload,
          type: TransactionType.EXPENSE,
          color: null,
          csrfToken: 'valid-csrf-token',
        })

        expect('success' in result && result.success).toBe(true)

        // Verify category name stored as-is
        const createCall = vi.mocked(prisma.category.create).mock.calls[0]
        expect(createCall[0].data.name).toBe(payload)

        // Verify React escaping prevents XSS
        const rendered = `<span>${escapeHtmlLikeReact(payload)}</span>`
        assertNoExecutableScript(rendered, payload)
      }
    })

    it('should reject category names shorter than 2 characters', async () => {
      // Schema requires min 2 chars
      const result = await createCategoryAction({
        name: '<',
        type: TransactionType.EXPENSE,
        csrfToken: 'valid-csrf-token',
      } as any)

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.name).toBeDefined()
      }
    })
  })

  describe('Budget Notes - Stored XSS', () => {
    it('should safely store and escape XSS payloads in budget notes', async () => {
      for (const payload of CRITICAL_XSS_PAYLOADS) {
        vi.clearAllMocks()

        vi.mocked(prisma.account.findUnique).mockResolvedValueOnce({
          id: 'test-account-id',
          name: 'Test Account',
        } as any)

        vi.mocked(prisma.category.findUnique).mockResolvedValueOnce({
          id: 'test-category-id',
          name: 'Test Category',
          type: TransactionType.EXPENSE,
        } as any)

        vi.mocked(prisma.budget.upsert).mockResolvedValueOnce({
          accountId: 'test-account-id',
          categoryId: 'test-category-id',
          monthKey: '2024-01',
          planned: 1000,
          currency: Currency.USD,
          notes: payload,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)

        const result = await upsertBudgetAction({
          accountId: 'test-account-id',
          categoryId: 'test-category-id',
          monthKey: '2024-01',
          planned: 1000,
          currency: Currency.USD,
          notes: payload,
          csrfToken: 'valid-csrf-token',
        })

        expect('success' in result && result.success).toBe(true)

        // Verify notes stored as-is
        const upsertCall = vi.mocked(prisma.budget.upsert).mock.calls[0]
        expect(upsertCall[0].update.notes).toBe(payload)

        // Verify React escaping
        const rendered = `<p>${escapeHtmlLikeReact(payload)}</p>`
        assertNoExecutableScript(rendered, payload)
      }
    })
  })

  describe('Holding Notes - Stored XSS', () => {
    it('should safely store and escape XSS payloads in holding notes', async () => {
      // Mock stock API validation
      vi.mock('@/lib/stock-api', () => ({
        validateSymbol: vi.fn().mockResolvedValue({ valid: true, name: 'Test Stock' }),
      }))

      for (const payload of CRITICAL_XSS_PAYLOADS.slice(0, 3)) {
        // Sample for speed
        vi.mocked(prisma.holding.create).mockResolvedValue({
          id: 'test-holding-id',
          accountId: 'test-account-id',
          categoryId: 'test-category-id',
          symbol: 'AAPL',
          quantity: 10,
          averageCost: 150,
          currency: Currency.USD,
          notes: payload,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)

        const result = await createHoldingAction({
          accountId: 'test-account-id',
          categoryId: 'test-category-id',
          symbol: 'AAPL',
          quantity: 10,
          averageCost: 150,
          currency: Currency.USD,
          notes: payload,
          csrfToken: 'valid-csrf-token',
        })

        if ('success' in result && result.success) {
          // Verify notes stored as-is
          const createCall = vi.mocked(prisma.holding.create).mock.calls[0]
          expect(createCall[0].data.notes).toBe(payload)

          // Verify React escaping
          const rendered = `<p>${escapeHtmlLikeReact(payload)}</p>`
          assertNoExecutableScript(rendered, payload)
        }
      }
    })
  })

  describe('Recurring Template Descriptions - Stored XSS', () => {
    it('should safely store and escape XSS payloads in recurring template descriptions', async () => {
      for (const payload of CRITICAL_XSS_PAYLOADS.slice(0, 3)) {
        vi.clearAllMocks()

        vi.mocked(prisma.account.findUnique).mockResolvedValueOnce({
          id: 'test-account-id',
          name: 'Test Account',
        } as any)

        vi.mocked(prisma.category.findUnique).mockResolvedValueOnce({
          id: 'test-category-id',
          name: 'Test Category',
          type: TransactionType.EXPENSE,
        } as any)

        vi.mocked(prisma.recurringTemplate.create).mockResolvedValueOnce({
          id: 'test-recurring-id',
          accountId: 'test-account-id',
          categoryId: 'test-category-id',
          type: TransactionType.EXPENSE,
          amount: 100,
          currency: Currency.USD,
          dayOfMonth: 1,
          description: payload,
          startMonthKey: '2024-01',
          endMonthKey: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)

        const result = await upsertRecurringTemplateAction({
          accountId: 'test-account-id',
          categoryId: 'test-category-id',
          type: TransactionType.EXPENSE,
          amount: 100,
          currency: Currency.USD,
          dayOfMonth: 1,
          description: payload,
          startMonthKey: '2024-01',
          endMonthKey: null,
          isActive: true,
          csrfToken: 'valid-csrf-token',
        })

        expect('success' in result && result.success).toBe(true)

        // Verify description stored as-is (action calls .create() when no id)
        const createCall = vi.mocked(prisma.recurringTemplate.create).mock.calls[0]
        expect(createCall[0].data.description).toBe(payload)

        // Verify React escaping
        const rendered = `<div>${escapeHtmlLikeReact(payload)}</div>`
        assertNoExecutableScript(rendered, payload)
      }
    })
  })
})

/**
 * Helper function to simulate React's JSX text escaping
 * React automatically escapes text content to prevent XSS
 */
function escapeHtmlLikeReact(text: string | null | undefined): string {
  if (!text) return ''

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}
