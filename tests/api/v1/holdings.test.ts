/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma adapter requires any casts for Holding model */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as CreateHolding } from '@/app/api/v1/holdings/route'
import { PUT as UpdateHolding, DELETE as DeleteHolding } from '@/app/api/v1/holdings/[id]/route'
import { POST as RefreshPrices } from '@/app/api/v1/holdings/refresh/route'
import { generateAccessToken } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import { getApiTestUser, getOtherTestUser, TEST_USER_ID } from './helpers'

// Mock stock API
vi.mock('@/lib/stock-api', () => ({
  fetchStockQuote: vi.fn().mockResolvedValue({ price: 150.0, currency: 'USD' }),
  refreshStockPrices: vi.fn().mockResolvedValue({ updated: 1, skipped: 0, errors: [] }),
}))

describe('Holdings API Routes', () => {
  let validToken: string
  let accountId: string
  let otherAccountId: string
  let holdingCategoryId: string

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing'
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')

    // Get test user for userId foreign keys
    const testUser = await getApiTestUser()

    // Get other user for unauthorized access testing
    const otherTestUser = await getOtherTestUser()

    // Upsert test accounts and category (atomic, no race condition)
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

    const holdingCategory = await prisma.category.upsert({
      where: { userId_name_type: { userId: testUser.id, name: 'TEST_Stocks', type: 'EXPENSE' } },
      update: {},
      create: { userId: testUser.id, name: 'TEST_Stocks', type: 'EXPENSE', isHolding: true },
    })

    accountId = account.id
    otherAccountId = otherAccount.id
    holdingCategoryId = holdingCategory.id
  })

  afterEach(async () => {
    await (prisma as any).holding.deleteMany({
      where: { symbol: { startsWith: 'TS' } },
    })
  })

  describe('POST /api/v1/holdings', () => {
    it('creates holding with valid JWT', async () => {
      const request = new NextRequest('http://localhost/api/v1/holdings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId: holdingCategoryId,
          symbol: 'TSAPL',
          quantity: 10,
          averageCost: 150.0,
          currency: 'USD',
          notes: 'Test holding',
        }),
      })

      const response = await CreateHolding(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.id).toBeTruthy()
    })

    it('creates holding without notes', async () => {
      const request = new NextRequest('http://localhost/api/v1/holdings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId: holdingCategoryId,
          symbol: 'TSGO',
          quantity: 5,
          averageCost: 2800.0,
          currency: 'USD',
        }),
      })

      const response = await CreateHolding(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
    })

    it('uppercases symbol automatically', async () => {
      const request = new NextRequest('http://localhost/api/v1/holdings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId: holdingCategoryId,
          symbol: 'tsmf',
          quantity: 15,
          averageCost: 380.0,
          currency: 'USD',
        }),
      })

      const response = await CreateHolding(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)

      // Verify symbol was uppercased
      const holding = await (prisma as any).holding.findUnique({
        where: { id: data.data.id },
      })
      expect(holding.symbol).toBe('TSMF')
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest('http://localhost/api/v1/holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          categoryId: holdingCategoryId,
          symbol: 'AAPL',
          quantity: 10,
          averageCost: 150,
          currency: 'USD',
        }),
      })

      const response = await CreateHolding(request)
      expect(response.status).toBe(401)
    })

    it('returns 400 with invalid data', async () => {
      const request = new NextRequest('http://localhost/api/v1/holdings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId: holdingCategoryId,
          symbol: 'AAPL',
          quantity: -5, // Invalid negative quantity
          averageCost: 150,
          currency: 'USD',
        }),
      })

      const response = await CreateHolding(request)
      expect(response.status).toBe(400)
    })

    it('returns 403 for unauthorized account access', async () => {
      const request = new NextRequest('http://localhost/api/v1/holdings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: otherAccountId,
          categoryId: holdingCategoryId,
          symbol: 'AAPL',
          quantity: 10,
          averageCost: 150,
          currency: 'USD',
        }),
      })

      const response = await CreateHolding(request)
      expect(response.status).toBe(403)
    })

    it('returns 400 for non-holding category', async () => {
      const regularCategory = await prisma.category.findFirst({
        where: { isHolding: false },
      })

      const request = new NextRequest('http://localhost/api/v1/holdings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId: regularCategory!.id,
          symbol: 'AAPL',
          quantity: 10,
          averageCost: 150,
          currency: 'USD',
        }),
      })

      const response = await CreateHolding(request)
      expect(response.status).toBe(400)
    })

    it('returns 400 with malformed JSON', async () => {
      const request = new NextRequest('http://localhost/api/v1/holdings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      const response = await CreateHolding(request)
      expect(response.status).toBe(400)
    })
  })

  describe('PUT /api/v1/holdings/[id]', () => {
    let holdingId: string

    beforeEach(async () => {
      const holding = await (prisma as any).holding.create({
        data: {
          accountId,
          categoryId: holdingCategoryId,
          symbol: 'TSUPD',
          quantity: 10,
          averageCost: 150,
          currency: 'USD',
        },
      })
      holdingId = holding.id
    })

    it('updates holding with valid JWT', async () => {
      const request = new NextRequest(`http://localhost/api/v1/holdings/${holdingId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantity: 20,
          averageCost: 160.0,
          notes: 'Updated notes',
        }),
      })

      const response = await UpdateHolding(request, { params: Promise.resolve({ id: holdingId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(holdingId)

      // Verify holding was updated
      const holding = await (prisma as any).holding.findUnique({ where: { id: holdingId } })
      expect(holding.quantity.toNumber()).toBe(20)
      expect(holding.averageCost.toNumber()).toBe(160)
    })

    it('returns 404 for non-existent holding', async () => {
      const request = new NextRequest('http://localhost/api/v1/holdings/nonexistent', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantity: 20,
          averageCost: 160,
        }),
      })

      const response = await UpdateHolding(request, { params: Promise.resolve({ id: 'nonexistent' }) })
      expect(response.status).toBe(404)
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest(`http://localhost/api/v1/holdings/${holdingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: 20,
          averageCost: 160,
        }),
      })

      const response = await UpdateHolding(request, { params: Promise.resolve({ id: holdingId }) })
      expect(response.status).toBe(401)
    })

    it('returns 400 with invalid data', async () => {
      const request = new NextRequest(`http://localhost/api/v1/holdings/${holdingId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantity: -10, // Invalid negative quantity
          averageCost: 160,
        }),
      })

      const response = await UpdateHolding(request, { params: Promise.resolve({ id: holdingId }) })
      expect(response.status).toBe(400)
    })

    it('returns 400 with malformed JSON', async () => {
      const request = new NextRequest(`http://localhost/api/v1/holdings/${holdingId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      const response = await UpdateHolding(request, { params: Promise.resolve({ id: holdingId }) })
      expect(response.status).toBe(400)
    })
  })

  describe('DELETE /api/v1/holdings/[id]', () => {
    let holdingId: string

    beforeEach(async () => {
      const holding = await (prisma as any).holding.create({
        data: {
          accountId,
          categoryId: holdingCategoryId,
          symbol: 'TSDEL',
          quantity: 10,
          averageCost: 150,
          currency: 'USD',
        },
      })
      holdingId = holding.id
    })

    it('deletes holding with valid JWT', async () => {
      const request = new NextRequest(`http://localhost/api/v1/holdings/${holdingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await DeleteHolding(request, { params: Promise.resolve({ id: holdingId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(holdingId)

      // Verify holding was deleted
      const holding = await (prisma as any).holding.findUnique({ where: { id: holdingId } })
      expect(holding).toBeNull()
    })

    it('returns 404 for non-existent holding', async () => {
      const request = new NextRequest('http://localhost/api/v1/holdings/nonexistent', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await DeleteHolding(request, { params: Promise.resolve({ id: 'nonexistent' }) })
      expect(response.status).toBe(404)
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest(`http://localhost/api/v1/holdings/${holdingId}`, {
        method: 'DELETE',
      })

      const response = await DeleteHolding(request, { params: Promise.resolve({ id: holdingId }) })
      expect(response.status).toBe(401)
    })

    it('returns 404 for unauthorized account access (no information leakage)', async () => {
      // Create holding for other account
      const otherHolding = await (prisma as any).holding.create({
        data: {
          accountId: otherAccountId,
          categoryId: holdingCategoryId,
          symbol: 'TSOTH',
          quantity: 10,
          averageCost: 150,
          currency: 'USD',
        },
      })

      const request = new NextRequest(`http://localhost/api/v1/holdings/${otherHolding.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      // Returns 404 instead of 403 to avoid leaking existence info
      const response = await DeleteHolding(request, { params: Promise.resolve({ id: otherHolding.id }) })
      expect(response.status).toBe(404)
    })
  })

  describe('POST /api/v1/holdings/refresh', () => {
    beforeEach(async () => {
      // Create a holding to refresh
      await (prisma as any).holding.create({
        data: {
          accountId,
          categoryId: holdingCategoryId,
          symbol: 'TSREF',
          quantity: 10,
          averageCost: 150,
          currency: 'USD',
        },
      })
    })

    it('refreshes prices with valid JWT', async () => {
      const request = new NextRequest('http://localhost/api/v1/holdings/refresh', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
        }),
      })

      const response = await RefreshPrices(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.updated).toBeDefined()
      expect(data.data.skipped).toBeDefined()
      expect(data.data.errors).toBeDefined()
    })

    it('returns empty result for account with no holdings', async () => {
      // Use authorized account but ensure it has no holdings
      await (prisma as any).holding.deleteMany({
        where: { accountId },
      })

      const request = new NextRequest('http://localhost/api/v1/holdings/refresh', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
        }),
      })

      const response = await RefreshPrices(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.updated).toBe(0)
      expect(data.data.skipped).toBe(0)
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest('http://localhost/api/v1/holdings/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
        }),
      })

      const response = await RefreshPrices(request)
      expect(response.status).toBe(401)
    })

    it('returns 403 for unauthorized account access', async () => {
      const request = new NextRequest('http://localhost/api/v1/holdings/refresh', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: otherAccountId,
        }),
      })

      const response = await RefreshPrices(request)
      expect(response.status).toBe(403)
    })

    it('returns 400 with missing accountId', async () => {
      const request = new NextRequest('http://localhost/api/v1/holdings/refresh', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      const response = await RefreshPrices(request)
      expect(response.status).toBe(400)
    })

    it('returns 400 with malformed JSON', async () => {
      const request = new NextRequest('http://localhost/api/v1/holdings/refresh', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      const response = await RefreshPrices(request)
      expect(response.status).toBe(400)
    })
  })
})
