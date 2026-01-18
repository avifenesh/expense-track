import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as QuickBudget } from '@/app/api/v1/budgets/quick/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import { getMonthStartFromKey } from '@/utils/date'
import { getApiTestUser, getOtherTestUser, TEST_USER_ID } from './helpers'

describe('POST /api/v1/budgets/quick', () => {
  let validToken: string
  let accountId: string
  let otherAccountId: string
  let categoryId: string
  let otherCategoryId: string
  const testMonthKey = '2024-01'

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing!'
    resetEnvCache()
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')

    const testUser = await getApiTestUser()
    const otherTestUser = await getOtherTestUser()

    // Create test account for test user
    const account = await prisma.account.upsert({
      where: { userId_name: { userId: testUser.id, name: 'TestAccount' } },
      update: {},
      create: { userId: testUser.id, name: 'TestAccount', type: 'SELF' },
    })

    // Create account for other user
    const otherAccount = await prisma.account.upsert({
      where: { userId_name: { userId: otherTestUser.id, name: 'OtherAccount' } },
      update: {},
      create: { userId: otherTestUser.id, name: 'OtherAccount', type: 'SELF' },
    })

    const category = await prisma.category.upsert({
      where: { userId_name_type: { userId: testUser.id, name: 'TEST_ExpenseCategory', type: 'EXPENSE' } },
      update: {},
      create: { userId: testUser.id, name: 'TEST_ExpenseCategory', type: 'EXPENSE' },
    })

    const otherCategory = await prisma.category.upsert({
      where: { userId_name_type: { userId: otherTestUser.id, name: 'OTHER_ExpenseCategory', type: 'EXPENSE' } },
      update: {},
      create: { userId: otherTestUser.id, name: 'OTHER_ExpenseCategory', type: 'EXPENSE' },
    })

    accountId = account.id
    otherAccountId = otherAccount.id
    categoryId = category.id
    otherCategoryId = otherCategory.id
  })

  afterEach(async () => {
    await prisma.budget.deleteMany({
      where: {
        month: getMonthStartFromKey(testMonthKey),
      },
    })
    await prisma.category.deleteMany({
      where: { name: { in: ['TEST_ExpenseCategory', 'OTHER_ExpenseCategory'] } },
    })
  })

  it('creates budget with valid JWT', async () => {
    const request = new NextRequest('http://localhost/api/v1/budgets/quick', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        categoryId,
        monthKey: testMonthKey,
        planned: 500.0,
        currency: 'USD',
      }),
    })

    const response = await QuickBudget(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)

    // Verify budget was created
    const budget = await prisma.budget.findUnique({
      where: {
        accountId_categoryId_month: {
          accountId,
          categoryId,
          month: getMonthStartFromKey(testMonthKey),
        },
      },
    })
    expect(budget).not.toBeNull()
    expect(budget?.planned.toNumber()).toBe(500)
  })

  it('updates existing budget (upsert)', async () => {
    // Create initial budget
    await prisma.budget.create({
      data: {
        accountId,
        categoryId,
        month: getMonthStartFromKey(testMonthKey),
        planned: 300,
        currency: 'USD',
      },
    })

    // Update with different amount
    const request = new NextRequest('http://localhost/api/v1/budgets/quick', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        categoryId,
        monthKey: testMonthKey,
        planned: 750.0,
        currency: 'USD',
      }),
    })

    const response = await QuickBudget(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)

    // Verify only one budget exists with updated amount
    const budgets = await prisma.budget.findMany({
      where: {
        accountId,
        categoryId,
        month: getMonthStartFromKey(testMonthKey),
      },
    })
    expect(budgets.length).toBe(1)
    expect(budgets[0].planned.toNumber()).toBe(750)
  })

  it('defaults to USD when currency not provided', async () => {
    const request = new NextRequest('http://localhost/api/v1/budgets/quick', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        categoryId,
        monthKey: testMonthKey,
        planned: 500.0,
      }),
    })

    const response = await QuickBudget(request)
    expect(response.status).toBe(201)

    const budget = await prisma.budget.findUnique({
      where: {
        accountId_categoryId_month: {
          accountId,
          categoryId,
          month: getMonthStartFromKey(testMonthKey),
        },
      },
    })
    expect(budget?.currency).toBe('USD')
  })

  it('returns 401 with missing token', async () => {
    const request = new NextRequest('http://localhost/api/v1/budgets/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId,
        categoryId,
        monthKey: testMonthKey,
        planned: 500,
        currency: 'USD',
      }),
    })

    const response = await QuickBudget(request)
    expect(response.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const request = new NextRequest('http://localhost/api/v1/budgets/quick', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        categoryId,
        monthKey: testMonthKey,
        planned: 500,
        currency: 'USD',
      }),
    })

    const response = await QuickBudget(request)
    expect(response.status).toBe(401)
  })

  it('returns 400 with malformed JSON', async () => {
    const request = new NextRequest('http://localhost/api/v1/budgets/quick', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: 'invalid json',
    })

    const response = await QuickBudget(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with missing required fields', async () => {
    const request = new NextRequest('http://localhost/api/v1/budgets/quick', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        // Missing categoryId, monthKey, planned
      }),
    })

    const response = await QuickBudget(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with negative planned amount', async () => {
    const request = new NextRequest('http://localhost/api/v1/budgets/quick', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        categoryId,
        monthKey: testMonthKey,
        planned: -100,
        currency: 'USD',
      }),
    })

    const response = await QuickBudget(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with invalid monthKey format', async () => {
    const request = new NextRequest('http://localhost/api/v1/budgets/quick', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        categoryId,
        monthKey: '2024/01', // Invalid format
        planned: 500,
        currency: 'USD',
      }),
    })

    const response = await QuickBudget(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with invalid currency', async () => {
    const request = new NextRequest('http://localhost/api/v1/budgets/quick', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        categoryId,
        monthKey: testMonthKey,
        planned: 500,
        currency: 'INVALID',
      }),
    })

    const response = await QuickBudget(request)
    expect(response.status).toBe(400)
  })

  it('returns 403 for unauthorized account access', async () => {
    const request = new NextRequest('http://localhost/api/v1/budgets/quick', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId: otherAccountId,
        categoryId,
        monthKey: testMonthKey,
        planned: 500,
        currency: 'USD',
      }),
    })

    const response = await QuickBudget(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('Account not found or access denied')
  })

  it('returns 403 for unauthorized category access', async () => {
    const request = new NextRequest('http://localhost/api/v1/budgets/quick', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        categoryId: otherCategoryId,
        monthKey: testMonthKey,
        planned: 500,
        currency: 'USD',
      }),
    })

    const response = await QuickBudget(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('Category not found or access denied')
  })

  it('returns 403 when user has no subscription', async () => {
    await prisma.subscription.update({
      where: { userId: TEST_USER_ID },
      data: { status: 'EXPIRED' },
    })

    const request = new NextRequest('http://localhost/api/v1/budgets/quick', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        categoryId,
        monthKey: testMonthKey,
        planned: 500,
        currency: 'USD',
      }),
    })

    const response = await QuickBudget(request)
    expect(response.status).toBe(402) // 402 Payment Required for subscription errors

    // Reset subscription for other tests
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)
    await prisma.subscription.update({
      where: { userId: TEST_USER_ID },
      data: { status: 'TRIALING', trialEndsAt },
    })
  })
})
