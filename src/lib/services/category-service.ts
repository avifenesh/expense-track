import { TransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface CreateCategoryInput {
  name: string
  type: TransactionType
  color?: string | null
}

export interface ArchiveCategoryInput {
  id: string
  isArchived: boolean
}

/**
 * Create a new category
 */
export async function createCategory(input: CreateCategoryInput) {
  return await prisma.category.create({
    data: {
      name: input.name,
      type: input.type,
      color: input.color ?? null,
    },
  })
}

/**
 * Archive or unarchive a category (soft delete)
 */
export async function archiveCategory(input: ArchiveCategoryInput) {
  return await prisma.category.update({
    where: { id: input.id },
    data: { isArchived: input.isArchived },
  })
}

/**
 * Get a category by ID
 */
export async function getCategoryById(id: string) {
  return await prisma.category.findUnique({ where: { id } })
}
