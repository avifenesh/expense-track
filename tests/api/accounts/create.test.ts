import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as CreateAccount } from '@/app/api/v1/accounts/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import { getApiTestUser, TEST_USER_ID, OTHER_USER_ID, getOtherTestUser } from '../v1/helpers'

describe('POST /api/v1/accounts', () => {
  let validToken: string

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing!'
    resetEnvCache()
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')

    // Ensure test user exists
    await getApiTestUser()
  })

  afterEach(async () => {
    await prisma.account.deleteMany({
      where: { name: { contains: 'TEST_' } },
    })
  })

  it('creates account with valid JWT and all fields', async () => {
    const request = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_NewAccount',
        type: 'SELF',
        color: '#FF5500',
        preferredCurrency: 'EUR',
      }),
    })

    const response = await CreateAccount(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.id).toBeTruthy()
    expect(data.data.name).toBe('TEST_NewAccount')
    expect(data.data.type).toBe('SELF')
    expect(data.data.color).toBe('#FF5500')
    expect(data.data.preferredCurrency).toBe('EUR')
  })

  it('creates account with minimum required fields', async () => {
    const request = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_MinimalAccount',
        type: 'PARTNER',
      }),
    })

    const response = await CreateAccount(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.name).toBe('TEST_MinimalAccount')
    expect(data.data.type).toBe('PARTNER')
    expect(data.data.color).toBeNull()
    expect(data.data.preferredCurrency).toBeNull()
  })

  it('creates account with OTHER type', async () => {
    const request = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_OtherAccount',
        type: 'OTHER',
        preferredCurrency: 'ILS',
      }),
    })

    const response = await CreateAccount(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.data.type).toBe('OTHER')
    expect(data.data.preferredCurrency).toBe('ILS')
  })

  it('returns 401 with missing token', async () => {
    const request = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'TEST_Account',
        type: 'SELF',
      }),
    })

    const response = await CreateAccount(request)
    expect(response.status).toBe(401)
  })

  it('returns 400 with missing name', async () => {
    const request = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'SELF',
      }),
    })

    const response = await CreateAccount(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with missing type', async () => {
    const request = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_NoType',
      }),
    })

    const response = await CreateAccount(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with invalid type', async () => {
    const request = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_InvalidType',
        type: 'INVALID',
      }),
    })

    const response = await CreateAccount(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with name too long', async () => {
    const request = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'T'.repeat(51),
        type: 'SELF',
      }),
    })

    const response = await CreateAccount(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with empty name', async () => {
    const request = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '',
        type: 'SELF',
      }),
    })

    const response = await CreateAccount(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with invalid color format', async () => {
    const request = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_BadColor',
        type: 'SELF',
        color: 'not-a-color',
      }),
    })

    const response = await CreateAccount(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with invalid currency', async () => {
    const request = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_BadCurrency',
        type: 'SELF',
        preferredCurrency: 'GBP',
      }),
    })

    const response = await CreateAccount(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 for duplicate account name', async () => {
    // First create
    const firstRequest = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_Duplicate',
        type: 'SELF',
      }),
    })
    await CreateAccount(firstRequest)

    // Try duplicate
    const duplicateRequest = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_Duplicate',
        type: 'PARTNER',
      }),
    })

    const response = await CreateAccount(duplicateRequest)
    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.fields?.name).toContain('An account with this name already exists')
  })

  it('allows same name for different users', async () => {
    // Create account for first user
    const firstRequest = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_SameName',
        type: 'SELF',
      }),
    })
    await CreateAccount(firstRequest)

    // Create account for second user
    await getOtherTestUser()
    const otherToken = generateAccessToken(OTHER_USER_ID, 'api-other@example.com')
    const secondRequest = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${otherToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_SameName',
        type: 'SELF',
      }),
    })

    const response = await CreateAccount(secondRequest)
    expect(response.status).toBe(201)
  })

  it('returns 400 with malformed JSON', async () => {
    const request = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: 'invalid json',
    })

    const response = await CreateAccount(request)
    expect(response.status).toBe(400)
  })

  it('accepts null for optional color field', async () => {
    const request = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_NullColor',
        type: 'SELF',
        color: null,
      }),
    })

    const response = await CreateAccount(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.data.color).toBeNull()
  })

  it('accepts null for optional preferredCurrency field', async () => {
    const request = new NextRequest('http://localhost/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_NullCurrency',
        type: 'SELF',
        preferredCurrency: null,
      }),
    })

    const response = await CreateAccount(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.data.preferredCurrency).toBeNull()
  })
})
