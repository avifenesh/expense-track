import { NextRequest } from 'next/server'
import { requireJwtAuth, getUserAuthInfo } from '@/lib/api-auth'
import {
  rejectTransactionRequest,
  getTransactionRequestById,
} from '@/lib/services/transaction-service'
import {
  authError,
  forbiddenError,
  notFoundError,
  serverError,
  successResponse,
} from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Authenticate
  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  // 2. Check request exists
  const transactionRequest = await getTransactionRequestById(params.id)
  if (!transactionRequest) {
    return notFoundError('Transaction request not found')
  }

  // 3. Authorize access to 'to' account
  const toAccount = await prisma.account.findUnique({
    where: { id: transactionRequest.toId },
  })
  const authUser = getUserAuthInfo(user.userId)

  if (!toAccount || !authUser.accountNames.includes(toAccount.name)) {
    return forbiddenError('You do not have access to this transaction request')
  }

  // 4. Reject request
  try {
    await rejectTransactionRequest(params.id)
    return successResponse({ id: params.id, status: 'REJECTED' })
  } catch (error) {
    if (error instanceof Error && error.message.includes('already')) {
      return forbiddenError(error.message)
    }
    return serverError('Unable to reject transaction request')
  }
}
