import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as ShareExpense } from '@/app/api/v1/expenses/share/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import { getApiTestUser, getOtherTestUser, TEST_USER_ID, OTHER_USER_ID } from './helpers'
import { SplitType, PaymentStatus, TransactionType, SubscriptionStatus } from '@prisma/client'

describe('POST /api/v1/expenses/share', () => {
  let validToken: string
  let otherToken: string
  let testUser: Awaited<ReturnType<typeof getApiTestUser>>
  let otherUser: Awaited<ReturnType<typeof getOtherTestUser>>
  let accountId: string
  let categoryId: string
  let transactionId: string

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing!'
    resetEnvCache()
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')
    otherToken = generateAccessToken(OTHER_USER_ID, 'api-other@example.com')

    // Get test users
    testUser = await getApiTestUser()
    otherUser = await getOtherTestUser()

    // Create test account
    const account = await prisma.account.upsert({
      where: { userId_name: { userId: testUser.id, name: 'ShareExpenseTestAccount' } },
      update: {},
      create: { userId: testUser.id, name: 'ShareExpenseTestAccount', type: 'SELF' },
    })
    accountId = account.id

    // Create test category
    const category = await prisma.category.upsert({
      where: { userId_name_type: { userId: testUser.id, name: 'ShareExpenseTestCategory', type: TransactionType.EXPENSE } },
      update: {},
      create: { userId: testUser.id, name: 'ShareExpenseTestCategory', type: TransactionType.EXPENSE },
    })
    categoryId = category.id

    // Create test transaction
    const transaction = await prisma.transaction.create({
      data: {
        accountId,
        categoryId,
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: 'USD',
        date: new Date(),
        month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        description: 'ShareExpenseTestTransaction',
      },
    })
    transactionId = transaction.id
  })

  afterEach(async () => {
    // Clean up test data in correct order (respecting foreign keys)
    await prisma.expenseParticipant.deleteMany({
      where: { sharedExpense: { transaction: { description: 'ShareExpenseTestTransaction' } } },
    })
    await prisma.sharedExpense.deleteMany({
      where: { transaction: { description: 'ShareExpenseTestTransaction' } },
    })
    await prisma.transaction.deleteMany({
      where: { description: 'ShareExpenseTestTransaction' },
    })
    await prisma.category.deleteMany({
      where: { name: 'ShareExpenseTestCategory' },
    })
    await prisma.account.deleteMany({
      where: { name: 'ShareExpenseTestAccount' },
    })
  })

  describe('authentication', () => {
    it('returns 401 with missing Authorization header', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId,
          splitType: 'EQUAL',
          participants: [{ email: otherUser.email }],
        }),
      })

      const response = await ShareExpense(request)
      expect(response.status).toBe(401)
    })

    it('returns 401 with invalid token', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer invalid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'EQUAL',
          participants: [{ email: otherUser.email }],
        }),
      })

      const response = await ShareExpense(request)
      expect(response.status).toBe(401)
    })

    it('returns 401 with malformed Authorization header', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: 'InvalidFormat token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'EQUAL',
          participants: [{ email: otherUser.email }],
        }),
      })

      const response = await ShareExpense(request)
      expect(response.status).toBe(401)
    })
  })

  describe('validation', () => {
    it('returns 400 with invalid JSON body', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.fields.body).toContain('Invalid JSON')
    })

    it('returns 400 with missing transactionId', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          splitType: 'EQUAL',
          participants: [{ email: otherUser.email }],
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
    })

    it('returns 400 with empty participants array', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'EQUAL',
          participants: [],
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.fields.participants).toBeDefined()
    })

    it('returns 400 with invalid email format', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'EQUAL',
          participants: [{ email: 'invalid-email' }],
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
    })

    it('returns 400 when trying to share with yourself', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'EQUAL',
          participants: [{ email: testUser.email }],
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.fields.participants).toContain('Expenses can only be shared with others')
    })

    it('returns 400 when participant email not found', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'EQUAL',
          participants: [{ email: 'nonexistent@example.com' }],
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.fields.participants[0]).toContain('Users not found')
      expect(data.fields.participants[0]).toContain('nonexistent@example.com')
    })

    it('returns 400 when description exceeds 240 characters', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'EQUAL',
          participants: [{ email: otherUser.email }],
          description: 'a'.repeat(241),
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
    })
  })

  describe('authorization', () => {
    it('returns 404 when transaction does not exist', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId: 'nonexistent-transaction-id',
          splitType: 'EQUAL',
          participants: [{ email: otherUser.email }],
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('Transaction not found')
    })

    it('returns 403 when user does not own the transaction', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${otherToken}`, // Other user trying to share test user's transaction
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'EQUAL',
          participants: [{ email: testUser.email }],
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('do not have access')
    })

    it('returns 409 when transaction is already shared', async () => {
      // First, create a shared expense for this transaction
      await prisma.sharedExpense.create({
        data: {
          transactionId,
          ownerId: testUser.id,
          splitType: SplitType.EQUAL,
          totalAmount: 100,
          currency: 'USD',
          description: 'Already shared',
          participants: {
            create: {
              userId: otherUser.id,
              shareAmount: 50,
              status: PaymentStatus.PENDING,
            },
          },
        },
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'EQUAL',
          participants: [{ email: otherUser.email }],
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toContain('already shared')
    })
  })

  describe('EQUAL split type', () => {
    it('creates shared expense with equal split', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'EQUAL',
          participants: [{ email: otherUser.email }],
          description: 'Dinner',
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.id).toBeDefined()
      expect(data.data.transactionId).toBe(transactionId)
      expect(data.data.splitType).toBe('EQUAL')
      expect(data.data.totalAmount).toBe('100.00')
      expect(data.data.currency).toBe('USD')
      expect(data.data.description).toBe('Dinner')
      expect(data.data.participants).toHaveLength(1)
      expect(data.data.participants[0].email).toBe(otherUser.email)
      expect(data.data.participants[0].shareAmount).toBe('50.00') // 100 / 2 = 50
      expect(data.data.participants[0].status).toBe('PENDING')
    })

    it('correctly calculates equal split with multiple participants', async () => {
      // Create a third user
      const thirdUser = await prisma.user.upsert({
        where: { id: 'api-third-user' },
        update: {},
        create: {
          id: 'api-third-user',
          email: 'api-third@example.com',
          displayName: 'API Third User',
          passwordHash: '$2b$10$placeholder',
          preferredCurrency: 'USD',
        },
      })

      // Ensure third user has active subscription
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 14)
      await prisma.subscription.upsert({
        where: { userId: thirdUser.id },
        update: { status: SubscriptionStatus.TRIALING, trialEndsAt },
        create: {
          userId: thirdUser.id,
          status: SubscriptionStatus.TRIALING,
          trialEndsAt,
        },
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'EQUAL',
          participants: [
            { email: otherUser.email },
            { email: thirdUser.email },
          ],
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.participants).toHaveLength(2)
      // 100 / 3 participants (including owner) = 33.33 each
      expect(data.data.participants[0].shareAmount).toBe('33.33')
      expect(data.data.participants[1].shareAmount).toBe('33.33')

      // Cleanup third user
      await prisma.subscription.delete({ where: { userId: thirdUser.id } }).catch(() => {})
      await prisma.user.delete({ where: { id: thirdUser.id } }).catch(() => {})
    })
  })

  describe('PERCENTAGE split type', () => {
    it('creates shared expense with percentage split', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'PERCENTAGE',
          participants: [{ email: otherUser.email, sharePercentage: 30 }],
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.splitType).toBe('PERCENTAGE')
      expect(data.data.participants[0].shareAmount).toBe('30.00') // 100 * 30% = 30
      expect(data.data.participants[0].sharePercentage).toBe('30.00')
    })

    it('returns 400 when PERCENTAGE split participant missing sharePercentage', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'PERCENTAGE',
          participants: [{ email: otherUser.email }], // Missing sharePercentage
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.fields.participants[0]).toContain('sharePercentage')
    })

    it('returns 400 when total percentage exceeds 100', async () => {
      // Create a third user
      const thirdUser = await prisma.user.upsert({
        where: { id: 'api-third-user' },
        update: {},
        create: {
          id: 'api-third-user',
          email: 'api-third@example.com',
          displayName: 'API Third User',
          passwordHash: '$2b$10$placeholder',
          preferredCurrency: 'USD',
        },
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'PERCENTAGE',
          participants: [
            { email: otherUser.email, sharePercentage: 60 },
            { email: thirdUser.email, sharePercentage: 50 }, // 60 + 50 = 110% > 100%
          ],
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.fields.participants[0]).toContain('percentage')

      // Cleanup
      await prisma.user.delete({ where: { id: thirdUser.id } }).catch(() => {})
    })
  })

  describe('FIXED split type', () => {
    it('creates shared expense with fixed split', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'FIXED',
          participants: [{ email: otherUser.email, shareAmount: 75 }],
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.splitType).toBe('FIXED')
      expect(data.data.participants[0].shareAmount).toBe('75.00')
      expect(data.data.participants[0].sharePercentage).toBeNull()
    })

    it('returns 400 when fixed amounts exceed transaction total', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'FIXED',
          participants: [{ email: otherUser.email, shareAmount: 150 }], // 150 > 100 transaction total
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.fields.participants[0]).toContain('cannot exceed')
    })

    it('returns 400 when FIXED split participant missing shareAmount', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'FIXED',
          participants: [{ email: otherUser.email }], // No shareAmount
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
    })
  })

  describe('database persistence', () => {
    it('creates SharedExpense record in database', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'EQUAL',
          participants: [{ email: otherUser.email }],
          description: 'Database test',
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      const sharedExpense = await prisma.sharedExpense.findUnique({
        where: { id: data.data.id },
        include: { participants: true },
      })

      expect(sharedExpense).toBeDefined()
      expect(sharedExpense?.transactionId).toBe(transactionId)
      expect(sharedExpense?.ownerId).toBe(testUser.id)
      expect(sharedExpense?.splitType).toBe(SplitType.EQUAL)
      expect(sharedExpense?.description).toBe('Database test')
      expect(sharedExpense?.participants).toHaveLength(1)
    })

    it('creates ExpenseParticipant records with correct status', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'EQUAL',
          participants: [{ email: otherUser.email }],
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      const participant = await prisma.expenseParticipant.findFirst({
        where: { sharedExpenseId: data.data.id },
      })

      expect(participant).toBeDefined()
      expect(participant?.userId).toBe(otherUser.id)
      expect(participant?.status).toBe(PaymentStatus.PENDING)
      expect(participant?.paidAt).toBeNull()
    })
  })

  describe('subscription enforcement', () => {
    it('returns 402 when user has expired subscription', async () => {
      // Expire the test user's subscription
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 7)
      await prisma.subscription.update({
        where: { userId: TEST_USER_ID },
        data: {
          status: SubscriptionStatus.EXPIRED,
          trialEndsAt: expiredDate,
        },
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'EQUAL',
          participants: [{ email: otherUser.email }],
        }),
      })

      const response = await ShareExpense(request)

      expect(response.status).toBe(402)

      // Restore subscription for other tests
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 14)
      await prisma.subscription.update({
        where: { userId: TEST_USER_ID },
        data: {
          status: SubscriptionStatus.TRIALING,
          trialEndsAt,
        },
      })
    })
  })

  describe('response format', () => {
    it('returns correct response structure', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'EQUAL',
          participants: [{ email: otherUser.email }],
          description: 'Response format test',
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          transactionId: expect.any(String),
          splitType: 'EQUAL',
          totalAmount: expect.any(String),
          currency: 'USD',
          description: 'Response format test',
          createdAt: expect.any(String),
          participants: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              userId: expect.any(String),
              email: expect.any(String),
              displayName: expect.any(String),
              shareAmount: expect.any(String),
              status: 'PENDING',
            }),
          ]),
        },
      })

      // Verify ISO date format
      expect(new Date(data.data.createdAt).toISOString()).toBe(data.data.createdAt)
    })

    it('returns amounts as strings (decimal precision)', async () => {
      // Create a transaction with a more complex amount
      const complexTransaction = await prisma.transaction.create({
        data: {
          accountId,
          categoryId,
          type: TransactionType.EXPENSE,
          amount: 99.99,
          currency: 'USD',
          date: new Date(),
          month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          description: 'ShareExpenseTestTransaction',
        },
      })

      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId: complexTransaction.id,
          splitType: 'EQUAL',
          participants: [{ email: otherUser.email }],
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      // Amounts should be strings, not numbers
      expect(typeof data.data.totalAmount).toBe('string')
      expect(typeof data.data.participants[0].shareAmount).toBe('string')
    })
  })

  describe('case-insensitive email handling', () => {
    it('handles mixed-case participant emails', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          splitType: 'EQUAL',
          participants: [{ email: otherUser.email.toUpperCase() }], // Uppercase email
        }),
      })

      const response = await ShareExpense(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.participants[0].email).toBe(otherUser.email) // Should normalize
    })
  })
})
