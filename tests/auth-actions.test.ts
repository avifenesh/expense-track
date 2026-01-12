import { describe, expect, it, vi } from 'vitest'

// Test password used for mock users
const TEST_PASSWORD = 'TestPassword123!'

// Mock prisma to avoid DATABASE_URL requirement
vi.mock('@/lib/prisma', () => ({
  prisma: {},
}))

// Mock auth module with test users (data inlined to avoid hoisting issues)
vi.mock('@/lib/auth', async () => {
  const { Currency } = await import('@prisma/client')
  const bcryptLib = await import('bcryptjs')
  const hash = bcryptLib.default.hashSync('TestPassword123!', 10)

  const users = [
    {
      id: 'avi' as const,
      email: 'test1@example.com',
      displayName: 'Test User 1',
      passwordHash: hash,
      accountNames: ['Test1'],
      defaultAccountName: 'Test1',
      preferredCurrency: Currency.USD,
    },
    {
      id: 'serena' as const,
      email: 'test2@example.com',
      displayName: 'Test User 2',
      passwordHash: hash,
      accountNames: ['Test2'],
      defaultAccountName: 'Test2',
      preferredCurrency: Currency.USD,
    },
  ]

  const contacts = users.map((user) => ({
    email: user.email,
    label: `${user.displayName} recovery inbox`,
  }))

  return {
    AUTH_USERS: users,
    RECOVERY_CONTACTS: contacts,
    getAuthUsers: () => users,
    getRecoveryContacts: () => contacts,
    SESSION_COOKIE: 'balance_session',
    USER_COOKIE: 'balance_user',
    ACCOUNT_COOKIE: 'balance_account',
  }
})

import { AUTH_USERS, RECOVERY_CONTACTS } from '@/lib/auth'
import { verifyCredentials } from '@/lib/auth-server'
import { requestPasswordResetAction } from '@/app/actions'

describe('auth credential verification', () => {
  it('accepts valid credentials', async () => {
    const user = AUTH_USERS[0]
    const result = await verifyCredentials({ email: user.email, password: TEST_PASSWORD })
    expect(result).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const user = AUTH_USERS[0]
    const result = await verifyCredentials({ email: user.email, password: 'wrong-pass' })
    expect(result).toBe(false)
  })

  it('rejects an unexpected email', async () => {
    const result = await verifyCredentials({ email: 'unauthorized@example.com', password: TEST_PASSWORD })
    expect(result).toBe(false)
  })
})

describe('password reset action', () => {
  it('returns a friendly confirmation for known inboxes', async () => {
    const target = RECOVERY_CONTACTS[0]
    const response = await requestPasswordResetAction({ email: target.email })
    expect(response).toEqual({
      success: true,
      message: expect.stringContaining(target.email),
    })
  })

  it('flags unknown inboxes', async () => {
    const response = await requestPasswordResetAction({ email: 'unknown@example.com' })
    expect(response).toEqual({
      error: {
        email: ['Email is not registered. Reach out to the finance team to restore access.'],
      },
    })
  })
})
