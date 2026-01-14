import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { archiveCategory, getCategoryById } from '@/lib/services/category-service'
import { archiveCategorySchema } from '@/schemas'
import { validationError, authError, notFoundError, serverError, successResponse } from '@/lib/api-helpers'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // 1. Authenticate
  try {
    requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  // 2. Parse and validate input
  let body
  try {
    body = await request.json()
  } catch {
    return validationError({ body: ['Invalid JSON'] })
  }

  const apiSchema = archiveCategorySchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse({ ...body, id })

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  // 3. Check category exists
  const existing = await getCategoryById(id)
  if (!existing) {
    return notFoundError('Category not found')
  }

  // 4. Execute archive (categories are global, no account authorization needed)
  try {
    await archiveCategory({
      id,
      isArchived: data.isArchived,
    })
    return successResponse({ id, isArchived: data.isArchived })
  } catch {
    return serverError('Unable to archive category')
  }
}
