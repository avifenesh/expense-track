import { Currency } from '@prisma/client'

export type AuthUser = {
  id: 'avi' | 'serena'
  email: string
  displayName: string
  passwordHash: string
  accountNames: string[]
  defaultAccountName: string
  preferredCurrency: Currency
}

function parseAuthUsers(): AuthUser[] {
  const user1Email = process.env.AUTH_USER1_EMAIL?.trim()
  const user1DisplayName = process.env.AUTH_USER1_DISPLAY_NAME?.trim()
  // Strip quotes, whitespace, and unescape backslashes that might be added by environment variable storage
  const user1PasswordHashRaw = process.env.AUTH_USER1_PASSWORD_HASH?.trim().replace(/^["']|["']$/g, '')
  const user1PasswordHash = user1PasswordHashRaw?.replace(/\\(.)/g, '$1') // Unescape \$ -> $
  const user1PreferredCurrency = (process.env.AUTH_USER1_PREFERRED_CURRENCY as Currency) || Currency.USD

  const user2Email = process.env.AUTH_USER2_EMAIL?.trim()
  const user2DisplayName = process.env.AUTH_USER2_DISPLAY_NAME?.trim()
  // Strip quotes, whitespace, and unescape backslashes that might be added by environment variable storage
  const user2PasswordHashRaw = process.env.AUTH_USER2_PASSWORD_HASH?.trim().replace(/^["']|["']$/g, '')
  const user2PasswordHash = user2PasswordHashRaw?.replace(/\\(.)/g, '$1') // Unescape \$ -> $
  const user2PreferredCurrency = (process.env.AUTH_USER2_PREFERRED_CURRENCY as Currency) || Currency.USD

  if (!user1Email || !user1DisplayName || !user1PasswordHash) {
    throw new Error('Missing required environment variables for user 1 (AUTH_USER1_*)')
  }

  if (!user2Email || !user2DisplayName || !user2PasswordHash) {
    throw new Error('Missing required environment variables for user 2 (AUTH_USER2_*)')
  }

  return [
    {
      id: 'avi',
      email: user1Email,
      displayName: user1DisplayName,
      passwordHash: user1PasswordHash,
      accountNames: ['Avi'],
      defaultAccountName: 'Avi',
      preferredCurrency: user1PreferredCurrency,
    },
    {
      id: 'serena',
      email: user2Email,
      displayName: user2DisplayName,
      passwordHash: user2PasswordHash,
      accountNames: ['Serena'],
      defaultAccountName: 'Serena',
      preferredCurrency: user2PreferredCurrency,
    },
  ]
}

let _authUsers: AuthUser[] | null = null

export function getAuthUsers(): AuthUser[] {
  if (!_authUsers) {
    _authUsers = parseAuthUsers()
  }
  return _authUsers
}

// For backward compatibility
export const AUTH_USERS = new Proxy({} as AuthUser[], {
  get(target, prop) {
    return getAuthUsers()[prop as any]
  },
  has(target, prop) {
    return prop in getAuthUsers()
  },
  ownKeys(target) {
    return Reflect.ownKeys(getAuthUsers())
  },
}) as unknown as AuthUser[]

export function getRecoveryContacts() {
  return getAuthUsers().map((user) => ({
    email: user.email,
    label: `${user.displayName} recovery inbox`,
  }))
}

export const RECOVERY_CONTACTS = new Proxy([] as ReturnType<typeof getRecoveryContacts>, {
  get(target, prop) {
    return getRecoveryContacts()[prop as any]
  },
}) as unknown as ReturnType<typeof getRecoveryContacts>

export const SESSION_COOKIE = 'balance_session'
export const USER_COOKIE = 'balance_user'
export const ACCOUNT_COOKIE = 'balance_account'

export type AuthSession = {
  userEmail: string
  accountId?: string
}
