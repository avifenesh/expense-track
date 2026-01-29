import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as SendReminder } from '@/app/api/v1/expenses/shares/[id]/remind/route'
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

// Mock the email module to prevent actual email sends
vi.mock('@/lib/email', () => ({
  sendPaymentReminderEmail: vi.fn().mockResolvedValue({ success: true }),
}))

describe('POST /api/v1/expenses/shares/[participantId]/remind', () => {
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
        userId_name: { userId: testUser.id, name: 'RemindTestAccount' },
      },
      update: {},
      create: { userId: testUser.id, name: 'RemindTestAccount', type: 'SELF' },
    })
    accountId = account.id

    const category = await prisma.category.upsert({
      where: {
        userId_name_type: {
          userId: testUser.id,
          name: 'RemindTestCategory',
          type: TransactionType.EXPENSE,
        },
      },
      update: {},
      create: {
        userId: testUser.id,
        name: 'RemindTestCategory',
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
        description: 'RemindTestTransaction',
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
        description: 'Test remind shared expense',
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
    vi.clearAllMocks()
    await prisma.expenseParticipant.deleteMany({
      where: { sharedExpense: { description: 'Test remind shared expense' } },
    })
    await prisma.sharedExpense.deleteMany({
      where: { description: 'Test remind shared expense' },
    })
    await prisma.transaction.deleteMany({
      where: { description: 'RemindTestTransaction' },
    })
    await prisma.category.deleteMany({
      where: { name: 'RemindTestCategory' },
    })
    await prisma.account.deleteMany({
      where: { name: 'RemindTestAccount' },
    })
  })

  it('sends reminder when called by owner for PENDING share', async () => {
    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${participantId}/remind`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const response = await SendReminder(request, {
      params: Promise.resolve({ id: participantId }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.id).toBe(participantId)
    expect(data.data.reminderSentAt).toBeTruthy()
  })

  it('returns 403 when called by non-owner (the participant)', async () => {
    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${participantId}/remind`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${otherToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const response = await SendReminder(request, {
      params: Promise.resolve({ id: participantId }),
    })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('Only the expense owner')
  })

  it('returns 404 for non-existent participant', async () => {
    const request = new NextRequest(
      'http://localhost/api/v1/expenses/shares/non-existent-id/remind',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const response = await SendReminder(request, {
      params: Promise.resolve({ id: 'non-existent-id' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('Participant not found')
  })

  it('returns 400 when participant status is PAID', async () => {
    await prisma.expenseParticipant.update({
      where: { id: participantId },
      data: { status: PaymentStatus.PAID, paidAt: new Date() },
    })

    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${participantId}/remind`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const response = await SendReminder(request, {
      params: Promise.resolve({ id: participantId }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.fields.status[0]).toContain('paid')
  })

  it('returns 400 when participant status is DECLINED', async () => {
    await prisma.expenseParticipant.update({
      where: { id: participantId },
      data: { status: PaymentStatus.DECLINED, declinedAt: new Date() },
    })

    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${participantId}/remind`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const response = await SendReminder(request, {
      params: Promise.resolve({ id: participantId }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.fields.status[0]).toContain('declined')
  })

  it('returns 400 when reminder sent within last 24 hours (cooldown active)', async () => {
    // Set reminderSentAt to 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    await prisma.expenseParticipant.update({
      where: { id: participantId },
      data: { reminderSentAt: oneHourAgo },
    })

    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${participantId}/remind`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const response = await SendReminder(request, {
      params: Promise.resolve({ id: participantId }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.fields.reminderSentAt[0]).toContain('one reminder per day')
  })

  it('successfully sends reminder when cooldown has expired (>24 hours)', async () => {
    // Set reminderSentAt to 25 hours ago
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000)
    await prisma.expenseParticipant.update({
      where: { id: participantId },
      data: { reminderSentAt: twentyFiveHoursAgo },
    })

    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${participantId}/remind`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const response = await SendReminder(request, {
      params: Promise.resolve({ id: participantId }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.id).toBe(participantId)
    expect(data.data.reminderSentAt).toBeTruthy()
  })

  it('returns 401 with missing token', async () => {
    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${participantId}/remind`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    )

    const response = await SendReminder(request, {
      params: Promise.resolve({ id: participantId }),
    })

    expect(response.status).toBe(401)
  })

  it('persists reminderSentAt in database after successful reminder', async () => {
    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${participantId}/remind`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const beforeRemind = new Date()
    await SendReminder(request, {
      params: Promise.resolve({ id: participantId }),
    })
    const afterRemind = new Date()

    const participant = await prisma.expenseParticipant.findUnique({
      where: { id: participantId },
    })

    expect(participant).toBeDefined()
    expect(participant?.reminderSentAt).toBeTruthy()
    expect(participant?.reminderSentAt?.getTime()).toBeGreaterThanOrEqual(
      beforeRemind.getTime()
    )
    expect(participant?.reminderSentAt?.getTime()).toBeLessThanOrEqual(
      afterRemind.getTime()
    )
  })

  it('returns valid ISO timestamp in reminderSentAt field', async () => {
    const request = new NextRequest(
      `http://localhost/api/v1/expenses/shares/${participantId}/remind`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const response = await SendReminder(request, {
      params: Promise.resolve({ id: participantId }),
    })
    const data = await response.json()

    expect(data.data.reminderSentAt).toBeTruthy()
    expect(new Date(data.data.reminderSentAt).toISOString()).toBe(
      data.data.reminderSentAt
    )
  })

  it('returns 500 when email sending fails', async () => {
    const { sendPaymentReminderEmail } = await import('@/lib/email')
    vi.mocked(sendPaymentReminderEmail).mockResolvedValueOnce({
      success: false,
    })

    const request = new NextRequest(
      `http://localhost:3000/api/v1/expenses/shares/${participantId}/remind`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const response = await SendReminder(request, {
      params: Promise.resolve({ id: participantId }),
    })

    expect(response.status).toBe(500)

    const data = await response.json()
    expect(data.error).toContain('Failed to send reminder email')

    // Verify reminderSentAt was rolled back (allows retry)
    const updated = await prisma.expenseParticipant.findUnique({
      where: { id: participantId },
    })
    expect(updated?.reminderSentAt).toBeNull()
  })

  it('returns 404 when shared expense is soft-deleted', async () => {
    // Soft-delete the shared expense
    await prisma.sharedExpense.update({
      where: { transactionId },
      data: { deletedAt: new Date() },
    })

    const request = new NextRequest(
      `http://localhost:3000/api/v1/expenses/shares/${participantId}/remind`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const response = await SendReminder(request, {
      params: Promise.resolve({ id: participantId }),
    })

    expect(response.status).toBe(404)

    const data = await response.json()
    expect(data.error).toBe('Participant not found')
  })
})
