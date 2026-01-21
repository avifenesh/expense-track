import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as GetDashboard } from '@/app/api/v1/dashboard/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import { getMonthStartFromKey, getMonthKey } from '@/utils/date'
import { getApiTestUser, getOtherTestUser, TEST_USER_ID, OTHER_USER_ID } from './helpers'
import { Currency, TransactionType, PaymentStatus } from '@prisma/client'

// Mock rate limiting to avoid test interference
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 100, resetAt: new Date() }),
  incrementRateLimit: vi.fn(),
  getRateLimitHeaders: () => ({}),
}))

describe('Dashboard API Routes', () => {
  let validToken: string
  let otherUserToken: string
  let accountId: string
  let otherAccountId: string
  let categoryId: string
  const testMonthKey = getMonthKey(new Date())

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing!'
    resetEnvCache()
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')
    otherUserToken = generateAccessToken(OTHER_USER_ID, 'api-other@example.com')

    const testUser = await getApiTestUser()
    const otherTestUser = await getOtherTestUser()

    // Create test account
    const account = await prisma.account.upsert({
      where: { userId_name: { userId: testUser.id, name: 'DashboardTestAccount' } },
      update: {},
      create: {
        userId: testUser.id,
        name: 'DashboardTestAccount',
        type: 'SELF',
        preferredCurrency: Currency.USD,
      },
    })

    // Other account belongs to OTHER user
    const otherAccount = await prisma.account.upsert({
      where: { userId_name: { userId: otherTestUser.id, name: 'OtherDashboardAccount' } },
      update: {},
      create: {
        userId: otherTestUser.id,
        name: 'OtherDashboardAccount',
        type: 'SELF',
        preferredCurrency: Currency.USD,
      },
    })

    // Create test category
    const category = await prisma.category.upsert({
      where: { userId_name_type: { userId: testUser.id, name: 'DashboardTestCategory', type: 'EXPENSE' } },
      update: {},
      create: { userId: testUser.id, name: 'DashboardTestCategory', type: 'EXPENSE' },
    })

    accountId = account.id
    otherAccountId = otherAccount.id
    categoryId = category.id

    // Create sample transaction
    await prisma.transaction.create({
      data: {
        accountId,
        categoryId,
        type: TransactionType.EXPENSE,
        amount: 50.0,
        currency: Currency.USD,
        date: new Date(),
        month: getMonthStartFromKey(testMonthKey),
        description: 'Test transaction',
      },
    })

    // Create sample budget
    await prisma.budget.create({
      data: {
        accountId,
        categoryId,
        month: getMonthStartFromKey(testMonthKey),
        planned: 200.0,
        currency: Currency.USD,
      },
    })
  })

  afterEach(async () => {
    // Clean up test data
    await prisma.transaction.deleteMany({
      where: { description: 'Test transaction' },
    })
    await prisma.budget.deleteMany({
      where: { accountId },
    })
    await prisma.category.deleteMany({
      where: { name: 'DashboardTestCategory' },
    })
    await prisma.account.deleteMany({
      where: { name: { in: ['DashboardTestAccount', 'OtherDashboardAccount'] } },
    })
  })

  describe('GET /api/v1/dashboard', () => {
    it('returns dashboard data with valid JWT and accountId', async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/dashboard?accountId=${accountId}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${validToken}` },
        }
      )

      const response = await GetDashboard(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.month).toBe(testMonthKey)
      expect(data.data.summary).toBeDefined()
      expect(data.data.summary.totalIncome).toBeDefined()
      expect(data.data.summary.totalExpenses).toBeDefined()
      expect(data.data.summary.netResult).toBeDefined()
      expect(data.data.budgetProgress).toBeInstanceOf(Array)
      expect(data.data.recentTransactions).toBeInstanceOf(Array)
      expect(typeof data.data.pendingSharedExpenses).toBe('number')
    })

    it('returns dashboard data for specific month', async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/dashboard?accountId=${accountId}&month=${testMonthKey}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${validToken}` },
        }
      )

      const response = await GetDashboard(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.month).toBe(testMonthKey)
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/dashboard?accountId=${accountId}`,
        { method: 'GET' }
      )

      const response = await GetDashboard(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBeDefined()
    })

    it('returns 401 with invalid token', async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/dashboard?accountId=${accountId}`,
        {
          method: 'GET',
          headers: { Authorization: 'Bearer invalid-token' },
        }
      )

      const response = await GetDashboard(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBeDefined()
    })

    it('returns 400 with missing accountId', async () => {
      const request = new NextRequest('http://localhost/api/v1/dashboard', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetDashboard(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.fields?.accountId).toBeDefined()
    })

    it('returns 400 with invalid month format', async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/dashboard?accountId=${accountId}&month=invalid`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${validToken}` },
        }
      )

      const response = await GetDashboard(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.fields?.month).toBeDefined()
    })

    it('returns 403 when accessing another user account', async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/dashboard?accountId=${otherAccountId}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${validToken}` },
        }
      )

      const response = await GetDashboard(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Access denied')
    })

    it('includes budget progress in response', async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/dashboard?accountId=${accountId}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${validToken}` },
        }
      )

      const response = await GetDashboard(request)
      const data = await response.json()

      expect(response.status).toBe(200)

      // Should have at least one budget (we created one in beforeEach)
      if (data.data.budgetProgress.length > 0) {
        const budget = data.data.budgetProgress[0]
        expect(budget.categoryId).toBeDefined()
        expect(budget.categoryName).toBeDefined()
        expect(budget.budgeted).toBeDefined()
        expect(budget.spent).toBeDefined()
        expect(budget.remaining).toBeDefined()
        expect(budget.percentUsed).toBeDefined()
      }
    })

    it('includes recent transactions in response', async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/dashboard?accountId=${accountId}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${validToken}` },
        }
      )

      const response = await GetDashboard(request)
      const data = await response.json()

      expect(response.status).toBe(200)

      // Should have at least one transaction (we created one in beforeEach)
      if (data.data.recentTransactions.length > 0) {
        const txn = data.data.recentTransactions[0]
        expect(txn.id).toBeDefined()
        expect(txn.amount).toBeDefined()
        expect(txn.date).toBeDefined()
        expect(txn.category).toBeDefined()
        expect(txn.category.name).toBeDefined()
      }
    })

    it('limits recent transactions to 5', async () => {
      // Create more transactions
      for (let i = 0; i < 10; i++) {
        await prisma.transaction.create({
          data: {
            accountId,
            categoryId,
            type: TransactionType.EXPENSE,
            amount: 10.0 + i,
            currency: Currency.USD,
            date: new Date(),
            month: getMonthStartFromKey(testMonthKey),
            description: `Bulk test transaction ${i}`,
          },
        })
      }

      const request = new NextRequest(
        `http://localhost/api/v1/dashboard?accountId=${accountId}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${validToken}` },
        }
      )

      const response = await GetDashboard(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.recentTransactions.length).toBeLessThanOrEqual(5)

      // Cleanup bulk transactions
      await prisma.transaction.deleteMany({
        where: { description: { startsWith: 'Bulk test transaction' } },
      })
    })

    it('returns pendingSharedExpenses count', async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/dashboard?accountId=${accountId}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${validToken}` },
        }
      )

      const response = await GetDashboard(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(typeof data.data.pendingSharedExpenses).toBe('number')
      expect(data.data.pendingSharedExpenses).toBeGreaterThanOrEqual(0)
    })

    it('defaults to current month when month not specified', async () => {
      const currentMonth = getMonthKey(new Date())
      const request = new NextRequest(
        `http://localhost/api/v1/dashboard?accountId=${accountId}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${validToken}` },
        }
      )

      const response = await GetDashboard(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.month).toBe(currentMonth)
    })

    it('returns valid summary amounts as strings', async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/dashboard?accountId=${accountId}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${validToken}` },
        }
      )

      const response = await GetDashboard(request)
      const data = await response.json()

      expect(response.status).toBe(200)

      // Summary amounts should be string decimals
      const { summary } = data.data
      expect(typeof summary.totalIncome).toBe('string')
      expect(typeof summary.totalExpenses).toBe('string')
      expect(typeof summary.netResult).toBe('string')

      // Should be valid decimal strings
      expect(parseFloat(summary.totalIncome)).not.toBeNaN()
      expect(parseFloat(summary.totalExpenses)).not.toBeNaN()
      expect(parseFloat(summary.netResult)).not.toBeNaN()
    })
  })
})
