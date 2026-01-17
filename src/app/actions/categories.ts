'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { successVoid } from '@/lib/action-result'
import { handlePrismaError } from '@/lib/prisma-errors'
import { parseInput, requireCsrfToken, requireAuthUser, requireActiveSubscription } from './shared'
import { categorySchema, archiveCategorySchema } from '@/schemas'

export async function createCategoryAction(input: z.infer<typeof categorySchema>) {
  const parsed = parseInput(categorySchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  // Check subscription before allowing category creation
  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  try {
    // Use upsert to handle race condition and archived category reactivation:
    // - If category exists and is archived, unarchive it with updated properties
    // - If category doesn't exist, create it
    // - If category exists and is not archived, the unique constraint prevents duplicates
    const existing = await prisma.category.findFirst({
      where: {
        userId: authUser.id,
        name: parsed.data.name,
        type: parsed.data.type,
      },
    })

    if (existing && !existing.isArchived) {
      // Category exists and is active - reject duplicate
      return handlePrismaError(new Error('P2002'), {
        action: 'createCategory',
        userId: authUser.id,
        input: parsed.data,
        uniqueMessage: 'A category with this name already exists',
        fallbackMessage: 'Unable to create category',
      })
    }

    if (existing && existing.isArchived) {
      // Reactivate archived category with new properties
      await prisma.category.update({
        where: { id: existing.id },
        data: {
          isArchived: false,
          color: parsed.data.color ?? null,
        },
      })
    } else {
      // Create new category
      await prisma.category.create({
        data: {
          userId: authUser.id,
          name: parsed.data.name,
          type: parsed.data.type,
          color: parsed.data.color ?? null,
        },
      })
    }
  } catch (error) {
    return handlePrismaError(error, {
      action: 'createCategory',
      userId: authUser.id,
      input: parsed.data,
      uniqueMessage: 'A category with this name already exists',
      fallbackMessage: 'Unable to create category',
    })
  }

  revalidatePath('/')
  return successVoid()
}

export async function archiveCategoryAction(input: z.infer<typeof archiveCategorySchema>) {
  const parsed = parseInput(archiveCategorySchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  // Check subscription before allowing category archive
  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  try {
    await prisma.category.update({
      where: {
        id: parsed.data.id,
        userId: authUser.id, // Ensure category belongs to user
      },
      data: { isArchived: parsed.data.isArchived },
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'archiveCategory',
      userId: authUser.id,
      input: parsed.data,
      notFoundMessage: 'Category not found',
      fallbackMessage: 'Unable to update category',
    })
  }

  revalidatePath('/')
  return successVoid()
}
