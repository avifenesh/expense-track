import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/v1/expenses/shared-by-me/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import { getApiTestUser, getOtherTestUser, TEST_USER_ID, OTHER_USER_ID } from './helpers'
import { SplitType, PaymentStatus, TransactionType } from '@prisma/client'

describe('GET /api/v1/expenses/shared-by-me', () => {
  let validToken: string
  let otherToken: string
  let accountId: string
  let categoryId: string

  // Track created resources for cleanup
  const createdTransactionIds: string[] = []
  const createdSharedExpenseIds: string[] = []

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing!'
    resetEnvCache()
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')
    otherToken = generateAccessToken(OTHER_USER_ID, 'api-other@example.com')

    // Get test users (ensure they exist)
    const testUser = await getApiTestUser()
    await getOtherTestUser()

    // Create test account
    const account = await prisma.account.upsert({
      where: { userId_name: { userId: testUser.id, name: 'SharedByMeTestAccount' } },
      update: {},
      create: { userId: testUser.id, name: 'SharedByMeTestAccount', type: 'SELF' },
    })
    accountId = account.id

    // Create test category
    const category = await prisma.category.upsert({
      where: { userId_name_type: { userId: testUser.id, name: 'SharedByMeTestCategory', type: TransactionType.EXPENSE } },
      update: {},
      create: { userId: testUser.id, name: 'SharedByMeTestCategory', type: TransactionType.EXPENSE },
    })
    categoryId = category.id
  })

  afterEach(async () => {
    // Clean up test data in reverse order of creation
    for (const id of createdSharedExpenseIds) {
      await prisma.expenseParticipant.deleteMany({ where: { sharedExpenseId: id } })
      await prisma.sharedExpense.deleteMany({ where: { id } })
    }
    for (const id of createdTransactionIds) {
      await prisma.transaction.deleteMany({ where: { id } })
    }
    await prisma.category.deleteMany({ where: { name: 'SharedByMeTestCategory' } })
    await prisma.account.deleteMany({ where: { name: 'SharedByMeTestAccount' } })

    // Reset arrays
    createdTransactionIds.length = 0
    createdSharedExpenseIds.length = 0
  })

  /**
   * Helper to create test shared expense data.
   *
   * Note: This uses a single account (testUser's) for all transactions regardless of
   * the shared expense owner. While this creates unrealistic data (a user "owning" a
   * shared expense linked to another user's transaction), it's acceptable for these
   * tests because:
   * 1. The endpoint filters by SharedExpense.ownerId, not transaction ownership
   * 2. This simplifies test setup without affecting the behavior being tested
   * 3. Real-world shared expenses would have proper account ownership
   */
  async function createTestSharedExpense(options: {
    ownerId: string
    participantId: string
    status?: PaymentStatus
    description?: string
  }) {
    // Create transaction (using testUser's account for simplicity)
    const transaction = await prisma.transaction.create({
      data: {
        accountId,
        categoryId,
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: 'USD',
        date: new Date(),
        month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        description: options.description || 'SharedByMeTestTransaction',
      },
    })
    createdTransactionIds.push(transaction.id)

    // Create shared expense
    const sharedExpense = await prisma.sharedExpense.create({
      data: {
        transactionId: transaction.id,
        ownerId: options.ownerId,
        splitType: SplitType.EQUAL,
        totalAmount: 100,
        currency: 'USD',
        description: options.description || 'Test shared expense',
        participants: {
          create: {
            userId: options.participantId,
            shareAmount: 50,
            status: options.status || PaymentStatus.PENDING,
            paidAt: options.status === PaymentStatus.PAID ? new Date() : null,
          },
        },
      },
      include: { participants: true },
    })
    createdSharedExpenseIds.push(sharedExpense.id)

    return sharedExpense
  }

  describe('Authentication', () => {
    it('returns 401 with missing token', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me', {
        method: 'GET',
      })

      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('returns 401 with invalid token', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me', {
        method: 'GET',
        headers: { Authorization: 'Bearer invalid-token' },
      })

      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('returns 200 with valid JWT', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.expenses).toBeDefined()
      expect(data.data.total).toBeDefined()
      expect(data.data.hasMore).toBeDefined()
    })
  })

  describe('Response format', () => {
    it('returns shared expenses owned by the user', async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      const sharedExpense = await createTestSharedExpense({
        ownerId: testUser.id,
        participantId: otherUser.id,
        description: 'Test expense for response format',
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.expenses.length).toBeGreaterThanOrEqual(1)

      const expense = data.data.expenses.find((e: { id: string }) => e.id === sharedExpense.id)
      expect(expense).toBeDefined()
      expect(expense.totalAmount).toBe('100')
      expect(expense.currency).toBe('USD')
      expect(expense.splitType).toBe('EQUAL')
      expect(expense.participants.length).toBe(1)
      expect(expense.participants[0].shareAmount).toBe('50')
      expect(expense.participants[0].status).toBe('PENDING')
      expect(expense.allSettled).toBe(false)
    })

    it('does not return expenses shared by others', async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      // Create expense where other user is owner
      await createTestSharedExpense({
        ownerId: otherUser.id,
        participantId: testUser.id,
        description: 'Other user expense',
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // Should not include expenses owned by other user
      const otherExpense = data.data.expenses.find(
        (e: { description: string }) => e.description === 'Other user expense'
      )
      expect(otherExpense).toBeUndefined()
    })
  })

  describe('Status filtering', () => {
    it('returns all expenses when status is not specified', async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      // Create pending expense
      await createTestSharedExpense({
        ownerId: testUser.id,
        participantId: otherUser.id,
        status: PaymentStatus.PENDING,
        description: 'Pending expense',
      })

      // Create settled expense
      await createTestSharedExpense({
        ownerId: testUser.id,
        participantId: otherUser.id,
        status: PaymentStatus.PAID,
        description: 'Settled expense',
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const pendingExpense = data.data.expenses.find((e: { description: string }) => e.description === 'Pending expense')
      const settledExpense = data.data.expenses.find((e: { description: string }) => e.description === 'Settled expense')
      expect(pendingExpense).toBeDefined()
      expect(settledExpense).toBeDefined()
    })

    it('filters by status=pending', async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      await createTestSharedExpense({
        ownerId: testUser.id,
        participantId: otherUser.id,
        status: PaymentStatus.PENDING,
        description: 'Pending only',
      })

      await createTestSharedExpense({
        ownerId: testUser.id,
        participantId: otherUser.id,
        status: PaymentStatus.PAID,
        description: 'Settled only',
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me?status=pending', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const pendingExpense = data.data.expenses.find((e: { description: string }) => e.description === 'Pending only')
      const settledExpense = data.data.expenses.find((e: { description: string }) => e.description === 'Settled only')
      expect(pendingExpense).toBeDefined()
      expect(settledExpense).toBeUndefined()
    })

    it('filters by status=settled', async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      await createTestSharedExpense({
        ownerId: testUser.id,
        participantId: otherUser.id,
        status: PaymentStatus.PENDING,
        description: 'Pending filter test',
      })

      await createTestSharedExpense({
        ownerId: testUser.id,
        participantId: otherUser.id,
        status: PaymentStatus.PAID,
        description: 'Settled filter test',
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me?status=settled', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const pendingExpense = data.data.expenses.find((e: { description: string }) => e.description === 'Pending filter test')
      const settledExpense = data.data.expenses.find((e: { description: string }) => e.description === 'Settled filter test')
      expect(pendingExpense).toBeUndefined()
      expect(settledExpense).toBeDefined()
    })

    it('returns all when status=all', async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      await createTestSharedExpense({
        ownerId: testUser.id,
        participantId: otherUser.id,
        status: PaymentStatus.PENDING,
        description: 'All test pending',
      })

      await createTestSharedExpense({
        ownerId: testUser.id,
        participantId: otherUser.id,
        status: PaymentStatus.PAID,
        description: 'All test settled',
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me?status=all', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.expenses.find((e: { description: string }) => e.description === 'All test pending')).toBeDefined()
      expect(data.data.expenses.find((e: { description: string }) => e.description === 'All test settled')).toBeDefined()
    })

    it('returns 400 for invalid status value', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me?status=invalid', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.fields.status).toBeDefined()
    })
  })

  describe('Pagination', () => {
    it('respects limit parameter', async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      // Create 3 expenses
      for (let i = 0; i < 3; i++) {
        await createTestSharedExpense({
          ownerId: testUser.id,
          participantId: otherUser.id,
          description: `Limit test ${i}`,
        })
      }

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me?limit=2', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.expenses.length).toBe(2)
      expect(data.data.hasMore).toBe(true)
      expect(data.data.total).toBeGreaterThanOrEqual(3)
    })

    it('respects offset parameter', async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      // Create 3 expenses
      for (let i = 0; i < 3; i++) {
        await createTestSharedExpense({
          ownerId: testUser.id,
          participantId: otherUser.id,
          description: `Offset test ${i}`,
        })
      }

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me?offset=1&limit=10', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // Should return 2 items (skipping first)
      const offsetExpenses = data.data.expenses.filter(
        (e: { description: string }) => e.description.startsWith('Offset test')
      )
      expect(offsetExpenses.length).toBe(2)
    })

    it('returns hasMore=false when no more items', async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      await createTestSharedExpense({
        ownerId: testUser.id,
        participantId: otherUser.id,
        description: 'Single expense',
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me?limit=50', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.hasMore).toBe(false)
    })

    it('returns 400 for invalid limit value', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me?limit=-1', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.fields.limit).toBeDefined()
    })

    it('returns 400 for non-numeric limit', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me?limit=abc', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.fields.limit).toBeDefined()
    })

    it('returns 400 for invalid offset value', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me?offset=-1', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.fields.offset).toBeDefined()
    })

    it('caps limit at maximum value', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me?limit=200', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      await response.json() // Ensure response is valid JSON

      // Should not error - just cap at max
      expect(response.status).toBe(200)
    })
  })

  describe('Empty results', () => {
    it('returns empty array when user has no shared expenses', async () => {
      // Use other token - they have no shared expenses owned by them
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-by-me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${otherToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.expenses).toEqual([])
      expect(data.data.total).toBe(0)
      expect(data.data.hasMore).toBe(false)
    })
  })
})
