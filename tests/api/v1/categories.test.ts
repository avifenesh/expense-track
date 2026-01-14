import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as CreateCategory } from '@/app/api/v1/categories/route'
import { PATCH as ArchiveCategory } from '@/app/api/v1/categories/[id]/archive/route'
import { generateAccessToken } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'

describe('Category API Routes', () => {
  let validToken: string

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing'
    validToken = generateAccessToken('avi', 'avi@example.com')
  })

  afterEach(async () => {
    // Delete holdings first (foreign key constraint)
    const testCategories = await prisma.category.findMany({
      where: { name: { contains: 'TEST_' } },
      select: { id: true },
    })
    const categoryIds = testCategories.map((c) => c.id)
    if (categoryIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).holding.deleteMany({
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

    it('returns 500 for duplicate category name', async () => {
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
      expect(response.status).toBe(500)
    })
  })

  describe('PATCH /api/v1/categories/[id]/archive', () => {
    let categoryId: string

    beforeEach(async () => {
      // Find or create the test category
      let category = await prisma.category.findFirst({
        where: { name: 'TEST_ToArchive', type: 'EXPENSE' },
      })
      if (!category) {
        category = await prisma.category.create({
          data: {
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
})
