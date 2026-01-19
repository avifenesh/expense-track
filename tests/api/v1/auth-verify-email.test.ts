import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

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

import { POST as verifyEmailPost } from '@/app/api/v1/auth/verify-email/route'
import { prisma } from '@/lib/prisma'

describe('POST /api/v1/auth/verify-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const buildRequest = (body: unknown) =>
    new NextRequest('http://localhost/api/v1/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  describe('success cases', () => {
    it('verifies email successfully with valid token', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000)
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-id',
        email: 'test@example.com',
        displayName: 'Test User',
        passwordHash: 'hashed',
        emailVerified: false,
        emailVerificationToken: 'valid-token',
        emailVerificationExpires: futureDate,
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
        passwordResetToken: null,
        passwordResetExpires: null,
        preferredCurrency: 'USD',
        hasCompletedOnboarding: false,
    activeAccountId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const response = await verifyEmailPost(buildRequest({ token: 'valid-token' }))

      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.message).toContain('verified successfully')
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      })
    })

    it('returns success for already verified email', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000) // 1 hour in future
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-id',
        email: 'test@example.com',
        displayName: 'Test User',
        passwordHash: 'hashed',
        emailVerified: true, // Already verified
        emailVerificationToken: 'token',
        emailVerificationExpires: futureDate,
        passwordResetToken: null,
        passwordResetExpires: null,
        preferredCurrency: 'USD',
        hasCompletedOnboarding: false,
    activeAccountId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const response = await verifyEmailPost(buildRequest({ token: 'token' }))

      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.message).toContain('already verified')
      expect(prisma.user.update).not.toHaveBeenCalled()
    })
  })

  describe('error cases', () => {
    it('returns 401 for invalid token', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)

      const response = await verifyEmailPost(buildRequest({ token: 'invalid-token' }))

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
        emailVerified: false,
        emailVerificationToken: 'expired-token',
        emailVerificationExpires: pastDate,
        passwordResetToken: null,
        passwordResetExpires: null,
        preferredCurrency: 'USD',
        hasCompletedOnboarding: false,
    activeAccountId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const response = await verifyEmailPost(buildRequest({ token: 'expired-token' }))

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toContain('expired')
    })
  })

  describe('validation errors', () => {
    it('returns 400 for missing token', async () => {
      const response = await verifyEmailPost(buildRequest({}))

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.fields?.token).toBeDefined()
    })

    it('returns 400 for empty token', async () => {
      const response = await verifyEmailPost(buildRequest({ token: '' }))

      expect(response.status).toBe(400)
    })

    it('returns 400 for malformed JSON', async () => {
      const response = await verifyEmailPost(
        new NextRequest('http://localhost/api/v1/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not json',
        }),
      )

      expect(response.status).toBe(400)
    })
  })
})
