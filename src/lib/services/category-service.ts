import { TransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ServiceError } from './errors'

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

export interface UpdateCategoryInput {
  id: string
  userId: string
  name: string
  color?: string | null
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
    // Use updateMany with isArchived check to handle race condition atomically
    const updateResult = await prisma.category.updateMany({
      where: {
        id: existing.id,
        isArchived: true, // Only update if still archived
      },
      data: {
        isArchived: false,
        color: input.color ?? null,
      },
    })

    // If no rows were updated, another request already reactivated it
    if (updateResult.count === 0) {
      return { success: false, error: 'DUPLICATE' }
    }

    // Fetch the updated category
    const category = await prisma.category.findUnique({
      where: { id: existing.id },
    })

    if (!category) {
      // Should not happen if updateMany succeeded
      throw new ServiceError('Category not found after reactivation', 'INTERNAL_ERROR', 500)
    }

    return { success: true, category, reactivated: true }
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

/** Result type for updateCategory */
export type UpdateCategoryResult =
  | { success: true; category: Awaited<ReturnType<typeof prisma.category.update>> }
  | { success: false; error: 'DUPLICATE' }

/**
 * Update a category's name and/or color
 * Checks for duplicate names within the same user and type
 */
export async function updateCategory(input: UpdateCategoryInput): Promise<UpdateCategoryResult> {
  // Get the existing category to check its type
  const existing = await prisma.category.findFirst({
    where: { id: input.id, userId: input.userId },
  })

  if (!existing) {
    throw new ServiceError('Category not found', 'NOT_FOUND', 404)
  }

  // Check for duplicate name (same user, same type, different id, not archived)
  const duplicate = await prisma.category.findFirst({
    where: {
      userId: input.userId,
      name: input.name,
      type: existing.type,
      id: { not: input.id },
      isArchived: false,
    },
  })

  if (duplicate) {
    return { success: false, error: 'DUPLICATE' }
  }

  // Update the category
  const category = await prisma.category.update({
    where: { id: input.id, userId: input.userId },
    data: {
      name: input.name,
      color: input.color !== undefined ? input.color : undefined,
    },
  })

  return { success: true, category }
}
