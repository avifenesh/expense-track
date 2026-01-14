import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as UpsertRecurringTemplate } from '@/app/api/v1/recurring/route'
import { PATCH as ToggleRecurringTemplate } from '@/app/api/v1/recurring/[id]/toggle/route'
import { POST as ApplyRecurringTemplates } from '@/app/api/v1/recurring/apply/route'
import { generateAccessToken } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'

describe('Recurring Template API Routes', () => {
  let validToken: string
  let accountId: string
  let otherAccountId: string
  let categoryId: string
  const testMonthKey = '2024-01'

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing'
    validToken = generateAccessToken('avi', 'avi@example.com')

    // Upsert test accounts and category (atomic, no race condition)
    const account = await prisma.account.upsert({
      where: { name: 'Avi' },
      update: {},
      create: { name: 'Avi', type: 'SELF' },
    })

    const otherAccount = await prisma.account.upsert({
      where: { name: 'Serena' },
      update: {},
      create: { name: 'Serena', type: 'SELF' },
    })

    const category = await prisma.category.upsert({
      where: { name_type: { name: 'TEST_RecurringCategory', type: 'EXPENSE' } },
      update: {},
      create: { name: 'TEST_RecurringCategory', type: 'EXPENSE' },
    })

    accountId = account.id
    otherAccountId = otherAccount.id
    categoryId = category.id
  })

  afterEach(async () => {
    await prisma.recurringTemplate.deleteMany({
      where: { description: { contains: 'TEST_' } },
    })
    await prisma.transaction.deleteMany({
      where: { description: { contains: 'TEST_' } },
    })
  })

  describe('POST /api/v1/recurring', () => {
    it('creates recurring template with valid JWT', async () => {
      const request = new NextRequest('http://localhost/api/v1/recurring', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 100.0,
          currency: 'USD',
          dayOfMonth: 15,
          description: 'TEST_Rent',
          startMonthKey: '2024-01',
        }),
      })

      const response = await UpsertRecurringTemplate(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.id).toBeTruthy()
    })

    it('creates recurring template with end month', async () => {
      const request = new NextRequest('http://localhost/api/v1/recurring', {
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
          dayOfMonth: 1,
          description: 'TEST_Subscription',
          startMonthKey: '2024-01',
          endMonthKey: '2024-12',
        }),
      })

      const response = await UpsertRecurringTemplate(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
    })

    it('updates existing recurring template', async () => {
      // First create
      const createRequest = new NextRequest('http://localhost/api/v1/recurring', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 100.0,
          currency: 'USD',
          dayOfMonth: 15,
          description: 'TEST_Update',
          startMonthKey: '2024-01',
        }),
      })
      const createResponse = await UpsertRecurringTemplate(createRequest)
      const createData = await createResponse.json()
      const templateId = createData.data.id

      // Then update
      const updateRequest = new NextRequest('http://localhost/api/v1/recurring', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: templateId,
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 150.0,
          currency: 'USD',
          dayOfMonth: 20,
          description: 'TEST_Update',
          startMonthKey: '2024-01',
        }),
      })

      const response = await UpsertRecurringTemplate(updateRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify template was updated
      const template = await prisma.recurringTemplate.findUnique({
        where: { id: templateId },
      })
      expect(template?.amount.toNumber()).toBe(150)
      expect(template?.dayOfMonth).toBe(20)
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest('http://localhost/api/v1/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 100,
          currency: 'USD',
          dayOfMonth: 15,
          startMonthKey: '2024-01',
        }),
      })

      const response = await UpsertRecurringTemplate(request)
      expect(response.status).toBe(401)
    })

    it('returns 400 with invalid data', async () => {
      const request = new NextRequest('http://localhost/api/v1/recurring', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: -100, // Invalid negative amount
          currency: 'USD',
          dayOfMonth: 15,
          startMonthKey: '2024-01',
        }),
      })

      const response = await UpsertRecurringTemplate(request)
      expect(response.status).toBe(400)
    })

    it('returns 400 when end month is before start month', async () => {
      const request = new NextRequest('http://localhost/api/v1/recurring', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 100,
          currency: 'USD',
          dayOfMonth: 15,
          startMonthKey: '2024-12',
          endMonthKey: '2024-01', // Before start month
        }),
      })

      const response = await UpsertRecurringTemplate(request)
      expect(response.status).toBe(400)
    })

    it('returns 403 for unauthorized account access', async () => {
      const request = new NextRequest('http://localhost/api/v1/recurring', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: otherAccountId,
          categoryId,
          type: 'EXPENSE',
          amount: 100,
          currency: 'USD',
          dayOfMonth: 15,
          startMonthKey: '2024-01',
        }),
      })

      const response = await UpsertRecurringTemplate(request)
      expect(response.status).toBe(403)
    })

    it('returns 400 with malformed JSON', async () => {
      const request = new NextRequest('http://localhost/api/v1/recurring', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      const response = await UpsertRecurringTemplate(request)
      expect(response.status).toBe(400)
    })
  })

  describe('PATCH /api/v1/recurring/[id]/toggle', () => {
    let templateId: string

    beforeEach(async () => {
      const template = await prisma.recurringTemplate.create({
        data: {
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 100,
          currency: 'USD',
          dayOfMonth: 15,
          description: 'TEST_Toggle',
          startMonth: new Date('2024-01-01'),
          isActive: true,
        },
      })
      templateId = template.id
    })

    it('toggles template to inactive with valid JWT', async () => {
      const request = new NextRequest(`http://localhost/api/v1/recurring/${templateId}/toggle`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: false,
        }),
      })

      const response = await ToggleRecurringTemplate(request, {
        params: Promise.resolve({ id: templateId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.isActive).toBe(false)

      // Verify template was toggled
      const template = await prisma.recurringTemplate.findUnique({ where: { id: templateId } })
      expect(template?.isActive).toBe(false)
    })

    it('toggles template to active', async () => {
      // First set to inactive
      await prisma.recurringTemplate.update({
        where: { id: templateId },
        data: { isActive: false },
      })

      // Then toggle to active
      const request = new NextRequest(`http://localhost/api/v1/recurring/${templateId}/toggle`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: true,
        }),
      })

      const response = await ToggleRecurringTemplate(request, {
        params: Promise.resolve({ id: templateId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.isActive).toBe(true)

      // Verify template was toggled
      const template = await prisma.recurringTemplate.findUnique({ where: { id: templateId } })
      expect(template?.isActive).toBe(true)
    })

    it('returns 404 for non-existent template', async () => {
      const request = new NextRequest('http://localhost/api/v1/recurring/nonexistent/toggle', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: false,
        }),
      })

      const response = await ToggleRecurringTemplate(request, {
        params: Promise.resolve({ id: 'nonexistent' }),
      })
      expect(response.status).toBe(404)
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest(`http://localhost/api/v1/recurring/${templateId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: false,
        }),
      })

      const response = await ToggleRecurringTemplate(request, {
        params: Promise.resolve({ id: templateId }),
      })
      expect(response.status).toBe(401)
    })

    it('returns 400 with invalid data', async () => {
      const request = new NextRequest(`http://localhost/api/v1/recurring/${templateId}/toggle`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: 'not-a-boolean',
        }),
      })

      const response = await ToggleRecurringTemplate(request, {
        params: Promise.resolve({ id: templateId }),
      })
      expect(response.status).toBe(400)
    })

    it('returns 400 with malformed JSON', async () => {
      const request = new NextRequest(`http://localhost/api/v1/recurring/${templateId}/toggle`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      const response = await ToggleRecurringTemplate(request, {
        params: Promise.resolve({ id: templateId }),
      })
      expect(response.status).toBe(400)
    })
  })

  describe('POST /api/v1/recurring/apply', () => {
    beforeEach(async () => {
      // Create active templates for testing
      await prisma.recurringTemplate.createMany({
        data: [
          {
            accountId,
            categoryId,
            type: 'EXPENSE',
            amount: 100,
            currency: 'USD',
            dayOfMonth: 15,
            description: 'TEST_Apply1',
            startMonth: new Date('2024-01-01'),
            isActive: true,
          },
          {
            accountId,
            categoryId,
            type: 'EXPENSE',
            amount: 50,
            currency: 'USD',
            dayOfMonth: 1,
            description: 'TEST_Apply2',
            startMonth: new Date('2024-01-01'),
            isActive: true,
          },
        ],
      })
    })

    it('applies recurring templates with valid JWT', async () => {
      const request = new NextRequest('http://localhost/api/v1/recurring/apply', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          monthKey: testMonthKey,
          accountId,
        }),
      })

      const response = await ApplyRecurringTemplates(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.created).toBeGreaterThan(0)
    })

    it('returns 0 when templates already applied', async () => {
      // First apply
      const firstRequest = new NextRequest('http://localhost/api/v1/recurring/apply', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          monthKey: testMonthKey,
          accountId,
        }),
      })
      await ApplyRecurringTemplates(firstRequest)

      // Second apply (should create 0 new transactions)
      const secondRequest = new NextRequest('http://localhost/api/v1/recurring/apply', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          monthKey: testMonthKey,
          accountId,
        }),
      })

      const response = await ApplyRecurringTemplates(secondRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.created).toBe(0)
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest('http://localhost/api/v1/recurring/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthKey: testMonthKey,
          accountId,
        }),
      })

      const response = await ApplyRecurringTemplates(request)
      expect(response.status).toBe(401)
    })

    it('returns 403 for unauthorized account access', async () => {
      const request = new NextRequest('http://localhost/api/v1/recurring/apply', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          monthKey: testMonthKey,
          accountId: otherAccountId,
        }),
      })

      const response = await ApplyRecurringTemplates(request)
      expect(response.status).toBe(403)
    })

    it('returns 400 with missing monthKey', async () => {
      const request = new NextRequest('http://localhost/api/v1/recurring/apply', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
        }),
      })

      const response = await ApplyRecurringTemplates(request)
      expect(response.status).toBe(400)
    })

    it('returns 400 with malformed JSON', async () => {
      const request = new NextRequest('http://localhost/api/v1/recurring/apply', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      const response = await ApplyRecurringTemplates(request)
      expect(response.status).toBe(400)
    })
  })
})
