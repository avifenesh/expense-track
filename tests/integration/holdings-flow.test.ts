import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createHoldingAction, updateHoldingAction, deleteHoldingAction } from '@/app/actions/holdings'
import { Currency, TransactionType } from '@prisma/client'
import { createTestAccount, cleanupTestData, getTestUser, MOCK_CSRF_TOKEN } from './helpers'

// Mock Next.js cache revalidation
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock auth to return test user (database-driven)
vi.mock('@/lib/auth-server', () => ({
  requireSession: vi.fn().mockResolvedValue({
    userEmail: 'test@example.com',
    accountId: 'test-account-id',
  }),
  getDbUserAsAuthUser: vi.fn().mockResolvedValue({
    id: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    passwordHash: 'hash',
    accountNames: ['TEST_Holdings_Account'],
    defaultAccountName: 'TEST_Holdings_Account',
    preferredCurrency: 'USD',
  }),
}))

// Mock subscription to allow access
vi.mock('@/lib/subscription', () => ({
  hasActiveSubscription: vi.fn().mockResolvedValue(true),
  getSubscriptionState: vi.fn().mockResolvedValue({
    status: 'ACTIVE',
    isActive: true,
    trialEndsAt: null,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    daysRemaining: 30,
    canAccessApp: true,
  }),
}))

// Mock stock API to avoid real API calls
vi.mock('@/lib/stock-api', () => ({
  fetchStockQuote: vi.fn().mockResolvedValue({
    symbol: 'AAPL',
    price: 150.0,
    currency: 'USD',
  }),
  refreshStockPrices: vi.fn().mockResolvedValue({
    updated: 1,
    skipped: 0,
    errors: [],
  }),
}))

describe('Holdings Flow Integration', () => {
  let testAccountId: string
  let testCategoryId: string

  beforeEach(async () => {
    // Get test user for userId foreign keys
    const testUser = await getTestUser()

    // Setup test account
    const account = await createTestAccount('TEST_Holdings_Account')
    testAccountId = account.id

    // Create a holding category (holdings use EXPENSE type with isHolding flag)
    const category = await prisma.category.upsert({
      where: {
        userId_name_type: { userId: testUser.id, name: 'TEST_Holdings_Category', type: TransactionType.EXPENSE },
      },
      update: {},
      create: {
        userId: testUser.id,
        name: 'TEST_Holdings_Category',
        type: TransactionType.EXPENSE,
        isHolding: true,
      },
    })
    testCategoryId = category.id
  })

  afterEach(async () => {
    // Cleanup test data (cleanupTestData handles categories with TEST_ prefix)
    await cleanupTestData()
  })

  it('completes full holding lifecycle: create → update → delete', async () => {
    // 1. Create holding
    const createResult = await createHoldingAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      symbol: 'AAPL',
      quantity: 10.5,
      averageCost: 145.5,
      currency: Currency.USD,
      notes: 'TEST_Holding_Original',
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(createResult).toEqual({ success: true })

    // 2. Verify holding created in database
    const createdHolding = await prisma.holding.findFirst({
      where: { notes: 'TEST_Holding_Original' },
    })

    expect(createdHolding).toBeDefined()
    expect(createdHolding?.accountId).toBe(testAccountId)
    expect(createdHolding?.categoryId).toBe(testCategoryId)
    expect(createdHolding?.symbol).toBe('AAPL')
    expect(createdHolding?.quantity.toNumber()).toBe(10.5)
    expect(createdHolding?.averageCost.toNumber()).toBe(145.5)
    expect(createdHolding?.currency).toBe(Currency.USD)

    const holdingId = createdHolding!.id

    // 3. Update holding (bought more shares)
    const updateResult = await updateHoldingAction({
      id: holdingId,
      quantity: 15.75,
      averageCost: 148.25,
      notes: 'TEST_Holding_Updated',
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(updateResult).toEqual({ success: true })

    // 4. Verify holding updated
    const updatedHolding = await prisma.holding.findUnique({
      where: { id: holdingId },
    })

    expect(updatedHolding?.quantity.toNumber()).toBe(15.75)
    expect(updatedHolding?.averageCost.toNumber()).toBe(148.25)
    expect(updatedHolding?.notes).toBe('TEST_Holding_Updated')

    // 5. Delete holding
    const deleteResult = await deleteHoldingAction({
      id: holdingId,
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(deleteResult).toEqual({ success: true })

    // 6. Verify holding deleted
    const deletedHolding = await prisma.holding.findUnique({
      where: { id: holdingId },
    })

    // Soft delete - record exists but has deletedAt set
    expect(deletedHolding).not.toBeNull()
    expect(deletedHolding?.deletedAt).not.toBeNull()
  })

  it('creates multiple holdings for same account', async () => {
    // Create holdings for AAPL, MSFT, GOOGL
    const symbols = ['AAPL', 'MSFT', 'GOOGL']
    const quantities = [10, 20, 5]
    const costs = [150, 300, 2500]

    for (let i = 0; i < symbols.length; i++) {
      const result = await createHoldingAction({
        accountId: testAccountId,
        categoryId: testCategoryId,
        symbol: symbols[i],
        quantity: quantities[i],
        averageCost: costs[i],
        currency: Currency.USD,
        notes: `TEST_Holding_${symbols[i]}`,
        csrfToken: MOCK_CSRF_TOKEN,
      })

      expect(result).toEqual({ success: true })
    }

    // Verify all 3 holdings exist
    const holdings = await prisma.holding.findMany({
      where: {
        accountId: testAccountId,
        notes: { contains: 'TEST_Holding_' },
      },
      orderBy: { symbol: 'asc' },
    })

    expect(holdings).toHaveLength(3)
    expect(holdings.map((h) => h.symbol)).toEqual(['AAPL', 'GOOGL', 'MSFT'])
  })

  it('calculates total value correctly (quantity * averageCost)', async () => {
    const result = await createHoldingAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      symbol: 'TSLA',
      quantity: 5.5,
      averageCost: 200,
      currency: Currency.USD,
      notes: 'TEST_Holding_Value_Calc',
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(result).toEqual({ success: true })

    const holding = await prisma.holding.findFirst({
      where: { notes: 'TEST_Holding_Value_Calc' },
    })

    expect(holding).toBeDefined()

    // Calculate total value
    const totalValue = holding!.quantity.toNumber() * holding!.averageCost.toNumber()
    expect(totalValue).toBe(1100) // 5.5 * 200
  })

  it('handles fractional shares correctly', async () => {
    // Create holding with fractional shares
    const result = await createHoldingAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      symbol: 'VTI',
      quantity: 12.456789,
      averageCost: 220.5,
      currency: Currency.USD,
      notes: 'TEST_Holding_Fractional',
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(result).toEqual({ success: true })

    const holding = await prisma.holding.findFirst({
      where: { notes: 'TEST_Holding_Fractional' },
    })

    expect(holding).toBeDefined()
    // Quantity should be stored with 6 decimal places precision
    expect(holding!.quantity.toNumber()).toBeCloseTo(12.456789, 6)
  })

  it('normalizes symbol to uppercase', async () => {
    // Create holding with lowercase symbol
    const result = await createHoldingAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      symbol: 'nvda',
      quantity: 8,
      averageCost: 450,
      currency: Currency.USD,
      notes: 'TEST_Holding_Lowercase',
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(result).toEqual({ success: true })

    const holding = await prisma.holding.findFirst({
      where: { notes: 'TEST_Holding_Lowercase' },
    })

    expect(holding).toBeDefined()
    expect(holding!.symbol).toBe('NVDA') // Should be uppercase
  })

  it('handles selling shares (reducing quantity)', async () => {
    // Create initial holding
    const createResult = await createHoldingAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      symbol: 'AMD',
      quantity: 50,
      averageCost: 100,
      currency: Currency.USD,
      notes: 'TEST_Holding_Sell',
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(createResult).toEqual({ success: true })

    const holding = await prisma.holding.findFirst({
      where: { notes: 'TEST_Holding_Sell' },
    })

    const holdingId = holding!.id

    // Sell 20 shares (reduce quantity to 30)
    const updateResult = await updateHoldingAction({
      id: holdingId,
      quantity: 30,
      averageCost: 100,
      notes: 'TEST_Holding_Sell_After',
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(updateResult).toEqual({ success: true })

    const updatedHolding = await prisma.holding.findUnique({
      where: { id: holdingId },
    })

    expect(updatedHolding?.quantity.toNumber()).toBe(30)
  })
})
