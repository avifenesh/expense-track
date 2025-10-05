export type AuthUser = {
  id: 'avi' | 'serena'
  email: string
  displayName: string
  passwordHash: string
  accountNames: string[]
  defaultAccountName: string
}

function parseAuthUsers(): AuthUser[] {
  const user1Email = process.env.AUTH_USER1_EMAIL || ''
  const user1DisplayName = process.env.AUTH_USER1_DISPLAY_NAME || 'User One'
  const user1PasswordHash = process.env.AUTH_USER1_PASSWORD_HASH || ''

  const user2Email = process.env.AUTH_USER2_EMAIL || ''
  const user2DisplayName = process.env.AUTH_USER2_DISPLAY_NAME || 'User Two'
  const user2PasswordHash = process.env.AUTH_USER2_PASSWORD_HASH || ''

  return [
    {
      id: 'avi',
      email: user1Email,
      displayName: user1DisplayName,
      passwordHash: user1PasswordHash,
      accountNames: ['Avi', 'Joint'],
      defaultAccountName: 'Avi',
    },
    {
      id: 'serena',
      email: user2Email,
      displayName: user2DisplayName,
      passwordHash: user2PasswordHash,
      accountNames: ['Serena', 'Joint'],
      defaultAccountName: 'Serena',
    },
  ]
}

export const AUTH_USERS: AuthUser[] = parseAuthUsers()

export const RECOVERY_CONTACTS = AUTH_USERS.map((user) => ({
  email: user.email,
  label: `${user.displayName} recovery inbox`,
}))

export const SESSION_COOKIE = 'balance_session'
export const USER_COOKIE = 'balance_user'
export const ACCOUNT_COOKIE = 'balance_account'

export type AuthSession = {
  userEmail: string
  accountId?: string
}
