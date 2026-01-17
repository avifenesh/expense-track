import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { resetAllRateLimits } from '@/lib/rate-limit'

vi.mock('@/lib/auth-server', () => ({
  verifyCredentials: vi.fn().mockResolvedValue({ valid: false, reason: 'invalid_credentials' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    refreshToken: {
      create: vi.fn(),
    },
  },
}))

import { POST as loginPost } from '@/app/api/v1/auth/login/route'

describe('Auth login rate limiting', () => {
  beforeEach(() => {
    resetAllRateLimits()
    vi.clearAllMocks()
  })

  it('returns 429 after 5 failed attempts for the same email (brute force protection)', async () => {
    const buildRequest = () =>
      new NextRequest('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'USER@example.com', password: 'bad-password' }),
      })

    // First 5 attempts should not be rate limited (may return 401 for invalid credentials)
    for (let i = 0; i < 5; i++) {
      const response = await loginPost(buildRequest())
      expect(response.status).not.toBe(429)
    }

    // 6th attempt should be rate limited
    const response = await loginPost(buildRequest())
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBeTruthy()
  })

  it('rate limits are case-insensitive for email', async () => {
    const emails = ['User@Example.com', 'USER@EXAMPLE.COM', 'user@example.com', 'UsEr@ExAmPlE.CoM', 'USER@example.COM']

    for (let i = 0; i < 5; i++) {
      const response = await loginPost(
        new NextRequest('http://localhost/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emails[i], password: 'bad-password' }),
        }),
      )
      expect(response.status).not.toBe(429)
    }

    // Next attempt (same email, different case) should be rate limited
    const response = await loginPost(
      new NextRequest('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'bad-password' }),
      }),
    )
    expect(response.status).toBe(429)
  })

  it('does not rate limit different emails', async () => {
    const buildRequest = (email: string) =>
      new NextRequest('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'bad-password' }),
      })

    // Hit rate limit for user1
    for (let i = 0; i < 5; i++) {
      await loginPost(buildRequest('user1@example.com'))
    }

    // user1 should be rate limited
    const user1Response = await loginPost(buildRequest('user1@example.com'))
    expect(user1Response.status).toBe(429)

    // user2 should not be rate limited
    const user2Response = await loginPost(buildRequest('user2@example.com'))
    expect(user2Response.status).not.toBe(429)
  })

  it('should track rate limit counter per email, not globally', async () => {
    const buildRequest = (email: string) =>
      new NextRequest('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'bad-password' }),
      })

    // Make 3 attempts for user1
    for (let i = 0; i < 3; i++) {
      await loginPost(buildRequest('user1@example.com'))
    }

    // Make 3 attempts for user2
    for (let i = 0; i < 3; i++) {
      await loginPost(buildRequest('user2@example.com'))
    }

    // If rate limit was global (6 total attempts), user3 would be blocked
    // But since it's per-email, user3 should still have 5 attempts available
    const user3Response = await loginPost(buildRequest('user3@example.com'))
    expect(user3Response.status).not.toBe(429)

    // Verify user1 can still make 2 more attempts (had 3, limit is 5)
    const user1Response4 = await loginPost(buildRequest('user1@example.com'))
    expect(user1Response4.status).not.toBe(429)

    const user1Response5 = await loginPost(buildRequest('user1@example.com'))
    expect(user1Response5.status).not.toBe(429)

    // Now user1 should be rate limited (6th attempt)
    const user1Response6 = await loginPost(buildRequest('user1@example.com'))
    expect(user1Response6.status).toBe(429)

    // user2 should still have 2 attempts remaining
    const user2Response4 = await loginPost(buildRequest('user2@example.com'))
    expect(user2Response4.status).not.toBe(429)
  })
})
