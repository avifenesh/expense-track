import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as GetCategories, POST as CreateCategory } from '@/app/api/v1/categories/route'
import { PATCH as ArchiveCategory } from '@/app/api/v1/categories/[id]/archive/route'
import { PUT as UpdateCategory } from '@/app/api/v1/categories/[id]/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import { getApiTestUser, TEST_USER_ID, OTHER_USER_ID, getOtherTestUser } from './helpers'

describe('Category API Routes', () => {
  let validToken: string
  let testUserId: string

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing!'
    resetEnvCache()
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')

    // Get test user for userId foreign keys
    const testUser = await getApiTestUser()
    testUserId = testUser.id
  })

  afterEach(async () => {
    // Delete all references to test categories (foreign key constraints)
    const testCategories = await prisma.category.findMany({
      where: { name: { contains: 'TEST_' } },
      select: { id: true },
    })
    const categoryIds = testCategories.map((c) => c.id)
    if (categoryIds.length > 0) {
      // Delete in order of foreign key dependencies
      await prisma.transaction.deleteMany({
        where: { categoryId: { in: categoryIds } },
      })
      await prisma.transactionRequest.deleteMany({
        where: { categoryId: { in: categoryIds } },
      })
      await prisma.budget.deleteMany({
        where: { categoryId: { in: categoryIds } },
      })
      await prisma.recurringTemplate.deleteMany({
        where: { categoryId: { in: categoryIds } },
      })
      await prisma.holding.deleteMany({
        where: { categoryId: { in: categoryIds } },
      })
    }
    // Then delete categories
    await prisma.category.deleteMany({
      where: { name: { contains: 'TEST_' } },
    })
  })

  describe('POST /api/v1/categories', () => {
    it('creates category with valid JWT', async () => {
      const request = new NextRequest('http://localhost/api/v1/categories', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'TEST_Category',
          type: 'EXPENSE',
          color: '#FF0000',
        }),
      })

      const response = await CreateCategory(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.id).toBeTruthy()
    })

    it('creates category without color', async () => {
      const request = new NextRequest('http://localhost/api/v1/categories', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'TEST_NoColor',
          type: 'INCOME',
        }),
      })

      const response = await CreateCategory(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest('http://localhost/api/v1/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'TEST_Category',
          type: 'EXPENSE',
        }),
      })

      const response = await CreateCategory(request)
      expect(response.status).toBe(401)
    })

    it('returns 400 with invalid data', async () => {
      const request = new NextRequest('http://localhost/api/v1/categories', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'T', // Too short (min 2 chars)
          type: 'EXPENSE',
        }),
      })

      const response = await CreateCategory(request)
      expect(response.status).toBe(400)
    })

    it('returns 400 with invalid type', async () => {
      const request = new NextRequest('http://localhost/api/v1/categories', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'TEST_Category',
          type: 'INVALID_TYPE',
        }),
      })

      const response = await CreateCategory(request)
      expect(response.status).toBe(400)
    })

    it('returns 400 with malformed JSON', async () => {
      const request = new NextRequest('http://localhost/api/v1/categories', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      const response = await CreateCategory(request)
      expect(response.status).toBe(400)
    })

    it('returns 400 for duplicate category name', async () => {
      // First create
      const firstRequest = new NextRequest('http://localhost/api/v1/categories', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'TEST_Duplicate',
          type: 'EXPENSE',
        }),
      })
      await CreateCategory(firstRequest)

      // Try to create duplicate
      const duplicateRequest = new NextRequest('http://localhost/api/v1/categories', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'TEST_Duplicate',
          type: 'EXPENSE',
        }),
      })

      const response = await CreateCategory(duplicateRequest)
      // Duplicate category returns 400 validation error, not 500 server error
      expect(response.status).toBe(400)
    })
  })

  describe('GET /api/v1/categories', () => {
    beforeEach(async () => {
      // Create test categories for GET tests
      await prisma.category.createMany({
        data: [
          { userId: testUserId, name: 'TEST_GetExpense1', type: 'EXPENSE', color: '#FF0000' },
          { userId: testUserId, name: 'TEST_GetExpense2', type: 'EXPENSE', color: '#00FF00' },
          { userId: testUserId, name: 'TEST_GetIncome1', type: 'INCOME', color: '#0000FF' },
          { userId: testUserId, name: 'TEST_GetArchived', type: 'EXPENSE', isArchived: true },
        ],
      })
    })

    it('returns categories with valid JWT', async () => {
      const request = new NextRequest('http://localhost/api/v1/categories', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetCategories(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.categories).toBeDefined()
      expect(data.data.categories.length).toBeGreaterThanOrEqual(3) // Excludes archived by default
    })

    it('returns categories with full data', async () => {
      const request = new NextRequest('http://localhost/api/v1/categories', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetCategories(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const category = data.data.categories.find((c: { name: string }) => c.name === 'TEST_GetExpense1')
      expect(category).toBeDefined()
      expect(category.id).toBeTruthy()
      expect(category.name).toBe('TEST_GetExpense1')
      expect(category.type).toBe('EXPENSE')
      expect(category.color).toBe('#FF0000')
      expect(category.isArchived).toBe(false)
    })

    it('filters by type correctly', async () => {
      const request = new NextRequest('http://localhost/api/v1/categories?type=INCOME', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetCategories(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const testIncomeCategories = data.data.categories.filter((c: { name: string }) => c.name.startsWith('TEST_Get'))
      expect(testIncomeCategories.length).toBe(1)
      expect(testIncomeCategories[0].type).toBe('INCOME')
    })

    it('excludes archived categories by default', async () => {
      const request = new NextRequest('http://localhost/api/v1/categories', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetCategories(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const archivedCategory = data.data.categories.find((c: { name: string }) => c.name === 'TEST_GetArchived')
      expect(archivedCategory).toBeUndefined()
    })

    it('includes archived categories when requested', async () => {
      const request = new NextRequest('http://localhost/api/v1/categories?includeArchived=true', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetCategories(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const archivedCategory = data.data.categories.find((c: { name: string }) => c.name === 'TEST_GetArchived')
      expect(archivedCategory).toBeDefined()
      expect(archivedCategory.isArchived).toBe(true)
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest('http://localhost/api/v1/categories', {
        method: 'GET',
      })

      const response = await GetCategories(request)
      expect(response.status).toBe(401)
    })

    it('returns 400 with invalid type', async () => {
      const request = new NextRequest('http://localhost/api/v1/categories?type=INVALID', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validToken}` },
      })

      const response = await GetCategories(request)
      expect(response.status).toBe(400)
    })
  })

  describe('PATCH /api/v1/categories/[id]/archive', () => {
    let categoryId: string

    beforeEach(async () => {
      // Find or create the test category
      let category = await prisma.category.findFirst({
        where: { name: 'TEST_ToArchive', type: 'EXPENSE', userId: testUserId },
      })
      if (!category) {
        category = await prisma.category.create({
          data: {
            userId: testUserId,
            name: 'TEST_ToArchive',
            type: 'EXPENSE',
          },
        })
      }
      categoryId = category.id
    })

    it('archives category with valid JWT', async () => {
      const request = new NextRequest(`http://localhost/api/v1/categories/${categoryId}/archive`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isArchived: true,
        }),
      })

      const response = await ArchiveCategory(request, { params: Promise.resolve({ id: categoryId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.isArchived).toBe(true)

      // Verify category was archived
      const category = await prisma.category.findUnique({ where: { id: categoryId } })
      expect(category?.isArchived).toBe(true)
    })

    it('unarchives category', async () => {
      // First archive
      await prisma.category.update({
        where: { id: categoryId },
        data: { isArchived: true },
      })

      // Then unarchive
      const request = new NextRequest(`http://localhost/api/v1/categories/${categoryId}/archive`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isArchived: false,
        }),
      })

      const response = await ArchiveCategory(request, { params: Promise.resolve({ id: categoryId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.isArchived).toBe(false)

      // Verify category was unarchived
      const category = await prisma.category.findUnique({ where: { id: categoryId } })
      expect(category?.isArchived).toBe(false)
    })

    it('returns 404 for non-existent category', async () => {
      const request = new NextRequest('http://localhost/api/v1/categories/nonexistent/archive', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isArchived: true,
        }),
      })

      const response = await ArchiveCategory(request, { params: Promise.resolve({ id: 'nonexistent' }) })
      expect(response.status).toBe(404)
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest(`http://localhost/api/v1/categories/${categoryId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isArchived: true,
        }),
      })

      const response = await ArchiveCategory(request, { params: Promise.resolve({ id: categoryId }) })
      expect(response.status).toBe(401)
    })

    it('returns 400 with invalid data', async () => {
      const request = new NextRequest(`http://localhost/api/v1/categories/${categoryId}/archive`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isArchived: 'not-a-boolean',
        }),
      })

      const response = await ArchiveCategory(request, { params: Promise.resolve({ id: categoryId }) })
      expect(response.status).toBe(400)
    })

    it('returns 400 with malformed JSON', async () => {
      const request = new NextRequest(`http://localhost/api/v1/categories/${categoryId}/archive`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      const response = await ArchiveCategory(request, { params: Promise.resolve({ id: categoryId }) })
      expect(response.status).toBe(400)
    })
  })

  describe('PUT /api/v1/categories/[id]', () => {
    let categoryId: string

    beforeEach(async () => {
      // Find or create the test category
      let category = await prisma.category.findFirst({
        where: { name: 'TEST_ToUpdate', type: 'EXPENSE', userId: testUserId },
      })
      if (!category) {
        category = await prisma.category.create({
          data: {
            userId: testUserId,
            name: 'TEST_ToUpdate',
            type: 'EXPENSE',
            color: '#FF0000',
          },
        })
      }
      categoryId = category.id
    })

    it('updates category with valid JWT', async () => {
      const request = new NextRequest(`http://localhost/api/v1/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'TEST_Updated',
          color: '#00FF00',
        }),
      })

      const response = await UpdateCategory(request, { params: Promise.resolve({ id: categoryId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('TEST_Updated')
      expect(data.data.color).toBe('#00FF00')

      // Verify category was updated in database
      const category = await prisma.category.findUnique({ where: { id: categoryId } })
      expect(category?.name).toBe('TEST_Updated')
      expect(category?.color).toBe('#00FF00')
    })

    it('updates category name only', async () => {
      const request = new NextRequest(`http://localhost/api/v1/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'TEST_NameOnly',
        }),
      })

      const response = await UpdateCategory(request, { params: Promise.resolve({ id: categoryId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('TEST_NameOnly')
    })

    it('returns 401 with missing token', async () => {
      const request = new NextRequest(`http://localhost/api/v1/categories/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'TEST_Updated',
        }),
      })

      const response = await UpdateCategory(request, { params: Promise.resolve({ id: categoryId }) })
      expect(response.status).toBe(401)
    })

    it('returns 404 for non-existent category', async () => {
      const request = new NextRequest('http://localhost/api/v1/categories/nonexistent', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'TEST_Updated',
        }),
      })

      const response = await UpdateCategory(request, { params: Promise.resolve({ id: 'nonexistent' }) })
      expect(response.status).toBe(404)
    })

    it('returns 404 for category owned by another user', async () => {
      // Create category for other user
      await getOtherTestUser()
      const otherCategory = await prisma.category.create({
        data: {
          userId: OTHER_USER_ID,
          name: 'TEST_OtherUser',
          type: 'EXPENSE',
        },
      })

      const request = new NextRequest(`http://localhost/api/v1/categories/${otherCategory.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'TEST_Hacked',
        }),
      })

      const response = await UpdateCategory(request, { params: Promise.resolve({ id: otherCategory.id }) })
      expect(response.status).toBe(404)

      // Cleanup
      await prisma.category.delete({ where: { id: otherCategory.id } })
    })

    it('returns 400 with invalid name (too short)', async () => {
      const request = new NextRequest(`http://localhost/api/v1/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'T', // Too short (min 2 chars)
        }),
      })

      const response = await UpdateCategory(request, { params: Promise.resolve({ id: categoryId }) })
      expect(response.status).toBe(400)
    })

    it('returns 400 with invalid name (too long)', async () => {
      const request = new NextRequest(`http://localhost/api/v1/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'T'.repeat(101), // Too long (max 100 chars)
        }),
      })

      const response = await UpdateCategory(request, { params: Promise.resolve({ id: categoryId }) })
      expect(response.status).toBe(400)
    })

    it('returns 400 with invalid color format', async () => {
      const request = new NextRequest(`http://localhost/api/v1/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'TEST_Valid',
          color: 'not-a-hex-color',
        }),
      })

      const response = await UpdateCategory(request, { params: Promise.resolve({ id: categoryId }) })
      expect(response.status).toBe(400)
    })

    it('returns 400 for duplicate category name within same type', async () => {
      // Create another category with the target name
      await prisma.category.create({
        data: {
          userId: testUserId,
          name: 'TEST_ExistingName',
          type: 'EXPENSE',
        },
      })

      const request = new NextRequest(`http://localhost/api/v1/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'TEST_ExistingName',
        }),
      })

      const response = await UpdateCategory(request, { params: Promise.resolve({ id: categoryId }) })
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.fields?.name).toContain('A category with this name already exists')
    })

    it('allows same name for different category types', async () => {
      // Create an income category with the same name
      await prisma.category.create({
        data: {
          userId: testUserId,
          name: 'TEST_SameName',
          type: 'INCOME',
        },
      })

      const request = new NextRequest(`http://localhost/api/v1/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'TEST_SameName',
        }),
      })

      const response = await UpdateCategory(request, { params: Promise.resolve({ id: categoryId }) })
      expect(response.status).toBe(200)
    })

    it('returns 400 with malformed JSON', async () => {
      const request = new NextRequest(`http://localhost/api/v1/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      const response = await UpdateCategory(request, { params: Promise.resolve({ id: categoryId }) })
      expect(response.status).toBe(400)
    })

    it('updates category with color set to null', async () => {
      const request = new NextRequest(`http://localhost/api/v1/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Category',
          color: null,
        }),
      })

      const response = await UpdateCategory(request, { params: Promise.resolve({ id: categoryId }) })
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Updated Category')
      // Color may be null or undefined after setting to null
      expect(data.data.color).toBeFalsy()
    })
  })
})
