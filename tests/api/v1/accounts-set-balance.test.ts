import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as SetBalance } from '@/app/api/v1/accounts/[id]/set-balance/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import { getApiTestUser, getOtherTestUser, TEST_USER_ID } from './helpers'
import { TransactionType, Currency } from '@prisma/client'

describe('POST /api/v1/accounts/[id]/set-balance', () => {
  let validToken: string
  let accountId: string
  let otherAccountId: string
  let deletedAccountId: string
  let categoryId: string

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
      where: { userId_name: { userId: testUser.id, name: 'SetBalanceTestAccount' } },
      update: { deletedAt: null },
      create: { userId: testUser.id, name: 'SetBalanceTestAccount', type: 'SELF' },
    })

    // Create account owned by OTHER user (test user should NOT have access)
    const otherAccount = await prisma.account.upsert({
      where: { userId_name: { userId: otherTestUser.id, name: 'OtherSetBalanceAccount' } },
      update: {},
      create: { userId: otherTestUser.id, name: 'OtherSetBalanceAccount', type: 'SELF' },
    })

    // Create soft-deleted account owned by test user
    const deletedAccount = await prisma.account.upsert({
      where: { userId_name: { userId: testUser.id, name: 'DeletedSetBalanceAccount' } },
      update: { deletedAt: new Date() },
      create: {
        userId: testUser.id,
        name: 'DeletedSetBalanceAccount',
        type: 'SELF',
        deletedAt: new Date(),
      },
    })

    // Create a category for transactions
    const category = await prisma.category.upsert({
      where: { userId_name_type: { userId: testUser.id, name: 'TestExpenseCategory', type: TransactionType.EXPENSE } },
      update: {},
      create: { userId: testUser.id, name: 'TestExpenseCategory', type: TransactionType.EXPENSE },
    })

    accountId = account.id
    otherAccountId = otherAccount.id
    deletedAccountId = deletedAccount.id
    categoryId = category.id

    // Clean up any existing transactions for this account in test month
    await prisma.transaction.deleteMany({
      where: {
        accountId,
        month: new Date(Date.UTC(2024, 0, 1)),
      },
    })
  })

  afterEach(async () => {
    // Clean up transactions created during tests
    await prisma.transaction.deleteMany({
      where: {
        accountId,
        description: 'Balance adjustment',
      },
    })
  })

  it('returns 401 when no authorization header', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetBalance: 1000, monthKey: '2024-01' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Missing authorization token')
  })

  it('returns 401 when JWT is invalid', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 1000, monthKey: '2024-01' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Invalid token')
  })

  it('returns 404 when account does not exist', async () => {
    const fakeAccountId = 'fake-account-id-xyz'
    const request = new NextRequest(`http://localhost/api/v1/accounts/${fakeAccountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 1000, monthKey: '2024-01' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: fakeAccountId }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Account not found')
  })

  it('returns 404 when account belongs to another user', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${otherAccountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 1000, monthKey: '2024-01' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: otherAccountId }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Account not found')
  })

  it('returns 404 when account is soft-deleted', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${deletedAccountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 1000, monthKey: '2024-01' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: deletedAccountId }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Account not found')
  })

  it('returns 400 for invalid JSON body', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: 'not valid json',
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.fields.body).toContain('Invalid JSON')
  })

  it('returns 400 for missing monthKey', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 1000 }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.fields.monthKey).toBeDefined()
  })

  it('returns 400 for invalid monthKey format (too short)', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 1000, monthKey: '24-1' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.fields.monthKey).toBeDefined()
  })

  it('returns 400 for invalid month number (2024-13)', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 1000, monthKey: '2024-13' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.fields.monthKey).toBeDefined()
  })

  it('returns 400 for invalid month number (2024-00)', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 1000, monthKey: '2024-00' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.fields.monthKey).toBeDefined()
  })

  it('returns 400 for invalid currency', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 1000, monthKey: '2024-01', currency: 'INVALID' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.fields.currency).toBeDefined()
  })

  it('creates positive adjustment (INCOME) when target is higher than current', async () => {
    // Create an expense transaction to establish a negative net
    await prisma.transaction.create({
      data: {
        accountId,
        categoryId,
        type: TransactionType.EXPENSE,
        amount: 500,
        currency: Currency.USD,
        date: new Date(Date.UTC(2024, 0, 15)),
        month: new Date(Date.UTC(2024, 0, 1)),
        description: 'Test expense',
        isRecurring: false,
      },
    })

    // Current net: -500, target: 200, adjustment should be +700
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 200, monthKey: '2024-01' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.adjustment).toBe(700)
    expect(data.data.transaction.type).toBe('INCOME')
    expect(data.data.transaction.amount).toBe('700.00')
  })

  it('creates negative adjustment (EXPENSE) when target is lower than current', async () => {
    // Create an income transaction to establish a positive net
    await prisma.transaction.create({
      data: {
        accountId,
        categoryId,
        type: TransactionType.INCOME,
        amount: 1000,
        currency: Currency.USD,
        date: new Date(Date.UTC(2024, 0, 15)),
        month: new Date(Date.UTC(2024, 0, 1)),
        description: 'Test income',
        isRecurring: false,
      },
    })

    // Current net: 1000, target: 300, adjustment should be -700
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 300, monthKey: '2024-01' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.adjustment).toBe(-700)
    expect(data.data.transaction.type).toBe('EXPENSE')
    expect(data.data.transaction.amount).toBe('700.00')
  })

  it('returns adjustment 0 when target equals current net', async () => {
    // Create a transaction with known amount
    await prisma.transaction.create({
      data: {
        accountId,
        categoryId,
        type: TransactionType.INCOME,
        amount: 500,
        currency: Currency.USD,
        date: new Date(Date.UTC(2024, 0, 15)),
        month: new Date(Date.UTC(2024, 0, 1)),
        description: 'Test income',
        isRecurring: false,
      },
    })

    // Current net: 500, target: 500, no adjustment needed
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 500, monthKey: '2024-01' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.adjustment).toBe(0)
    expect(data.data.transaction).toBeUndefined()
  })

  it('creates Balance Adjustment category if it does not exist', async () => {
    // Delete any existing Balance Adjustment category
    await prisma.category.deleteMany({
      where: { userId: TEST_USER_ID, name: 'Balance Adjustment' },
    })

    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 100, monthKey: '2024-01' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)

    // Verify category was created
    const category = await prisma.category.findFirst({
      where: { userId: TEST_USER_ID, name: 'Balance Adjustment' },
    })
    expect(category).not.toBeNull()
    expect(category?.type).toBe(TransactionType.INCOME)
  })

  it('uses existing Balance Adjustment category', async () => {
    // Ensure Balance Adjustment category exists
    const existingCategory = await prisma.category.upsert({
      where: { userId_name_type: { userId: TEST_USER_ID, name: 'Balance Adjustment', type: TransactionType.INCOME } },
      update: {},
      create: { userId: TEST_USER_ID, name: 'Balance Adjustment', type: TransactionType.INCOME },
    })

    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 100, monthKey: '2024-01' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)

    // Verify transaction uses existing category
    const transaction = await prisma.transaction.findFirst({
      where: { id: data.data.transaction.id },
    })
    expect(transaction?.categoryId).toBe(existingCategory.id)
  })

  it('handles different currency types', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 100, monthKey: '2024-01', currency: 'EUR' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.transaction.currency).toBe('EUR')
  })

  it('handles negative target balance', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: -500, monthKey: '2024-01' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.adjustment).toBe(-500)
    expect(data.data.transaction.type).toBe('EXPENSE')
    expect(data.data.transaction.amount).toBe('500.00')
  })

  it('handles zero target balance with existing transactions', async () => {
    // Create an income transaction
    await prisma.transaction.create({
      data: {
        accountId,
        categoryId,
        type: TransactionType.INCOME,
        amount: 200,
        currency: Currency.USD,
        date: new Date(Date.UTC(2024, 0, 15)),
        month: new Date(Date.UTC(2024, 0, 1)),
        description: 'Test income',
        isRecurring: false,
      },
    })

    // Current net: 200, target: 0, adjustment should be -200
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 0, monthKey: '2024-01' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.adjustment).toBe(-200)
    expect(data.data.transaction.type).toBe('EXPENSE')
  })

  it('handles decimal target balance', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 123.45, monthKey: '2024-01' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.adjustment).toBe(123.45)
    expect(data.data.transaction.amount).toBe('123.45')
  })

  it('returns 400 for Infinity targetBalance', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: Infinity, monthKey: '2024-01' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.fields.targetBalance).toBeDefined()
  })

  it('returns 400 for string targetBalance', async () => {
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 'not-a-number', monthKey: '2024-01' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.fields.targetBalance).toBeDefined()
  })

  it('creates EXPENSE category for negative adjustment', async () => {
    // Create an income transaction to establish a positive net
    await prisma.transaction.create({
      data: {
        accountId,
        categoryId,
        type: TransactionType.INCOME,
        amount: 1000,
        currency: Currency.USD,
        date: new Date(Date.UTC(2024, 0, 15)),
        month: new Date(Date.UTC(2024, 0, 1)),
        description: 'Test income',
        isRecurring: false,
      },
    })

    // Delete any existing Balance Adjustment categories to test fresh creation
    await prisma.category.deleteMany({
      where: { userId: TEST_USER_ID, name: 'Balance Adjustment' },
    })

    // Current net: 1000, target: 300, adjustment should be -700 (EXPENSE)
    const request = new NextRequest(`http://localhost/api/v1/accounts/${accountId}/set-balance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetBalance: 300, monthKey: '2024-01' }),
    })

    const response = await SetBalance(request, { params: Promise.resolve({ id: accountId }) })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.transaction.type).toBe('EXPENSE')

    // Verify the Balance Adjustment category was created with EXPENSE type
    const expenseCategory = await prisma.category.findFirst({
      where: { userId: TEST_USER_ID, name: 'Balance Adjustment', type: TransactionType.EXPENSE },
    })
    expect(expenseCategory).not.toBeNull()

    // Verify transaction uses this EXPENSE category
    const transaction = await prisma.transaction.findFirst({
      where: { id: data.data.transaction.id },
    })
    expect(transaction?.categoryId).toBe(expenseCategory!.id)
  })
})
