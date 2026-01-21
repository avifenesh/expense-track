
export const TEST_USERS = {
  primary: {
    email: 'e2e-user1@test.local',
    password: 'TestPassword123!',
    name: 'E2E Test User',
  },

  secondary: {
    email: 'e2e-user2@test.local',
    password: 'TestPassword123!',
    name: 'E2E Test User 2',
  },

  newUser: {
    email: `e2e-new-${Date.now()}@balancebeacon.app`,
    password: 'NewUserPassword123!',
    name: 'New Test User',
  },

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

export const TEST_SHARING = {
  sharedExpense: {
    amount: '120.00',
    description: 'E2E Shared Restaurant Bill',
    category: 'Food & Dining',
    splitType: 'EQUAL' as const,
    participants: [
      { email: 'e2e-user1@test.local', share: '60.00' },
      { email: 'e2e-user2@test.local', share: '60.00' },
    ],
  },

  percentageSplit: {
    amount: '200.00',
    description: 'E2E Percentage Split',
    category: 'Shopping',
    splitType: 'PERCENTAGE' as const,
    participants: [
      { email: 'e2e-user1@test.local', percentage: 60 },
      { email: 'e2e-user2@test.local', percentage: 40 },
    ],
  },

  fixedSplit: {
    amount: '150.00',
    description: 'E2E Fixed Amount Split',
    category: 'Entertainment',
    splitType: 'FIXED' as const,
    participants: [
      { email: 'e2e-user1@test.local', amount: '100.00' },
      { email: 'e2e-user2@test.local', amount: '50.00' },
    ],
  },
} as const;

export const ERROR_SCENARIOS = {
  network: {
    offline: 'Network request failed',
    timeout: 'Request timeout',
    serverError: 'Server error occurred',
  },

  validation: {
    invalidEmail: 'Invalid email format',
    weakPassword: 'Password must be at least 8 characters',
    requiredField: 'This field is required',
    invalidAmount: 'Invalid amount',
  },

  auth: {
    invalidCredentials: 'Invalid email or password',
    emailInUse: 'Email already in use',
    sessionExpired: 'Session expired',
    unauthorized: 'Unauthorized',
  },

  sharing: {
    invalidSplit: 'Split amounts must equal total',
    participantNotFound: 'Participant not found',
    cannotShareWithSelf: 'Cannot share expense with yourself',
  },

  budgets: {
    amountExceeded: 'Budget amount exceeded',
    duplicateBudget: 'Budget already exists for this category',
  },
} as const;

export const API_CONFIG = {
  // a live backend for basic smoke tests
  baseUrl: process.env.E2E_API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000', // DevSkim: ignore DS162092,DS126858
  timeout: 10000,
} as const;
