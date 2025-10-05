export type AuthUser = {
  id: 'avi' | 'serena'
  email: string
  displayName: string
  passwordHash: string
  accountNames: string[]
  defaultAccountName: string
}

export const AUTH_USERS: AuthUser[] = [
  {
    id: 'avi',
    email: 'user1@example.com',
    displayName: 'User One',
    passwordHash: '$2b$12$REPLACE_WITH_YOUR_HASH',
    accountNames: ['Avi', 'Joint'],
    defaultAccountName: 'Avi',
  },
  {
    id: 'serena',
    email: 'user2@example.com',
    displayName: 'User Two',
    passwordHash: '$2b$12$REPLACE_WITH_YOUR_HASH',
    accountNames: ['Serena', 'Joint'],
    defaultAccountName: 'Serena',
  },
]

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
