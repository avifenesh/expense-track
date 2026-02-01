/**
 * E2E Test Fixtures
 * Test data constants for E2E tests
 */

// Test user - uses @test.local domain for auto-verification
export const TEST_USER = {
  email: 'e2e-test@test.local',
  password: 'TestPassword123!',
  displayName: 'E2E Test User',
}

// Alternative test user for multi-user scenarios
export const TEST_USER_2 = {
  email: 'e2e-test-2@test.local',
  password: 'TestPassword456!',
  displayName: 'E2E Test User 2',
}

// Invalid credentials for error testing
export const INVALID_USER = {
  email: 'invalid@test.local',
  password: 'WrongPassword123!',
}

// Test account data
export const TEST_ACCOUNT = {
  name: 'Test Checking',
  type: 'CHECKING' as const,
  preferredCurrency: 'USD' as const,
}

// Test category data
export const TEST_EXPENSE_CATEGORY = {
  name: 'Groceries',
  type: 'EXPENSE' as const,
  color: '#4CAF50',
}

export const TEST_INCOME_CATEGORY = {
  name: 'Salary',
  type: 'INCOME' as const,
  color: '#2196F3',
}

// Test transaction data
export const TEST_EXPENSE_TRANSACTION = {
  type: 'EXPENSE' as const,
  amount: 25.5,
  currency: 'USD' as const,
  description: 'Test grocery purchase',
}

export const TEST_INCOME_TRANSACTION = {
  type: 'INCOME' as const,
  amount: 1000.0,
  currency: 'USD' as const,
  description: 'Test salary payment',
}

// Test budget data
export const TEST_BUDGET = {
  planned: 500.0,
  currency: 'USD' as const,
}

// Timeouts
export const TIMEOUTS = {
  SHORT: 5000,
  MEDIUM: 10000,
  LONG: 60000,
  STARTUP: 120000,
}
