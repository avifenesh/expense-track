import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resetAllRateLimits, incrementRateLimit, checkRateLimit } from '@/lib/rate-limit'

// Mock external dependencies
vi.mock('@/lib/api-auth', () => ({
  requireJwtAuth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findMany: vi.fn(),
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
import { GET } from '@/app/api/v1/accounts/route'
import { requireJwtAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

const mockRequireJwtAuth = vi.mocked(requireJwtAuth)
const mockAccountFindMany = vi.mocked(prisma.account.findMany)

describe('GET /api/v1/accounts', () => {
  const mockUser = { userId: 'user-123', email: 'test@example.com' }
  const mockAccounts = [
    {
      id: 'acc-1',
      name: 'Personal Account',
      type: 'PERSONAL',
      preferredCurrency: 'USD',
      color: '#4CAF50',
      icon: 'wallet',
      description: 'My personal finances',
    },
    {
      id: 'acc-2',
      name: 'Shared Account',
      type: 'SHARED',
      preferredCurrency: 'EUR',
      color: '#2196F3',
      icon: 'users',
      description: 'Shared with roommates',
    },
  ]

  function createRequest() {
    return new Request('http://localhost:3000/api/v1/accounts', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    }) as import('next/server').NextRequest
  }

  beforeEach(() => {
    vi.clearAllMocks()
    resetAllRateLimits()
    mockRequireJwtAuth.mockReturnValue(mockUser)
    // Cast to unknown since we're mocking the select result, not full Account type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAccountFindMany.mockResolvedValue(mockAccounts as unknown as any)
  })

  afterEach(() => {
    resetAllRateLimits()
  })

  describe('Authentication', () => {
    it('returns 401 when JWT is invalid', async () => {
      mockRequireJwtAuth.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid token')
    })

    it('returns 401 when Authorization header is missing', async () => {
      mockRequireJwtAuth.mockImplementation(() => {
        throw new Error('Unauthorized')
      })

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('returns 200 when authenticated', async () => {
      const response = await GET(createRequest())
      expect(response.status).toBe(200)
    })
  })

  describe('Rate Limiting', () => {
    it('allows requests under limit', async () => {
      const response = await GET(createRequest())
      expect(response.status).toBe(200)
    })

    it('blocks requests over limit', async () => {
      // Hit the rate limit (100 requests)
      for (let i = 0; i < 100; i++) {
        checkRateLimit(mockUser.userId)
        incrementRateLimit(mockUser.userId)
      }

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toBe('Rate limit exceeded')
    })
  })

  describe('Success Response', () => {
    it('returns accounts for authenticated user', async () => {
      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.accounts).toHaveLength(2)
      expect(data.data.accounts[0]).toEqual(mockAccounts[0])
      expect(data.data.accounts[1]).toEqual(mockAccounts[1])
    })

    it('returns empty array when user has no accounts', async () => {
      mockAccountFindMany.mockResolvedValue([])

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.accounts).toEqual([])
    })

    it('filters by userId and non-deleted accounts', async () => {
      await GET(createRequest())

      expect(mockAccountFindMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          type: true,
          preferredCurrency: true,
          color: true,
          icon: true,
          description: true,
        },
        orderBy: { createdAt: 'asc' },
      })
    })
  })

  describe('Error Handling', () => {
    it('handles database errors gracefully', async () => {
      mockAccountFindMany.mockRejectedValue(new Error('Database connection failed'))

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Unable to fetch accounts')
    })
  })
})
