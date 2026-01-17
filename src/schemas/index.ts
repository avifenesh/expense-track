import { z } from 'zod'
import { TransactionType, Currency, SplitType, PaymentStatus } from '@prisma/client'

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
  name: z
    .string()
    .min(2, 'Category name must be at least 2 characters')
    .max(100, 'Category name must be at most 100 characters')
    .regex(/^[\p{L}\p{N}](?:.*\S.*)?[\p{L}\p{N}]$|^[\p{L}\p{N}]{2}$/u, 'Category name must start and end with alphanumeric characters and contain non-whitespace'),
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

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
})

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

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

// Account deletion schema (GDPR)
export const deleteAccountSchema = z.object({
  confirmEmail: z.string().email('Please enter your email to confirm deletion'),
  csrfToken: z.string().min(1, 'Security token required'),
})

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>

// Expense sharing schemas
export const participantSchema = z.object({
  email: z.string().email('Invalid email address'),
  shareAmount: z.coerce.number().min(0.01, 'Share amount must be positive').optional(),
  sharePercentage: z.coerce.number().min(0).max(100, 'Percentage must be between 0 and 100').optional(),
})

export type ParticipantInput = z.infer<typeof participantSchema>

export const shareExpenseSchema = z
  .object({
    transactionId: z.string().min(1, 'Transaction is required'),
    splitType: z.nativeEnum(SplitType).default(SplitType.EQUAL),
    participants: z.array(participantSchema).min(1, 'At least one participant is required'),
    description: z.string().max(240, 'Description too long').optional().nullable(),
    csrfToken: z.string().min(1, 'Security token required'),
  })
  .refine(
    (data) => {
      if (data.splitType === SplitType.PERCENTAGE) {
        const totalPercentage = data.participants.reduce((sum, p) => sum + (p.sharePercentage ?? 0), 0)
        return totalPercentage <= 100
      }
      return true
    },
    { message: 'Total percentage cannot exceed 100%', path: ['participants'] },
  )
  .refine(
    (data) => {
      if (data.splitType === SplitType.FIXED) {
        return data.participants.every((p) => p.shareAmount !== undefined && p.shareAmount >= 0.01)
      }
      return true
    },
    { message: 'All participants must have a share amount for fixed splits', path: ['participants'] },
  )

export type ShareExpenseInput = z.infer<typeof shareExpenseSchema>

export const markSharePaidSchema = z.object({
  participantId: z.string().min(1, 'Participant ID is required'),
  csrfToken: z.string().min(1, 'Security token required'),
})

export type MarkSharePaidInput = z.infer<typeof markSharePaidSchema>

export const cancelSharedExpenseSchema = z.object({
  sharedExpenseId: z.string().min(1, 'Shared expense ID is required'),
  csrfToken: z.string().min(1, 'Security token required'),
})

export type CancelSharedExpenseInput = z.infer<typeof cancelSharedExpenseSchema>

export const declineShareSchema = z.object({
  participantId: z.string().min(1, 'Participant ID is required'),
  csrfToken: z.string().min(1, 'Security token required'),
})

export type DeclineShareInput = z.infer<typeof declineShareSchema>

export const userLookupSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  csrfToken: z.string().min(1, 'Security token required'),
})

export type UserLookupInput = z.infer<typeof userLookupSchema>

export const sendPaymentReminderSchema = z.object({
  participantId: z.string().min(1, 'Participant ID is required'),
  csrfToken: z.string().min(1, 'Security token required'),
})

export type SendPaymentReminderInput = z.infer<typeof sendPaymentReminderSchema>

// Re-export enums for convenience
export { SplitType, PaymentStatus }

// Data export schema (GDPR)
export const exportUserDataSchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  csrfToken: z.string().min(1, 'Security token required'),
})

export type ExportUserDataInput = z.infer<typeof exportUserDataSchema>
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

// Chat schemas
export { chatMessageSchema, chatRequestSchema } from './chat'
export type { ChatMessage, ChatRequest } from './chat'
