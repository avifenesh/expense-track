import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH as ActivateAccount } from '@/app/api/v1/accounts/[id]/activate/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import { getApiTestUser, getOtherTestUser, TEST_USER_ID } from './helpers'

describe('PATCH /api/v1/accounts/[id]/activate', () => {
  let validToken: string
  let accountId: string
  let otherAccountId: string
  let deletedAccountId: string

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing!'
    resetEnvCache()
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')

    // Get test user for userId foreign keys
    const testUser = await getApiTestUser()

    // Get other user for unauthorized access testing
    const otherTestUser = await getOtherTestUser()

    // Create test account owned by test user
    const account = await prisma.account.upsert({
      where: { userId_name: { userId: testUser.id, name: 'TestAccount' } },
      update: {},
      create: { userId: testUser.id, name: 'TestAccount', type: 'SELF' },
    })

    // Create account owned by OTHER user (test user should NOT have access)
    const otherAccount = await prisma.account.upsert({
      where: { userId_name: { userId: otherTestUser.id, name: 'OtherAccount' } },
      update: {},
      create: { userId: otherTestUser.id, name: 'OtherAccount', type: 'SELF' },
    })

    // Create soft-deleted account owned by test user
    const deletedAccount = await prisma.account.upsert({
      where: { userId_name: { userId: testUser.id, name: 'DeletedAccount' } },
      update: { deletedAt: new Date() },
      create: {
        userId: testUser.id,
        name: 'DeletedAccount',
        type: 'SELF',
        deletedAt: new Date(),
      },
    })

    accountId = account.id
    otherAccountId = otherAccount.id
    deletedAccountId = deletedAccount.id
  })

  afterEach(async () => {
    // Reset activeAccountId for test user
    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { activeAccountId: null },
    })
  })

  it('returns 401 when no authorization header', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/activate`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await ActivateAccount(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Missing authorization token')
  })

  it('returns 401 when JWT is invalid', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/activate`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer invalid-token',
        'Content-Type': 'application/json',
      },
    })

    const response = await ActivateAccount(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Invalid token')
  })

  it('returns 404 when account does not exist', async () => {
    const fakeAccountId = 'fake-account-id-xyz'
    const request = new NextRequest(`http://localhost/api/v1/accounts/${fakeAccountId}/activate`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    const response = await ActivateAccount(request, { params: Promise.resolve({ id: fakeAccountId }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Account not found')
  })

  it('returns 404 when account belongs to another user', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${otherAccountId}/activate`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    const response = await ActivateAccount(request, { params: Promise.resolve({ id: otherAccountId }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Account not found')
  })

  it('returns 404 when account is soft-deleted', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${deletedAccountId}/activate`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    const response = await ActivateAccount(request, { params: Promise.resolve({ id: deletedAccountId }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Account not found')
  })

  it('successfully activates account and updates user activeAccountId', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/activate`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    const response = await ActivateAccount(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.activeAccountId).toBe(accountId)

    // Verify database was updated
    const updatedUser = await prisma.user.findUnique({
      where: { id: TEST_USER_ID },
      select: { activeAccountId: true },
    })
    expect(updatedUser?.activeAccountId).toBe(accountId)
  })

  it('updates activeAccountId when changing from one account to another', async () => {
    // First activate an account
    const firstAccount = await prisma.account.upsert({
      where: { userId_name: { userId: TEST_USER_ID, name: 'FirstAccount' } },
      update: {},
      create: { userId: TEST_USER_ID, name: 'FirstAccount', type: 'SELF' },
    })

    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { activeAccountId: firstAccount.id },
    })

    // Now activate a different account
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/activate`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    const response = await ActivateAccount(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.activeAccountId).toBe(accountId)

    // Verify database was updated to new account
    const updatedUser = await prisma.user.findUnique({
      where: { id: TEST_USER_ID },
      select: { activeAccountId: true },
    })
    expect(updatedUser?.activeAccountId).toBe(accountId)
  })
})
