import { NextRequest } from 'next/server'
import { requireJwtAuth, getUserAuthInfo } from '@/lib/api-auth'
import { refreshHoldingPrices } from '@/lib/services/holding-service'
import { refreshHoldingPricesSchema } from '@/schemas'
import { validationError, authError, forbiddenError, serverError, successResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
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

  const apiSchema = refreshHoldingPricesSchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  // 3. Authorize account access
  const account = await prisma.account.findUnique({ where: { id: data.accountId } })
  if (!account) return forbiddenError('Account not found')

  const authUser = getUserAuthInfo(user.userId)
  if (!authUser.accountNames.includes(account.name)) {
    return forbiddenError('You do not have access to this account')
  }

  // 4. Execute refresh
  try {
    const result = await refreshHoldingPrices({ accountId: data.accountId })
    return successResponse(result)
  } catch {
    return serverError('Unable to refresh stock prices')
  }
}
