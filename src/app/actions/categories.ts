'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { successVoid, generalError } from '@/lib/action-result'
import { handlePrismaError } from '@/lib/prisma-errors'
import { getDbUserAsAuthUser, requireSession } from '@/lib/auth-server'
import { parseInput, requireCsrfToken, requireActiveSubscription } from './shared'
import { categorySchema, archiveCategorySchema } from '@/schemas'

export async function createCategoryAction(input: z.infer<typeof categorySchema>) {
  const parsed = parseInput(categorySchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  let session
  try {
    session = await requireSession()
  } catch {
    return generalError('Your session expired. Please sign in again.')
  }

  const authUser = await getDbUserAsAuthUser(session.userEmail)
  if (!authUser) {
    return generalError('User record not found')
  }

  // Check subscription before allowing category creation
  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  try {
    await prisma.category.create({
      data: {
        userId: authUser.id,
        name: parsed.data.name,
        type: parsed.data.type,
        color: parsed.data.color ?? null,
      },
    })
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

  let session
  try {
    session = await requireSession()
  } catch {
    return generalError('Your session expired. Please sign in again.')
  }

  const authUser = await getDbUserAsAuthUser(session.userEmail)
  if (!authUser) {
    return generalError('User record not found')
  }

  // Check subscription before allowing category archive
  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

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
