import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PUT as UpdateAccount } from '@/app/api/v1/accounts/[id]/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import { getApiTestUser, TEST_USER_ID, OTHER_USER_ID, getOtherTestUser } from '../v1/helpers'

describe('PUT /api/v1/accounts/[id] - Extended fields', () => {
  let validToken: string
  let testUserId: string
  let accountId: string

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing!'
    resetEnvCache()
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')

    const testUser = await getApiTestUser()
    testUserId = testUser.id

    // Create a test account to update
    const account = await prisma.account.create({
      data: {
        userId: testUserId,
        name: 'TEST_ToUpdate',
        type: 'SELF',
        color: '#FF0000',
        preferredCurrency: 'USD',
      },
    })
    accountId = account.id
  })

  afterEach(async () => {
    await prisma.account.deleteMany({
      where: { name: { contains: 'TEST_' } },
    })
  })

  it('updates account name only', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_UpdatedName',
      }),
    })

    const response = await UpdateAccount(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.name).toBe('TEST_UpdatedName')
    expect(data.data.type).toBe('SELF')
    expect(data.data.color).toBe('#FF0000')
    expect(data.data.preferredCurrency).toBe('USD')
  })

  it('updates account type', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_ToUpdate',
        type: 'PARTNER',
      }),
    })

    const response = await UpdateAccount(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.type).toBe('PARTNER')
  })

  it('updates account color', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_ToUpdate',
        color: '#00FF00',
      }),
    })

    const response = await UpdateAccount(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.color).toBe('#00FF00')
  })

  it('clears color by setting null', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_ToUpdate',
        color: null,
      }),
    })

    const response = await UpdateAccount(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.color).toBeNull()
  })

  it('updates preferredCurrency', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_ToUpdate',
        preferredCurrency: 'EUR',
      }),
    })

    const response = await UpdateAccount(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.preferredCurrency).toBe('EUR')
  })

  it('clears preferredCurrency by setting null', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_ToUpdate',
        preferredCurrency: null,
      }),
    })

    const response = await UpdateAccount(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.preferredCurrency).toBeNull()
  })

  it('updates all fields at once', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_FullUpdate',
        type: 'OTHER',
        color: '#0000FF',
        preferredCurrency: 'ILS',
      }),
    })

    const response = await UpdateAccount(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.name).toBe('TEST_FullUpdate')
    expect(data.data.type).toBe('OTHER')
    expect(data.data.color).toBe('#0000FF')
    expect(data.data.preferredCurrency).toBe('ILS')
  })

  it('returns 400 with invalid type', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_ToUpdate',
        type: 'INVALID',
      }),
    })

    const response = await UpdateAccount(request, { params: Promise.resolve({ id: accountId }) })
    expect(response.status).toBe(400)
  })

  it('returns 400 with invalid color format', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_ToUpdate',
        color: 'not-a-color',
      }),
    })

    const response = await UpdateAccount(request, { params: Promise.resolve({ id: accountId }) })
    expect(response.status).toBe(400)
  })

  it('returns 400 with invalid currency', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_ToUpdate',
        preferredCurrency: 'GBP',
      }),
    })

    const response = await UpdateAccount(request, { params: Promise.resolve({ id: accountId }) })
    expect(response.status).toBe(400)
  })

  it('returns 404 for non-existent account', async () => {
    const request = new NextRequest('http://localhost/api/v1/accounts/nonexistent', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_Updated',
      }),
    })

    const response = await UpdateAccount(request, { params: Promise.resolve({ id: 'nonexistent' }) })
    expect(response.status).toBe(404)
  })

  it('returns 404 for account owned by another user', async () => {
    // Create account for other user
    await getOtherTestUser()
    const otherAccount = await prisma.account.create({
      data: {
        userId: OTHER_USER_ID,
        name: 'TEST_OtherUserAccount',
        type: 'SELF',
      },
    })

    const request = new NextRequest(`http://localhost/api/v1/accounts/${otherAccount.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TEST_Hacked',
      }),
    })

    const response = await UpdateAccount(request, { params: Promise.resolve({ id: otherAccount.id }) })
    expect(response.status).toBe(404)
  })

  it('returns 401 with missing token', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'TEST_Updated',
      }),
    })

    const response = await UpdateAccount(request, { params: Promise.resolve({ id: accountId }) })
    expect(response.status).toBe(401)
  })
})
