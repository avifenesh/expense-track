import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { resetAllRateLimits } from '@/lib/rate-limit'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/server-logger', () => ({
  serverLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import { POST as registerPost } from '@/app/api/v1/auth/register/route'
import { prisma } from '@/lib/prisma'

describe('POST /api/v1/auth/register', () => {
  beforeEach(() => {
    resetAllRateLimits()
    vi.clearAllMocks()
  })

  const buildRequest = (body: unknown) =>
    new NextRequest('http://localhost/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  describe('success cases', () => {
    it('registers new user successfully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
      vi.mocked(prisma.user.create).mockResolvedValueOnce({
        id: 'new-user-id',
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
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const response = await registerPost(
        buildRequest({
          email: 'test@example.com',
          password: 'Password123',
          displayName: 'Test User',
        }),
      )

      const data = await response.json()
      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.message).toContain('verification email')
    })

    it('returns success even for existing email (email enumeration protection)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'existing-user',
        email: 'existing@example.com',
        displayName: 'Existing User',
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

      const response = await registerPost(
        buildRequest({
          email: 'existing@example.com',
          password: 'Password123',
          displayName: 'Test User',
        }),
      )

      const data = await response.json()
      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      // Same message as successful registration
      expect(data.data.message).toContain('verification email')
      // User create should NOT be called
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('auto-verifies @test.local emails for E2E testing', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
      vi.mocked(prisma.user.create).mockResolvedValueOnce({
        id: 'new-user-id',
        email: 'e2e-test@test.local',
        displayName: 'Test User',
        passwordHash: 'hashed',
        emailVerified: true, // Should be auto-verified
        emailVerificationToken: null, // No token needed
        emailVerificationExpires: null, // No expiry needed
        passwordResetToken: null,
        passwordResetExpires: null,
        preferredCurrency: 'USD',
        hasCompletedOnboarding: false,
        activeAccountId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await registerPost(
        buildRequest({
          email: 'e2e-test@test.local',
          password: 'Password123',
          displayName: 'Test User',
        }),
      )

      // Verify user was created with auto-verification
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'e2e-test@test.local',
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        }),
      })
    })

    it('does NOT auto-verify non-test.local emails', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
      vi.mocked(prisma.user.create).mockResolvedValueOnce({
        id: 'new-user-id',
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
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await registerPost(
        buildRequest({
          email: 'test@example.com',
          password: 'Password123',
          displayName: 'Test User',
        }),
      )

      // Verify user was created WITHOUT auto-verification
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          emailVerified: false,
          emailVerificationToken: expect.any(String),
          emailVerificationExpires: expect.any(Date),
        }),
      })
    })

    it('normalizes email to lowercase', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
      vi.mocked(prisma.user.create).mockResolvedValueOnce({
        id: 'new-user-id',
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
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await registerPost(
        buildRequest({
          email: 'TEST@EXAMPLE.COM',
          password: 'Password123',
          displayName: 'Test User',
        }),
      )

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })
    })
  })

  describe('validation errors', () => {
    it('returns 400 for invalid email', async () => {
      const response = await registerPost(
        buildRequest({
          email: 'not-an-email',
          password: 'Password123',
          displayName: 'Test User',
        }),
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.fields?.email).toBeDefined()
    })

    it('returns 400 for password too short', async () => {
      const response = await registerPost(
        buildRequest({
          email: 'test@example.com',
          password: 'Pass1',
          displayName: 'Test User',
        }),
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.fields?.password).toBeDefined()
    })

    it('returns 400 for password without uppercase', async () => {
      const response = await registerPost(
        buildRequest({
          email: 'test@example.com',
          password: 'password123',
          displayName: 'Test User',
        }),
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.fields?.password).toBeDefined()
    })

    it('returns 400 for password without lowercase', async () => {
      const response = await registerPost(
        buildRequest({
          email: 'test@example.com',
          password: 'PASSWORD123',
          displayName: 'Test User',
        }),
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.fields?.password).toBeDefined()
    })

    it('returns 400 for password without number', async () => {
      const response = await registerPost(
        buildRequest({
          email: 'test@example.com',
          password: 'PasswordABC',
          displayName: 'Test User',
        }),
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.fields?.password).toBeDefined()
    })

    it('returns 400 for display name too short', async () => {
      const response = await registerPost(
        buildRequest({
          email: 'test@example.com',
          password: 'Password123',
          displayName: 'A',
        }),
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.fields?.displayName).toBeDefined()
    })

    it('returns 400 for display name with invalid characters', async () => {
      const response = await registerPost(
        buildRequest({
          email: 'test@example.com',
          password: 'Password123',
          displayName: 'Test<script>User',
        }),
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.fields?.displayName).toBeDefined()
    })

    it('returns 400 for missing required fields', async () => {
      const response = await registerPost(buildRequest({}))

      expect(response.status).toBe(400)
    })

    it('returns 400 for malformed JSON', async () => {
      const response = await registerPost(
        new NextRequest('http://localhost/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not json',
        }),
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.fields?.body).toBeDefined()
    })
  })

  describe('rate limiting', () => {
    it('returns 429 after 3 registration attempts for same email', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'new-user-id',
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
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // First 3 attempts should succeed
      for (let i = 0; i < 3; i++) {
        const response = await registerPost(
          buildRequest({
            email: 'ratelimit@example.com',
            password: 'Password123',
            displayName: 'Test User',
          }),
        )
        expect(response.status).not.toBe(429)
      }

      // 4th attempt should be rate limited
      const response = await registerPost(
        buildRequest({
          email: 'ratelimit@example.com',
          password: 'Password123',
          displayName: 'Test User',
        }),
      )
      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBeTruthy()
    })

    it('rate limits are case-insensitive for email', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'new-user-id',
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
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const emails = ['CASE@example.com', 'Case@Example.COM', 'case@EXAMPLE.com']

      for (let i = 0; i < 3; i++) {
        const response = await registerPost(
          buildRequest({
            email: emails[i],
            password: 'Password123',
            displayName: 'Test User',
          }),
        )
        expect(response.status).not.toBe(429)
      }

      // 4th attempt with different case should still be rate limited
      const response = await registerPost(
        buildRequest({
          email: 'CASE@EXAMPLE.COM',
          password: 'Password123',
          displayName: 'Test User',
        }),
      )
      expect(response.status).toBe(429)
    })
  })
})
