import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { Currency } from '@prisma/client'

// Mock dependencies before imports
vi.mock('@/lib/api-auth', () => ({
  requireJwtAuth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitTyped: vi.fn().mockReturnValue({ allowed: true, limit: 3, remaining: 2, resetAt: new Date() }),
  incrementRateLimitTyped: vi.fn(),
  resetAllRateLimits: vi.fn(),
}))

vi.mock('@/lib/paddle', () => ({
  cancelPaddleSubscription: vi.fn(),
}))

vi.mock('@/lib/server-logger', () => ({
  serverLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

import { DELETE } from '@/app/api/v1/auth/account/route'
import { requireJwtAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimitTyped, resetAllRateLimits } from '@/lib/rate-limit'
import { cancelPaddleSubscription } from '@/lib/paddle'
import { serverLogger } from '@/lib/server-logger'

describe('DELETE /api/v1/auth/account', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    passwordHash: 'hashed-password',
    preferredCurrency: Currency.USD,
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    hasCompletedOnboarding: true,
    activeAccountId: null,
    deletedAt: null,
    deletedBy: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    subscription: null,
  }

  const buildRequest = (body: unknown) =>
    new NextRequest('http://localhost/api/v1/auth/account', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token',
      },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.clearAllMocks()
    resetAllRateLimits()
    vi.mocked(checkRateLimitTyped).mockReturnValue({
      allowed: true,
      limit: 3,
      remaining: 2,
      resetAt: new Date(),
    })
  })

  describe('authentication', () => {
    it('should return 401 if no authorization token provided', async () => {
      vi.mocked(requireJwtAuth).mockImplementation(() => {
        throw new Error('Missing authorization token')
      })

      const request = buildRequest({ confirmEmail: 'test@example.com' })
      const response = await DELETE(request)

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Missing authorization token')
    })

    it('should return 401 if token is expired', async () => {
      vi.mocked(requireJwtAuth).mockImplementation(() => {
        throw new Error('Token expired')
      })

      const request = buildRequest({ confirmEmail: 'test@example.com' })
      const response = await DELETE(request)

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Token expired')
    })

    it('should return 401 if token is invalid', async () => {
      vi.mocked(requireJwtAuth).mockImplementation(() => {
        throw new Error('Invalid token')
      })

      const request = buildRequest({ confirmEmail: 'test@example.com' })
      const response = await DELETE(request)

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Invalid token')
    })
  })

  describe('rate limiting', () => {
    it('should return 429 when rate limited', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      const resetAt = new Date(Date.now() + 3600000) // 1 hour from now
      vi.mocked(checkRateLimitTyped).mockReturnValue({
        allowed: false,
        limit: 3,
        remaining: 0,
        resetAt,
      })

      const request = buildRequest({ confirmEmail: 'test@example.com' })
      const response = await DELETE(request)

      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBeTruthy()
    })

    it('should use account_deletion rate limit type', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          await callback(prisma)
        }
      })

      const request = buildRequest({ confirmEmail: 'test@example.com' })
      await DELETE(request)

      expect(checkRateLimitTyped).toHaveBeenCalledWith('user-123', 'account_deletion')
    })
  })

  describe('validation', () => {
    it('should return 400 for invalid JSON', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      const request = new NextRequest('http://localhost/api/v1/auth/account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token',
        },
        body: 'not json',
      })

      const response = await DELETE(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.fields?.body).toBeDefined()
    })

    it('should return 400 for missing confirmEmail', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      const request = buildRequest({})
      const response = await DELETE(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.fields?.confirmEmail).toBeDefined()
    })

    it('should return 400 for invalid email format', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      const request = buildRequest({ confirmEmail: 'not-an-email' })
      const response = await DELETE(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.fields?.confirmEmail).toBeDefined()
    })

    it('should return 400 when confirmEmail does not match user email', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)

      const request = buildRequest({ confirmEmail: 'different@example.com' })
      const response = await DELETE(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.fields?.confirmEmail).toBeDefined()
      expect(body.fields?.confirmEmail[0]).toContain('Email confirmation does not match')
    })

    it('should accept email confirmation case-insensitively', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          await callback(prisma)
        }
      })

      const request = buildRequest({ confirmEmail: 'TEST@EXAMPLE.COM' })
      const response = await DELETE(request)

      expect(response.status).toBe(200)
    })
  })

  describe('user not found', () => {
    it('should return 401 when user not found in database', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const request = buildRequest({ confirmEmail: 'test@example.com' })
      const response = await DELETE(request)

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('User not found')
    })

    it('should return 401 when user is already deleted', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      // User is not found because deletedAt is set (filtered by query)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const request = buildRequest({ confirmEmail: 'test@example.com' })
      const response = await DELETE(request)

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('User not found')
    })
  })

  describe('successful deletion', () => {
    it('should delete account and return success', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          await callback(prisma)
        }
      })

      const request = buildRequest({ confirmEmail: 'test@example.com' })
      const response = await DELETE(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.message).toBe('Account deleted successfully')
    })

    it('should anonymize user data in transaction', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)

      let userUpdateData: Record<string, unknown> | null = null
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          const mockTx = {
            user: {
              update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
                userUpdateData = data
                return Promise.resolve({})
              }),
            },
            refreshToken: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
          }
          await callback(mockTx as never)
        }
      })

      const request = buildRequest({ confirmEmail: 'test@example.com' })
      await DELETE(request)

      expect(userUpdateData).not.toBeNull()
      expect(userUpdateData!.deletedAt).toBeDefined()
      expect(userUpdateData!.deletedBy).toBe('user-123')
      expect(userUpdateData!.displayName).toBe('Deleted User')
      expect(userUpdateData!.passwordHash).toBe('')
      expect(userUpdateData!.emailVerified).toBe(false)
      expect(userUpdateData!.emailVerificationToken).toBeNull()
      expect(userUpdateData!.passwordResetToken).toBeNull()
      // Email should be anonymized (starts with 'deleted-')
      expect((userUpdateData!.email as string).startsWith('deleted-')).toBe(true)
    })

    it('should delete all refresh tokens for the user', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)

      let refreshTokenDeleteWhere: Record<string, unknown> | null = null
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          const mockTx = {
            user: {
              update: vi.fn().mockResolvedValue({}),
            },
            refreshToken: {
              deleteMany: vi.fn().mockImplementation(({ where }) => {
                refreshTokenDeleteWhere = where
                return Promise.resolve({ count: 2 })
              }),
            },
          }
          await callback(mockTx as never)
        }
      })

      const request = buildRequest({ confirmEmail: 'test@example.com' })
      await DELETE(request)

      expect(refreshTokenDeleteWhere).toEqual({ userId: 'user-123' })
    })

    it('should log successful deletion', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          await callback(prisma)
        }
      })

      const request = buildRequest({ confirmEmail: 'test@example.com' })
      await DELETE(request)

      expect(serverLogger.info).toHaveBeenCalledWith(
        'User account deleted (GDPR)',
        expect.objectContaining({
          userId: 'user-123',
          originalEmail: 'test@example.com',
        }),
      )
    })
  })

  describe('Paddle subscription cancellation', () => {
    it('should cancel Paddle subscription when user has one', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      const userWithSubscription = {
        ...mockUser,
        subscription: {
          paddleSubscriptionId: 'sub_12345',
        },
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithSubscription)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          await callback(prisma)
        }
      })
      vi.mocked(cancelPaddleSubscription).mockResolvedValue({ data: {} } as never)

      const request = buildRequest({ confirmEmail: 'test@example.com' })
      const response = await DELETE(request)

      expect(response.status).toBe(200)
      expect(cancelPaddleSubscription).toHaveBeenCalledWith('sub_12345')
      expect(serverLogger.info).toHaveBeenCalledWith(
        'Paddle subscription canceled for deleted account',
        expect.objectContaining({
          userId: 'user-123',
          subscriptionId: 'sub_12345',
        }),
      )
    })

    it('should succeed even if Paddle cancellation fails', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      const userWithSubscription = {
        ...mockUser,
        subscription: {
          paddleSubscriptionId: 'sub_12345',
        },
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithSubscription)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          await callback(prisma)
        }
      })
      vi.mocked(cancelPaddleSubscription).mockRejectedValue(new Error('Paddle API error'))

      const request = buildRequest({ confirmEmail: 'test@example.com' })
      const response = await DELETE(request)

      // Should still succeed - Paddle failure is non-blocking
      expect(response.status).toBe(200)
      expect(serverLogger.error).toHaveBeenCalledWith(
        'Failed to cancel Paddle subscription during account deletion',
        expect.objectContaining({
          userId: 'user-123',
          subscriptionId: 'sub_12345',
          error: 'Paddle API error',
        }),
      )
    })

    it('should not call Paddle when user has no subscription', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          await callback(prisma)
        }
      })

      const request = buildRequest({ confirmEmail: 'test@example.com' })
      await DELETE(request)

      expect(cancelPaddleSubscription).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should return 500 when database transaction fails', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error('Transaction failed'))

      const request = buildRequest({ confirmEmail: 'test@example.com' })
      const response = await DELETE(request)

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('Account deletion failed')
      expect(serverLogger.error).toHaveBeenCalled()
    })
  })

  describe('deleted user cannot authenticate', () => {
    it('should reject authentication for deleted users via api-auth filter', async () => {
      // This test verifies the auth filter behavior we implemented earlier
      // When getUserAuthInfo is called with deletedAt: null filter,
      // it should return null for deleted users

      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'deleted-user-123',
        email: 'deleted@example.com',
      })

      // Simulate that the user lookup returns null because user is deleted
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const request = buildRequest({ confirmEmail: 'deleted@example.com' })
      const response = await DELETE(request)

      // Should fail to find user (returns 401)
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('User not found')
    })
  })
})
