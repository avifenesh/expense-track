import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resetAllRateLimits, incrementRateLimitTyped, checkRateLimitTyped } from '@/lib/rate-limit'

// Mock external dependencies
vi.mock('@/lib/api-auth', () => ({
  requireJwtAuth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/server-logger', () => ({
  serverLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

// Import after mocks
import { GET } from '@/app/api/v1/users/lookup/route'
import { requireJwtAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

const mockRequireJwtAuth = vi.mocked(requireJwtAuth)
const mockUserFindUnique = vi.mocked(prisma.user.findUnique)

describe('GET /api/v1/users/lookup', () => {
  const mockUser = { userId: 'user-123', email: 'requester@example.com' }
  const mockFoundUser = {
    id: 'user-456',
    email: 'found@example.com',
    displayName: 'Found User',
  }

  function createRequest(email?: string) {
    const url = email
      ? `http://localhost:3000/api/v1/users/lookup?email=${encodeURIComponent(email)}`
      : 'http://localhost:3000/api/v1/users/lookup'

    const req = new Request(url, {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    })

    // Add nextUrl property for Next.js compatibility
    Object.defineProperty(req, 'nextUrl', {
      value: new URL(url),
      writable: false,
    })

    return req as import('next/server').NextRequest
  }

  beforeEach(() => {
    vi.clearAllMocks()
    resetAllRateLimits()
    mockRequireJwtAuth.mockReturnValue(mockUser)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUserFindUnique.mockResolvedValue(mockFoundUser as unknown as any)
  })

  afterEach(() => {
    resetAllRateLimits()
  })

  describe('Authentication', () => {
    it('returns 401 when JWT is invalid', async () => {
      mockRequireJwtAuth.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      const response = await GET(createRequest('test@example.com'))
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid token')
    })

    it('returns 401 when Authorization header is missing', async () => {
      mockRequireJwtAuth.mockImplementation(() => {
        throw new Error('Unauthorized')
      })

      const response = await GET(createRequest('test@example.com'))
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('returns 200 when authenticated with valid query', async () => {
      const response = await GET(createRequest('found@example.com'))
      expect(response.status).toBe(200)
    })
  })

  describe('Rate Limiting', () => {
    it('allows requests under limit', async () => {
      const response = await GET(createRequest('found@example.com'))
      expect(response.status).toBe(200)
    })

    it('blocks requests over login rate limit', async () => {
      // Login rate limit is 5 requests per minute (protects against email enumeration)
      for (let i = 0; i < 5; i++) {
        checkRateLimitTyped(mockUser.userId, 'login')
        incrementRateLimitTyped(mockUser.userId, 'login')
      }

      const response = await GET(createRequest('found@example.com'))
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toBe('Rate limit exceeded')
    })
  })

  describe('Email Validation', () => {
    it('returns 400 when email is missing', async () => {
      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.fields.email).toBeDefined()
    })

    it('returns 400 for invalid email format', async () => {
      const response = await GET(createRequest('not-an-email'))
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.fields.email).toContain('Invalid email format')
    })

    it('returns 400 for empty email', async () => {
      const response = await GET(createRequest(''))
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
    })

    it('returns 400 for email too long', async () => {
      const longEmail = 'a'.repeat(250) + '@example.com'
      const response = await GET(createRequest(longEmail))
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.fields.email).toContain('Email is too long')
    })
  })

  describe('Self-lookup Prevention', () => {
    it('returns 400 when looking up own email', async () => {
      const response = await GET(createRequest('requester@example.com'))
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.fields.email).toContain('Cannot look up your own email address')
    })

    it('handles case-insensitive self-lookup check', async () => {
      const response = await GET(createRequest('REQUESTER@EXAMPLE.COM'))
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.fields.email).toContain('Cannot look up your own email address')
    })
  })

  describe('User Lookup', () => {
    it('returns user when found', async () => {
      const response = await GET(createRequest('found@example.com'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.user).toEqual({
        id: 'user-456',
        email: 'found@example.com',
        displayName: 'Found User',
      })
    })

    it('returns 404 when user not found', async () => {
      mockUserFindUnique.mockResolvedValue(null)

      const response = await GET(createRequest('nonexistent@example.com'))
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('User not found')
    })

    it('normalizes email to lowercase for lookup', async () => {
      await GET(createRequest('FOUND@EXAMPLE.COM'))

      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { email: 'found@example.com' },
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      })
    })

    it('handles user with null displayName', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'user-789',
        email: 'noname@example.com',
        displayName: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as unknown as any)

      const response = await GET(createRequest('noname@example.com'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.user.displayName).toBeNull()
    })
  })

  describe('Error Handling', () => {
    it('handles database errors gracefully', async () => {
      mockUserFindUnique.mockRejectedValue(new Error('Database connection failed'))

      const response = await GET(createRequest('found@example.com'))
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('An unexpected error occurred')
    })
  })
})
