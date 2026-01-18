import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as BulkCategories } from '@/app/api/v1/categories/bulk/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import { getApiTestUser, TEST_USER_ID } from './helpers'

describe('POST /api/v1/categories/bulk', () => {
  let validToken: string

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing!'
    resetEnvCache()
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')

    await getApiTestUser()
  })

  afterEach(async () => {
    // Clean up created categories
    await prisma.category.deleteMany({
      where: {
        userId: TEST_USER_ID,
        name: { in: ['Test Category 1', 'Test Category 2', 'Groceries', 'Utilities'] },
      },
    })
  })

  it('creates multiple categories with valid JWT', async () => {
    const request = new NextRequest('http://localhost/api/v1/categories/bulk', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categories: [
          { name: 'Test Category 1', type: 'EXPENSE', color: '#FF0000' },
          { name: 'Test Category 2', type: 'INCOME', color: '#00FF00' },
        ],
      }),
    })

    const response = await BulkCategories(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.categoriesCreated).toBe(2)
    expect(data.data.categories.length).toBe(2)

    // Verify categories were created
    const categories = await prisma.category.findMany({
      where: {
        userId: TEST_USER_ID,
        name: { in: ['Test Category 1', 'Test Category 2'] },
      },
    })

    expect(categories.length).toBe(2)
  })

  it('returns created categories with correct fields', async () => {
    const request = new NextRequest('http://localhost/api/v1/categories/bulk', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categories: [{ name: 'Groceries', type: 'EXPENSE', color: '#FF5733' }],
      }),
    })

    const response = await BulkCategories(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    const category = data.data.categories[0]

    expect(category).toHaveProperty('id')
    expect(category).toHaveProperty('name')
    expect(category).toHaveProperty('type')
    expect(category).toHaveProperty('color')
    expect(category).toHaveProperty('isArchived')
    expect(category).toHaveProperty('isHolding')
    expect(category).toHaveProperty('userId')

    expect(category.name).toBe('Groceries')
    expect(category.type).toBe('EXPENSE')
    expect(category.color).toBe('#FF5733')
  })

  it('reactivates archived categories', async () => {
    // Create and archive a category
    await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        name: 'Groceries',
        type: 'EXPENSE',
        color: '#FF0000',
        isArchived: true,
      },
    })

    const request = new NextRequest('http://localhost/api/v1/categories/bulk', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categories: [{ name: 'Groceries', type: 'EXPENSE', color: '#00FF00' }],
      }),
    })

    const response = await BulkCategories(request)
    await response.json()

    expect(response.status).toBe(201)

    // Verify category was reactivated and color updated
    const category = await prisma.category.findUnique({
      where: {
        userId_name_type: {
          userId: TEST_USER_ID,
          name: 'Groceries',
          type: 'EXPENSE',
        },
      },
    })

    expect(category?.isArchived).toBe(false)
    expect(category?.color).toBe('#00FF00')
  })

  it('handles categories without color', async () => {
    const request = new NextRequest('http://localhost/api/v1/categories/bulk', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categories: [{ name: 'Utilities', type: 'EXPENSE' }],
      }),
    })

    const response = await BulkCategories(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.data.categories[0].color).toBeNull()
  })

  it('creates both EXPENSE and INCOME categories', async () => {
    const request = new NextRequest('http://localhost/api/v1/categories/bulk', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categories: [
          { name: 'Groceries', type: 'EXPENSE' },
          { name: 'Test Category 1', type: 'INCOME' },
        ],
      }),
    })

    const response = await BulkCategories(request)
    const data = await response.json()

    expect(response.status).toBe(201)

    const categories = data.data.categories
    const expense = categories.find((c: { type: string }) => c.type === 'EXPENSE')
    const income = categories.find((c: { type: string }) => c.type === 'INCOME')

    expect(expense).toBeDefined()
    expect(income).toBeDefined()
  })

  it('returns 401 with missing token', async () => {
    const request = new NextRequest('http://localhost/api/v1/categories/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categories: [{ name: 'Test', type: 'EXPENSE' }],
      }),
    })

    const response = await BulkCategories(request)
    expect(response.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const request = new NextRequest('http://localhost/api/v1/categories/bulk', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categories: [{ name: 'Test', type: 'EXPENSE' }],
      }),
    })

    const response = await BulkCategories(request)
    expect(response.status).toBe(401)
  })

  it('returns 400 with malformed JSON', async () => {
    const request = new NextRequest('http://localhost/api/v1/categories/bulk', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: 'invalid json',
    })

    const response = await BulkCategories(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with empty categories array', async () => {
    const request = new NextRequest('http://localhost/api/v1/categories/bulk', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categories: [],
      }),
    })

    const response = await BulkCategories(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with missing categories field', async () => {
    const request = new NextRequest('http://localhost/api/v1/categories/bulk', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    const response = await BulkCategories(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with category name too short', async () => {
    const request = new NextRequest('http://localhost/api/v1/categories/bulk', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categories: [{ name: 'A', type: 'EXPENSE' }],
      }),
    })

    const response = await BulkCategories(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with invalid transaction type', async () => {
    const request = new NextRequest('http://localhost/api/v1/categories/bulk', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categories: [{ name: 'Test', type: 'INVALID' }],
      }),
    })

    const response = await BulkCategories(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with missing category name', async () => {
    const request = new NextRequest('http://localhost/api/v1/categories/bulk', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categories: [{ type: 'EXPENSE' }],
      }),
    })

    const response = await BulkCategories(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 with missing category type', async () => {
    const request = new NextRequest('http://localhost/api/v1/categories/bulk', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categories: [{ name: 'Test' }],
      }),
    })

    const response = await BulkCategories(request)
    expect(response.status).toBe(400)
  })

  it('returns 403 when user has no subscription', async () => {
    await prisma.subscription.update({
      where: { userId: TEST_USER_ID },
      data: { status: 'EXPIRED' },
    })

    const request = new NextRequest('http://localhost/api/v1/categories/bulk', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categories: [{ name: 'Test', type: 'EXPENSE' }],
      }),
    })

    const response = await BulkCategories(request)
    expect(response.status).toBe(402) // 402 Payment Required for subscription errors

    // Reset subscription for other tests
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)
    await prisma.subscription.update({
      where: { userId: TEST_USER_ID },
      data: { status: 'TRIALING', trialEndsAt },
    })
  })
})
