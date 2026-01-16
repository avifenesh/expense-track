import { TransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface CreateCategoryInput {
  userId: string
  name: string
  type: TransactionType
  color?: string | null
}

export interface ArchiveCategoryInput {
  id: string
  userId: string
  isArchived: boolean
}

/**
 * Create a new category
 */
export async function createCategory(input: CreateCategoryInput) {
  return await prisma.category.create({
    data: {
      userId: input.userId,
      name: input.name,
      type: input.type,
      color: input.color ?? null,
    },
  })
}

/**
 * Archive or unarchive a category (soft delete)
 * Requires userId to ensure user can only archive their own categories
 */
export async function archiveCategory(input: ArchiveCategoryInput) {
  return await prisma.category.update({
    where: { id: input.id, userId: input.userId },
    data: { isArchived: input.isArchived },
  })
}

/**
 * Get a category by ID
 * If userId is provided, only returns the category if it belongs to that user
 */
export async function getCategoryById(id: string, userId?: string) {
  if (userId) {
    return await prisma.category.findFirst({ where: { id, userId } })
  }
  return await prisma.category.findUnique({ where: { id } })
}
