import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH as UpdateCurrency } from '@/app/api/v1/users/me/currency/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import { getApiTestUser, TEST_USER_ID } from './helpers'

describe('PATCH /api/v1/users/me/currency', () => {
  let validToken: string

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing!'
    resetEnvCache()
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')

    await getApiTestUser()

    // Reset to USD before each test
    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { preferredCurrency: 'USD' },
    })
  })

  afterEach(async () => {
    // Reset to USD after each test
    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { preferredCurrency: 'USD' },
    })
  })

  it('updates currency with valid JWT', async () => {
    const request = new NextRequest('http://localhost/api/v1/users/me/currency', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currency: 'EUR',
      }),
    })

    const response = await UpdateCurrency(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.currency).toBe('EUR')

    // Verify in database
    const user = await prisma.user.findUnique({
      where: { id: TEST_USER_ID },
      select: { preferredCurrency: true },
    })

    expect(user?.preferredCurrency).toBe('EUR')
  })

  it('updates currency to ILS', async () => {
    const request = new NextRequest('http://localhost/api/v1/users/me/currency', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currency: 'ILS',
      }),
    })

    const response = await UpdateCurrency(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.currency).toBe('ILS')

    // Verify in database
    const user = await prisma.user.findUnique({
      where: { id: TEST_USER_ID },
      select: { preferredCurrency: true },
    })

    expect(user?.preferredCurrency).toBe('ILS')
  })

  it('can change currency multiple times', async () => {
    // First change to EUR
    const request1 = new NextRequest('http://localhost/api/v1/users/me/currency', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currency: 'EUR',
      }),
    })

    await UpdateCurrency(request1)

    // Then change to ILS
    const request2 = new NextRequest('http://localhost/api/v1/users/me/currency', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currency: 'ILS',
      }),
    })

    const response2 = await UpdateCurrency(request2)
    const data2 = await response2.json()

    expect(response2.status).toBe(200)
    expect(data2.data.currency).toBe('ILS')

    // Verify final state
    const user = await prisma.user.findUnique({
      where: { id: TEST_USER_ID },
      select: { preferredCurrency: true },
    })

    expect(user?.preferredCurrency).toBe('ILS')
  })

  it('returns 401 with missing token', async () => {
    const request = new NextRequest('http://localhost/api/v1/users/me/currency', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency: 'EUR',
      }),
    })

    const response = await UpdateCurrency(request)
    expect(response.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const request = new NextRequest('http://localhost/api/v1/users/me/currency', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer invalid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currency: 'EUR',
      }),
    })

    const response = await UpdateCurrency(request)
    expect(response.status).toBe(401)
  })

  it('returns 401 with malformed Authorization header', async () => {
    const request = new NextRequest('http://localhost/api/v1/users/me/currency', {
      method: 'PATCH',
      headers: {
        Authorization: 'InvalidFormat',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currency: 'EUR',
      }),
    })

    const response = await UpdateCurrency(request)
    expect(response.status).toBe(401)
  })

  it('returns 400 with malformed JSON', async () => {
    const request = new NextRequest('http://localhost/api/v1/users/me/currency', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: 'invalid json',
    })

    const response = await UpdateCurrency(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with missing currency field', async () => {
    const request = new NextRequest('http://localhost/api/v1/users/me/currency', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    const response = await UpdateCurrency(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with invalid currency code', async () => {
    const request = new NextRequest('http://localhost/api/v1/users/me/currency', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currency: 'INVALID',
      }),
    })

    const response = await UpdateCurrency(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with empty currency string', async () => {
    const request = new NextRequest('http://localhost/api/v1/users/me/currency', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currency: '',
      }),
    })

    const response = await UpdateCurrency(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with null currency', async () => {
    const request = new NextRequest('http://localhost/api/v1/users/me/currency', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currency: null,
      }),
    })

    const response = await UpdateCurrency(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with currency as number', async () => {
    const request = new NextRequest('http://localhost/api/v1/users/me/currency', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currency: 123,
      }),
    })

    const response = await UpdateCurrency(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with lowercase currency code', async () => {
    const request = new NextRequest('http://localhost/api/v1/users/me/currency', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currency: 'usd',
      }),
    })

    const response = await UpdateCurrency(request)
    expect(response.status).toBe(400)
  })

  it('does not require subscription (no requireSubscription flag)', async () => {
    // Note: This endpoint doesn't require subscription unlike others
    // This is intentional for currency updates, but let's verify behavior
    await prisma.subscription.update({
      where: { userId: TEST_USER_ID },
      data: { status: 'EXPIRED' },
    })

    const request = new NextRequest('http://localhost/api/v1/users/me/currency', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currency: 'EUR',
      }),
    })

    const response = await UpdateCurrency(request)
    // Should succeed because requireSubscription is not set
    expect(response.status).toBe(200)

    // Reset subscription for other tests
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)
    await prisma.subscription.update({
      where: { userId: TEST_USER_ID },
      data: { status: 'TRIALING', trialEndsAt },
    })
  })
})
