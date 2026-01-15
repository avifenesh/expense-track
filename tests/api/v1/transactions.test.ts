import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as CreateTransaction } from '@/app/api/v1/transactions/route'
import { PUT as UpdateTransaction, DELETE as DeleteTransaction } from '@/app/api/v1/transactions/[id]/route'
import { POST as CreateRequest } from '@/app/api/v1/transactions/requests/route'
import { POST as ApproveRequest } from '@/app/api/v1/transactions/requests/[id]/approve/route'
import { POST as RejectRequest } from '@/app/api/v1/transactions/requests/[id]/reject/route'
import { generateAccessToken } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import { getApiTestUser } from './helpers'

describe('Transaction API Routes', () => {
  let validToken: string
  let accountId: string
  let otherAccountId: string
  let categoryId: string

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing'
    validToken = generateAccessToken('avi', 'avi@example.com')

    // Get test user for userId foreign keys
    const testUser = await getApiTestUser()

    // Create 'serena' user for transaction request approval tests
    // This user owns the 'other' account and can approve/reject requests
    const serenaUser = await prisma.user.upsert({
      where: { id: 'serena' },
      update: {},
      create: {
        id: 'serena',
        email: 'serena@example.com',
        displayName: 'Serena Test User',
        passwordHash: '$2b$10$placeholder',
        preferredCurrency: 'USD',
      },
    })

    // Upsert test accounts and category (atomic, no race condition)
    const account = await prisma.account.upsert({
      where: { userId_name: { userId: testUser.id, name: 'Avi' } },
      update: {},
      create: { userId: testUser.id, name: 'Avi', type: 'SELF' },
    })

    // Other account belongs to 'serena' user - for request approval tests
    const otherAccount = await prisma.account.upsert({
      where: { userId_name: { userId: serenaUser.id, name: 'SerenaAccount' } },
      update: {},
      create: { userId: serenaUser.id, name: 'SerenaAccount', type: 'SELF' },
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
    let serenaToken: string

    beforeEach(async () => {
      serenaToken = generateAccessToken('serena', 'serena@example.com')
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
        headers: { Authorization: `Bearer ${serenaToken}` },
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
        headers: { Authorization: `Bearer ${serenaToken}` },
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
    let serenaToken: string

    beforeEach(async () => {
      serenaToken = generateAccessToken('serena', 'serena@example.com')
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
        headers: { Authorization: `Bearer ${serenaToken}` },
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
        headers: { Authorization: `Bearer ${serenaToken}` },
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
})
