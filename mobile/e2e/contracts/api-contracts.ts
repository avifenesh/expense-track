/**
 * API Contracts
 * Zod schemas defining the contract between backend and mobile app
 * These should mirror the schemas in mobile/src/schemas/
 */

import { z } from 'zod';

// ============ Auth Contracts ============

export const LoginRequestContract = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const LoginResponseContract = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

export const RegisterRequestContract = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(100),
});

export const RegisterResponseContract = z.object({
  message: z.string(),
});

// ============ User Contracts ============

export const UserProfileContract = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  preferredCurrency: z.enum(['USD', 'EUR', 'ILS']),
  hasCompletedOnboarding: z.boolean(),
  createdAt: z.string(),
  subscription: z.object({
    isActive: z.boolean(),
    isTrialing: z.boolean(),
    trialEndsAt: z.string().nullable(),
    currentPeriodEnd: z.string().nullable(),
  }),
});

// ============ Account Contracts ============

export const AccountContract = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['CHECKING', 'SAVINGS', 'CREDIT', 'CASH', 'INVESTMENT', 'OTHER']),
  preferredCurrency: z.enum(['USD', 'EUR', 'ILS']),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  description: z.string().nullable(),
});

export const AccountsResponseContract = z.object({
  accounts: z.array(AccountContract),
});

// ============ Category Contracts ============

export const CategoryContract = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['INCOME', 'EXPENSE']),
  color: z.string().nullable(),
});

export const CategoriesResponseContract = z.object({
  categories: z.array(CategoryContract),
});

// ============ Transaction Contracts ============

export const CreateTransactionRequestContract = z.object({
  accountId: z.string(),
  categoryId: z.string().optional(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().positive(),
  currency: z.enum(['USD', 'EUR', 'ILS']),
  date: z.string(), // ISO date string
  description: z.string().optional(),
  isRecurring: z.boolean().optional(),
});

export const TransactionContract = z.object({
  id: z.string(),
  accountId: z.string(),
  categoryId: z.string().nullable(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.string(), // Decimal string
  currency: z.enum(['USD', 'EUR', 'ILS']),
  date: z.string(),
  month: z.string(),
  description: z.string().nullable(),
  isRecurring: z.boolean(),
  category: CategoryContract.nullable().optional(),
});

export const TransactionsResponseContract = z.object({
  transactions: z.array(TransactionContract),
  total: z.number(),
  hasMore: z.boolean(),
});

// ============ Budget Contracts ============

export const BudgetContract = z.object({
  id: z.string(),
  accountId: z.string(),
  categoryId: z.string(),
  month: z.string(),
  planned: z.string(), // Decimal string
  currency: z.enum(['USD', 'EUR', 'ILS']),
  category: CategoryContract.optional(),
});

export const BudgetsResponseContract = z.object({
  budgets: z.array(BudgetContract),
});

// ============ Seed Data Contract ============

export const SeedDataResponseContract = z.object({
  categoriesCreated: z.number(),
  transactionsCreated: z.number(),
  budgetsCreated: z.number(),
});

// ============ Error Contract ============

export const ApiErrorContract = z.object({
  success: z.literal(false),
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    details: z.record(z.array(z.string())).optional(),
  }),
});

// ============ Type Exports ============

export type LoginRequest = z.infer<typeof LoginRequestContract>;
export type LoginResponse = z.infer<typeof LoginResponseContract>;
export type RegisterRequest = z.infer<typeof RegisterRequestContract>;
export type RegisterResponse = z.infer<typeof RegisterResponseContract>;
export type UserProfile = z.infer<typeof UserProfileContract>;
export type Account = z.infer<typeof AccountContract>;
export type Category = z.infer<typeof CategoryContract>;
export type CreateTransactionRequest = z.infer<typeof CreateTransactionRequestContract>;
export type Transaction = z.infer<typeof TransactionContract>;
export type Budget = z.infer<typeof BudgetContract>;
export type ApiError = z.infer<typeof ApiErrorContract>;
