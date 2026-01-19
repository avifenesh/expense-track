/**
 * E2E Test Fixtures
 *
 * Test data for E2E tests. These credentials should match
 * the test environment setup.
 */

export const TEST_USERS = {
  // Primary test user - matches web E2E test user setup
  // Note: These credentials should match users seeded in CI workflow
  primary: {
    email: 'e2e-user1@test.local',
    password: 'E2ETestPassword123!',
    name: 'E2E Test User',
  },

  // Secondary test user for multi-user scenarios
  secondary: {
    email: 'e2e-user2@test.local',
    password: 'E2ETestPassword123!',
    name: 'E2E Test User 2',
  },

  // New user for registration tests
  newUser: {
    email: `e2e-new-${Date.now()}@balancebeacon.app`,
    password: 'NewUserPassword123!',
    name: 'New Test User',
  },

  // Invalid credentials for error case testing
  invalid: {
    email: 'invalid@balancebeacon.app',
    password: 'WrongPassword123!',
  },
} as const;

export const TEST_TRANSACTIONS = {
  expense: {
    amount: '25.50',
    description: 'E2E Test Expense',
    category: 'Food & Dining',
    type: 'expense',
  },

  income: {
    amount: '1000.00',
    description: 'E2E Test Income',
    category: 'Salary',
    type: 'income',
  },

  large: {
    amount: '5000.00',
    description: 'E2E Large Transaction',
    category: 'Shopping',
    type: 'expense',
  },
} as const;

export const TEST_BUDGETS = {
  food: {
    category: 'Food & Dining',
    amount: '500.00',
  },

  shopping: {
    category: 'Shopping',
    amount: '300.00',
  },

  entertainment: {
    category: 'Entertainment',
    amount: '200.00',
  },
} as const;

export const TEST_CATEGORIES = {
  expense: [
    'Food & Dining',
    'Shopping',
    'Transportation',
    'Entertainment',
    'Bills & Utilities',
    'Healthcare',
  ],

  income: ['Salary', 'Freelance', 'Investments', 'Other Income'],
} as const;

export const API_CONFIG = {
  // Note: In CI, tests may run without a backend (mocked or using EXPO_PUBLIC_API_URL)
  // The E2E_API_URL env var is used for reference but tests should not require
  // a live backend for basic smoke tests
  baseUrl: process.env.E2E_API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000', // DevSkim: ignore DS162092,DS126858
  timeout: 10000,
} as const;
