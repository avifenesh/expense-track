/**
 * E2E Test API Client
 * Direct API calls for test setup and teardown
 */
/* eslint-disable no-console */

import { TEST_USER } from './fixtures';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface Account {
  id: string;
  name: string;
  type: string;
  preferredCurrency: string;
  color: string | null;
  icon: string | null;
  description: string | null;
}

interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  color: string | null;
}

interface Transaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  currency: string;
  date: string;
  month: string;
  description: string | null;
  isRecurring: boolean;
}

interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  preferredCurrency: string;
  hasCompletedOnboarding: boolean;
  subscription: {
    isActive: boolean;
    isTrialing: boolean;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
  };
}

export class TestApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl?: string) {
    // Android emulator uses 10.0.2.2 to reach host, iOS uses localhost
    // For direct API calls during test setup, use localhost
    this.baseUrl = baseUrl || process.env.E2E_API_BASE_URL || 'http://localhost:3000';
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    requireAuth: boolean = true
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requireAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await response.json();

    if (!response.ok) {
      const errorMessage = json.error?.message || json.message || `API error: ${response.status}`;
      throw new Error(errorMessage);
    }

    // API responses have { success: true, data: T } format
    return json.data !== undefined ? json.data : json;
  }

  // ============ Auth ============

  async register(
    email: string,
    password: string,
    displayName: string
  ): Promise<void> {
    await this.request<{ message: string }>(
      'POST',
      '/api/v1/auth/register',
      { email, password, displayName },
      false
    );
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>(
      'POST',
      '/api/v1/auth/login',
      { email, password },
      false
    );
    this.accessToken = response.accessToken;
    return response;
  }

  async logout(): Promise<void> {
    if (!this.accessToken) return;
    try {
      await this.request<void>('POST', '/api/v1/auth/logout', {});
    } catch {
      // Ignore logout errors
    }
    this.accessToken = null;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  // ============ User ============

  async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('GET', '/api/v1/users/me');
  }

  async completeOnboarding(): Promise<{ hasCompletedOnboarding: boolean }> {
    return this.request<{ hasCompletedOnboarding: boolean }>(
      'POST',
      '/api/v1/onboarding/complete'
    );
  }

  // ============ Accounts ============

  async getAccounts(): Promise<{ accounts: Account[] }> {
    return this.request<{ accounts: Account[] }>('GET', '/api/v1/accounts');
  }

  // ============ Categories ============

  async getCategories(): Promise<{ categories: Category[] }> {
    return this.request<{ categories: Category[] }>('GET', '/api/v1/categories');
  }

  // ============ Transactions ============

  async createTransaction(data: {
    accountId: string;
    categoryId?: string;
    type: 'INCOME' | 'EXPENSE';
    amount: number;
    currency: string;
    date: string;
    description?: string;
  }): Promise<Transaction> {
    return this.request<Transaction>('POST', '/api/v1/transactions', data);
  }

  async getTransactions(
    accountId: string,
    options?: { month?: string; categoryId?: string; type?: 'INCOME' | 'EXPENSE' }
  ): Promise<{ transactions: Transaction[]; total: number; hasMore: boolean }> {
    const params = new URLSearchParams({ accountId });
    if (options?.month) params.set('month', options.month);
    if (options?.categoryId) params.set('categoryId', options.categoryId);
    if (options?.type) params.set('type', options.type);

    return this.request<{ transactions: Transaction[]; total: number; hasMore: boolean }>(
      'GET',
      `/api/v1/transactions?${params.toString()}`
    );
  }

  // ============ Seed Data ============

  async seedData(): Promise<{
    categoriesCreated: number;
    transactionsCreated: number;
    budgetsCreated: number;
  }> {
    return this.request<{
      categoriesCreated: number;
      transactionsCreated: number;
      budgetsCreated: number;
    }>('POST', '/api/v1/seed-data');
  }

  // ============ Test Helpers ============

  /**
   * Ensures test user exists and is ready for testing.
   * Registers if not exists, logs in, and completes onboarding.
   * Note: Registration now creates default accounts automatically.
   */
  async ensureTestUser(
    user: typeof TEST_USER = TEST_USER,
    completeOnboarding: boolean = true
  ): Promise<LoginResponse> {
    // Try to login first
    try {
      const loginResponse = await this.login(user.email, user.password);

      if (completeOnboarding) {
        // Always call completeOnboarding for test users to ensure subscription exists
        // The endpoint is idempotent and creates subscription if missing
        await this.completeOnboarding();
      }

      return loginResponse;
    } catch {
      // User doesn't exist, register first
      await this.register(user.email, user.password, user.displayName);
      const loginResponse = await this.login(user.email, user.password);

      if (completeOnboarding) {
        await this.completeOnboarding();
      }

      return loginResponse;
    }
  }

  /**
   * Sets up test data: seeds categories, transactions, and budgets.
   */
  async setupTestData(): Promise<void> {
    try {
      await this.seedData();
    } catch (error) {
      // Seed may fail if data already exists - that's OK
      console.log('[TestApiClient] Seed data may already exist:', error);
    }
  }

  /**
   * Gets the first account for the authenticated user.
   */
  async getFirstAccount(): Promise<Account | null> {
    const { accounts } = await this.getAccounts();
    return accounts[0] || null;
  }

  /**
   * Gets a category by name and type.
   */
  async getCategoryByName(
    name: string,
    type: 'INCOME' | 'EXPENSE'
  ): Promise<Category | null> {
    const { categories } = await this.getCategories();
    return categories.find((c) => c.name === name && c.type === type) || null;
  }
}

// Singleton for convenience in tests
let defaultClient: TestApiClient | null = null;

export function getTestApiClient(): TestApiClient {
  if (!defaultClient) {
    defaultClient = new TestApiClient();
  }
  return defaultClient;
}

export function resetTestApiClient(): void {
  defaultClient = null;
}
