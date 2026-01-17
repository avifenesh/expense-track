import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as GetTransactions, POST as CreateTransaction } from '@/app/api/v1/transactions/route'
import { PUT as UpdateTransaction, DELETE as DeleteTransaction } from '@/app/api/v1/transactions/[id]/route'
import { POST as CreateRequest } from '@/app/api/v1/transactions/requests/route'
import { POST as ApproveRequest } from '@/app/api/v1/transactions/requests/[id]/approve/route'
import { POST as RejectRequest } from '@/app/api/v1/transactions/requests/[id]/reject/route'
import { generateAccessToken } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import { getApiTestUser, TEST_USER_ID } from './helpers'

describe('Transaction API Routes', () => {
  let validToken: string
  let accountId: string
  let otherAccountId: string
  let categoryId: string

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing'
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')

    // Get test user for userId foreign keys
    const testUser = await getApiTestUser()

    // Create approver user for transaction request approval tests
    // This user owns the approver account and can approve/reject requests
    const approverUser = await prisma.user.upsert({
      where: { id: 'approver-user' },
      update: {},
      create: {
        id: 'approver-user',
        email: 'approver@example.com',
        displayName: 'Approver Test User',
        passwordHash: '$2b$10$placeholder',
        preferredCurrency: 'USD',
      },
    })

    // Upsert test accounts and category (atomic, no race condition)
    const account = await prisma.account.upsert({
      where: { userId_name: { userId: testUser.id, name: 'TestAccount' } },
      update: {},
      create: { userId: testUser.id, name: 'TestAccount', type: 'SELF' },
    })

    // Other account belongs to approver user - for request approval tests
    const otherAccount = await prisma.account.upsert({
      where: { userId_name: { userId: approverUser.id, name: 'ApproverAccount' } },
      update: {},
      create: { userId: approverUser.id, name: 'ApproverAccount', type: 'SELF' },
    })

    const category = await prisma.category.upsert({
      where: { userId_name_type: { userId: testUser.id, name: 'TEST_TransactionCategory', type: 'EXPENSE' } },
      update: {},
      create: { userId: testUser.id, name: 'TEST_TransactionCategory', type: 'EXPENSE' },
    })

    accountId = account.id
    otherAccountId = otherAccount.id
    categoryId = category.id
  })

  afterEach(async () => {
    await prisma.transaction.deleteMany({
      where: { description: { contains: 'TEST_' } },
    })
    await prisma.transactionRequest.deleteMany({
      where: { description: { contains: 'TEST_' } },
    })
  })

  describe('POST /api/v1/transactions', () => {
    it('creates transaction with valid JWT', async () => {
      const request = new NextRequest('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 50.0,
          currency: 'USD',
          date: new Date().toISOString(),
          description: 'TEST_Transaction',
        }),
      })

      const response = await CreateTransaction(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.id).toBeTruthy()
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 50,
          currency: 'USD',
          date: new Date().toISOString(),
        }),
      })

      const response = await CreateTransaction(request)
      expect(response.status).toBe(401)
    })

    it('returns 400 with invalid data', async () => {
      const request = new NextRequest('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'INVALID_TYPE',
          amount: -10,
          currency: 'USD',
          date: new Date().toISOString(),
        }),
      })

      const response = await CreateTransaction(request)
      expect(response.status).toBe(400)
    })

    it('returns 403 for unauthorized account access', async () => {
      const request = new NextRequest('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: otherAccountId,
          categoryId,
          type: 'EXPENSE',
          amount: 50,
          currency: 'USD',
          date: new Date().toISOString(),
        }),
      })

      const response = await CreateTransaction(request)
      expect(response.status).toBe(403)
    })

    it('returns 400 with malformed JSON', async () => {
      const request = new NextRequest('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      const response = await CreateTransaction(request)
      expect(response.status).toBe(400)
    })
  })

  describe('GET /api/v1/transactions', () => {
    beforeEach(async () => {
      // Create test transactions for GET tests
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      await prisma.transaction.createMany({
        data: [
          {
            accountId,
            categoryId,
            type: 'EXPENSE',
            amount: 100,
            currency: 'USD',
            date: now,
            month: monthStart,
            description: 'TEST_GetTransaction1',
          },
          {
            accountId,
            categoryId,
            type: 'INCOME',
            amount: 200,
            currency: 'USD',
            date: now,
            month: monthStart,
            description: 'TEST_GetTransaction2',
          },
          {
            accountId,
            categoryId,
            type: 'EXPENSE',
            amount: 50,
            currency: 'USD',
            date: now,
            month: monthStart,
            description: 'TEST_GetTransaction3',
          },
        ],
      })
    })

    it('returns transactions with valid JWT and accountId', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions?accountId=${accountId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetTransactions(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.transactions).toBeDefined()
      expect(data.data.transactions.length).toBeGreaterThanOrEqual(3)
      expect(data.data.total).toBeGreaterThanOrEqual(3)
      expect(typeof data.data.hasMore).toBe('boolean')
    })

    it('returns transactions with category data', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions?accountId=${accountId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetTransactions(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const transaction = data.data.transactions[0]
      expect(transaction.category).toBeDefined()
      expect(transaction.category.id).toBeTruthy()
      expect(transaction.category.name).toBeTruthy()
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions?accountId=${accountId}`, {
        method: 'GET',
      })

      const response = await GetTransactions(request)
      expect(response.status).toBe(401)
    })

    it('returns 403 for unauthorized account access', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions?accountId=${otherAccountId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetTransactions(request)
      expect(response.status).toBe(403)
    })

    it('returns 400 with missing accountId', async () => {
      const request = new NextRequest('http://localhost/api/v1/transactions', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetTransactions(request)
      expect(response.status).toBe(400)
    })

    it('returns 400 with invalid type filter', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions?accountId=${accountId}&type=INVALID`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetTransactions(request)
      expect(response.status).toBe(400)
    })

    it('filters by type correctly', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions?accountId=${accountId}&type=EXPENSE`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetTransactions(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.transactions.every((t: { type: string }) => t.type === 'EXPENSE')).toBe(true)
    })

    it('respects pagination limit', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions?accountId=${accountId}&limit=2`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetTransactions(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.transactions.length).toBe(2)
      expect(data.data.hasMore).toBe(true)
    })

    it('respects pagination offset', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions?accountId=${accountId}&limit=2&offset=2`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetTransactions(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.transactions.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('PUT /api/v1/transactions/[id]', () => {
    let transactionId: string

    beforeEach(async () => {
      const transaction = await prisma.transaction.create({
        data: {
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 50,
          currency: 'USD',
          date: new Date(),
          month: new Date(),
          description: 'TEST_Original',
        },
      })
      transactionId = transaction.id
    })

    it('updates transaction with valid JWT', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions/${transactionId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 75.0,
          currency: 'USD',
          date: new Date().toISOString(),
          description: 'TEST_Updated',
        }),
      })

      const response = await UpdateTransaction(request, { params: Promise.resolve({ id: transactionId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(transactionId)
    })

    it('returns 404 for non-existent transaction', async () => {
      const request = new NextRequest('http://localhost/api/v1/transactions/nonexistent', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 75,
          currency: 'USD',
          date: new Date().toISOString(),
        }),
      })

      const response = await UpdateTransaction(request, { params: Promise.resolve({ id: 'nonexistent' }) })
      expect(response.status).toBe(404)
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions/${transactionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 75,
          currency: 'USD',
          date: new Date().toISOString(),
        }),
      })

      const response = await UpdateTransaction(request, { params: Promise.resolve({ id: transactionId }) })
      expect(response.status).toBe(401)
    })
  })

  describe('DELETE /api/v1/transactions/[id]', () => {
    let transactionId: string

    beforeEach(async () => {
      const transaction = await prisma.transaction.create({
        data: {
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 50,
          currency: 'USD',
          date: new Date(),
          month: new Date(),
          description: 'TEST_ToDelete',
        },
      })
      transactionId = transaction.id
    })

    it('deletes transaction with valid JWT', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions/${transactionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await DeleteTransaction(request, { params: Promise.resolve({ id: transactionId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      const deleted = await prisma.transaction.findUnique({ where: { id: transactionId } })
      expect(deleted).toBeNull()
    })

    it('returns 404 for non-existent transaction', async () => {
      const request = new NextRequest('http://localhost/api/v1/transactions/nonexistent', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await DeleteTransaction(request, { params: Promise.resolve({ id: 'nonexistent' }) })
      expect(response.status).toBe(404)
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions/${transactionId}`, {
        method: 'DELETE',
      })

      const response = await DeleteTransaction(request, { params: Promise.resolve({ id: transactionId }) })
      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/v1/transactions/requests', () => {
    it('creates transaction request with valid JWT', async () => {
      const request = new NextRequest('http://localhost/api/v1/transactions/requests', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toId: otherAccountId,
          categoryId,
          amount: 100.0,
          currency: 'USD',
          date: new Date().toISOString(),
          description: 'TEST_Request',
        }),
      })

      const response = await CreateRequest(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.id).toBeTruthy()
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest('http://localhost/api/v1/transactions/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toId: otherAccountId,
          categoryId,
          amount: 100,
          currency: 'USD',
          date: new Date().toISOString(),
        }),
      })

      const response = await CreateRequest(request)
      expect(response.status).toBe(401)
    })

    it('returns 400 with invalid data', async () => {
      const request = new NextRequest('http://localhost/api/v1/transactions/requests', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toId: otherAccountId,
          categoryId,
          amount: -50,
          currency: 'USD',
          date: new Date().toISOString(),
        }),
      })

      const response = await CreateRequest(request)
      expect(response.status).toBe(400)
    })
  })

  describe('POST /api/v1/transactions/requests/[id]/approve', () => {
    let requestId: string
    let approverToken: string

    beforeEach(async () => {
      approverToken = generateAccessToken('approver-user', 'approver@example.com')
      const transactionRequest = await prisma.transactionRequest.create({
        data: {
          fromId: accountId,
          toId: otherAccountId,
          categoryId,
          amount: 100,
          currency: 'USD',
          date: new Date(),
          description: 'TEST_PendingRequest',
          status: 'PENDING',
        },
      })
      requestId = transactionRequest.id
    })

    it('approves request with valid JWT and authorization', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions/requests/${requestId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${approverToken}` },
      })

      const response = await ApproveRequest(request, { params: Promise.resolve({ id: requestId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('APPROVED')

      const updated = await prisma.transactionRequest.findUnique({ where: { id: requestId } })
      expect(updated?.status).toBe('APPROVED')
    })

    it('returns 404 for non-existent request', async () => {
      const request = new NextRequest('http://localhost/api/v1/transactions/requests/nonexistent/approve', {
        method: 'POST',
        headers: { Authorization: `Bearer ${approverToken}` },
      })

      const response = await ApproveRequest(request, { params: Promise.resolve({ id: 'nonexistent' }) })
      expect(response.status).toBe(404)
    })

    it('returns 403 for unauthorized user', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions/requests/${requestId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await ApproveRequest(request, { params: Promise.resolve({ id: requestId }) })
      expect(response.status).toBe(403)
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions/requests/${requestId}/approve`, {
        method: 'POST',
      })

      const response = await ApproveRequest(request, { params: Promise.resolve({ id: requestId }) })
      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/v1/transactions/requests/[id]/reject', () => {
    let requestId: string
    let approverToken: string

    beforeEach(async () => {
      approverToken = generateAccessToken('approver-user', 'approver@example.com')
      const transactionRequest = await prisma.transactionRequest.create({
        data: {
          fromId: accountId,
          toId: otherAccountId,
          categoryId,
          amount: 100,
          currency: 'USD',
          date: new Date(),
          description: 'TEST_PendingRequest',
          status: 'PENDING',
        },
      })
      requestId = transactionRequest.id
    })

    it('rejects request with valid JWT and authorization', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions/requests/${requestId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${approverToken}` },
      })

      const response = await RejectRequest(request, { params: Promise.resolve({ id: requestId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('REJECTED')

      const updated = await prisma.transactionRequest.findUnique({ where: { id: requestId } })
      expect(updated?.status).toBe('REJECTED')
    })

    it('returns 404 for non-existent request', async () => {
      const request = new NextRequest('http://localhost/api/v1/transactions/requests/nonexistent/reject', {
        method: 'POST',
        headers: { Authorization: `Bearer ${approverToken}` },
      })

      const response = await RejectRequest(request, { params: Promise.resolve({ id: 'nonexistent' }) })
      expect(response.status).toBe(404)
    })

    it('returns 403 for unauthorized user', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions/requests/${requestId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await RejectRequest(request, { params: Promise.resolve({ id: requestId }) })
      expect(response.status).toBe(403)
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest(`http://localhost/api/v1/transactions/requests/${requestId}/reject`, {
        method: 'POST',
      })

      const response = await RejectRequest(request, { params: Promise.resolve({ id: requestId }) })
      expect(response.status).toBe(401)
    })
  })

  describe('authorization boundaries', () => {
    let userATransactionId: string
    let userBToken: string

    beforeEach(async () => {
      // Create User B (attacker)
      const userB = await prisma.user.upsert({
        where: { id: 'user-b-attacker' },
        update: {},
        create: {
          id: 'user-b-attacker',
          email: 'attacker@example.com',
          displayName: 'Attacker User',
          passwordHash: '$2b$10$placeholder',
          preferredCurrency: 'USD',
        },
      })

      // Create User B's account
      await prisma.account.upsert({
        where: { userId_name: { userId: userB.id, name: 'AttackerAccount' } },
        update: {},
        create: { userId: userB.id, name: 'AttackerAccount', type: 'SELF' },
      })

      userBToken = generateAccessToken('user-b-attacker', 'attacker@example.com')

      // Create a transaction for User A (test user - the victim)
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const transaction = await prisma.transaction.create({
        data: {
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 100,
          currency: 'USD',
          date: now,
          month: monthStart,
          description: 'TEST_UserATransaction',
        },
      })
      userATransactionId = transaction.id
    })

    it('should reject GET access to transactions from another user account', async () => {
      // User B tries to access User A's transactions via accountId
      const request = new NextRequest(`http://localhost/api/v1/transactions?accountId=${accountId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${userBToken}` },
      })

      const response = await GetTransactions(request)
      expect(response.status).toBe(403)
    })

    it('should reject modification of transactions from another user account', async () => {
      // User B tries to update User A's transaction
      const request = new NextRequest(`http://localhost/api/v1/transactions/${userATransactionId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${userBToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 999,
          currency: 'USD',
          date: new Date().toISOString(),
          description: 'TEST_Hijacked',
        }),
      })

      const response = await UpdateTransaction(request, { params: Promise.resolve({ id: userATransactionId }) })
      expect(response.status).toBe(403)
    })

    it('should reject deletion of transactions from another user account', async () => {
      // User B tries to delete User A's transaction
      const request = new NextRequest(`http://localhost/api/v1/transactions/${userATransactionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userBToken}` },
      })

      const response = await DeleteTransaction(request, { params: Promise.resolve({ id: userATransactionId }) })
      expect(response.status).toBe(403)

      // Verify transaction still exists
      const stillExists = await prisma.transaction.findUnique({ where: { id: userATransactionId } })
      expect(stillExists).not.toBeNull()
    })

    it('should reject creation of transactions in another user account', async () => {
      // User B tries to create a transaction in User A's account
      const request = new NextRequest('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userBToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId, // User A's account
          categoryId,
          type: 'EXPENSE',
          amount: 50,
          currency: 'USD',
          date: new Date().toISOString(),
          description: 'TEST_MaliciousTransaction',
        }),
      })

      const response = await CreateTransaction(request)
      expect(response.status).toBe(403)
    })
  })
})
