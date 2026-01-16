import { Currency } from '@prisma/client'

/**
 * AuthUser represents an authenticated user with their account information.
 * This type is used throughout the app for session and authorization checks.
 */
export type AuthUser = {
  id: string
  email: string
  displayName: string
  passwordHash: string
  accountNames: string[]
  defaultAccountName: string
  preferredCurrency: Currency
  hasCompletedOnboarding: boolean
}

// Session cookie names
export const SESSION_COOKIE = 'balance_session'
export const USER_COOKIE = 'balance_user'
export const ACCOUNT_COOKIE = 'balance_account'
export const SESSION_TS_COOKIE = 'balance_session_ts' // Timestamp nonce for session token

// Session expires after 30 days
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export type AuthSession = {
  userEmail: string
  accountId?: string
}
