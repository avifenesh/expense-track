import { describe, expect, it, vi, beforeEach } from 'vitest'
import { registerAction, verifyEmailAction, resendVerificationEmailAction } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { Currency, User } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Helper to create a mock User object
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    passwordHash: 'hashed',
    preferredCurrency: Currency.USD,
    emailVerified: false,
    emailVerificationToken: 'token',
    emailVerificationExpires: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

type ActionResult = { success: true; data: { message: string } } | { error: Record<string, string[]> }

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
    vi.mocked(prisma.user.create).mockResolvedValue(
      createMockUser({
        id: 'new-user-id',
        email: 'new@example.com',
        displayName: 'New User',
      }),
    )

    const result = (await registerAction({
      email: 'new@example.com',
      password: 'Password123a',
      displayName: 'New User',
    })) as ActionResult

    expect(result).toHaveProperty('success', true)
    expect(result).toHaveProperty('data')
    if ('data' in result) {
      // Generic message to prevent email enumeration
      expect(result.data.message).toContain('verification email')
    }
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
    vi.mocked(prisma.user.create).mockResolvedValue(
      createMockUser({
        id: 'new-user-id',
        email: 'new@example.com',
        displayName: 'New User',
      }),
    )

    await registerAction({
      email: '  NEW@EXAMPLE.COM  ',
      password: 'Password123a',
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

  it('should return generic success for existing email (prevents enumeration)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      createMockUser({
        id: 'existing-user',
        email: 'existing@example.com',
        displayName: 'Existing',
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      }),
    )

    const result = (await registerAction({
      email: 'existing@example.com',
      password: 'Password123a',
      displayName: 'New User',
    })) as ActionResult

    // Should return generic success to prevent email enumeration attacks
    expect(result).toHaveProperty('success', true)
    if ('data' in result) {
      expect(result.data.message).toContain('verification email')
    }
    // Should NOT call prisma.user.create since email exists
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('should reject weak password - too short', async () => {
    const result = (await registerAction({
      email: 'test@example.com',
      password: 'Pa1a',
      displayName: 'Test User',
    })) as ActionResult

    expect(result).toHaveProperty('error')
    if ('error' in result) {
      expect(result.error.password).toBeDefined()
      expect(result.error.password?.[0]).toContain('8 characters')
    }
  })

  it('should reject password without uppercase letter', async () => {
    const result = (await registerAction({
      email: 'test@example.com',
      password: 'password123', // pragma: allowlist secret
      displayName: 'Test User',
    })) as ActionResult

    expect(result).toHaveProperty('error')
    if ('error' in result) {
      expect(result.error.password).toBeDefined()
      expect(result.error.password?.[0]).toContain('uppercase')
    }
  })

  it('should reject password without lowercase letter', async () => {
    const result = (await registerAction({
      email: 'test@example.com',
      password: 'PASSWORD123',
      displayName: 'Test User',
    })) as ActionResult

    expect(result).toHaveProperty('error')
    if ('error' in result) {
      expect(result.error.password).toBeDefined()
      expect(result.error.password?.[0]).toContain('lowercase')
    }
  })

  it('should reject password without number', async () => {
    const result = (await registerAction({
      email: 'test@example.com',
      password: 'PasswordABC',
      displayName: 'Test User',
    })) as ActionResult

    expect(result).toHaveProperty('error')
    if ('error' in result) {
      expect(result.error.password).toBeDefined()
      expect(result.error.password?.[0]).toContain('number')
    }
  })

  it('should reject short display name', async () => {
    const result = (await registerAction({
      email: 'test@example.com',
      password: 'Password123a',
      displayName: 'A',
    })) as ActionResult

    expect(result).toHaveProperty('error')
    if ('error' in result) {
      expect(result.error.displayName).toBeDefined()
    }
  })

  it('should reject invalid email format', async () => {
    const result = (await registerAction({
      email: 'not-an-email',
      password: 'Password123a',
      displayName: 'Test User',
    })) as ActionResult

    expect(result).toHaveProperty('error')
    if ('error' in result) {
      expect(result.error.email).toBeDefined()
    }
  })

  it('should hash password with bcrypt', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue(
      createMockUser({
        id: 'new-user-id',
        email: 'test@example.com',
        displayName: 'Test User',
      }),
    )

    await registerAction({
      email: 'test@example.com',
      password: 'Password123a',
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
    vi.mocked(prisma.user.create).mockResolvedValue(
      createMockUser({
        id: 'new-user-id',
        email: 'test@example.com',
        displayName: 'Test User',
      }),
    )

    await registerAction({
      email: 'test@example.com',
      password: 'Password123a',
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
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      createMockUser({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test',
        emailVerified: false,
        emailVerificationToken: 'valid-token',
        emailVerificationExpires: futureDate,
      }),
    )

    vi.mocked(prisma.user.update).mockResolvedValue(
      createMockUser({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test',
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      }),
    )

    const result = (await verifyEmailAction({ token: 'valid-token' })) as ActionResult

    expect(result).toHaveProperty('success', true)
    if ('data' in result) {
      expect(result.data.message).toContain('verified')
    }
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
    // Token found but expired
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      createMockUser({
        emailVerificationToken: 'expired-token',
        emailVerificationExpires: new Date(Date.now() - 1000), // Expired
      }),
    )

    const result = (await verifyEmailAction({ token: 'expired-token' })) as ActionResult

    expect(result).toHaveProperty('error')
    if ('error' in result) {
      expect(result.error.token).toBeDefined()
      expect(result.error.token?.[0]).toContain('Invalid or expired')
    }
  })

  it('should reject invalid token', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const result = (await verifyEmailAction({ token: 'nonexistent-token' })) as ActionResult

    expect(result).toHaveProperty('error')
    if ('error' in result) {
      expect(result.error.token?.[0]).toContain('Invalid or expired')
    }
  })

  it('should reject empty token', async () => {
    const result = (await verifyEmailAction({ token: '' })) as ActionResult

    expect(result).toHaveProperty('error')
    if ('error' in result) {
      expect(result.error.token).toBeDefined()
    }
  })
})

describe('verifyCredentials with database users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should verify database user with correct password', async () => {
    const { verifyCredentials } = await import('@/lib/auth-server')

    const passwordHash = await bcrypt.hash('CorrectPassword123a', 12)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      createMockUser({
        id: 'db-user-1',
        email: 'dbuser@example.com',
        displayName: 'DB User',
        passwordHash,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      }),
    )

    const result = await verifyCredentials({
      email: 'dbuser@example.com',
      password: 'CorrectPassword123a',
    })

    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.userId).toBe('db-user-1')
    }
  })

  it('should reject database user with wrong password', async () => {
    const { verifyCredentials } = await import('@/lib/auth-server')

    const passwordHash = await bcrypt.hash('CorrectPassword123a', 12)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      createMockUser({
        id: 'db-user-1',
        email: 'dbuser@example.com',
        displayName: 'DB User',
        passwordHash,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      }),
    )

    const result = await verifyCredentials({
      email: 'dbuser@example.com',
      password: 'WrongPassword',
    })

    expect(result.valid).toBe(false)
  })

  it('should reject unverified email user', async () => {
    const { verifyCredentials } = await import('@/lib/auth-server')

    const passwordHash = await bcrypt.hash('Password123a', 12)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      createMockUser({
        id: 'db-user-1',
        email: 'unverified@example.com',
        displayName: 'Unverified User',
        passwordHash,
        emailVerified: false, // Not verified
        emailVerificationToken: 'some-token',
        emailVerificationExpires: new Date(Date.now() + 86400000),
      }),
    )

    const result = await verifyCredentials({
      email: 'unverified@example.com',
      password: 'Password123a',
    })

    expect(result.valid).toBe(false)
  })

  it('should reject non-existent user', async () => {
    const { verifyCredentials } = await import('@/lib/auth-server')

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const result = await verifyCredentials({
      email: 'nobody@example.com',
      password: 'SomePassword123a',
    })

    expect(result.valid).toBe(false)
  })
})

describe('resendVerificationEmailAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return generic success for non-existent email (prevents enumeration)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const result = (await resendVerificationEmailAction({
      email: 'nonexistent@example.com',
    })) as ActionResult

    expect(result).toHaveProperty('success', true)
    if ('data' in result) {
      expect(result.data.message).toContain('unverified account')
    }
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('should return generic success for already verified email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      createMockUser({
        id: 'verified-user',
        email: 'verified@example.com',
        emailVerified: true,
        emailVerificationToken: null,
      }),
    )

    const result = (await resendVerificationEmailAction({
      email: 'verified@example.com',
    })) as ActionResult

    expect(result).toHaveProperty('success', true)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('should resend verification email for unverified user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      createMockUser({
        id: 'unverified-user',
        email: 'unverified@example.com',
        emailVerified: false,
        emailVerificationToken: 'old-token',
        emailVerificationExpires: new Date(Date.now() - 1000),
      }),
    )
    vi.mocked(prisma.user.update).mockResolvedValue(
      createMockUser({
        id: 'unverified-user',
        email: 'unverified@example.com',
        emailVerified: false,
      }),
    )

    const result = (await resendVerificationEmailAction({
      email: 'unverified@example.com',
    })) as ActionResult

    expect(result).toHaveProperty('success', true)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'unverified-user' },
        data: expect.objectContaining({
          emailVerificationToken: expect.any(String),
          emailVerificationExpires: expect.any(Date),
        }),
      }),
    )
  })

  it('should reject invalid email format', async () => {
    const result = (await resendVerificationEmailAction({
      email: 'not-an-email',
    })) as ActionResult

    expect(result).toHaveProperty('error')
    if ('error' in result) {
      expect(result.error.email).toBeDefined()
    }
  })
})
