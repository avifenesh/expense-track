import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { DELETE as DeleteShare } from '@/app/api/v1/expenses/shares/[id]/route'
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

describe('DELETE /api/v1/expenses/shares/[id]', () => {
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

    const testUser = await getApiTestUser()
    const otherUser = await getOtherTestUser()

    const account = await prisma.account.upsert({
      where: {
        userId_name: { userId: testUser.id, name: 'DeleteShareTestAccount' },
      },
      update: {},
      create: { userId: testUser.id, name: 'DeleteShareTestAccount', type: 'SELF' },
    })
    accountId = account.id

    const category = await prisma.category.upsert({
      where: {
        userId_name_type: {
          userId: testUser.id,
          name: 'DeleteShareTestCategory',
          type: TransactionType.EXPENSE,
        },
      },
      update: {},
      create: {
        userId: testUser.id,
        name: 'DeleteShareTestCategory',
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
        description: 'DeleteShareTestTransaction',
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
        description: 'Test delete shared expense',
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
    sharedExpenseId = sharedExpense.id
    participantId = sharedExpense.participants[0].id
  })

  afterEach(async () => {
    await prisma.expenseParticipant.deleteMany({
      where: { sharedExpense: { description: 'Test delete shared expense' } },
    })
    await prisma.sharedExpense.deleteMany({
      where: { description: 'Test delete shared expense' },
    })
    await prisma.transaction.deleteMany({
      where: { description: 'DeleteShareTestTransaction' },
    })
    await prisma.category.deleteMany({
      where: { name: 'DeleteShareTestCategory' },
    })
    await prisma.account.deleteMany({
      where: { name: 'DeleteShareTestAccount' },
    })
  })

  it('deletes shared expense when called by owner with PENDING participants', async () => {
    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${sharedExpenseId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      }
    )

    const response = await DeleteShare(request, {
      params: Promise.resolve({ id: sharedExpenseId }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.deleted).toBe(true)
  })

  it('returns 401 with missing token', async () => {
    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${sharedExpenseId}`,
      {
        method: 'DELETE',
      }
    )

    const response = await DeleteShare(request, {
      params: Promise.resolve({ id: sharedExpenseId }),
    })

    expect(response.status).toBe(401)
  })

  it('returns 404 for non-existent shared expense', async () => {
    const request = new NextRequest(
      'http://localhost/api/v1/expenses/shares/non-existent-id',
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      }
    )

    const response = await DeleteShare(request, {
      params: Promise.resolve({ id: 'non-existent-id' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('Shared expense not found')
  })

  it('returns 403 when called by non-owner', async () => {
    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${sharedExpenseId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${otherToken}`,
        },
      }
    )

    const response = await DeleteShare(request, {
      params: Promise.resolve({ id: sharedExpenseId }),
    })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('Only the expense owner')
  })

  it('returns 400 when participant has already PAID', async () => {
    await prisma.expenseParticipant.update({
      where: { id: participantId },
      data: { status: PaymentStatus.PAID, paidAt: new Date() },
    })

    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${sharedExpenseId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      }
    )

    const response = await DeleteShare(request, {
      params: Promise.resolve({ id: sharedExpenseId }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.fields.participants[0]).toContain('participants have already paid')
  })

  it('allows delete when participants are PENDING or DECLINED', async () => {
    await prisma.expenseParticipant.update({
      where: { id: participantId },
      data: { status: PaymentStatus.DECLINED, declinedAt: new Date() },
    })

    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${sharedExpenseId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      }
    )

    const response = await DeleteShare(request, {
      params: Promise.resolve({ id: sharedExpenseId }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.deleted).toBe(true)
  })

  it('soft deletes both SharedExpense and ExpenseParticipant in database', async () => {
    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${sharedExpenseId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      }
    )

    const beforeDelete = new Date()
    await DeleteShare(request, { params: Promise.resolve({ id: sharedExpenseId }) })
    const afterDelete = new Date()

    const sharedExpense = await prisma.sharedExpense.findUnique({
      where: { id: sharedExpenseId },
    })
    const participant = await prisma.expenseParticipant.findUnique({
      where: { id: participantId },
    })

    expect(sharedExpense).toBeDefined()
    expect(sharedExpense?.deletedAt).toBeTruthy()
    expect(sharedExpense?.deletedBy).toBe(TEST_USER_ID)
    expect(sharedExpense?.deletedAt?.getTime()).toBeGreaterThanOrEqual(beforeDelete.getTime())
    expect(sharedExpense?.deletedAt?.getTime()).toBeLessThanOrEqual(afterDelete.getTime())

    expect(participant).toBeDefined()
    expect(participant?.deletedAt).toBeTruthy()
    expect(participant?.deletedBy).toBe(TEST_USER_ID)
    expect(participant?.deletedAt?.getTime()).toBeGreaterThanOrEqual(beforeDelete.getTime())
    expect(participant?.deletedAt?.getTime()).toBeLessThanOrEqual(afterDelete.getTime())
  })

  it('returns 404 for already soft-deleted shared expense', async () => {
    await prisma.sharedExpense.update({
      where: { id: sharedExpenseId },
      data: { deletedAt: new Date(), deletedBy: TEST_USER_ID },
    })

    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${sharedExpenseId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      }
    )

    const response = await DeleteShare(request, {
      params: Promise.resolve({ id: sharedExpenseId }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('Shared expense not found')
  })
})
