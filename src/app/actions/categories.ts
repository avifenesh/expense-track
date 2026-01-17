'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { successVoid, failure } from '@/lib/action-result'
import { handlePrismaError } from '@/lib/prisma-errors'
import { parseInput, requireCsrfToken, requireActiveSubscription } from './shared'
import { categorySchema, archiveCategorySchema } from '@/schemas'
import { createOrReactivateCategory } from '@/lib/services/category-service'

export async function createCategoryAction(input: z.infer<typeof categorySchema>) {
  const parsed = parseInput(categorySchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  // requireActiveSubscription returns authUser - no need for separate requireAuthUser call
  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck
  const { authUser } = subscriptionCheck

  // Use service function that handles archived category reactivation
  const result = await createOrReactivateCategory({
    userId: authUser.id,
    name: parsed.data.name,
    type: parsed.data.type,
    color: parsed.data.color,
  })

  if (!result.success) {
    return failure({ name: ['A category with this name already exists'] })
  }

  revalidatePath('/')
  return successVoid()
}

export async function archiveCategoryAction(input: z.infer<typeof archiveCategorySchema>) {
  const parsed = parseInput(archiveCategorySchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  // requireActiveSubscription returns authUser - no need for separate requireAuthUser call
  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck
  const { authUser } = subscriptionCheck

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
