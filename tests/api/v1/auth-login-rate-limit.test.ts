import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { resetAllRateLimits } from '@/lib/rate-limit'

vi.mock('@/lib/auth-server', () => ({
  verifyCredentials: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/lib/auth', () => ({
  AUTH_USERS: [
    {
      id: 'avi',
      email: 'user@example.com',
      displayName: 'Test User',
      passwordHash: 'hash',
      accountNames: [],
      defaultAccountName: 'Test',
      preferredCurrency: 'USD',
    },
  ],
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

  it('returns 429 after 100 attempts for the same email', async () => {
    const buildRequest = () =>
      new NextRequest('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'USER@example.com', password: 'bad-password' }),
      })

    for (let i = 0; i < 100; i++) {
      const response = await loginPost(buildRequest())
      expect(response.status).not.toBe(429)
    }

    const response = await loginPost(buildRequest())
    expect(response.status).toBe(429)
  })
})
