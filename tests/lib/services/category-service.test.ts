import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionType } from '@prisma/client'

// 1. Mock @prisma/client FIRST (enums & Decimal)
vi.mock('@prisma/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@prisma/client')>()
  return {
    ...original,
    TransactionType: { INCOME: 'INCOME', EXPENSE: 'EXPENSE' },
  }
})

// 2. Mock @/lib/prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    category: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

// 3. Import AFTER all mocks
import { createCategory, archiveCategory, getCategoryById } from '@/lib/services/category-service'
import { prisma } from '@/lib/prisma'

describe('category-service.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createCategory', () => {
    it('should create category with color', async () => {
      const mockCategory = {
        id: 'cat-1',
        name: 'Groceries',
        type: TransactionType.EXPENSE,
        color: '#FF5733',
        isArchived: false,
        isHolding: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.create).mockResolvedValue(mockCategory)

      const result = await createCategory({
        name: 'Groceries',
        type: TransactionType.EXPENSE,
        color: '#FF5733',
      })

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          name: 'Groceries',
          type: TransactionType.EXPENSE,
          color: '#FF5733',
        },
      })
      expect(result).toEqual(mockCategory)
    })

    it('should create category with null color when not provided', async () => {
      const mockCategory = {
        id: 'cat-2',
        name: 'Salary',
        type: TransactionType.INCOME,
        color: null,
        isArchived: false,
        isHolding: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.create).mockResolvedValue(mockCategory)

      const result = await createCategory({
        name: 'Salary',
        type: TransactionType.INCOME,
      })

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          name: 'Salary',
          type: TransactionType.INCOME,
          color: null,
        },
      })
      expect(result).toEqual(mockCategory)
    })

    it('should create category with INCOME type', async () => {
      const mockCategory = {
        id: 'cat-3',
        name: 'Freelance',
        type: TransactionType.INCOME,
        color: null,
        isArchived: false,
        isHolding: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.create).mockResolvedValue(mockCategory)

      const result = await createCategory({
        name: 'Freelance',
        type: TransactionType.INCOME,
        color: null,
      })

      expect(result.type).toBe(TransactionType.INCOME)
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          name: 'Freelance',
          type: TransactionType.INCOME,
          color: null,
        },
      })
    })

    it('should create category with EXPENSE type', async () => {
      const mockCategory = {
        id: 'cat-4',
        name: 'Rent',
        type: TransactionType.EXPENSE,
        color: '#1A73E8',
        isArchived: false,
        isHolding: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.create).mockResolvedValue(mockCategory)

      const result = await createCategory({
        name: 'Rent',
        type: TransactionType.EXPENSE,
        color: '#1A73E8',
      })

      expect(result.type).toBe(TransactionType.EXPENSE)
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          name: 'Rent',
          type: TransactionType.EXPENSE,
          color: '#1A73E8',
        },
      })
    })

    it('should propagate Prisma error for unique constraint violation', async () => {
      const prismaError = new Error('Unique constraint failed on the fields: (`name`,`type`)')
      prismaError.name = 'PrismaClientKnownRequestError'

      vi.mocked(prisma.category.create).mockRejectedValue(prismaError)

      await expect(
        createCategory({
          name: 'Groceries',
          type: TransactionType.EXPENSE,
          color: null,
        }),
      ).rejects.toThrow('Unique constraint failed on the fields: (`name`,`type`)')
    })
  })

  describe('archiveCategory', () => {
    it('should set isArchived to true', async () => {
      const mockCategory = {
        id: 'cat-1',
        name: 'Old Category',
        type: TransactionType.EXPENSE,
        color: null,
        isArchived: true,
        isHolding: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.update).mockResolvedValue(mockCategory)

      const result = await archiveCategory({
        id: 'cat-1',
        isArchived: true,
      })

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: { isArchived: true },
      })
      expect(result.isArchived).toBe(true)
    })

    it('should set isArchived to false (unarchive)', async () => {
      const mockCategory = {
        id: 'cat-1',
        name: 'Restored Category',
        type: TransactionType.EXPENSE,
        color: null,
        isArchived: false,
        isHolding: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.update).mockResolvedValue(mockCategory)

      const result = await archiveCategory({
        id: 'cat-1',
        isArchived: false,
      })

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: { isArchived: false },
      })
      expect(result.isArchived).toBe(false)
    })

    it('should propagate Prisma error for non-existent category', async () => {
      const prismaError = new Error('Record to update not found')
      prismaError.name = 'PrismaClientKnownRequestError'

      vi.mocked(prisma.category.update).mockRejectedValue(prismaError)

      await expect(
        archiveCategory({
          id: 'non-existent-id',
          isArchived: true,
        }),
      ).rejects.toThrow('Record to update not found')
    })
  })

  describe('getCategoryById', () => {
    it('should return category when found', async () => {
      const mockCategory = {
        id: 'cat-1',
        name: 'Groceries',
        type: TransactionType.EXPENSE,
        color: '#FF5733',
        isArchived: false,
        isHolding: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.findUnique).mockResolvedValue(mockCategory)

      const result = await getCategoryById('cat-1')

      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
      })
      expect(result).toEqual(mockCategory)
    })

    it('should return null when category not found', async () => {
      vi.mocked(prisma.category.findUnique).mockResolvedValue(null)

      const result = await getCategoryById('non-existent-id')

      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
      })
      expect(result).toBeNull()
    })

    it('should return archived category (soft delete does not hide)', async () => {
      const mockArchivedCategory = {
        id: 'cat-1',
        name: 'Archived Category',
        type: TransactionType.EXPENSE,
        color: null,
        isArchived: true,
        isHolding: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.findUnique).mockResolvedValue(mockArchivedCategory)

      const result = await getCategoryById('cat-1')

      expect(result).toEqual(mockArchivedCategory)
      expect(result?.isArchived).toBe(true)
    })
  })
})
