import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { validationError, successResponse, serverError, authError } from '@/lib/api-helpers'
import { serverLogger } from '@/lib/server-logger'

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required').max(128, 'Invalid token'),
})

export async function POST(request: NextRequest) {
  try {
    let body
    try {
      body = await request.json()
    } catch {
      return validationError({ body: ['Invalid JSON'] })
    }

    const parsed = verifyEmailSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { token } = parsed.data

    // Find user with this verification token
    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token },
    })

    if (!user) {
      return authError('Invalid or expired verification token')
    }

    // Check if token has expired
    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      return authError('Verification token has expired. Please request a new one.')
    }

    // Check if already verified
    if (user.emailVerified) {
      return successResponse({ message: 'Email is already verified' })
    }

    // Update user to mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    })

    serverLogger.info('Email verified successfully', { userId: user.id, email: user.email })

    return successResponse({ message: 'Email verified successfully. You can now log in.' })
  } catch (error) {
    serverLogger.error('Email verification failed', { error })
    return serverError('Email verification failed')
  }
}
