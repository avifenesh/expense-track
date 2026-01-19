// E2E test users (must match .env.e2e configuration)
export const TEST_USER_1 = {
  email: 'e2e-user1@test.example.com',
  password: 'Af!@#$56789',
  displayName: 'TestUserOne',
} as const

export const TEST_USER_2 = {
  email: 'e2e-user2@test.example.com',
  password: 'A76v38i61_7',
  displayName: 'TestUserTwo',
} as const

export const TEST_USER_3 = {
  email: 'e2e-user3@test.example.com',
  password: 'Test1234!@#$',
  displayName: 'TestUserThree',
} as const

// Test account names
export const TEST_ACCOUNTS = {
  USER1_PERSONAL: 'TestUserOne',
  USER2_PERSONAL: 'TestUserTwo',
  JOINT: 'Joint',
} as const

// Test categories (these should exist in seed data)
export const TEST_CATEGORIES = {
  GROCERIES: 'Groceries',
  RENT: 'Rent',
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
