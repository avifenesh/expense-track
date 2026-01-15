/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { registerAction, verifyEmailAction } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { Currency } from '@prisma/client'
import bcrypt from 'bcryptjs'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'test-message-id' }),
}))

describe('registerAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully register a new user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null) // No existing user
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'new-user-id',
      email: 'new@example.com',
      displayName: 'New User',
      passwordHash: 'hashed',
      preferredCurrency: Currency.USD,
      emailVerified: false,
      emailVerificationToken: 'token',
      emailVerificationExpires: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const result = await registerAction({
      email: 'new@example.com',
      password: 'Password123',
      displayName: 'New User',
    })

    expect(result).toHaveProperty('success', true)
    expect(result).toHaveProperty('data')
    expect((result as any).data.message).toContain('check your email')
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'new@example.com',
          displayName: 'New User',
          emailVerified: false,
        }),
      }),
    )
  })

  it('should normalize email to lowercase', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'new-user-id',
      email: 'new@example.com',
      displayName: 'New User',
      passwordHash: 'hashed',
      preferredCurrency: Currency.USD,
      emailVerified: false,
      emailVerificationToken: 'token',
      emailVerificationExpires: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    await registerAction({
      email: '  NEW@EXAMPLE.COM  ',
      password: 'Password123',
      displayName: 'New User',
    })

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'new@example.com',
        }),
      }),
    )
  })

  it('should reject registration with existing email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'existing-user',
      email: 'existing@example.com',
      displayName: 'Existing',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const result = await registerAction({
      email: 'existing@example.com',
      password: 'Password123',
      displayName: 'New User',
    })

    expect(result).toHaveProperty('error')
    expect((result as any).error.email[0]).toContain('already registered')
  })

  it('should reject weak password - too short', async () => {
    const result = await registerAction({
      email: 'test@example.com',
      password: 'Pass1',
      displayName: 'Test User',
    })

    expect(result).toHaveProperty('error')
    expect((result as any).error.password).toBeDefined()
    expect((result as any).error.password[0]).toContain('8 characters')
  })

  it('should reject password without uppercase letter', async () => {
    const result = await registerAction({
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test User',
    })

    expect(result).toHaveProperty('error')
    expect((result as any).error.password).toBeDefined()
    expect((result as any).error.password[0]).toContain('uppercase')
  })

  it('should reject password without number', async () => {
    const result = await registerAction({
      email: 'test@example.com',
      password: 'PasswordABC',
      displayName: 'Test User',
    })

    expect(result).toHaveProperty('error')
    expect((result as any).error.password).toBeDefined()
    expect((result as any).error.password[0]).toContain('number')
  })

  it('should reject short display name', async () => {
    const result = await registerAction({
      email: 'test@example.com',
      password: 'Password123',
      displayName: 'A',
    })

    expect(result).toHaveProperty('error')
    expect((result as any).error.displayName).toBeDefined()
  })

  it('should reject invalid email format', async () => {
    const result = await registerAction({
      email: 'not-an-email',
      password: 'Password123',
      displayName: 'Test User',
    })

    expect(result).toHaveProperty('error')
    expect((result as any).error.email).toBeDefined()
  })

  it('should hash password with bcrypt', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'new-user-id',
      email: 'test@example.com',
      displayName: 'Test User',
      passwordHash: 'hashed',
      preferredCurrency: Currency.USD,
      emailVerified: false,
      emailVerificationToken: 'token',
      emailVerificationExpires: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    await registerAction({
      email: 'test@example.com',
      password: 'Password123',
      displayName: 'Test User',
    })

    // Verify password was hashed
    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0]
    const passwordHash = createCall.data.passwordHash as string
    expect(passwordHash).toBeDefined()
    expect(passwordHash.startsWith('$2')).toBe(true) // bcrypt hash prefix
  })

  it('should create default Personal account for new user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'new-user-id',
      email: 'test@example.com',
      displayName: 'Test User',
      passwordHash: 'hashed',
      preferredCurrency: Currency.USD,
      emailVerified: false,
      emailVerificationToken: 'token',
      emailVerificationExpires: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    await registerAction({
      email: 'test@example.com',
      password: 'Password123',
      displayName: 'Test User',
    })

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accounts: {
            create: {
              name: 'Personal',
              type: 'SELF',
            },
          },
        }),
      }),
    )
  })
})

describe('verifyEmailAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should verify valid token', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      displayName: 'Test',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      emailVerified: false,
      emailVerificationToken: 'valid-token',
      emailVerificationExpires: futureDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      displayName: 'Test',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const result = await verifyEmailAction({ token: 'valid-token' })

    expect(result).toHaveProperty('success', true)
    expect((result as any).data.message).toContain('verified')
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    })
  })

  it('should reject expired token', async () => {
    // Token not found because expiry check in where clause fails
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    const result = await verifyEmailAction({ token: 'expired-token' })

    expect(result).toHaveProperty('error')
    expect((result as any).error.token).toBeDefined()
    expect((result as any).error.token[0]).toContain('Invalid or expired')
  })

  it('should reject invalid token', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    const result = await verifyEmailAction({ token: 'nonexistent-token' })

    expect(result).toHaveProperty('error')
    expect((result as any).error.token[0]).toContain('Invalid or expired')
  })

  it('should reject empty token', async () => {
    const result = await verifyEmailAction({ token: '' })

    expect(result).toHaveProperty('error')
    expect((result as any).error.token).toBeDefined()
  })
})

describe('verifyCredentials with database users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should verify database user with correct password', async () => {
    const { verifyCredentials } = await import('@/lib/auth-server')

    const passwordHash = await bcrypt.hash('CorrectPassword123', 12)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'db-user-1',
      email: 'dbuser@example.com',
      displayName: 'DB User',
      passwordHash,
      preferredCurrency: Currency.USD,
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const result = await verifyCredentials({
      email: 'dbuser@example.com',
      password: 'CorrectPassword123',
    })

    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.source).toBe('database')
      expect(result.userId).toBe('db-user-1')
    }
  })

  it('should reject database user with wrong password', async () => {
    const { verifyCredentials } = await import('@/lib/auth-server')

    const passwordHash = await bcrypt.hash('CorrectPassword123', 12)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'db-user-1',
      email: 'dbuser@example.com',
      displayName: 'DB User',
      passwordHash,
      preferredCurrency: Currency.USD,
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const result = await verifyCredentials({
      email: 'dbuser@example.com',
      password: 'WrongPassword',
    })

    expect(result.valid).toBe(false)
  })

  it('should reject unverified email user', async () => {
    const { verifyCredentials } = await import('@/lib/auth-server')

    const passwordHash = await bcrypt.hash('Password123', 12)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'db-user-1',
      email: 'unverified@example.com',
      displayName: 'Unverified User',
      passwordHash,
      preferredCurrency: Currency.USD,
      emailVerified: false, // Not verified
      emailVerificationToken: 'some-token',
      emailVerificationExpires: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const result = await verifyCredentials({
      email: 'unverified@example.com',
      password: 'Password123',
    })

    expect(result.valid).toBe(false)
  })

  it('should reject non-existent user', async () => {
    const { verifyCredentials } = await import('@/lib/auth-server')

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const result = await verifyCredentials({
      email: 'nobody@example.com',
      password: 'SomePassword123',
    })

    expect(result.valid).toBe(false)
  })
})
