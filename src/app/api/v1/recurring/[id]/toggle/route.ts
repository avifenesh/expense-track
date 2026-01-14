import { NextRequest } from 'next/server'
import { requireJwtAuth, getUserAuthInfo } from '@/lib/api-auth'
import { toggleRecurringTemplate, getRecurringTemplateById } from '@/lib/services/recurring-service'
import { toggleRecurringSchema } from '@/schemas'
import {
  validationError,
  authError,
  forbiddenError,
  notFoundError,
  serverError,
  successResponse,
} from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // 1. Authenticate
  let user
  try {
    user = requireJwtAuth(request)
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

  const apiSchema = toggleRecurringSchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse({ ...body, id })

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  // 3. Check template exists
  const existing = await getRecurringTemplateById(id)
  if (!existing) {
    return notFoundError('Recurring template not found')
  }

  // 4. Authorize account access
  const account = await prisma.account.findUnique({ where: { id: existing.accountId } })
  if (!account) return notFoundError('Account not found')

  const authUser = getUserAuthInfo(user.userId)
  if (!authUser.accountNames.includes(account.name)) {
    return forbiddenError('You do not have access to this account')
  }

  // 5. Execute toggle
  try {
    await toggleRecurringTemplate(data)
    return successResponse({ id, isActive: data.isActive })
  } catch {
    return serverError('Unable to toggle recurring template')
  }
}
