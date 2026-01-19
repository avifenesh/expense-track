import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/v1/expenses/shared-with-me/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import { getApiTestUser, getOtherTestUser, TEST_USER_ID, OTHER_USER_ID } from './helpers'
import { SplitType, PaymentStatus, TransactionType } from '@prisma/client'

describe('GET /api/v1/expenses/shared-with-me', () => {
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
    await getApiTestUser()
    const otherUser = await getOtherTestUser()

    // Create test account (owned by other user - they share expenses with test user)
    const account = await prisma.account.upsert({
      where: { userId_name: { userId: otherUser.id, name: 'SharedWithMeTestAccount' } },
      update: {},
      create: { userId: otherUser.id, name: 'SharedWithMeTestAccount', type: 'SELF' },
    })
    accountId = account.id

    // Create test category
    const category = await prisma.category.upsert({
      where: { userId_name_type: { userId: otherUser.id, name: 'SharedWithMeTestCategory', type: TransactionType.EXPENSE } },
      update: {},
      create: { userId: otherUser.id, name: 'SharedWithMeTestCategory', type: TransactionType.EXPENSE },
    })
    categoryId = category.id
  })

  afterEach(async () => {
    // Clean up test data using cascade deletes for efficiency.
    // Deleting transactions will cascade to SharedExpense and ExpenseParticipant.
    if (createdTransactionIds.length > 0) {
      await prisma.transaction.deleteMany({
        where: { id: { in: createdTransactionIds } },
      })
    }
    // These are upserted, so we clean them up to ensure test isolation.
    await prisma.category.deleteMany({ where: { name: 'SharedWithMeTestCategory' } })
    await prisma.account.deleteMany({ where: { name: 'SharedWithMeTestAccount' } })

    // Reset tracking arrays
    createdTransactionIds.length = 0
    createdSharedExpenseIds.length = 0
  })

  /**
   * Helper to create test shared expense data where other user shares with test user.
   */
  async function createTestSharedExpense(options: {
    ownerId: string
    participantId: string
    status?: PaymentStatus
    description?: string
  }) {
    // Create transaction (owned by the expense owner)
    const transaction = await prisma.transaction.create({
      data: {
        accountId,
        categoryId,
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: 'USD',
        date: new Date(),
        month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        description: options.description || 'SharedWithMeTestTransaction',
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
            declinedAt: options.status === PaymentStatus.DECLINED ? new Date() : null,
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
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me', {
        method: 'GET',
      })

      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('returns 401 with invalid token', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me', {
        method: 'GET',
        headers: { Authorization: 'Bearer invalid-token' },
      })

      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('returns 200 with valid JWT', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me', {
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
    it('returns expenses shared with the user', async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      const sharedExpense = await createTestSharedExpense({
        ownerId: otherUser.id,
        participantId: testUser.id,
        description: 'Test expense for response format',
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.expenses.length).toBeGreaterThanOrEqual(1)

      const expense = data.data.expenses.find((e: { sharedExpense: { id: string } }) => e.sharedExpense.id === sharedExpense.id)
      expect(expense).toBeDefined()
      expect(expense.shareAmount).toBe('50')
      expect(expense.status).toBe('PENDING')
      expect(expense.sharedExpense.totalAmount).toBe('100')
      expect(expense.sharedExpense.currency).toBe('USD')
      expect(expense.sharedExpense.splitType).toBe('EQUAL')
      expect(expense.sharedExpense.owner.id).toBe(otherUser.id)
      expect(expense.sharedExpense.owner.displayName).toBe('API Other User')
    })

    it('does not return expenses user owns', async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      // Create expense where test user is owner (not participant)
      await createTestSharedExpense({
        ownerId: testUser.id,
        participantId: otherUser.id,
        description: 'Test user owned expense',
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // Should not include expenses owned by test user
      const ownedExpense = data.data.expenses.find(
        (e: { sharedExpense: { description: string } }) => e.sharedExpense.description === 'Test user owned expense'
      )
      expect(ownedExpense).toBeUndefined()
    })
  })

  describe('Status filtering', () => {
    it('returns all expenses when status is not specified', async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      // Create expenses with different statuses
      await createTestSharedExpense({
        ownerId: otherUser.id,
        participantId: testUser.id,
        status: PaymentStatus.PENDING,
        description: 'Pending expense',
      })

      await createTestSharedExpense({
        ownerId: otherUser.id,
        participantId: testUser.id,
        status: PaymentStatus.PAID,
        description: 'Paid expense',
      })

      await createTestSharedExpense({
        ownerId: otherUser.id,
        participantId: testUser.id,
        status: PaymentStatus.DECLINED,
        description: 'Declined expense',
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const pendingExpense = data.data.expenses.find((e: { sharedExpense: { description: string } }) => e.sharedExpense.description === 'Pending expense')
      const paidExpense = data.data.expenses.find((e: { sharedExpense: { description: string } }) => e.sharedExpense.description === 'Paid expense')
      const declinedExpense = data.data.expenses.find((e: { sharedExpense: { description: string } }) => e.sharedExpense.description === 'Declined expense')
      expect(pendingExpense).toBeDefined()
      expect(paidExpense).toBeDefined()
      expect(declinedExpense).toBeDefined()
    })

    it('filters by status=pending', async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      await createTestSharedExpense({
        ownerId: otherUser.id,
        participantId: testUser.id,
        status: PaymentStatus.PENDING,
        description: 'Pending only',
      })

      await createTestSharedExpense({
        ownerId: otherUser.id,
        participantId: testUser.id,
        status: PaymentStatus.PAID,
        description: 'Paid only',
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me?status=pending', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const pendingExpense = data.data.expenses.find((e: { sharedExpense: { description: string } }) => e.sharedExpense.description === 'Pending only')
      const paidExpense = data.data.expenses.find((e: { sharedExpense: { description: string } }) => e.sharedExpense.description === 'Paid only')
      expect(pendingExpense).toBeDefined()
      expect(paidExpense).toBeUndefined()
    })

    it('filters by status=paid', async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      await createTestSharedExpense({
        ownerId: otherUser.id,
        participantId: testUser.id,
        status: PaymentStatus.PENDING,
        description: 'Pending filter test',
      })

      await createTestSharedExpense({
        ownerId: otherUser.id,
        participantId: testUser.id,
        status: PaymentStatus.PAID,
        description: 'Paid filter test',
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me?status=paid', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const pendingExpense = data.data.expenses.find((e: { sharedExpense: { description: string } }) => e.sharedExpense.description === 'Pending filter test')
      const paidExpense = data.data.expenses.find((e: { sharedExpense: { description: string } }) => e.sharedExpense.description === 'Paid filter test')
      expect(pendingExpense).toBeUndefined()
      expect(paidExpense).toBeDefined()
    })

    it('filters by status=declined', async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      await createTestSharedExpense({
        ownerId: otherUser.id,
        participantId: testUser.id,
        status: PaymentStatus.PENDING,
        description: 'Pending declined test',
      })

      await createTestSharedExpense({
        ownerId: otherUser.id,
        participantId: testUser.id,
        status: PaymentStatus.DECLINED,
        description: 'Declined filter test',
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me?status=declined', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const pendingExpense = data.data.expenses.find((e: { sharedExpense: { description: string } }) => e.sharedExpense.description === 'Pending declined test')
      const declinedExpense = data.data.expenses.find((e: { sharedExpense: { description: string } }) => e.sharedExpense.description === 'Declined filter test')
      expect(pendingExpense).toBeUndefined()
      expect(declinedExpense).toBeDefined()
    })

    it('returns all when status=all', async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      await createTestSharedExpense({
        ownerId: otherUser.id,
        participantId: testUser.id,
        status: PaymentStatus.PENDING,
        description: 'All test pending',
      })

      await createTestSharedExpense({
        ownerId: otherUser.id,
        participantId: testUser.id,
        status: PaymentStatus.PAID,
        description: 'All test paid',
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me?status=all', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.expenses.find((e: { sharedExpense: { description: string } }) => e.sharedExpense.description === 'All test pending')).toBeDefined()
      expect(data.data.expenses.find((e: { sharedExpense: { description: string } }) => e.sharedExpense.description === 'All test paid')).toBeDefined()
    })

    it('returns 400 for invalid status value', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me?status=invalid', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.fields.status).toBeDefined()
    })

    it('returns 400 for status=settled (not valid for shared-with-me)', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me?status=settled', {
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
          ownerId: otherUser.id,
          participantId: testUser.id,
          description: `Limit test ${i}`,
        })
      }

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me?limit=2', {
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
          ownerId: otherUser.id,
          participantId: testUser.id,
          description: `Offset test ${i}`,
        })
      }

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me?offset=1&limit=10', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const offsetExpenses = data.data.expenses.filter(
        (e: { sharedExpense: { description: string } }) => e.sharedExpense.description.startsWith('Offset test')
      )
      expect(offsetExpenses.length).toBe(2)
    })

    it('returns hasMore=false when no more items', async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      await createTestSharedExpense({
        ownerId: otherUser.id,
        participantId: testUser.id,
        description: 'Single expense',
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me?limit=50', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.hasMore).toBe(false)
    })

    it('returns 400 for invalid limit value', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me?limit=-1', {
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
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me?limit=abc', {
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
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me?offset=-1', {
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
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me?limit=200', {
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
      // Use other token - they may have shared expenses they own, but none shared with them
      const request = new NextRequest('http://localhost/api/v1/expenses/shared-with-me', {
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
