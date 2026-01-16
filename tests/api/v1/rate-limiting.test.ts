import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as transactionsPost } from '@/app/api/v1/transactions/route'
import { POST as refreshPost } from '@/app/api/v1/auth/refresh/route'
import { POST as holdingsPost } from '@/app/api/v1/holdings/route'
import { generateAccessToken, generateRefreshToken } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import { resetAllRateLimits } from '@/lib/rate-limit'
import { getApiTestUser, TEST_USER_ID } from './helpers'

describe('API Rate Limiting Integration', () => {
  let validToken: string
  let refreshToken: string
  let testAccountId: string
  let testUserId: string

  beforeEach(async () => {
    vi.useFakeTimers()
    resetAllRateLimits()

    // Get test user for userId foreign keys
    const testUser = await getApiTestUser()
    testUserId = testUser.id

    // Generate test JWT token using the actual test user ID
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')

    // Create refresh token for testing
    const { token, jti, expiresAt } = generateRefreshToken(TEST_USER_ID, 'api-test@example.com')
    refreshToken = token
    await prisma.refreshToken.create({
      data: { jti, userId: testUser.id, email: 'api-test@example.com', expiresAt },
    })

    // Setup test account
    testAccountId = 'test-account-rate-limit'
    await prisma.account.upsert({
      where: { id: testAccountId },
      update: {},
      create: {
        id: testAccountId,
        userId: testUser.id,
        name: 'Avi Checking Rate Limit Test',
        type: 'SELF',
        preferredCurrency: 'ILS',
      },
    })
  })

  afterEach(async () => {
    vi.useRealTimers()
    resetAllRateLimits()

    // Cleanup test data
    await prisma.transaction.deleteMany({
      where: { description: { contains: 'RATE_LIMIT_TEST' } },
    })
    await prisma.refreshToken.deleteMany({
      where: { email: 'avi@example.com' },
    })
  })

  describe('transactions endpoint', () => {
    it('allows 100 requests within limit', async () => {
      const categoryId = 'test-category-id'

      // Setup test category with unique name
      await prisma.category.upsert({
        where: { id: categoryId },
        update: {},
        create: {
          id: categoryId,
          userId: testUserId,
          name: 'Test Category Rate Limit 1',
          type: 'EXPENSE',
        },
      })

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        const request = new NextRequest('http://localhost/api/v1/transactions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountId: testAccountId,
            categoryId,
            amount: 10,
            currency: 'ILS',
            type: 'EXPENSE',
            date: new Date().toISOString(),
            description: `RATE_LIMIT_TEST ${i}`,
          }),
        })

        const response = await transactionsPost(request)
        expect(response.status).not.toBe(429)
      }
    })

    it('blocks 101st request with 429', async () => {
      const categoryId = 'test-category-id-2'

      await prisma.category.upsert({
        where: { id: categoryId },
        update: {},
        create: {
          id: categoryId,
          userId: testUserId,
          name: 'Test Category Rate Limit 2',
          type: 'EXPENSE',
        },
      })

      // Make 100 requests (fill the quota)
      for (let i = 0; i < 100; i++) {
        const request = new NextRequest('http://localhost/api/v1/transactions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountId: testAccountId,
            categoryId,
            amount: 10,
            currency: 'ILS',
            type: 'EXPENSE',
            date: new Date().toISOString(),
            description: `RATE_LIMIT_TEST ${i}`,
          }),
        })

        await transactionsPost(request)
      }

      // 101st request should return 429
      const request = new NextRequest('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: testAccountId,
          categoryId,
          amount: 10,
          currency: 'ILS',
          type: 'EXPENSE',
          date: new Date().toISOString(),
          description: 'RATE_LIMIT_TEST 101',
        }),
      })

      const response = await transactionsPost(request)
      expect(response.status).toBe(429)

      const data = await response.json()
      expect(data.error).toBe('Rate limit exceeded')
    })

    it('includes Retry-After header on 429 response', async () => {
      const categoryId = 'test-category-id-3'

      await prisma.category.upsert({
        where: { id: categoryId },
        update: {},
        create: {
          id: categoryId,
          userId: testUserId,
          name: 'Test Category Rate Limit 3',
          type: 'EXPENSE',
        },
      })

      // Fill quota
      for (let i = 0; i < 100; i++) {
        await transactionsPost(
          new NextRequest('http://localhost/api/v1/transactions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${validToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              accountId: testAccountId,
              categoryId,
              amount: 10,
              currency: 'ILS',
              type: 'EXPENSE',
              date: new Date().toISOString(),
              description: `RATE_LIMIT_TEST ${i}`,
            }),
          }),
        )
      }

      // Make rate-limited request
      const response = await transactionsPost(
        new NextRequest('http://localhost/api/v1/transactions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountId: testAccountId,
            categoryId,
            amount: 10,
            currency: 'ILS',
            type: 'EXPENSE',
            date: new Date().toISOString(),
            description: 'RATE_LIMIT_TEST 101',
          }),
        }),
      )

      expect(response.status).toBe(429)
      const retryAfter = response.headers.get('Retry-After')
      expect(retryAfter).toBeTruthy()
      expect(Number(retryAfter)).toBeGreaterThan(0)
      expect(Number(retryAfter)).toBeLessThanOrEqual(60)
    })

    it('resets after time window expires', async () => {
      const categoryId = 'test-category-id-4'

      await prisma.category.upsert({
        where: { id: categoryId },
        update: {},
        create: {
          id: categoryId,
          userId: testUserId,
          name: 'Test Category Rate Limit 4',
          type: 'EXPENSE',
        },
      })

      // Fill quota
      for (let i = 0; i < 100; i++) {
        await transactionsPost(
          new NextRequest('http://localhost/api/v1/transactions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${validToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              accountId: testAccountId,
              categoryId,
              amount: 10,
              currency: 'ILS',
              type: 'EXPENSE',
              date: new Date().toISOString(),
              description: `RATE_LIMIT_TEST ${i}`,
            }),
          }),
        )
      }

      // Should be rate limited
      let response = await transactionsPost(
        new NextRequest('http://localhost/api/v1/transactions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountId: testAccountId,
            categoryId,
            amount: 10,
            currency: 'ILS',
            type: 'EXPENSE',
            date: new Date().toISOString(),
            description: 'RATE_LIMIT_TEST blocked',
          }),
        }),
      )
      expect(response.status).toBe(429)

      // Advance time by 61 seconds
      vi.advanceTimersByTime(61 * 1000)

      // Should be allowed again
      response = await transactionsPost(
        new NextRequest('http://localhost/api/v1/transactions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountId: testAccountId,
            categoryId,
            amount: 10,
            currency: 'ILS',
            type: 'EXPENSE',
            date: new Date().toISOString(),
            description: 'RATE_LIMIT_TEST after reset',
          }),
        }),
      )
      expect(response.status).not.toBe(429)
    })
  })

  describe('refresh endpoint', () => {
    it('enforces rate limit on refresh token endpoint', async () => {
      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        const request = new NextRequest('http://localhost/api/v1/auth/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        })

        const response = await refreshPost(request)

        if (response.status === 200) {
          // Update refreshToken with new one from response
          const data = await response.json()
          if (data.success && data.data.refreshToken) {
            refreshToken = data.data.refreshToken
          }
        }
      }

      // 101st request should be rate limited
      const request = new NextRequest('http://localhost/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      })

      const response = await refreshPost(request)
      expect(response.status).toBe(429)
    })
  })

  describe('holdings endpoint', () => {
    it('enforces rate limit on holdings create endpoint', async () => {
      const categoryId = 'test-holdings-category'

      await prisma.category.upsert({
        where: { id: categoryId },
        update: {},
        create: {
          id: categoryId,
          userId: testUserId,
          name: 'Test Stocks Rate Limit',
          type: 'EXPENSE',
        },
      })

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        const request = new NextRequest('http://localhost/api/v1/holdings', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountId: testAccountId,
            categoryId,
            symbol: 'AAPL',
            quantity: 1,
            purchasePrice: 150,
            purchaseCurrency: 'USD',
            purchaseDate: new Date().toISOString(),
          }),
        })

        await holdingsPost(request)
      }

      // 101st request should be rate limited
      const request = new NextRequest('http://localhost/api/v1/holdings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: testAccountId,
          categoryId,
          symbol: 'AAPL',
          quantity: 1,
          purchasePrice: 150,
          purchaseCurrency: 'USD',
          purchaseDate: new Date().toISOString(),
        }),
      })

      const response = await holdingsPost(request)
      expect(response.status).toBe(429)
    })
  })

  describe('different users', () => {
    it('tracks rate limits independently per user', async () => {
      const user1Token = generateAccessToken(TEST_USER_ID, 'api-test@example.com')
      const user2Token = generateAccessToken('other-user', 'other@example.com')

      // Create second user for rate limit testing with their own account
      const user2 = await prisma.user.upsert({
        where: { id: 'other-user' },
        update: {},
        create: {
          id: 'other-user',
          email: 'other@example.com',
          displayName: 'Other Test User',
          passwordHash: '$2b$10$placeholder',
          preferredCurrency: 'USD',
        },
      })

      const user2AccountId = 'test-account-other'
      await prisma.account.upsert({
        where: { id: user2AccountId },
        update: {},
        create: {
          id: user2AccountId,
          userId: user2.id,
          name: 'Other User Rate Limit Test',
          type: 'SELF',
          preferredCurrency: 'USD',
        },
      })

      const categoryId = 'test-category-multi-user'
      await prisma.category.upsert({
        where: { id: categoryId },
        update: {},
        create: {
          id: categoryId,
          userId: testUserId,
          name: 'Test Category Multi User',
          type: 'EXPENSE',
        },
      })

      // Create category for user2 as well
      const user2CategoryId = 'test-category-multi-user-2'
      await prisma.category.upsert({
        where: { id: user2CategoryId },
        update: {},
        create: {
          id: user2CategoryId,
          userId: user2.id,
          name: 'Test Category Multi User 2',
          type: 'EXPENSE',
        },
      })

      // User 1 makes 100 requests (fills quota)
      for (let i = 0; i < 100; i++) {
        await transactionsPost(
          new NextRequest('http://localhost/api/v1/transactions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${user1Token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              accountId: testAccountId,
              categoryId,
              amount: 10,
              currency: 'ILS',
              type: 'EXPENSE',
              date: new Date().toISOString(),
              description: `USER1_TEST ${i}`,
            }),
          }),
        )
      }

      // User 1 should be rate limited
      const user1Response = await transactionsPost(
        new NextRequest('http://localhost/api/v1/transactions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${user1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountId: testAccountId,
            categoryId,
            amount: 10,
            currency: 'ILS',
            type: 'EXPENSE',
            date: new Date().toISOString(),
            description: 'USER1_TEST blocked',
          }),
        }),
      )
      expect(user1Response.status).toBe(429)

      // User 2 should still be allowed (using their own account)
      const user2Response = await transactionsPost(
        new NextRequest('http://localhost/api/v1/transactions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${user2Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountId: user2AccountId,
            categoryId: user2CategoryId,
            amount: 10,
            currency: 'USD',
            type: 'EXPENSE',
            date: new Date().toISOString(),
            description: 'USER2_TEST allowed',
          }),
        }),
      )
      expect(user2Response.status).not.toBe(429)
    })
  })
})
