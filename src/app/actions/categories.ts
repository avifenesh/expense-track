'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { successVoid, generalError } from '@/lib/action-result'
import { parseInput } from './shared'
import { categorySchema, archiveCategorySchema } from '@/schemas'

export async function createCategoryAction(input: z.infer<typeof categorySchema>) {
  const parsed = parseInput(categorySchema, input)
  if ('error' in parsed) return parsed

  try {
    await prisma.category.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        color: parsed.data.color ?? null,
      },
    })
  } catch (err) {
    console.error('createCategoryAction', err)
    return generalError('Category already exists')
  }

  revalidatePath('/')
  return successVoid()
}

export async function archiveCategoryAction(input: z.infer<typeof archiveCategorySchema>) {
  const parsed = parseInput(archiveCategorySchema, input)
  if ('error' in parsed) return parsed

  try {
    await prisma.category.update({
      where: { id: parsed.data.id },
      data: { isArchived: parsed.data.isArchived },
    })
  } catch (err) {
    console.error('archiveCategoryAction', err)
    return generalError('Category not found')
  }

  revalidatePath('/')
  return successVoid()
}
