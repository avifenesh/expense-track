'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { successVoid, generalError } from '@/lib/action-result'
import { requireSession, getAuthUserFromSession } from '@/lib/auth-server'
import { parseInput, requireCsrfToken } from './shared'
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

  const authUser = getAuthUserFromSession(session)
  if (!authUser) {
    return generalError('User record not found')
  }

  try {
    await prisma.category.create({
      data: {
        userId: authUser.id,
        name: parsed.data.name,
        type: parsed.data.type,
        color: parsed.data.color ?? null,
      },
    })
  } catch {
    return generalError('Category already exists')
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

  const authUser = getAuthUserFromSession(session)
  if (!authUser) {
    return generalError('User record not found')
  }

  try {
    await prisma.category.update({
      where: {
        id: parsed.data.id,
        userId: authUser.id, // Ensure category belongs to user
      },
      data: { isArchived: parsed.data.isArchived },
    })
  } catch {
    return generalError('Category not found')
  }

  revalidatePath('/')
  return successVoid()
}
