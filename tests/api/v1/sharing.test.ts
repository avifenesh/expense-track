import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as GetSharing } from '@/app/api/v1/sharing/route'
import { PATCH as MarkPaid } from '@/app/api/v1/sharing/[participantId]/paid/route'
import { POST as DeclineShare } from '@/app/api/v1/expenses/shares/[participantId]/decline/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import { getApiTestUser, getOtherTestUser, TEST_USER_ID, OTHER_USER_ID } from './helpers'
import { SplitType, PaymentStatus, TransactionType } from '@prisma/client'

describe('Sharing API Routes', () => {
  let validToken: string
  let otherToken: string
  let accountId: string
  let categoryId: string
  let transactionId: string
  let sharedExpenseId: string
  let participantId: string

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing!'
    resetEnvCache()
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')
    otherToken = generateAccessToken(OTHER_USER_ID, 'api-other@example.com')

    // Get test users
    const testUser = await getApiTestUser()
    const otherUser = await getOtherTestUser()

    // Create test account
    const account = await prisma.account.upsert({
      where: { userId_name: { userId: testUser.id, name: 'SharingTestAccount' } },
      update: {},
      create: { userId: testUser.id, name: 'SharingTestAccount', type: 'SELF' },
    })
    accountId = account.id

    // Create test category
    const category = await prisma.category.upsert({
      where: { userId_name_type: { userId: testUser.id, name: 'SharingTestCategory', type: TransactionType.EXPENSE } },
      update: {},
      create: { userId: testUser.id, name: 'SharingTestCategory', type: TransactionType.EXPENSE },
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
        description: 'SharingTestTransaction',
      },
    })
    transactionId = transaction.id

    // Create shared expense owned by testUser, with otherUser as participant
    const sharedExpense = await prisma.sharedExpense.create({
      data: {
        transactionId,
        ownerId: testUser.id,
        splitType: SplitType.EQUAL,
        totalAmount: 100,
        currency: 'USD',
        description: 'Test shared expense',
        participants: {
          create: {
            userId: otherUser.id,
            shareAmount: 50,
            status: PaymentStatus.PENDING,
          },
        },
      },
      include: {
        participants: true,
      },
    })
    sharedExpenseId = sharedExpense.id
    participantId = sharedExpense.participants[0].id
  })

  afterEach(async () => {
    // Clean up test data
    await prisma.expenseParticipant.deleteMany({
      where: { sharedExpense: { description: 'Test shared expense' } },
    })
    await prisma.sharedExpense.deleteMany({
      where: { description: 'Test shared expense' },
    })
    await prisma.transaction.deleteMany({
      where: { description: 'SharingTestTransaction' },
    })
    await prisma.category.deleteMany({
      where: { name: 'SharingTestCategory' },
    })
    await prisma.account.deleteMany({
      where: { name: 'SharingTestAccount' },
    })
  })

  describe('GET /api/v1/sharing', () => {
    it('returns sharing data with valid JWT', async () => {
      const request = new NextRequest('http://localhost/api/v1/sharing', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetSharing(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.sharedExpenses).toBeDefined()
      expect(data.data.expensesSharedWithMe).toBeDefined()
      expect(data.data.settlementBalances).toBeDefined()
    })

    it('returns shared expenses owned by the user', async () => {
      const request = new NextRequest('http://localhost/api/v1/sharing', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetSharing(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.sharedExpenses.length).toBeGreaterThanOrEqual(1)

      const expense = data.data.sharedExpenses.find((e: { id: string }) => e.id === sharedExpenseId)
      expect(expense).toBeDefined()
      expect(expense.totalAmount).toBe('100')
      expect(expense.participants.length).toBe(1)
    })

    it('returns expenses shared with the user', async () => {
      // Request as the other user (who is a participant)
      const request = new NextRequest('http://localhost/api/v1/sharing', {
        method: 'GET',
        headers: { Authorization: `Bearer ${otherToken}` },
      })

      const response = await GetSharing(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.expensesSharedWithMe.length).toBeGreaterThanOrEqual(1)

      const participation = data.data.expensesSharedWithMe.find((p: { sharedExpense: { id: string } }) => p.sharedExpense.id === sharedExpenseId)
      expect(participation).toBeDefined()
      expect(participation.shareAmount).toBe('50')
    })

    it('returns settlement balances', async () => {
      const request = new NextRequest('http://localhost/api/v1/sharing', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetSharing(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // Balance should show other user owes test user
      const balance = data.data.settlementBalances.find((b: { userId: string }) => b.userId === OTHER_USER_ID)
      if (balance) {
        expect(parseFloat(balance.theyOwe)).toBeGreaterThan(0)
      }
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest('http://localhost/api/v1/sharing', {
        method: 'GET',
      })

      const response = await GetSharing(request)
      expect(response.status).toBe(401)
    })

    it('returns 401 with invalid token', async () => {
      const request = new NextRequest('http://localhost/api/v1/sharing', {
        method: 'GET',
        headers: { Authorization: 'Bearer invalid-token' },
      })

      const response = await GetSharing(request)
      expect(response.status).toBe(401)
    })
  })

  describe('PATCH /api/v1/sharing/[participantId]/paid', () => {
    it('marks participant as paid when called by owner', async () => {
      const request = new NextRequest(`http://localhost/api/v1/sharing/${participantId}/paid`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      const response = await MarkPaid(request, { params: Promise.resolve({ participantId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(participantId)
      expect(data.data.status).toBe('PAID')
      expect(data.data.paidAt).toBeTruthy()
    })

    it('returns 403 when called by non-owner', async () => {
      // Other user (participant) tries to mark themselves as paid
      const request = new NextRequest(`http://localhost/api/v1/sharing/${participantId}/paid`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${otherToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      const response = await MarkPaid(request, { params: Promise.resolve({ participantId }) })
      expect(response.status).toBe(403)
    })

    it('returns 404 for non-existent participant', async () => {
      const request = new NextRequest('http://localhost/api/v1/sharing/non-existent-id/paid', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      const response = await MarkPaid(request, { params: Promise.resolve({ participantId: 'non-existent-id' }) })
      expect(response.status).toBe(404)
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest(`http://localhost/api/v1/sharing/${participantId}/paid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const response = await MarkPaid(request, { params: Promise.resolve({ participantId }) })
      expect(response.status).toBe(401)
    })

    it('persists paid status in database', async () => {
      const request = new NextRequest(`http://localhost/api/v1/sharing/${participantId}/paid`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      await MarkPaid(request, { params: Promise.resolve({ participantId }) })

      // Verify in database
      const participant = await prisma.expenseParticipant.findUnique({
        where: { id: participantId },
      })

      expect(participant).toBeDefined()
      expect(participant?.status).toBe(PaymentStatus.PAID)
      expect(participant?.paidAt).toBeTruthy()
    })
  })

  describe('POST /api/v1/expenses/shares/[participantId]/decline', () => {
    it('declines share when called by participant', async () => {
      const request = new NextRequest(`http://localhost/api/v1/expenses/shares/${participantId}/decline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${otherToken}`,
          'Content-Type': 'application/json',
        },
      })

      const response = await DeclineShare(request, { params: Promise.resolve({ participantId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(participantId)
      expect(data.data.status).toBe('DECLINED')
      expect(data.data.declinedAt).toBeTruthy()
      // Verify declinedAt is a valid ISO timestamp
      expect(new Date(data.data.declinedAt).toISOString()).toBe(data.data.declinedAt)
    })

    it('declines share with optional reason', async () => {
      const declineReason = 'I was not part of this expense'
      const request = new NextRequest(`http://localhost/api/v1/expenses/shares/${participantId}/decline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${otherToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: declineReason }),
      })

      const response = await DeclineShare(request, { params: Promise.resolve({ participantId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(participantId)
      expect(data.data.status).toBe('DECLINED')
      expect(data.data.declinedAt).toBeTruthy()

      // Verify reason is persisted in database
      const participant = await prisma.expenseParticipant.findUnique({
        where: { id: participantId },
      })
      expect(participant).toBeDefined()
      expect(participant?.declineReason).toBe(declineReason)
      expect(participant?.declinedAt).toBeTruthy()
    })

    it('returns 403 when non-participant tries to decline', async () => {
      const request = new NextRequest(`http://localhost/api/v1/expenses/shares/${participantId}/decline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
      })

      const response = await DeclineShare(request, { params: Promise.resolve({ participantId }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('only decline shares assigned to you')
    })

    it('returns 404 for non-existent participant', async () => {
      const request = new NextRequest('http://localhost/api/v1/expenses/shares/non-existent-id/decline', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${otherToken}`,
          'Content-Type': 'application/json',
        },
      })

      const response = await DeclineShare(request, { params: Promise.resolve({ participantId: 'non-existent-id' }) })

      expect(response.status).toBe(404)
    })

    it('returns 400 when trying to decline PAID share', async () => {
      await prisma.expenseParticipant.update({
        where: { id: participantId },
        data: { status: PaymentStatus.PAID, paidAt: new Date() },
      })

      const request = new NextRequest(`http://localhost/api/v1/expenses/shares/${participantId}/decline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${otherToken}`,
          'Content-Type': 'application/json',
        },
      })

      const response = await DeclineShare(request, { params: Promise.resolve({ participantId }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.fields.status[0]).toContain('already paid')
    })

    it('returns 400 when trying to decline already DECLINED share', async () => {
      await prisma.expenseParticipant.update({
        where: { id: participantId },
        data: { status: PaymentStatus.DECLINED },
      })

      const request = new NextRequest(`http://localhost/api/v1/expenses/shares/${participantId}/decline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${otherToken}`,
          'Content-Type': 'application/json',
        },
      })

      const response = await DeclineShare(request, { params: Promise.resolve({ participantId }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.fields.status[0]).toContain('already declined')
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest(`http://localhost/api/v1/expenses/shares/${participantId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await DeclineShare(request, { params: Promise.resolve({ participantId }) })

      expect(response.status).toBe(401)
    })

    it('persists declined status and declinedAt in database', async () => {
      const request = new NextRequest(`http://localhost/api/v1/expenses/shares/${participantId}/decline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${otherToken}`,
          'Content-Type': 'application/json',
        },
      })

      const beforeDecline = new Date()
      await DeclineShare(request, { params: Promise.resolve({ participantId }) })
      const afterDecline = new Date()

      const participant = await prisma.expenseParticipant.findUnique({
        where: { id: participantId },
      })

      expect(participant).toBeDefined()
      expect(participant?.status).toBe(PaymentStatus.DECLINED)
      expect(participant?.declinedAt).toBeTruthy()
      // Verify declinedAt is within the expected time range
      expect(participant?.declinedAt?.getTime()).toBeGreaterThanOrEqual(beforeDecline.getTime())
      expect(participant?.declinedAt?.getTime()).toBeLessThanOrEqual(afterDecline.getTime())
    })
  })
})
