import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { resetAllRateLimits } from '@/lib/rate-limit'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/server-logger', () => ({
  serverLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import { POST as requestResetPost } from '@/app/api/v1/auth/request-reset/route'
import { POST as resetPasswordPost } from '@/app/api/v1/auth/reset-password/route'
import { prisma } from '@/lib/prisma'

describe('Password Reset Flow', () => {
  beforeEach(() => {
    resetAllRateLimits()
    vi.clearAllMocks()
  })

  describe('POST /api/v1/auth/request-reset', () => {
    const buildRequest = (body: unknown) =>
      new NextRequest('http://localhost/api/v1/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

    describe('success cases', () => {
      it('generates reset token for existing user', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
          id: 'user-id',
          email: 'test@example.com',
          displayName: 'Test User',
          passwordHash: 'hashed',
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
          passwordResetToken: null,
          passwordResetExpires: null,
          preferredCurrency: 'USD',
          hasCompletedOnboarding: false,
    activeAccountId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        vi.mocked(prisma.user.update).mockResolvedValueOnce({
          id: 'user-id',
          email: 'test@example.com',
          displayName: 'Test User',
          passwordHash: 'hashed',
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
          passwordResetToken: 'reset-token',
          passwordResetExpires: new Date(),
          preferredCurrency: 'USD',
          hasCompletedOnboarding: false,
    activeAccountId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        const response = await requestResetPost(buildRequest({ email: 'test@example.com' }))

        const data = await response.json()
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.message).toContain('If an account exists')
        expect(prisma.user.update).toHaveBeenCalled()
      })

      it('returns same success message for non-existent email (email enumeration protection)', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)

        const response = await requestResetPost(buildRequest({ email: 'nonexistent@example.com' }))

        const data = await response.json()
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.message).toContain('If an account exists')
        expect(prisma.user.update).not.toHaveBeenCalled()
      })
    })

    describe('validation errors', () => {
      it('returns 400 for invalid email', async () => {
        const response = await requestResetPost(buildRequest({ email: 'not-an-email' }))

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.fields?.email).toBeDefined()
      })

      it('returns 400 for missing email', async () => {
        const response = await requestResetPost(buildRequest({}))

        expect(response.status).toBe(400)
      })

      it('returns 400 for malformed JSON', async () => {
        const response = await requestResetPost(
          new NextRequest('http://localhost/api/v1/auth/request-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'not json',
          }),
        )

        expect(response.status).toBe(400)
      })
    })

    describe('rate limiting', () => {
      it('returns 429 after 3 attempts for same email within 1 hour', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
          id: 'user-id',
          email: 'test@example.com',
          displayName: 'Test User',
          passwordHash: 'hashed',
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
          passwordResetToken: null,
          passwordResetExpires: null,
          preferredCurrency: 'USD',
          hasCompletedOnboarding: false,
    activeAccountId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        vi.mocked(prisma.user.update).mockResolvedValue({
          id: 'user-id',
          email: 'test@example.com',
          displayName: 'Test User',
          passwordHash: 'hashed',
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
          passwordResetToken: 'reset-token',
          passwordResetExpires: new Date(),
          preferredCurrency: 'USD',
          hasCompletedOnboarding: false,
    activeAccountId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        // First 3 attempts should succeed
        for (let i = 0; i < 3; i++) {
          const response = await requestResetPost(buildRequest({ email: 'ratelimit-reset@example.com' }))
          expect(response.status).not.toBe(429)
        }

        // 4th attempt should be rate limited
        const response = await requestResetPost(buildRequest({ email: 'ratelimit-reset@example.com' }))
        expect(response.status).toBe(429)
        expect(response.headers.get('Retry-After')).toBeTruthy()
      })
    })
  })

  describe('POST /api/v1/auth/reset-password', () => {
    const buildRequest = (body: unknown) =>
      new NextRequest('http://localhost/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

    describe('success cases', () => {
      it('resets password successfully with valid token', async () => {
        const futureDate = new Date(Date.now() + 60 * 60 * 1000)
        vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
          id: 'user-id',
          email: 'test@example.com',
          displayName: 'Test User',
          passwordHash: 'old-hash',
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
          passwordResetToken: 'valid-token',
          passwordResetExpires: futureDate,
          preferredCurrency: 'USD',
          hasCompletedOnboarding: false,
    activeAccountId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        vi.mocked(prisma.user.update).mockResolvedValueOnce({
          id: 'user-id',
          email: 'test@example.com',
          displayName: 'Test User',
          passwordHash: 'new-hash',
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
          passwordResetToken: null,
          passwordResetExpires: null,
          preferredCurrency: 'USD',
          hasCompletedOnboarding: false,
    activeAccountId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValueOnce({ count: 1 })

        const response = await resetPasswordPost(
          buildRequest({
            token: 'valid-token',
            newPassword: 'NewPassword123',
          }),
        )

        const data = await response.json()
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.message).toContain('reset successfully')
        expect(prisma.user.update).toHaveBeenCalled()
        expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
          where: { userId: 'user-id' },
        })
      })
    })

    describe('error cases', () => {
      it('returns 401 for invalid token', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)

        const response = await resetPasswordPost(
          buildRequest({
            token: 'invalid-token',
            newPassword: 'NewPassword123',
          }),
        )

        expect(response.status).toBe(401)
        const data = await response.json()
        expect(data.error).toContain('Invalid or expired')
      })

      it('returns 401 for expired token', async () => {
        const pastDate = new Date(Date.now() - 60 * 60 * 1000)
        vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
          id: 'user-id',
          email: 'test@example.com',
          displayName: 'Test User',
          passwordHash: 'hashed',
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
          passwordResetToken: 'expired-token',
          passwordResetExpires: pastDate,
          preferredCurrency: 'USD',
          hasCompletedOnboarding: false,
    activeAccountId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        const response = await resetPasswordPost(
          buildRequest({
            token: 'expired-token',
            newPassword: 'NewPassword123',
          }),
        )

        expect(response.status).toBe(401)
        const data = await response.json()
        expect(data.error).toContain('expired')
      })
    })

    describe('validation errors', () => {
      it('returns 400 for password too short', async () => {
        const response = await resetPasswordPost(
          buildRequest({
            token: 'valid-token',
            newPassword: 'Pass1',
          }),
        )

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.fields?.newPassword).toBeDefined()
      })

      it('returns 400 for password without uppercase', async () => {
        const response = await resetPasswordPost(
          buildRequest({
            token: 'valid-token',
            newPassword: 'password123',
          }),
        )

        expect(response.status).toBe(400)
      })

      it('returns 400 for password without lowercase', async () => {
        const response = await resetPasswordPost(
          buildRequest({
            token: 'valid-token',
            newPassword: 'PASSWORD123',
          }),
        )

        expect(response.status).toBe(400)
      })

      it('returns 400 for password without number', async () => {
        const response = await resetPasswordPost(
          buildRequest({
            token: 'valid-token',
            newPassword: 'PasswordABC',
          }),
        )

        expect(response.status).toBe(400)
      })

      it('returns 400 for missing token', async () => {
        const response = await resetPasswordPost(
          buildRequest({
            newPassword: 'NewPassword123',
          }),
        )

        expect(response.status).toBe(400)
      })

      it('returns 400 for missing newPassword', async () => {
        const response = await resetPasswordPost(
          buildRequest({
            token: 'valid-token',
          }),
        )

        expect(response.status).toBe(400)
      })

      it('returns 400 for malformed JSON', async () => {
        const response = await resetPasswordPost(
          new NextRequest('http://localhost/api/v1/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'not json',
          }),
        )

        expect(response.status).toBe(400)
      })
    })
  })
})
