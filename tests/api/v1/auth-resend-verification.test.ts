import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { resetAllRateLimits } from '@/lib/rate-limit'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/server-logger', () => ({
  serverLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import { POST as resendVerificationPost } from '@/app/api/v1/auth/resend-verification/route'
import { prisma } from '@/lib/prisma'

describe('POST /api/v1/auth/resend-verification', () => {
  beforeEach(() => {
    resetAllRateLimits()
    vi.clearAllMocks()
  })

  const buildRequest = (body: unknown) =>
    new NextRequest('http://localhost/api/v1/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  describe('success cases', () => {
    it('generates new verification token for unverified user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-id',
        email: 'test@example.com',
        displayName: 'Test User',
        passwordHash: 'hashed',
        emailVerified: false,
        emailVerificationToken: 'old-token',
        emailVerificationExpires: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
        preferredCurrency: 'USD',
        hasCompletedOnboarding: false,
        activeAccountId: null,
        deletedAt: null,
        deletedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(prisma.user.update).mockResolvedValueOnce({
        id: 'user-id',
        email: 'test@example.com',
        displayName: 'Test User',
        passwordHash: 'hashed',
        emailVerified: false,
        emailVerificationToken: 'new-token',
        emailVerificationExpires: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
        preferredCurrency: 'USD',
        hasCompletedOnboarding: false,
        activeAccountId: null,
        deletedAt: null,
        deletedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const response = await resendVerificationPost(buildRequest({ email: 'test@example.com' }))

      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(prisma.user.update).toHaveBeenCalled()
    })

    it('returns same success message for non-existent email (email enumeration protection)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)

      const response = await resendVerificationPost(buildRequest({ email: 'nonexistent@example.com' }))

      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.message).toContain('If an account exists')
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('returns same success message for already verified email (email enumeration protection)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-id',
        email: 'verified@example.com',
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
        deletedAt: null,
        deletedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const response = await resendVerificationPost(buildRequest({ email: 'verified@example.com' }))

      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.message).toContain('If an account exists')
      expect(prisma.user.update).not.toHaveBeenCalled()
    })
  })

  describe('validation errors', () => {
    it('returns 400 for invalid email', async () => {
      const response = await resendVerificationPost(buildRequest({ email: 'not-an-email' }))

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.fields?.email).toBeDefined()
    })

    it('returns 400 for missing email', async () => {
      const response = await resendVerificationPost(buildRequest({}))

      expect(response.status).toBe(400)
    })

    it('returns 400 for malformed JSON', async () => {
      const response = await resendVerificationPost(
        new NextRequest('http://localhost/api/v1/auth/resend-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not json',
        }),
      )

      expect(response.status).toBe(400)
    })
  })

  describe('rate limiting', () => {
    it('returns 429 after 3 attempts for same email within 15 minutes', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        displayName: 'Test User',
        passwordHash: 'hashed',
        emailVerified: false,
        emailVerificationToken: 'token',
        emailVerificationExpires: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
        preferredCurrency: 'USD',
        hasCompletedOnboarding: false,
        activeAccountId: null,
        deletedAt: null,
        deletedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(prisma.user.update).mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        displayName: 'Test User',
        passwordHash: 'hashed',
        emailVerified: false,
        emailVerificationToken: 'new-token',
        emailVerificationExpires: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
        preferredCurrency: 'USD',
        hasCompletedOnboarding: false,
        activeAccountId: null,
        deletedAt: null,
        deletedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // First 3 attempts should succeed
      for (let i = 0; i < 3; i++) {
        const response = await resendVerificationPost(buildRequest({ email: 'ratelimit-resend@example.com' }))
        expect(response.status).not.toBe(429)
      }

      // 4th attempt should be rate limited
      const response = await resendVerificationPost(buildRequest({ email: 'ratelimit-resend@example.com' }))
      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBeTruthy()
    })
  })
})
