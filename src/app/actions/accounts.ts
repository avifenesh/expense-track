'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { successVoid, generalError } from '@/lib/action-result'
import { handlePrismaError } from '@/lib/prisma-errors'
import { parseInput, requireCsrfToken, requireAuthUser } from './shared'
import { deleteFinancialAccountSchema } from '@/schemas'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { getMonthKey } from '@/utils/date'

/**
 * Soft delete a financial account.
 * Sets deletedAt and deletedBy instead of hard deleting.
 * The account will be excluded from all queries that filter by deletedAt: null.
 */
export async function deleteFinancialAccountAction(input: z.infer<typeof deleteFinancialAccountSchema>) {
  const parsed = parseInput(deleteFinancialAccountSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  // Find the account and verify ownership
  let account
  try {
    account = await prisma.account.findFirst({
      where: { id: parsed.data.accountId, deletedAt: null },
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'deleteFinancialAccount.findFirst',
      input: { accountId: parsed.data.accountId },
      fallbackMessage: 'Unable to delete account',
    })
  }

  if (!account) {
    return generalError('Account not found')
  }

  if (account.userId !== authUser.id) {
    return generalError('You do not have access to this account')
  }

  // Count active accounts to prevent deleting the last one
  let activeAccountCount
  try {
    activeAccountCount = await prisma.account.count({
      where: { userId: authUser.id, deletedAt: null },
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'deleteFinancialAccount.count',
      userId: authUser.id,
      fallbackMessage: 'Unable to delete account',
    })
  }

  if (activeAccountCount <= 1) {
    return generalError('Cannot delete your only account. You must have at least one active account.')
  }

  try {
    await prisma.account.update({
      where: { id: parsed.data.accountId },
      data: { deletedAt: new Date(), deletedBy: authUser.id },
    })

    // Invalidate dashboard cache for all months (account deletion affects all historical data)
    const currentMonth = new Date()
    await invalidateDashboardCache({
      monthKey: getMonthKey(currentMonth),
      accountId: parsed.data.accountId,
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'deleteFinancialAccount',
      accountId: parsed.data.accountId,
      input: { accountId: parsed.data.accountId },
      notFoundMessage: 'Account not found',
      fallbackMessage: 'Unable to delete account',
    })
  }

  revalidatePath('/')
  return successVoid()
}
