import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as CreateTransaction } from '@/app/api/v1/transactions/route'
import { POST as CreateTransactionRequest } from '@/app/api/v1/transactions/requests/route'
import { POST as ApproveTransactionRequest } from '@/app/api/v1/transactions/requests/[id]/approve/route'
import { POST as RejectTransactionRequest } from '@/app/api/v1/transactions/requests/[id]/reject/route'
import { PATCH as MarkSharePaid } from '@/app/api/v1/expenses/shares/participants/[participantId]/paid/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import { getApiTestUser, getOtherTestUser, TEST_USER_ID, OTHER_USER_ID } from './helpers'
import { SubscriptionStatus, RequestStatus, SplitType, PaymentStatus, TransactionType } from '@prisma/client'

/**
 * Subscription Enforcement Tests
 *
 * Tests that mutating API endpoints (POST, PATCH, DELETE) properly enforce
 * subscription requirements with 402 Payment Required responses.
 *
 * Key behaviors:
 * - GET endpoints allow access regardless of subscription (users can view data)
 * - Mutating endpoints require active subscription
 * - Returns 402 with code 'SUBSCRIPTION_REQUIRED' when subscription is inactive
 * - TRIALING, ACTIVE, PAST_DUE, and CANCELED (with period) allow access
 * - EXPIRED status blocks access
 */
describe('Subscription Enforcement on API Routes', () => {
  let validToken: string
  let accountId: string
  let categoryId: string

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing!'
    resetEnvCache()
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')

    // Get test user for userId foreign keys
    const testUser = await getApiTestUser()

    // Upsert test account
    const account = await prisma.account.upsert({
      where: { userId_name: { userId: testUser.id, name: 'SubscriptionTestAccount' } },
      update: {},
      create: { userId: testUser.id, name: 'SubscriptionTestAccount', type: 'SELF' },
    })

    // Upsert test category
    const category = await prisma.category.upsert({
      where: { userId_name_type: { userId: testUser.id, name: 'SUB_TestCategory', type: 'EXPENSE' } },
      update: {},
      create: { userId: testUser.id, name: 'SUB_TestCategory', type: 'EXPENSE' },
    })

    accountId = account.id
    categoryId = category.id
  })

  afterEach(async () => {
    // Reset subscription to valid state for other tests
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)
    await prisma.subscription.upsert({
      where: { userId: TEST_USER_ID },
      update: { status: SubscriptionStatus.TRIALING, trialEndsAt },
      create: {
        userId: TEST_USER_ID,
        status: SubscriptionStatus.TRIALING,
        trialEndsAt,
      },
    })

    // Cleanup test data
    await prisma.transaction.deleteMany({
      where: { description: { contains: 'SUB_TEST_' } },
    })
    await prisma.category.deleteMany({
      where: { name: 'SUB_TestCategory' },
    })
    await prisma.account.deleteMany({
      where: { name: 'SubscriptionTestAccount' },
    })
  })

  describe('returns 402 Payment Required for expired subscription', () => {
    beforeEach(async () => {
      // Set subscription to EXPIRED
      await prisma.subscription.update({
        where: { userId: TEST_USER_ID },
        data: { status: SubscriptionStatus.EXPIRED },
      })
    })

    it('POST /api/v1/transactions returns 402 with expired subscription', async () => {
      const request = new NextRequest('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 50.0,
          currency: 'USD',
          date: '2024-01-15',
          description: 'SUB_TEST_Blocked transaction',
        }),
      })

      const response = await CreateTransaction(request)
      const data = await response.json()

      expect(response.status).toBe(402)
      expect(data.error).toBe('Active subscription required')
      expect(data.code).toBe('SUBSCRIPTION_REQUIRED')
    })

    it('POST /api/v1/transactions/requests returns 402 with expired subscription', async () => {
      // Create a target account for the request
      const otherAccount = await prisma.account.create({
        data: {
          userId: TEST_USER_ID,
          name: 'SubscriptionTestTargetAccount',
          type: 'SELF',
        },
      })

      try {
        const request = new NextRequest('http://localhost/api/v1/transactions/requests', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            toId: otherAccount.id,
            categoryId,
            amount: 25.0,
            currency: 'USD',
            date: '2024-01-15',
            description: 'SUB_TEST_Blocked request',
          }),
        })

        const response = await CreateTransactionRequest(request)
        const data = await response.json()

        expect(response.status).toBe(402)
        expect(data.code).toBe('SUBSCRIPTION_REQUIRED')
      } finally {
        await prisma.account.delete({ where: { id: otherAccount.id } })
      }
    })
  })

  describe('allows access with valid subscription states', () => {
    it('allows access with TRIALING subscription', async () => {
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 7)
      await prisma.subscription.update({
        where: { userId: TEST_USER_ID },
        data: { status: SubscriptionStatus.TRIALING, trialEndsAt },
      })

      const request = new NextRequest('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 50.0,
          currency: 'USD',
          date: '2024-01-15',
          description: 'SUB_TEST_Trialing transaction',
        }),
      })

      const response = await CreateTransaction(request)
      expect(response.status).toBe(201)
    })

    it('allows access with ACTIVE subscription', async () => {
      const periodEnd = new Date()
      periodEnd.setDate(periodEnd.getDate() + 30)
      await prisma.subscription.update({
        where: { userId: TEST_USER_ID },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: periodEnd,
        },
      })

      const request = new NextRequest('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 50.0,
          currency: 'USD',
          date: '2024-01-15',
          description: 'SUB_TEST_Active transaction',
        }),
      })

      const response = await CreateTransaction(request)
      expect(response.status).toBe(201)
    })

    it('allows access with PAST_DUE subscription (grace period)', async () => {
      await prisma.subscription.update({
        where: { userId: TEST_USER_ID },
        data: { status: SubscriptionStatus.PAST_DUE },
      })

      const request = new NextRequest('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 50.0,
          currency: 'USD',
          date: '2024-01-15',
          description: 'SUB_TEST_PastDue transaction',
        }),
      })

      const response = await CreateTransaction(request)
      expect(response.status).toBe(201)
    })

    it('allows access with CANCELED subscription (within period)', async () => {
      const periodEnd = new Date()
      periodEnd.setDate(periodEnd.getDate() + 15)
      await prisma.subscription.update({
        where: { userId: TEST_USER_ID },
        data: {
          status: SubscriptionStatus.CANCELED,
          currentPeriodEnd: periodEnd,
          canceledAt: new Date(),
        },
      })

      const request = new NextRequest('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 50.0,
          currency: 'USD',
          date: '2024-01-15',
          description: 'SUB_TEST_Canceled transaction',
        }),
      })

      const response = await CreateTransaction(request)
      expect(response.status).toBe(201)
    })
  })

  describe('blocks access with CANCELED subscription (period ended)', () => {
    it('returns 402 when CANCELED and period has ended', async () => {
      const periodEnd = new Date()
      periodEnd.setDate(periodEnd.getDate() - 5) // 5 days ago
      await prisma.subscription.update({
        where: { userId: TEST_USER_ID },
        data: {
          status: SubscriptionStatus.CANCELED,
          currentPeriodEnd: periodEnd,
          canceledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        },
      })

      const request = new NextRequest('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 50.0,
          currency: 'USD',
          date: '2024-01-15',
          description: 'SUB_TEST_Expired canceled transaction',
        }),
      })

      const response = await CreateTransaction(request)
      const data = await response.json()

      expect(response.status).toBe(402)
      expect(data.code).toBe('SUBSCRIPTION_REQUIRED')
    })
  })

  describe('blocks access with expired TRIALING subscription', () => {
    it('returns 402 when trial has ended', async () => {
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() - 1) // Yesterday
      await prisma.subscription.update({
        where: { userId: TEST_USER_ID },
        data: {
          status: SubscriptionStatus.TRIALING,
          trialEndsAt,
        },
      })

      const request = new NextRequest('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 50.0,
          currency: 'USD',
          date: '2024-01-15',
          description: 'SUB_TEST_Expired trial transaction',
        }),
      })

      const response = await CreateTransaction(request)
      const data = await response.json()

      expect(response.status).toBe(402)
      expect(data.code).toBe('SUBSCRIPTION_REQUIRED')
    })
  })

  describe('blocks access with no subscription record', () => {
    it('returns 402 when no subscription exists', async () => {
      // Delete subscription entirely
      await prisma.subscription.delete({
        where: { userId: TEST_USER_ID },
      })

      const request = new NextRequest('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 50.0,
          currency: 'USD',
          date: '2024-01-15',
          description: 'SUB_TEST_No subscription transaction',
        }),
      })

      const response = await CreateTransaction(request)
      const data = await response.json()

      expect(response.status).toBe(402)
      expect(data.code).toBe('SUBSCRIPTION_REQUIRED')
    })
  })

  describe('subscription enforcement on approve/reject endpoints', () => {
    let otherUserToken: string
    let otherAccountId: string
    let transactionRequestId: string

    beforeEach(async () => {
      // Setup other user who will receive the transaction request
      const otherUser = await getOtherTestUser()
      otherUserToken = generateAccessToken(OTHER_USER_ID, 'api-other@example.com')

      // Create account for other user
      const otherAccount = await prisma.account.upsert({
        where: { userId_name: { userId: otherUser.id, name: 'OtherSubTestAccount' } },
        update: {},
        create: { userId: otherUser.id, name: 'OtherSubTestAccount', type: 'SELF' },
      })
      otherAccountId = otherAccount.id

      // Create a transaction request from test user to other user
      const txRequest = await prisma.transactionRequest.create({
        data: {
          fromId: accountId,
          toId: otherAccountId,
          categoryId,
          amount: 50.0,
          currency: 'USD',
          date: new Date('2024-01-15'),
          description: 'SUB_TEST_Request',
          status: RequestStatus.PENDING,
        },
      })
      transactionRequestId = txRequest.id
    })

    afterEach(async () => {
      // Reset other user's subscription to valid state for other tests
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 14)
      await prisma.subscription.upsert({
        where: { userId: OTHER_USER_ID },
        update: { status: SubscriptionStatus.TRIALING, trialEndsAt },
        create: { userId: OTHER_USER_ID, status: SubscriptionStatus.TRIALING, trialEndsAt },
      })

      // Cleanup transaction requests
      await prisma.transactionRequest.deleteMany({
        where: { description: { contains: 'SUB_TEST_' } },
      })
      await prisma.account.deleteMany({
        where: { name: 'OtherSubTestAccount' },
      })
    })

    it('POST /api/v1/transactions/requests/[id]/approve returns 402 with expired subscription', async () => {
      // Set other user's subscription to EXPIRED (they're the one approving)
      await prisma.subscription.update({
        where: { userId: OTHER_USER_ID },
        data: { status: SubscriptionStatus.EXPIRED },
      })

      const request = new NextRequest(`http://localhost/api/v1/transactions/requests/${transactionRequestId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${otherUserToken}`,
          'Content-Type': 'application/json',
        },
      })

      const response = await ApproveTransactionRequest(request, { params: Promise.resolve({ id: transactionRequestId }) })
      const data = await response.json()

      expect(response.status).toBe(402)
      expect(data.code).toBe('SUBSCRIPTION_REQUIRED')
    })

    it('POST /api/v1/transactions/requests/[id]/reject returns 402 with expired subscription', async () => {
      // Set other user's subscription to EXPIRED (they're the one rejecting)
      await prisma.subscription.update({
        where: { userId: OTHER_USER_ID },
        data: { status: SubscriptionStatus.EXPIRED },
      })

      const request = new NextRequest(`http://localhost/api/v1/transactions/requests/${transactionRequestId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${otherUserToken}`,
          'Content-Type': 'application/json',
        },
      })

      const response = await RejectTransactionRequest(request, { params: Promise.resolve({ id: transactionRequestId }) })
      const data = await response.json()

      expect(response.status).toBe(402)
      expect(data.code).toBe('SUBSCRIPTION_REQUIRED')
    })

    it('approve endpoint allows access with valid subscription', async () => {
      // Ensure other user has valid subscription
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 14)
      await prisma.subscription.upsert({
        where: { userId: OTHER_USER_ID },
        update: { status: SubscriptionStatus.TRIALING, trialEndsAt },
        create: { userId: OTHER_USER_ID, status: SubscriptionStatus.TRIALING, trialEndsAt },
      })

      const request = new NextRequest(`http://localhost/api/v1/transactions/requests/${transactionRequestId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${otherUserToken}`,
          'Content-Type': 'application/json',
        },
      })

      const response = await ApproveTransactionRequest(request, { params: Promise.resolve({ id: transactionRequestId }) })

      // Should succeed (200) or fail for other reasons (not 402)
      expect(response.status).not.toBe(402)
    })
  })

  describe('subscription enforcement on expense share endpoints', () => {
    let participantId: string
    let transactionId: string

    beforeEach(async () => {
      const testUser = await getApiTestUser()
      const otherUser = await getOtherTestUser()

      const transaction = await prisma.transaction.create({
        data: {
          accountId,
          categoryId,
          type: TransactionType.EXPENSE,
          amount: 100,
          currency: 'USD',
          date: new Date(),
          month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          description: 'SUB_TEST_ShareTransaction',
        },
      })
      transactionId = transaction.id

      const sharedExpense = await prisma.sharedExpense.create({
        data: {
          transactionId,
          ownerId: testUser.id,
          splitType: SplitType.EQUAL,
          totalAmount: 100,
          currency: 'USD',
          description: 'SUB_TEST_SharedExpense',
          participants: {
            create: {
              userId: otherUser.id,
              shareAmount: 50,
              status: PaymentStatus.PENDING,
            },
          },
        },
        include: { participants: true },
      })
      participantId = sharedExpense.participants[0].id
    })

    afterEach(async () => {
      await prisma.expenseParticipant.deleteMany({
        where: { sharedExpense: { description: 'SUB_TEST_SharedExpense' } },
      })
      await prisma.sharedExpense.deleteMany({
        where: { description: 'SUB_TEST_SharedExpense' },
      })
      await prisma.transaction.deleteMany({
        where: { description: 'SUB_TEST_ShareTransaction' },
      })
    })

    it('PATCH /api/v1/expenses/shares/[participantId]/paid returns 402 with expired subscription', async () => {
      await prisma.subscription.update({
        where: { userId: TEST_USER_ID },
        data: { status: SubscriptionStatus.EXPIRED },
      })

      const request = new NextRequest(
        `http://localhost/api/v1/expenses/shares/${participantId}/paid`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${validToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      )

      const response = await MarkSharePaid(request, {
        params: Promise.resolve({ participantId }),
      })
      const data = await response.json()

      expect(response.status).toBe(402)
      expect(data.code).toBe('SUBSCRIPTION_REQUIRED')
    })

    it('PATCH /api/v1/expenses/shares/[participantId]/paid allows access with valid subscription', async () => {
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 14)
      await prisma.subscription.upsert({
        where: { userId: TEST_USER_ID },
        update: { status: SubscriptionStatus.TRIALING, trialEndsAt },
        create: { userId: TEST_USER_ID, status: SubscriptionStatus.TRIALING, trialEndsAt },
      })

      const request = new NextRequest(
        `http://localhost/api/v1/expenses/shares/${participantId}/paid`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${validToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      )

      const response = await MarkSharePaid(request, {
        params: Promise.resolve({ participantId }),
      })

      expect(response.status).toBe(200)
    })
  })
})
