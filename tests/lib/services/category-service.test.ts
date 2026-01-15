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
      findUnique: vi.fn(),
    },
  },
}))

// Import after mocks
import { prisma } from '@/lib/prisma'
import {
  createCategory,
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

  describe('Phase 1: createCategory()', () => {
    it('should create category with all fields', async () => {
      const input: CreateCategoryInput = {
        name: 'Groceries',
        type: TransactionType.EXPENSE,
        color: '#FF5733',
      }

      const mockCategory = {
        id: 'cat-1',
        name: 'Groceries',
        type: TransactionType.EXPENSE,
        color: '#FF5733',
        isHolding: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.create).mockResolvedValue(mockCategory)

      const result = await createCategory(input)

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          name: 'Groceries',
          type: TransactionType.EXPENSE,
          color: '#FF5733',
        },
      })
      expect(result).toEqual(mockCategory)
    })

    it('should create category without color (null)', async () => {
      const input: CreateCategoryInput = {
        name: 'Salary',
        type: TransactionType.INCOME,
      }

      const mockCategory = {
        id: 'cat-2',
        name: 'Salary',
        type: TransactionType.INCOME,
        color: null,
        isHolding: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.create).mockResolvedValue(mockCategory)

      const result = await createCategory(input)

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          name: 'Salary',
          type: TransactionType.INCOME,
          color: null,
        },
      })
      expect(result).toEqual(mockCategory)
    })

    it('should create category with explicit null color', async () => {
      const input: CreateCategoryInput = {
        name: 'Transport',
        type: TransactionType.EXPENSE,
        color: null,
      }

      const mockCategory = {
        id: 'cat-3',
        name: 'Transport',
        type: TransactionType.EXPENSE,
        color: null,
        isHolding: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.create).mockResolvedValue(mockCategory)

      await createCategory(input)

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          name: 'Transport',
          type: TransactionType.EXPENSE,
          color: null,
        },
      })
    })

    it('should create INCOME type category', async () => {
      const input: CreateCategoryInput = {
        name: 'Freelance',
        type: TransactionType.INCOME,
        color: '#00FF00',
      }

      const mockCategory = {
        id: 'cat-4',
        name: 'Freelance',
        type: TransactionType.INCOME,
        color: '#00FF00',
        isHolding: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.create).mockResolvedValue(mockCategory)

      const result = await createCategory(input)

      expect(result.type).toBe(TransactionType.INCOME)
    })

    it('should create EXPENSE type category', async () => {
      const input: CreateCategoryInput = {
        name: 'Utilities',
        type: TransactionType.EXPENSE,
        color: '#0000FF',
      }

      const mockCategory = {
        id: 'cat-5',
        name: 'Utilities',
        type: TransactionType.EXPENSE,
        color: '#0000FF',
        isHolding: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.create).mockResolvedValue(mockCategory)

      const result = await createCategory(input)

      expect(result.type).toBe(TransactionType.EXPENSE)
    })

    it('should handle Prisma unique constraint violation', async () => {
      const input: CreateCategoryInput = {
        name: 'Groceries',
        type: TransactionType.EXPENSE,
      }

      const error = new Error('Unique constraint failed')
      ;(error as PrismaError).code = 'P2002'

      vi.mocked(prisma.category.create).mockRejectedValue(error)

      await expect(createCategory(input)).rejects.toThrow('Unique constraint failed')
    })

    it('should handle Prisma connection error', async () => {
      const input: CreateCategoryInput = {
        name: 'Test',
        type: TransactionType.EXPENSE,
      }

      const error = new Error('Connection timeout')
      vi.mocked(prisma.category.create).mockRejectedValue(error)

      await expect(createCategory(input)).rejects.toThrow('Connection timeout')
    })
  })

  describe('Phase 2: archiveCategory()', () => {
    it('should archive category (isArchived=true)', async () => {
      const input: ArchiveCategoryInput = {
        id: 'cat-1',
        isArchived: true,
      }

      const mockCategory = {
        id: 'cat-1',
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
        where: { id: 'cat-1' },
        data: { isArchived: true },
      })
      expect(result.isArchived).toBe(true)
    })

    it('should unarchive category (isArchived=false)', async () => {
      const input: ArchiveCategoryInput = {
        id: 'cat-1',
        isArchived: false,
      }

      const mockCategory = {
        id: 'cat-1',
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
        where: { id: 'cat-1' },
        data: { isArchived: false },
      })
      expect(result.isArchived).toBe(false)
    })

    it('should be idempotent when archiving already archived category', async () => {
      const input: ArchiveCategoryInput = {
        id: 'cat-1',
        isArchived: true,
      }

      const mockCategory = {
        id: 'cat-1',
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
