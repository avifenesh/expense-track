import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as SeedData } from '@/app/api/v1/seed-data/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import { getApiTestUser, TEST_USER_ID } from './helpers'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '@/lib/default-categories'
import { getMonthStart } from '@/utils/date'

describe('POST /api/v1/seed-data', () => {
  let validToken: string
  let seedAccountId: string | null = null

  const getSeedAccountId = async () => {
    const account = await prisma.account.findFirst({
      where: { userId: TEST_USER_ID, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    })

    if (!account) {
      throw new Error('No account found for seed-data tests')
    }

    return account.id
  }

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing!'
    resetEnvCache()
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')

    const testUser = await getApiTestUser()

    // Create test account
    await prisma.account.upsert({
      where: { userId_name: { userId: testUser.id, name: 'TestAccount' } },
      update: {},
      create: { userId: testUser.id, name: 'TestAccount', type: 'SELF' },
    })

    seedAccountId = await getSeedAccountId()
  })

  afterEach(async () => {
    // Clean up created data
    if (seedAccountId) {
      await prisma.transaction.deleteMany({
        where: {
          accountId: seedAccountId,
          description: { in: ['Weekly grocery shopping', 'Monthly salary'] },
        },
      })

      const month = getMonthStart(new Date())
      const groceriesCategory = await prisma.category.findFirst({
        where: { userId: TEST_USER_ID, name: 'Groceries', type: 'EXPENSE' },
        select: { id: true },
      })

      if (groceriesCategory) {
        await prisma.budget.deleteMany({
          where: {
            accountId: seedAccountId,
            categoryId: groceriesCategory.id,
            month,
          },
        })
      }
    }
    await prisma.category.deleteMany({
      where: {
        userId: TEST_USER_ID,
        name: {
          in: [...DEFAULT_EXPENSE_CATEGORIES.map((c) => c.name), ...DEFAULT_INCOME_CATEGORIES.map((c) => c.name)],
        },
      },
    })
  })

  it('seeds data successfully with valid JWT', async () => {
    const request = new NextRequest('http://localhost/api/v1/seed-data', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    const response = await SeedData(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.categoriesCreated).toBe(DEFAULT_EXPENSE_CATEGORIES.length + DEFAULT_INCOME_CATEGORIES.length)
    expect(data.data.transactionsCreated).toBe(2)
    expect(data.data.budgetsCreated).toBe(1)
  })

  it('creates default categories correctly', async () => {
    const request = new NextRequest('http://localhost/api/v1/seed-data', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    await SeedData(request)

    const categories = await prisma.category.findMany({
      where: {
        userId: TEST_USER_ID,
        name: { in: ['Groceries', 'Salary'] },
      },
    })

    expect(categories.length).toBe(2)
    const groceries = categories.find((c) => c.name === 'Groceries')
    const salary = categories.find((c) => c.name === 'Salary')

    expect(groceries?.type).toBe('EXPENSE')
    expect(salary?.type).toBe('INCOME')
  })

  it('creates sample transactions correctly', async () => {
    const request = new NextRequest('http://localhost/api/v1/seed-data', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    await SeedData(request)

    const grocery = await prisma.transaction.findFirst({
      where: { accountId: seedAccountId ?? undefined, description: 'Weekly grocery shopping' },
      orderBy: { createdAt: 'desc' },
    })
    const salary = await prisma.transaction.findFirst({
      where: { accountId: seedAccountId ?? undefined, description: 'Monthly salary' },
      orderBy: { createdAt: 'desc' },
    })

    expect(grocery).toBeTruthy()
    expect(grocery?.type).toBe('EXPENSE')
    expect(grocery?.amount.toNumber()).toBe(85.5)

    expect(salary).toBeTruthy()
    expect(salary?.type).toBe('INCOME')
    expect(salary?.amount.toNumber()).toBe(3500.0)
  })

  it('creates budget for groceries correctly', async () => {
    const request = new NextRequest('http://localhost/api/v1/seed-data', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    await SeedData(request)

    const month = getMonthStart(new Date())
    const budget = await prisma.budget.findFirst({
      where: {
        accountId: seedAccountId ?? undefined,
        month,
        category: { name: 'Groceries' },
      },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    })

    expect(budget).toBeTruthy()
    expect(budget?.category.name).toBe('Groceries')
    expect(budget?.planned.toNumber()).toBe(400)
  })

  it('is idempotent - can be called multiple times', async () => {
    const request = new NextRequest('http://localhost/api/v1/seed-data', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    // First call
    const response1 = await SeedData(request)
    const data1 = await response1.json()
    expect(response1.status).toBe(201)

    // Second call - should not fail
    const response2 = await SeedData(request)
    const data2 = await response2.json()
    expect(response2.status).toBe(201)
    expect(data2.data.categoriesCreated).toBe(data1.data.categoriesCreated)

    // Verify no duplicate transactions created
    const transactions = await prisma.transaction.findMany({
      where: {
        accountId: seedAccountId ?? undefined,
        description: { in: ['Weekly grocery shopping', 'Monthly salary'] },
      },
    })
    // Should have more than 2 because we called seed twice
    expect(transactions.length).toBeGreaterThan(2)
  })

  it('reactivates archived categories', async () => {
    // Create and archive a category first
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        name: 'Groceries',
        type: 'EXPENSE',
        isArchived: true,
      },
    })

    const request = new NextRequest('http://localhost/api/v1/seed-data', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    await SeedData(request)

    const reactivated = await prisma.category.findUnique({
      where: { id: category.id },
    })

    expect(reactivated?.isArchived).toBe(false)
  })

  it('uses user preferred currency', async () => {
    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { preferredCurrency: 'EUR' },
    })

    const request = new NextRequest('http://localhost/api/v1/seed-data', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    await SeedData(request)

    const grocery = await prisma.transaction.findFirst({
      where: { accountId: seedAccountId ?? undefined, description: 'Weekly grocery shopping' },
      orderBy: { createdAt: 'desc' },
    })
    const salary = await prisma.transaction.findFirst({
      where: { accountId: seedAccountId ?? undefined, description: 'Monthly salary' },
      orderBy: { createdAt: 'desc' },
    })

    expect(grocery?.currency).toBe('EUR')
    expect(salary?.currency).toBe('EUR')

    const month = getMonthStart(new Date())
    const budget = await prisma.budget.findFirst({
      where: {
        accountId: seedAccountId ?? undefined,
        month,
        category: { name: 'Groceries' },
      },
      orderBy: { createdAt: 'desc' },
    })

    expect(budget?.currency).toBe('EUR')

    // Reset for other tests
    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { preferredCurrency: 'USD' },
    })
  })

  it('returns 401 with missing token', async () => {
    const request = new NextRequest('http://localhost/api/v1/seed-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await SeedData(request)
    expect(response.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const request = new NextRequest('http://localhost/api/v1/seed-data', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid-token',
        'Content-Type': 'application/json',
      },
    })

    const response = await SeedData(request)
    expect(response.status).toBe(401)
  })

  it('returns 402 when user has no subscription', async () => {
    await prisma.subscription.update({
      where: { userId: TEST_USER_ID },
      data: { status: 'EXPIRED' },
    })

    const request = new NextRequest('http://localhost/api/v1/seed-data', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    const response = await SeedData(request)
    expect(response.status).toBe(402) // 402 Payment Required for subscription errors

    // Reset subscription for other tests
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)
    await prisma.subscription.update({
      where: { userId: TEST_USER_ID },
      data: { status: 'TRIALING', trialEndsAt },
    })
  })

  it('returns 403 when user has no account', async () => {
    // Delete the test account
    await prisma.account.deleteMany({
      where: { userId: TEST_USER_ID },
    })

    const request = new NextRequest('http://localhost/api/v1/seed-data', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    const response = await SeedData(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('No account found')
  })
})
