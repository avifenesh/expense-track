import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { resetAllRateLimits } from '@/lib/rate-limit'

vi.mock('@/lib/services/registration-service', () => ({
  registerUser: vi.fn(),
}))

vi.mock('@/lib/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/server-logger', () => ({
  serverLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

import { POST as registerPost } from '@/app/api/v1/auth/register/route'
import { registerUser } from '@/lib/services/registration-service'
import { sendVerificationEmail } from '@/lib/email'

describe('POST /api/v1/auth/register', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
    resetAllRateLimits()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const buildRequest = (body: unknown) =>
    new NextRequest('http://localhost/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  describe('success cases', () => {
    it('registers new user successfully', async () => {
      vi.mocked(registerUser).mockResolvedValueOnce({
        success: true,
        userId: 'new-user-id',
        email: 'test@example.com',
        emailVerified: false,
        verificationToken: 'token',
        verificationExpires: new Date(),
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
      expect(data.data.emailVerified).toBe(false)
      expect(registerUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123',
        displayName: 'Test User',
        autoVerify: false,
      })
      expect(sendVerificationEmail).toHaveBeenCalledWith('test@example.com', 'token')
    })

    it('returns success even for existing email (email enumeration protection)', async () => {
      vi.mocked(registerUser).mockResolvedValueOnce({ success: false, reason: 'exists' })

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
      expect(sendVerificationEmail).not.toHaveBeenCalled()
    })

    it('auto-verifies @test.local emails for E2E testing', async () => {
      vi.mocked(registerUser).mockResolvedValueOnce({
        success: true,
        userId: 'new-user-id',
        email: 'e2e-test@test.local',
        emailVerified: true,
        verificationToken: null,
        verificationExpires: null,
      })

      const response = await registerPost(
        buildRequest({
          email: 'e2e-test@test.local',
          password: 'Password123',
          displayName: 'Test User',
        }),
      )

      const data = await response.json()
      // Response should indicate emailVerified: true for test users
      expect(data.data.emailVerified).toBe(true)

      expect(registerUser).toHaveBeenCalledWith({
        email: 'e2e-test@test.local',
        password: 'Password123',
        displayName: 'Test User',
        autoVerify: true,
      })
      expect(sendVerificationEmail).not.toHaveBeenCalled()
    })

    it('does NOT auto-verify non-test.local emails', async () => {
      vi.mocked(registerUser).mockResolvedValueOnce({
        success: true,
        userId: 'new-user-id',
        email: 'test@example.com',
        emailVerified: false,
        verificationToken: 'token',
        verificationExpires: new Date(),
      })

      await registerPost(
        buildRequest({
          email: 'test@example.com',
          password: 'Password123',
          displayName: 'Test User',
        }),
      )

      expect(registerUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123',
        displayName: 'Test User',
        autoVerify: false,
      })
      expect(sendVerificationEmail).toHaveBeenCalledWith('test@example.com', 'token')
    })

    it('normalizes email to lowercase', async () => {
      vi.mocked(registerUser).mockResolvedValueOnce({
        success: true,
        userId: 'new-user-id',
        email: 'test@example.com',
        emailVerified: true,
        verificationToken: null,
        verificationExpires: null,
      })

      await registerPost(
        buildRequest({
          email: 'TEST@EXAMPLE.COM',
          password: 'Password123',
          displayName: 'Test User',
        }),
      )

      expect(registerUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123',
        displayName: 'Test User',
        autoVerify: false,
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
      vi.mocked(registerUser).mockResolvedValue({
        success: true,
        userId: 'new-user-id',
        email: 'ratelimit@example.com',
        emailVerified: true,
        verificationToken: null,
        verificationExpires: null,
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
      vi.mocked(registerUser).mockResolvedValue({
        success: true,
        userId: 'new-user-id',
        email: 'case@example.com',
        emailVerified: true,
        verificationToken: null,
        verificationExpires: null,
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
