import { z } from 'zod'
import { TransactionType, Currency, SplitType } from '@prisma/client'

// ============================================
// Transaction Schemas (API)
// ============================================

export const transactionApiSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  categoryId: z.string().min(1, 'Category is required'),
  type: z.nativeEnum(TransactionType),
  amount: z.coerce.number().min(0.01, 'Amount must be positive'),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  date: z.coerce.date(),
  description: z.string().max(240, 'Keep the description short').optional().nullable(),
  isRecurring: z.boolean().optional().default(false),
  recurringTemplateId: z.string().optional().nullable(),
})

export type TransactionApiInput = z.infer<typeof transactionApiSchema>

export const transactionUpdateApiSchema = transactionApiSchema.extend({
  id: z.string().min(1),
})

export type TransactionUpdateApiInput = z.infer<typeof transactionUpdateApiSchema>

export const deleteTransactionApiSchema = z.object({
  id: z.string().min(1),
})

// ============================================
// Budget Schemas (API)
// ============================================

export const budgetApiSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  monthKey: z.string().min(7),
  planned: z.coerce.number().min(0, 'Budget must be >= 0'),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  notes: z.string().max(240).optional().nullable(),
})

export type BudgetApiInput = z.infer<typeof budgetApiSchema>

export const deleteBudgetApiSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  monthKey: z.string().min(7),
})

// ============================================
// Recurring Template Schemas (API)
// ============================================

export const recurringTemplateApiSchema = z
  .object({
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
  })
  .refine(
    (data) => {
      // If endMonthKey is provided, it must be >= startMonthKey
      if (data.endMonthKey) {
        return data.endMonthKey >= data.startMonthKey
      }
      return true
    },
    { message: 'End month must be on or after start month', path: ['endMonthKey'] },
  )

export type RecurringTemplateApiInput = z.infer<typeof recurringTemplateApiSchema>

export const toggleRecurringApiSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
})

export const applyRecurringApiSchema = z.object({
  monthKey: z.string().min(7),
  accountId: z.string().min(1),
  templateIds: z.array(z.string()).optional(),
})

// ============================================
// Category Schemas (API)
// ============================================

export const categoryApiSchema = z.object({
  name: z
    .string()
    .min(2, 'Category name must be at least 2 characters')
    .max(100, 'Category name must be at most 100 characters')
    .regex(
      /^[\p{L}\p{N}](?:.*\S.*)?[\p{L}\p{N}]$|^[\p{L}\p{N}]{2}$/u,
      'Category name must start and end with alphanumeric characters and contain non-whitespace',
    ),
  type: z.nativeEnum(TransactionType),
  color: z.string().optional().nullable(),
})

export type CategoryApiInput = z.infer<typeof categoryApiSchema>

export const archiveCategoryApiSchema = z.object({
  id: z.string().min(1),
  isArchived: z.boolean(),
})

export const updateCategoryApiSchema = z.object({
  name: z
    .string()
    .min(2, 'Category name must be at least 2 characters')
    .max(100, 'Category name must be at most 100 characters')
    .regex(
      /^[\p{L}\p{N}](?:.*\S.*)?[\p{L}\p{N}]$|^[\p{L}\p{N}]{2}$/u,
      'Category name must start and end with alphanumeric characters and contain non-whitespace',
    ),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g., #FF0000)')
    .nullish(),
})

export type UpdateCategoryApiInput = z.infer<typeof updateCategoryApiSchema>

// ============================================
// Holdings Schemas (API)
// ============================================

export const holdingApiSchema = z.object({
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
})

export type HoldingApiInput = z.infer<typeof holdingApiSchema>

export const updateHoldingApiSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().min(0.000001).max(999999999),
  averageCost: z.coerce.number().min(0),
  notes: z.string().max(240).optional().nullable(),
})

export const deleteHoldingApiSchema = z.object({
  id: z.string().min(1),
})

export const refreshHoldingPricesApiSchema = z.object({
  accountId: z.string().min(1),
})

// ============================================
// Expense Sharing Schemas (API)
// ============================================

export const participantApiSchema = z.object({
  email: z.string().email('Invalid email address'),
  shareAmount: z.coerce.number().min(0.01, 'Share amount must be positive').optional(),
  sharePercentage: z.coerce.number().min(0).max(100, 'Percentage must be between 0 and 100').optional(),
})

export type ParticipantApiInput = z.infer<typeof participantApiSchema>

export const shareExpenseApiSchema = z
  .object({
    transactionId: z.string().min(1, 'Transaction is required'),
    splitType: z.nativeEnum(SplitType).default(SplitType.EQUAL),
    participants: z.array(participantApiSchema).min(1, 'At least one participant is required'),
    description: z.string().max(240, 'Description too long').optional().nullable(),
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

export type ShareExpenseApiInput = z.infer<typeof shareExpenseApiSchema>

// ============================================
// ID-only Schemas (API)
// ============================================

export const idApiSchema = z.object({
  id: z.string().min(1),
})

export const userLookupApiSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

// ============================================
// Sharing Schemas (API)
// ============================================

export const markPaidApiSchema = z.object({
  participantId: z.string().min(1, 'Participant ID is required'),
})
