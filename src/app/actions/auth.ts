'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AUTH_USERS, RECOVERY_CONTACTS } from '@/lib/auth'
import { clearSession, establishSession, updateSessionAccount, verifyCredentials } from '@/lib/auth-server'
import { success, successVoid, failure } from '@/lib/action-result'
import { parseInput, ensureAccountAccess } from './shared'
import { loginSchema, recoverySchema, accountSelectionSchema } from '@/schemas'

export async function loginAction(input: z.infer<typeof loginSchema>) {
  const parsed = parseInput(loginSchema, {
    ...input,
    email: input.email.trim().toLowerCase(),
  })
  if ('error' in parsed) return parsed
  const { email, password } = parsed.data
  const normalizedEmail = email.toLowerCase()
  const authUser = AUTH_USERS.find((user) => user.email.toLowerCase() === normalizedEmail)

  const credentialsValid = await verifyCredentials({ email, password })
  if (!credentialsValid) {
    return failure({ credentials: ['Invalid username or password'] })
  }

  if (!authUser) {
    return failure({ credentials: ['Invalid username or password'] })
  }

  const accounts = await prisma.account.findMany({
    where: { name: { in: authUser.accountNames } },
    orderBy: { name: 'asc' },
  })

  if (accounts.length === 0) {
    return {
      error: {
        general: ['No accounts are provisioned for this user. Please contact support.'],
      },
    }
  }

  const defaultAccount = accounts.find((account) => account.name === authUser.defaultAccountName) ?? accounts[0]

  await establishSession({ userEmail: authUser.email, accountId: defaultAccount.id })
  return success({ accountId: defaultAccount.id })
}

export async function logoutAction() {
  await clearSession()
  return successVoid()
}

export async function requestPasswordResetAction(input: z.infer<typeof recoverySchema>) {
  const parsed = parseInput(recoverySchema, input)
  if ('error' in parsed) return parsed

  const recoveryContact = RECOVERY_CONTACTS.find(
    (contact) => contact.email.toLowerCase() === parsed.data.email.trim().toLowerCase(),
  )

  if (!recoveryContact) {
    return {
      error: {
        email: ['Email is not registered. Reach out to the finance team to restore access.'],
      },
    }
  }

  return {
    success: true,
    message: `A reset link was sent to ${recoveryContact.email}. Use the standard password after completing the guided reset.`,
  }
}

export async function persistActiveAccountAction(input: z.infer<typeof accountSelectionSchema>) {
  const parsed = parseInput(accountSelectionSchema, input)
  if ('error' in parsed) return parsed

  const access = await ensureAccountAccess(parsed.data.accountId)
  if ('error' in access) {
    return access
  }

  const updateResult = await updateSessionAccount(access.account.id)
  if ('error' in updateResult) {
    return updateResult
  }

  return successVoid()
}
