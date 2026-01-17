import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TransactionType } from '@prisma/client'

// Prisma error type
interface PrismaError extends Error {
  code: string
}

// Mock Prisma BEFORE imports
vi.mock('@/lib/prisma', () => ({
  prisma: {
    category: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

// Import after mocks
import { prisma } from '@/lib/prisma'
import {
  createOrReactivateCategory,
  archiveCategory,
  getCategoryById,
  type CreateCategoryInput,
  type ArchiveCategoryInput,
} from '@/lib/services/category-service'

describe('category-service.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Phase 1: createOrReactivateCategory()', () => {
    it('should create new category when none exists', async () => {
      const input: CreateCategoryInput = {
        userId: 'test-user',
        name: 'Groceries',
        type: TransactionType.EXPENSE,
        color: '#FF5733',
      }

      const mockCategory = {
        id: 'cat-1',
        userId: 'test-user',
        name: 'Groceries',
        type: TransactionType.EXPENSE,
        color: '#FF5733',
        isHolding: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.category.create).mockResolvedValue(mockCategory)

      const result = await createOrReactivateCategory(input)

      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'test-user',
          name: 'Groceries',
          type: TransactionType.EXPENSE,
        },
      })
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          userId: 'test-user',
          name: 'Groceries',
          type: TransactionType.EXPENSE,
          color: '#FF5733',
        },
      })
      expect(result).toEqual({ success: true, category: mockCategory, reactivated: false })
    })

    it('should create category with null color when not provided', async () => {
      const input: CreateCategoryInput = {
        userId: 'test-user',
        name: 'Salary',
        type: TransactionType.INCOME,
      }

      const mockCategory = {
        id: 'cat-2',
        userId: 'test-user',
        name: 'Salary',
        type: TransactionType.INCOME,
        color: null,
        isHolding: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.category.create).mockResolvedValue(mockCategory)

      const result = await createOrReactivateCategory(input)

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          userId: 'test-user',
          name: 'Salary',
          type: TransactionType.INCOME,
          color: null,
        },
      })
      expect(result.success).toBe(true)
    })

    it('should return DUPLICATE error when active category exists', async () => {
      const input: CreateCategoryInput = {
        userId: 'test-user',
        name: 'Groceries',
        type: TransactionType.EXPENSE,
      }

      const existingCategory = {
        id: 'cat-existing',
        userId: 'test-user',
        name: 'Groceries',
        type: TransactionType.EXPENSE,
        color: null,
        isHolding: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.findFirst).mockResolvedValue(existingCategory)

      const result = await createOrReactivateCategory(input)

      expect(result).toEqual({ success: false, error: 'DUPLICATE' })
      expect(prisma.category.create).not.toHaveBeenCalled()
    })

    it('should reactivate archived category', async () => {
      const input: CreateCategoryInput = {
        userId: 'test-user',
        name: 'Transport',
        type: TransactionType.EXPENSE,
        color: '#0000FF',
      }

      const archivedCategory = {
        id: 'cat-archived',
        userId: 'test-user',
        name: 'Transport',
        type: TransactionType.EXPENSE,
        color: '#FF0000',
        isHolding: false,
        isArchived: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const reactivatedCategory = {
        ...archivedCategory,
        color: '#0000FF',
        isArchived: false,
      }

      vi.mocked(prisma.category.findFirst).mockResolvedValue(archivedCategory)
      vi.mocked(prisma.category.updateMany).mockResolvedValue({ count: 1 })
      vi.mocked(prisma.category.findUnique).mockResolvedValue(reactivatedCategory)

      const result = await createOrReactivateCategory(input)

      expect(prisma.category.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'cat-archived',
          isArchived: true,
        },
        data: {
          isArchived: false,
          color: '#0000FF',
        },
      })
      expect(result).toEqual({ success: true, category: reactivatedCategory, reactivated: true })
    })

    it('should handle race condition on create with unique constraint', async () => {
      const input: CreateCategoryInput = {
        userId: 'test-user',
        name: 'Test',
        type: TransactionType.EXPENSE,
      }

      const error = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        name: 'PrismaClientKnownRequestError',
      })

      vi.mocked(prisma.category.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.category.create).mockRejectedValue(error)

      const result = await createOrReactivateCategory(input)

      expect(result).toEqual({ success: false, error: 'DUPLICATE' })
    })

    it('should handle Prisma connection error', async () => {
      const input: CreateCategoryInput = {
        userId: 'test-user',
        name: 'Test',
        type: TransactionType.EXPENSE,
      }

      const error = new Error('Connection timeout')
      vi.mocked(prisma.category.findFirst).mockRejectedValue(error)

      await expect(createOrReactivateCategory(input)).rejects.toThrow('Connection timeout')
    })
  })

  describe('Phase 2: archiveCategory()', () => {
    it('should archive category (isArchived=true)', async () => {
      const input: ArchiveCategoryInput = {
        id: 'cat-1',
        userId: 'test-user',
        isArchived: true,
      }

      const mockCategory = {
        id: 'cat-1',
        userId: 'test-user',
        name: 'Old Category',
        type: TransactionType.EXPENSE,
        color: '#FF5733',
        isHolding: false,
        isArchived: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.update).mockResolvedValue(mockCategory)

      const result = await archiveCategory(input)

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1', userId: 'test-user' },
        data: { isArchived: true },
      })
      expect(result.isArchived).toBe(true)
    })

    it('should unarchive category (isArchived=false)', async () => {
      const input: ArchiveCategoryInput = {
        id: 'cat-1',
        userId: 'test-user',
        isArchived: false,
      }

      const mockCategory = {
        id: 'cat-1',
        userId: 'test-user',
        name: 'Restored Category',
        type: TransactionType.EXPENSE,
        color: '#FF5733',
        isHolding: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.update).mockResolvedValue(mockCategory)

      const result = await archiveCategory(input)

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1', userId: 'test-user' },
        data: { isArchived: false },
      })
      expect(result.isArchived).toBe(false)
    })

    it('should be idempotent when archiving already archived category', async () => {
      const input: ArchiveCategoryInput = {
        id: 'cat-1',
        userId: 'test-user',
        isArchived: true,
      }

      const mockCategory = {
        id: 'cat-1',
        userId: 'test-user',
        name: 'Already Archived',
        type: TransactionType.EXPENSE,
        color: '#FF5733',
        isHolding: false,
        isArchived: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.update).mockResolvedValue(mockCategory)

      const result = await archiveCategory(input)

      expect(result.isArchived).toBe(true)
      expect(prisma.category.update).toHaveBeenCalledTimes(1)
    })

    it('should handle category not found error', async () => {
      const input: ArchiveCategoryInput = {
        id: 'nonexistent',
        userId: 'test-user',
        isArchived: true,
      }

      const error = new Error('Record not found')
      ;(error as PrismaError).code = 'P2025'

      vi.mocked(prisma.category.update).mockRejectedValue(error)

      await expect(archiveCategory(input)).rejects.toThrow('Record not found')
    })

    it('should handle Prisma update failure', async () => {
      const input: ArchiveCategoryInput = {
        id: 'cat-1',
        userId: 'test-user',
        isArchived: true,
      }

      const error = new Error('Database error')
      vi.mocked(prisma.category.update).mockRejectedValue(error)

      await expect(archiveCategory(input)).rejects.toThrow('Database error')
    })
  })

  describe('Phase 3: getCategoryById()', () => {
    it('should find existing category', async () => {
      const mockCategory = {
        id: 'cat-1',
        userId: 'test-user',
        name: 'Groceries',
        type: TransactionType.EXPENSE,
        color: '#FF5733',
        isHolding: false,
        isArchived: false,
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

      const result = await getCategoryById('nonexistent')

      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent' },
      })
      expect(result).toBeNull()
    })

    it('should handle Prisma query error', async () => {
      const error = new Error('Query failed')
      vi.mocked(prisma.category.findUnique).mockRejectedValue(error)

      await expect(getCategoryById('cat-1')).rejects.toThrow('Query failed')
    })
  })
})
