import { z } from 'zod'
import { TransactionType, Currency } from '@prisma/client'

// Transaction schemas
export const transactionSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  categoryId: z.string().min(1, 'Category is required'),
  type: z.nativeEnum(TransactionType),
  amount: z.coerce.number().min(0.01, 'Amount must be positive'),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  date: z.coerce.date(),
  description: z.string().max(240, 'Keep the description short').optional().nullable(),
  isRecurring: z.boolean().optional().default(false),
  recurringTemplateId: z.string().optional().nullable(),
  csrfToken: z.string().min(1, 'Security token required'),
})

export type TransactionInput = z.infer<typeof transactionSchema>

export const transactionUpdateSchema = transactionSchema.extend({
  id: z.string().min(1),
})

export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>

export const deleteTransactionSchema = z.object({
  id: z.string().min(1),
  csrfToken: z.string().min(1, 'Security token required'),
})

export const transactionRequestSchema = z.object({
  toId: z.string().min(1, 'Target account is required'),
  categoryId: z.string().min(1, 'Category is required'),
  amount: z.coerce.number().min(0.01, 'Amount must be positive'),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  date: z.coerce.date(),
  description: z.string().max(240, 'Keep the description short').optional().nullable(),
  csrfToken: z.string().min(1, 'Security token required'),
})

export type TransactionRequestInput = z.infer<typeof transactionRequestSchema>

export const idSchema = z.object({
  id: z.string().min(1),
  csrfToken: z.string().min(1, 'Security token required'),
})

// Budget schemas
export const budgetSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  monthKey: z.string().min(7),
  planned: z.coerce.number().min(0, 'Budget must be >= 0'),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  notes: z.string().max(240).optional().nullable(),
  csrfToken: z.string().min(1, 'Security token required'),
})

export type BudgetInput = z.infer<typeof budgetSchema>

export const deleteBudgetSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  monthKey: z.string().min(7),
  csrfToken: z.string().min(1, 'Security token required'),
})

// Recurring template schemas
export const recurringTemplateSchema = z.object({
  id: z.string().optional(),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  type: z.nativeEnum(TransactionType),
  amount: z.coerce.number().min(0.01),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  dayOfMonth: z.coerce.number().min(1).max(31),
  description: z.string().max(240).optional().nullable(),
  startMonthKey: z.string().min(7, 'Start month is required'),
  endMonthKey: z.string().min(7).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  csrfToken: z.string().min(1, 'Security token required'),
})

export type RecurringTemplateInput = z.infer<typeof recurringTemplateSchema>

export const toggleRecurringSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
  csrfToken: z.string().min(1, 'Security token required'),
})

export const applyRecurringSchema = z.object({
  monthKey: z.string().min(7),
  accountId: z.string().min(1),
  templateIds: z.array(z.string()).optional(),
  csrfToken: z.string().min(1, 'Security token required'),
})

// Category schemas
export const categorySchema = z.object({
  name: z.string().min(2),
  type: z.nativeEnum(TransactionType),
  color: z.string().optional().nullable(),
  csrfToken: z.string().min(1, 'Security token required'),
})

export const archiveCategorySchema = z.object({
  id: z.string().min(1),
  isArchived: z.boolean(),
  csrfToken: z.string().min(1, 'Security token required'),
})

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const registrationSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(100, 'Display name too long'),
})

export type RegistrationInput = z.infer<typeof registrationSchema>

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token required'),
})

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>

export const resendVerificationSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>

export const recoverySchema = z.object({
  email: z.string().email('Provide a valid email address'),
})

export const accountSelectionSchema = z.object({
  accountId: z.string().min(1),
  csrfToken: z.string().min(1, 'Security token required'),
})

// Holdings schemas
export const holdingSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  categoryId: z.string().min(1, 'Category is required'),
  symbol: z
    .string()
    .min(1)
    .max(5, 'Stock symbols are typically 1-5 characters')
    .regex(/^[A-Z]+$/, 'Symbol must be uppercase letters'),
  quantity: z.coerce.number().min(0.000001).max(999999999, 'Quantity out of range'),
  averageCost: z.coerce.number().min(0, 'Average cost cannot be negative'),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  notes: z.string().max(240, 'Keep notes short').optional().nullable(),
  csrfToken: z.string().min(1, 'Security token required'),
})

export type HoldingInput = z.infer<typeof holdingSchema>

export const updateHoldingSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().min(0.000001).max(999999999),
  averageCost: z.coerce.number().min(0),
  notes: z.string().max(240).optional().nullable(),
  csrfToken: z.string().min(1, 'Security token required'),
})

export const deleteHoldingSchema = z.object({
  id: z.string().min(1),
  csrfToken: z.string().min(1, 'Security token required'),
})

export const refreshHoldingPricesSchema = z.object({
  accountId: z.string().min(1),
  csrfToken: z.string().min(1, 'Security token required'),
})

// Balance schemas
export const refreshExchangeRatesSchema = z.object({
  csrfToken: z.string().min(1, 'Security token required'),
})

export type RefreshExchangeRatesInput = z.infer<typeof refreshExchangeRatesSchema>

export const setBalanceSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  targetBalance: z.coerce.number(),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  monthKey: z.string().min(7, 'Month key is required'),
  csrfToken: z.string().min(1, 'Security token required'),
})

// Onboarding schemas
export {
  completeOnboardingSchema,
  skipOnboardingSchema,
  updatePreferredCurrencySchema,
  createInitialCategoriesSchema,
  createQuickBudgetSchema,
  seedSampleDataSchema,
} from './onboarding'

export type {
  CompleteOnboardingInput,
  SkipOnboardingInput,
  UpdatePreferredCurrencyInput,
  CreateInitialCategoriesInput,
  CreateQuickBudgetInput,
  SeedSampleDataInput,
} from './onboarding'
