import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH as MarkPaid } from '@/app/api/v1/expenses/shares/[id]/paid/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import {
  getApiTestUser,
  getOtherTestUser,
  TEST_USER_ID,
  OTHER_USER_ID,
} from './helpers'
import { SplitType, PaymentStatus, TransactionType } from '@prisma/client'

describe('PATCH /api/v1/expenses/shares/[participantId]/paid', () => {
  let validToken: string
  let otherToken: string
  let accountId: string
  let categoryId: string
  let transactionId: string
  let participantId: string

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing!'
    resetEnvCache()
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')
    otherToken = generateAccessToken(OTHER_USER_ID, 'api-other@example.com')

    const testUser = await getApiTestUser()
    const otherUser = await getOtherTestUser()

    const account = await prisma.account.upsert({
      where: {
        userId_name: { userId: testUser.id, name: 'PaidTestAccount' },
      },
      update: {},
      create: { userId: testUser.id, name: 'PaidTestAccount', type: 'SELF' },
    })
    accountId = account.id

    const category = await prisma.category.upsert({
      where: {
        userId_name_type: {
          userId: testUser.id,
          name: 'PaidTestCategory',
          type: TransactionType.EXPENSE,
        },
      },
      update: {},
      create: {
        userId: testUser.id,
        name: 'PaidTestCategory',
        type: TransactionType.EXPENSE,
      },
    })
    categoryId = category.id

    const transaction = await prisma.transaction.create({
      data: {
        accountId,
        categoryId,
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: 'USD',
        date: new Date(),
        month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        description: 'PaidTestTransaction',
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
        description: 'Test paid shared expense',
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
      where: { sharedExpense: { description: 'Test paid shared expense' } },
    })
    await prisma.sharedExpense.deleteMany({
      where: { description: 'Test paid shared expense' },
    })
    await prisma.transaction.deleteMany({
      where: { description: 'PaidTestTransaction' },
    })
    await prisma.category.deleteMany({
      where: { name: 'PaidTestCategory' },
    })
    await prisma.account.deleteMany({
      where: { name: 'PaidTestAccount' },
    })
  })

  it('marks participant as paid when called by owner', async () => {
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

    const response = await MarkPaid(request, {
      params: Promise.resolve({ id: participantId }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.id).toBe(participantId)
    expect(data.data.status).toBe('PAID')
    expect(data.data.paidAt).toBeTruthy()
  })

  it('returns 403 when called by non-owner (participant)', async () => {
    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${participantId}/paid`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${otherToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    )

    const response = await MarkPaid(request, {
      params: Promise.resolve({ id: participantId }),
    })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('Only the expense owner')
  })

  it('returns 404 for non-existent participant', async () => {
    const request = new NextRequest(
      'http://localhost/api/v1/expenses/shares/non-existent-id/paid',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    )

    const response = await MarkPaid(request, {
      params: Promise.resolve({ id: 'non-existent-id' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('Participant not found')
  })

  it('returns 400 when share is already PAID', async () => {
    await prisma.expenseParticipant.update({
      where: { id: participantId },
      data: { status: PaymentStatus.PAID, paidAt: new Date() },
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

    const response = await MarkPaid(request, {
      params: Promise.resolve({ id: participantId }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.fields.status[0]).toContain('already paid')
  })

  it('returns 400 when share is already DECLINED', async () => {
    await prisma.expenseParticipant.update({
      where: { id: participantId },
      data: { status: PaymentStatus.DECLINED, declinedAt: new Date() },
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

    const response = await MarkPaid(request, {
      params: Promise.resolve({ id: participantId }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.fields.status[0]).toContain('already declined')
  })

  it('returns 401 with missing token', async () => {
    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${participantId}/paid`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    )

    const response = await MarkPaid(request, {
      params: Promise.resolve({ id: participantId }),
    })

    expect(response.status).toBe(401)
  })

  it('persists paid status and paidAt in database', async () => {
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

    const beforeMark = new Date()
    await MarkPaid(request, { params: Promise.resolve({ id: participantId }) })
    const afterMark = new Date()

    const participant = await prisma.expenseParticipant.findUnique({
      where: { id: participantId },
    })

    expect(participant).toBeDefined()
    expect(participant?.status).toBe(PaymentStatus.PAID)
    expect(participant?.paidAt).toBeTruthy()
    expect(participant?.paidAt?.getTime()).toBeGreaterThanOrEqual(
      beforeMark.getTime()
    )
    expect(participant?.paidAt?.getTime()).toBeLessThanOrEqual(
      afterMark.getTime()
    )
  })

  it('returns valid ISO timestamp in paidAt field', async () => {
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

    const response = await MarkPaid(request, {
      params: Promise.resolve({ id: participantId }),
    })
    const data = await response.json()

    expect(data.data.paidAt).toBeTruthy()
    expect(new Date(data.data.paidAt).toISOString()).toBe(data.data.paidAt)
  })
})
