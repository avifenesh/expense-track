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
    email: 'aviarchi1994@gmail.com',
    displayName: 'Avi Archi',
    passwordHash: '$2b$12$Aimtye8X.eHLuZGy0960s.dnUR5bDQnmwZo0knsz5rbrC0K.1GleS',
    accountNames: ['Avi', 'Joint'],
    defaultAccountName: 'Avi',
  },
  {
    id: 'serena',
    email: 'serena.bianchi@hotmail.it',
    displayName: 'Serena Bianchi',
    passwordHash: '$2b$12$z6LV7T0T/72RbQnZ0Dg/IeQBJDXUdVESKpsDjLj9oQL9hKFBowbeW',
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
