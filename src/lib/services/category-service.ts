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

/** Result type for createOrReactivateCategory */
export type CreateCategoryResult =
  | { success: true; category: Awaited<ReturnType<typeof prisma.category.create>>; reactivated: boolean }
  | { success: false; error: 'DUPLICATE' }

/**
 * Create a new category or reactivate an archived one.
 * Handles the race condition where concurrent requests might try to create
 * the same category.
 *
 * @returns Success with category and whether it was reactivated, or error if duplicate
 */
export async function createOrReactivateCategory(input: CreateCategoryInput): Promise<CreateCategoryResult> {
  // Check if category with same name and type exists
  const existing = await prisma.category.findFirst({
    where: {
      userId: input.userId,
      name: input.name,
      type: input.type,
    },
  })

  if (existing && !existing.isArchived) {
    // Category exists and is active - reject duplicate
    return { success: false, error: 'DUPLICATE' }
  }

  if (existing && existing.isArchived) {
    // Reactivate archived category with new properties
    try {
      const category = await prisma.category.update({
        where: { id: existing.id },
        data: {
          isArchived: false,
          color: input.color ?? null,
        },
      })
      return { success: true, category, reactivated: true }
    } catch (error) {
      // Handle race condition: another request might have already reactivated it
      if (isPrismaUniqueConstraintError(error)) {
        return { success: false, error: 'DUPLICATE' }
      }
      throw error
    }
  }

  // Create new category (with race condition handling)
  try {
    const category = await prisma.category.create({
      data: {
        userId: input.userId,
        name: input.name,
        type: input.type,
        color: input.color ?? null,
      },
    })
    return { success: true, category, reactivated: false }
  } catch (error) {
    // Handle race condition: another request might have created the category
    if (isPrismaUniqueConstraintError(error)) {
      return { success: false, error: 'DUPLICATE' }
    }
    throw error
  }
}

/**
 * Type guard for Prisma P2002 unique constraint errors.
 */
function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002' &&
    'name' in error &&
    (error as { name: string }).name === 'PrismaClientKnownRequestError'
  )
}

/**
 * Create a new category (legacy - throws on duplicate)
 * @deprecated Use createOrReactivateCategory instead for better handling
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
