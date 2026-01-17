import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as GetBudgets, POST as UpsertBudget, DELETE as DeleteBudget } from '@/app/api/v1/budgets/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import { getMonthStartFromKey } from '@/utils/date'
import { getApiTestUser, getOtherTestUser, TEST_USER_ID } from './helpers'

describe('Budget API Routes', () => {
  let validToken: string
  let accountId: string
  let otherAccountId: string
  let categoryId: string
  const testMonthKey = '2024-01'

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing!'
    resetEnvCache()
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')

    // Get test user for userId foreign keys
    const testUser = await getApiTestUser()

    // Get other user for unauthorized access testing
    const otherTestUser = await getOtherTestUser()

    // Upsert test accounts (atomic, no race condition)
    const account = await prisma.account.upsert({
      where: { userId_name: { userId: testUser.id, name: 'TestAccount' } },
      update: {},
      create: { userId: testUser.id, name: 'TestAccount', type: 'SELF' },
    })

    // Other account belongs to OTHER user - test user should NOT have access
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

    accountId = account.id
    otherAccountId = otherAccount.id
    categoryId = category.id
  })

  afterEach(async () => {
    await prisma.budget.deleteMany({
      where: {
        month: getMonthStartFromKey(testMonthKey),
      },
    })
    await prisma.category.deleteMany({
      where: { name: 'TEST_ExpenseCategory' },
    })
  })

  describe('POST /api/v1/budgets', () => {
    it('creates budget with valid JWT', async () => {
      const request = new NextRequest('http://localhost/api/v1/budgets', {
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
          notes: 'Test budget',
        }),
      })

      const response = await UpsertBudget(request)
      const data = await response.json()

      expect(response.status).toBe(201) // 201 for create, 200 for update
      expect(data.success).toBe(true)
      expect(data.data.id).toBeTruthy()
    })

    it('updates existing budget (upsert)', async () => {
      // First create
      const createRequest = new NextRequest('http://localhost/api/v1/budgets', {
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
      await UpsertBudget(createRequest)

      // Then update with different amount
      const updateRequest = new NextRequest('http://localhost/api/v1/budgets', {
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
          notes: 'Updated budget',
        }),
      })

      const response = await UpsertBudget(updateRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
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

    it('returns 401 with missing token', async () => {
      const request = new NextRequest('http://localhost/api/v1/budgets', {
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

      const response = await UpsertBudget(request)
      expect(response.status).toBe(401)
    })

    it('returns 400 with invalid data', async () => {
      const request = new NextRequest('http://localhost/api/v1/budgets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          monthKey: testMonthKey,
          planned: -100, // Invalid negative amount
          currency: 'USD',
        }),
      })

      const response = await UpsertBudget(request)
      expect(response.status).toBe(400)
    })

    it('returns 403 for unauthorized account access', async () => {
      const request = new NextRequest('http://localhost/api/v1/budgets', {
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

      const response = await UpsertBudget(request)
      expect(response.status).toBe(403)
    })

    it('returns 400 with malformed JSON', async () => {
      const request = new NextRequest('http://localhost/api/v1/budgets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      const response = await UpsertBudget(request)
      expect(response.status).toBe(400)
    })
  })

  describe('GET /api/v1/budgets', () => {
    beforeEach(async () => {
      // Create test budgets for GET tests
      await prisma.budget.createMany({
        data: [
          {
            accountId,
            categoryId,
            month: getMonthStartFromKey(testMonthKey),
            planned: 500,
            currency: 'USD',
            notes: 'TEST_Budget1',
          },
          {
            accountId,
            categoryId,
            month: getMonthStartFromKey('2024-02'),
            planned: 600,
            currency: 'USD',
            notes: 'TEST_Budget2',
          },
        ],
      })
    })

    afterEach(async () => {
      await prisma.budget.deleteMany({
        where: { month: { in: [getMonthStartFromKey(testMonthKey), getMonthStartFromKey('2024-02')] } },
      })
    })

    it('returns budgets with valid JWT and accountId', async () => {
      const request = new NextRequest(`http://localhost/api/v1/budgets?accountId=${accountId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetBudgets(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.budgets).toBeDefined()
      expect(data.data.budgets.length).toBeGreaterThanOrEqual(2)
    })

    it('returns budgets with category data', async () => {
      const request = new NextRequest(`http://localhost/api/v1/budgets?accountId=${accountId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetBudgets(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const budget = data.data.budgets[0]
      expect(budget.category).toBeDefined()
      expect(budget.category.id).toBeTruthy()
      expect(budget.category.name).toBeTruthy()
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest(`http://localhost/api/v1/budgets?accountId=${accountId}`, {
        method: 'GET',
      })

      const response = await GetBudgets(request)
      expect(response.status).toBe(401)
    })

    it('returns 403 for unauthorized account access', async () => {
      const request = new NextRequest(`http://localhost/api/v1/budgets?accountId=${otherAccountId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetBudgets(request)
      expect(response.status).toBe(403)
    })

    it('returns 400 with missing accountId', async () => {
      const request = new NextRequest('http://localhost/api/v1/budgets', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetBudgets(request)
      expect(response.status).toBe(400)
    })

    it('filters by month correctly', async () => {
      const request = new NextRequest(`http://localhost/api/v1/budgets?accountId=${accountId}&month=${testMonthKey}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetBudgets(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.budgets.length).toBeGreaterThanOrEqual(1)
      expect(data.data.budgets.every((b: { month: string }) => b.month.startsWith('2024-01'))).toBe(true)
    })
  })

  describe('DELETE /api/v1/budgets', () => {
    beforeEach(async () => {
      // Create a budget to delete
      await prisma.budget.create({
        data: {
          accountId,
          categoryId,
          month: getMonthStartFromKey(testMonthKey),
          planned: 500,
          currency: 'USD',
        },
      })
    })

    it('deletes budget with valid JWT', async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/budgets?accountId=${accountId}&categoryId=${categoryId}&monthKey=${testMonthKey}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${validToken}` },
        },
      )

      const response = await DeleteBudget(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.deleted).toBe(true)

      // Verify budget was soft deleted
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
      expect(budget?.deletedAt).not.toBeNull()
    })

    it('returns 404 for non-existent budget', async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/budgets?accountId=${accountId}&categoryId=${categoryId}&monthKey=2025-12`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${validToken}` },
        },
      )

      const response = await DeleteBudget(request)
      expect(response.status).toBe(404)
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/budgets?accountId=${accountId}&categoryId=${categoryId}&monthKey=${testMonthKey}`,
        {
          method: 'DELETE',
        },
      )

      const response = await DeleteBudget(request)
      expect(response.status).toBe(401)
    })

    it('returns 403 for unauthorized account access', async () => {
      // Create budget for other account
      await prisma.budget.create({
        data: {
          accountId: otherAccountId,
          categoryId,
          month: getMonthStartFromKey(testMonthKey),
          planned: 500,
          currency: 'USD',
        },
      })

      const request = new NextRequest(
        `http://localhost/api/v1/budgets?accountId=${otherAccountId}&categoryId=${categoryId}&monthKey=${testMonthKey}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${validToken}` },
        },
      )

      const response = await DeleteBudget(request)
      expect(response.status).toBe(403)
    })

    it('returns 400 with missing query params', async () => {
      const request = new NextRequest('http://localhost/api/v1/budgets?accountId=only-one-param', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await DeleteBudget(request)
      expect(response.status).toBe(400)
    })
  })
})
