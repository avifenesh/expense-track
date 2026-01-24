import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resetAllRateLimits, incrementRateLimit, checkRateLimit } from '@/lib/rate-limit'

// Helper to create mock Decimal with toNumber method
function mockDecimal(value: number) {
  return { toNumber: () => value }
}

// Mock external dependencies
vi.mock('@/lib/api-auth', () => ({
  requireJwtAuth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    transaction: {
      groupBy: vi.fn(),
    },
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

vi.mock('@/lib/subscription', () => ({
  getSubscriptionState: vi.fn().mockResolvedValue({ canAccessApp: true }),
}))

// Import after mocks
import { GET } from '@/app/api/v1/accounts/route'
import { PUT, DELETE } from '@/app/api/v1/accounts/[id]/route'
import { requireJwtAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

const mockRequireJwtAuth = vi.mocked(requireJwtAuth)
const mockAccountFindMany = vi.mocked(prisma.account.findMany)
const mockAccountFindFirst = vi.mocked(prisma.account.findFirst)
const mockAccountUpdate = vi.mocked(prisma.account.update)
const mockAccountCount = vi.mocked(prisma.account.count)
const mockTransactionGroupBy = vi.mocked(prisma.transaction.groupBy)
const mockUserFindUnique = vi.mocked(prisma.user.findUnique)

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAccountFindMany.mockResolvedValue(mockAccounts as unknown as any)
    // Default: no transactions, so empty groupBy result
    mockTransactionGroupBy.mockResolvedValue([])
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
    it('returns accounts for authenticated user with balance', async () => {
      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.accounts).toHaveLength(2)
      expect(data.data.accounts[0]).toEqual({ ...mockAccounts[0], balance: 0 })
      expect(data.data.accounts[1]).toEqual({ ...mockAccounts[1], balance: 0 })
    })

    it('calculates balance correctly from transactions', async () => {
      mockAccountFindMany.mockResolvedValue([mockAccounts[0]] as never)
      // groupBy returns aggregated results by accountId and type
      mockTransactionGroupBy.mockResolvedValue([
        { accountId: 'acc-1', type: 'INCOME', _sum: { amount: mockDecimal(1000) } },
        { accountId: 'acc-1', type: 'EXPENSE', _sum: { amount: mockDecimal(350) } },
      ] as never)

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.accounts[0].balance).toBe(650) // 1000 - 350
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

describe('PUT /api/v1/accounts/[id]', () => {
  const mockUser = { userId: 'user-123', email: 'test@example.com' }
  const mockAccount = {
    id: 'acc-1',
    name: 'Personal Account',
    type: 'SELF',
    preferredCurrency: 'USD',
    color: '#4CAF50',
    icon: 'wallet',
    description: 'My personal finances',
    userId: 'user-123',
    deletedAt: null,
  }

  function createRequest(body: Record<string, unknown>) {
    return new Request('http://localhost:3000/api/v1/accounts/acc-1', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }) as import('next/server').NextRequest
  }

  beforeEach(() => {
    vi.clearAllMocks()
    resetAllRateLimits()
    mockRequireJwtAuth.mockReturnValue(mockUser)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAccountFindFirst.mockResolvedValue(mockAccount as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAccountUpdate.mockResolvedValue({ ...mockAccount, name: 'Updated Account' } as any)
  })

  afterEach(() => {
    resetAllRateLimits()
  })

  describe('Authentication', () => {
    it('returns 401 when JWT is invalid', async () => {
      mockRequireJwtAuth.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      const response = await PUT(createRequest({ name: 'New Name' }), {
        params: Promise.resolve({ id: 'acc-1' }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid token')
    })
  })

  describe('Validation', () => {
    it('returns 400 when name is empty', async () => {
      const response = await PUT(createRequest({ name: '' }), {
        params: Promise.resolve({ id: 'acc-1' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.fields?.name).toBeDefined()
    })

    it('returns 400 when name exceeds 50 characters', async () => {
      const response = await PUT(createRequest({ name: 'a'.repeat(51) }), {
        params: Promise.resolve({ id: 'acc-1' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.fields?.name).toBeDefined()
    })

    it('returns 400 for invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/v1/accounts/acc-1', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      }) as import('next/server').NextRequest

      const response = await PUT(request, { params: Promise.resolve({ id: 'acc-1' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.fields?.body).toBeDefined()
    })

    it('returns 400 when name already exists for another account', async () => {
      mockAccountFindFirst
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce(mockAccount as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce({ ...mockAccount, id: 'acc-2' } as any)

      const response = await PUT(createRequest({ name: 'Duplicate Name' }), {
        params: Promise.resolve({ id: 'acc-1' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.fields?.name).toContain('An account with this name already exists')
    })
  })

  describe('Authorization', () => {
    it('returns 404 when account does not exist', async () => {
      mockAccountFindFirst.mockResolvedValue(null)

      const response = await PUT(createRequest({ name: 'New Name' }), {
        params: Promise.resolve({ id: 'nonexistent' }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Account not found')
    })
  })

  describe('Success', () => {
    it('updates account name successfully', async () => {
      mockAccountFindFirst
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce(mockAccount as any)
        .mockResolvedValueOnce(null) // No duplicate name

      const response = await PUT(createRequest({ name: 'Updated Account' }), {
        params: Promise.resolve({ id: 'acc-1' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Updated Account')
    })
  })
})

describe('DELETE /api/v1/accounts/[id]', () => {
  const mockUser = { userId: 'user-123', email: 'test@example.com' }
  const mockAccount = {
    id: 'acc-1',
    name: 'Personal Account',
    type: 'SELF',
    preferredCurrency: 'USD',
    userId: 'user-123',
    deletedAt: null,
  }

  function createRequest() {
    return new Request('http://localhost:3000/api/v1/accounts/acc-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-token' },
    }) as import('next/server').NextRequest
  }

  beforeEach(() => {
    vi.clearAllMocks()
    resetAllRateLimits()
    mockRequireJwtAuth.mockReturnValue(mockUser)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAccountFindFirst.mockResolvedValue(mockAccount as any)
    mockAccountCount.mockResolvedValue(2) // User has 2 accounts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUserFindUnique.mockResolvedValue({ activeAccountId: 'acc-2' } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAccountUpdate.mockResolvedValue({ ...mockAccount, deletedAt: new Date() } as any)
  })

  afterEach(() => {
    resetAllRateLimits()
  })

  describe('Authentication', () => {
    it('returns 401 when JWT is invalid', async () => {
      mockRequireJwtAuth.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      const response = await DELETE(createRequest(), {
        params: Promise.resolve({ id: 'acc-1' }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid token')
    })
  })

  describe('Authorization', () => {
    it('returns 404 when account does not exist', async () => {
      mockAccountFindFirst.mockResolvedValue(null)

      const response = await DELETE(createRequest(), {
        params: Promise.resolve({ id: 'nonexistent' }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Account not found')
    })
  })

  describe('Constraints', () => {
    it('returns 400 when trying to delete active account', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockUserFindUnique.mockResolvedValue({ activeAccountId: 'acc-1' } as any)

      const response = await DELETE(createRequest(), {
        params: Promise.resolve({ id: 'acc-1' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.fields?.id).toContain('Cannot delete the active account. Switch to another account first.')
    })

    it('returns 400 when trying to delete the only account', async () => {
      mockAccountCount.mockResolvedValue(1)

      const response = await DELETE(createRequest(), {
        params: Promise.resolve({ id: 'acc-1' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.fields?.id).toContain('Cannot delete your only account.')
    })
  })

  describe('Success', () => {
    it('soft deletes account successfully', async () => {
      const response = await DELETE(createRequest(), {
        params: Promise.resolve({ id: 'acc-1' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.deleted).toBe(true)
      expect(mockAccountUpdate).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: {
          deletedAt: expect.any(Date),
          deletedBy: 'user-123',
        },
      })
    })
  })
})
