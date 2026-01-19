// E2E test users - credentials must match CI workflow and seed-e2e.ts
// Uses environment variables in CI, fallback to hardcoded values for local dev
export const TEST_USER_1 = {
  email: process.env.AUTH_USER1_EMAIL || 'e2e-user1@test.local',
  password: process.env.AUTH_USER1_PASSWORD || 'TestPassword123!',
  displayName: 'TestUserOne',
} as const

export const TEST_USER_2 = {
  email: process.env.AUTH_USER2_EMAIL || 'e2e-user2@test.local',
  password: process.env.AUTH_USER2_PASSWORD || 'TestPassword123!',
  displayName: 'TestUserTwo',
} as const

export const TEST_USER_3 = {
  email: 'e2e-user3@test.local',
  password: 'TestPassword123!',
  displayName: 'TestUserThree',
} as const

// Test account names
export const TEST_ACCOUNTS = {
  USER1_PERSONAL: 'TestUserOne',
  USER2_PERSONAL: 'TestUserTwo',
  JOINT: 'Joint',
} as const

// Test categories (these must match DEFAULT_EXPENSE_CATEGORIES and DEFAULT_INCOME_CATEGORIES)
export const TEST_CATEGORIES = {
  GROCERIES: 'Groceries',
  HOUSING: 'Housing', // Was 'Rent', but default categories use 'Housing'
  SALARY: 'Salary',
  ENTERTAINMENT: 'Entertainment',
  UTILITIES: 'Utilities',
} as const

// Date helpers for consistent test data
export const getToday = () => {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

export const getMonthStart = () => {
  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
}

export const getLastMonthStart = () => {
  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0]
}
