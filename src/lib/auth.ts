export const AUTH_USERNAME = 'balance-director'

export const AUTH_USER = {
  username: AUTH_USERNAME,
  email: 'director@balancebeacon.app',
  displayName: 'Balance Director',
  passwordHash: '$2b$12$W//T19qmvxlf.4ygIEor3uxK89TR/yTl0AkVMXFhOOfJUoxTHal8S',
}

export const RECOVERY_CONTACTS = [
  {
    email: 'director@balancebeacon.app',
    label: 'Primary director inbox',
  },
  {
    email: 'finance-ops@balancebeacon.app',
    label: 'Operations backup channel',
  },
]

export const SESSION_COOKIE = 'balance_session'
export const USER_COOKIE = 'balance_user'
export const ACCOUNT_COOKIE = 'balance_account'

export type AuthSession = {
  username: string
  accountId?: string
}
