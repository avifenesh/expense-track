import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { createTrialSubscription } from '@/lib/subscription'
import { serverLogger } from '@/lib/server-logger'

const BCRYPT_ROUNDS = 12
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24

export type RegistrationResult =
  | {
      success: true
      userId: string
      email: string
      emailVerified: boolean
      verificationToken: string | null
      verificationExpires: Date | null
    }
  | { success: false; reason: 'exists' | 'failed' }

export async function registerUser({
  email,
  password,
  displayName,
  autoVerify,
}: {
  email: string
  password: string
  displayName: string
  autoVerify?: boolean
}): Promise<RegistrationResult> {
  const normalizedEmail = email.trim().toLowerCase()

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  })

  if (existingUser) {
    return { success: false, reason: 'exists' }
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  const shouldAutoVerify = Boolean(autoVerify)
  const verificationToken = shouldAutoVerify ? null : randomBytes(32).toString('hex')
  const verificationExpires = shouldAutoVerify
    ? null
    : new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

  try {
    const newUser = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          displayName: displayName.trim(),
          passwordHash,
          emailVerified: shouldAutoVerify,
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
          accounts: {
            create: {
              name: 'Personal',
              type: 'SELF',
            },
          },
        },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          emailVerificationToken: true,
          emailVerificationExpires: true,
        },
      })

      await createTrialSubscription(createdUser.id, tx)

      return createdUser
    })

    return {
      success: true,
      userId: newUser.id,
      email: newUser.email,
      emailVerified: newUser.emailVerified,
      verificationToken: newUser.emailVerificationToken,
      verificationExpires: newUser.emailVerificationExpires,
    }
  } catch (error) {
    const hasKnownRequestError =
      typeof Prisma?.PrismaClientKnownRequestError === 'function' &&
      error instanceof Prisma.PrismaClientKnownRequestError

    if (hasKnownRequestError && error.code === 'P2002') {
      return { success: false, reason: 'exists' }
    }
    serverLogger.error('Failed to register user', { action: 'registerUser', input: { email: normalizedEmail } }, error)
    return { success: false, reason: 'failed' }
  }
}
