import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { validationError, successResponse, serverError, authError } from '@/lib/api-helpers'
import { serverLogger } from '@/lib/server-logger'

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required').max(128, 'Invalid token'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
})

export async function POST(request: NextRequest) {
  try {
    let body
    try {
      body = await request.json()
    } catch {
      return validationError({ body: ['Invalid JSON'] })
    }

    const parsed = resetPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { token, newPassword } = parsed.data

    // Find user with this reset token
    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token },
    })

    if (!user) {
      return authError('Invalid or expired reset token')
    }

    // Check if token has expired
    if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
      return authError('Reset token has expired. Please request a new one.')
    }

    // Hash new password with bcrypt (cost factor 12)
    const passwordHash = await bcrypt.hash(newPassword, 12)

    // Update user password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    })

    // Invalidate all existing refresh tokens for this user
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    })

    serverLogger.info('Password reset successfully', { userId: user.id, email: user.email })

    return successResponse({ message: 'Password has been reset successfully. Please log in with your new password.' })
  } catch (error) {
    serverLogger.error('Password reset failed', { error })
    return serverError('Password reset failed')
  }
}
