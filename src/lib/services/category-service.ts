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

export type CreateCategoryResult =
  | { success: true; category: Awaited<ReturnType<typeof prisma.category.create>>; reactivated: boolean }
  | { success: false; error: 'DUPLICATE' }

export async function createOrReactivateCategory(input: CreateCategoryInput): Promise<CreateCategoryResult> {
  const existing = await prisma.category.findFirst({
    where: {
      userId: input.userId,
      name: input.name,
      type: input.type,
    },
  })

  if (existing && !existing.isArchived) {
    return { success: false, error: 'DUPLICATE' }
  }

  if (existing && existing.isArchived) {
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

    if (updateResult.count === 0) {
      return { success: false, error: 'DUPLICATE' }
    }

    const category = await prisma.category.findUnique({
      where: { id: existing.id },
    })

    if (!category) {
      throw new ServiceError('Category not found after reactivation', 'INTERNAL_ERROR', 500)
    }

    return { success: true, category, reactivated: true }
  }

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
    if (isPrismaUniqueConstraintError(error)) {
      return { success: false, error: 'DUPLICATE' }
    }
    throw error
  }
}

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

export async function archiveCategory(input: ArchiveCategoryInput) {
  return await prisma.category.update({
    where: { id: input.id, userId: input.userId },
    data: { isArchived: input.isArchived },
  })
}

export async function getCategoryById(id: string, userId?: string) {
  if (userId) {
    return await prisma.category.findFirst({ where: { id, userId } })
  }
  return await prisma.category.findUnique({ where: { id } })
}

export type UpdateCategoryResult =
  | { success: true; category: Awaited<ReturnType<typeof prisma.category.update>> }
  | { success: false; error: 'DUPLICATE' }

export async function updateCategory(input: UpdateCategoryInput): Promise<UpdateCategoryResult> {
  const existing = await prisma.category.findFirst({
    where: { id: input.id, userId: input.userId },
  })

  if (!existing) {
    throw new ServiceError('Category not found', 'NOT_FOUND', 404)
  }

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

  try {
    const category = await prisma.category.update({
      where: { id: input.id, userId: input.userId },
      data: {
        name: input.name,
        ...(input.color !== undefined && { color: input.color }),
      },
    })

    return { success: true, category }
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return { success: false, error: 'DUPLICATE' }
    }
    throw error
  }
}
