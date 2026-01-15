import { NextRequest } from 'next/server'
import { requireJwtAuth, getUserAuthInfo } from '@/lib/api-auth'
import { updateHolding, deleteHolding, getHoldingById } from '@/lib/services/holding-service'
import { updateHoldingSchema } from '@/schemas'
import {
  validationError,
  authError,
  forbiddenError,
  notFoundError,
  serverError,
  successResponse,
  rateLimitError,
} from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // 1. Authenticate
  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  // 1.5 Rate limit check
  const rateLimit = checkRateLimit(user.userId)
  if (!rateLimit.allowed) {
    return rateLimitError(rateLimit.resetAt)
  }
  incrementRateLimit(user.userId)

  // 2. Parse and validate input
  let body
  try {
    body = await request.json()
  } catch {
    return validationError({ body: ['Invalid JSON'] })
  }

  const apiSchema = updateHoldingSchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse({ ...body, id })

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  // 3. Check holding exists
  const existing = await getHoldingById(id)
  if (!existing) {
    return notFoundError('Holding not found')
  }

  // 4. Authorize account access
  const account = await prisma.account.findUnique({ where: { id: existing.accountId } })
  if (!account) return notFoundError('Account not found')

  const authUser = await getUserAuthInfo(user.userId)
  if (!authUser.accountNames.includes(account.name)) {
    return forbiddenError('You do not have access to this account')
  }

  // 5. Execute update
  try {
    await updateHolding(data)
    return successResponse({ id })
  } catch {
    return serverError('Unable to update holding')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // 1. Authenticate
  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  // 1.5 Rate limit check
  const rateLimitCheck = checkRateLimit(user.userId)
  if (!rateLimitCheck.allowed) {
    return rateLimitError(rateLimitCheck.resetAt)
  }
  incrementRateLimit(user.userId)

  // 2. Check holding exists
  const existing = await getHoldingById(id)
  if (!existing) {
    return notFoundError('Holding not found')
  }

  // 3. Authorize account access
  const account = await prisma.account.findUnique({ where: { id: existing.accountId } })
  if (!account) return notFoundError('Account not found')

  const authUser = await getUserAuthInfo(user.userId)
  if (!authUser.accountNames.includes(account.name)) {
    return forbiddenError('You do not have access to this account')
  }

  // 4. Execute delete
  try {
    await deleteHolding(id)
    return successResponse({ id })
  } catch {
    return serverError('Unable to delete holding')
  }
}
