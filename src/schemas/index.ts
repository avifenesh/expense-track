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
})

export type TransactionInput = z.infer<typeof transactionSchema>

export const transactionUpdateSchema = transactionSchema.extend({
  id: z.string().min(1),
})

export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>

export const deleteTransactionSchema = z.object({
  id: z.string().min(1),
})

export const transactionRequestSchema = z.object({
  toId: z.string().min(1, 'Target partner account is required'),
  categoryId: z.string().min(1, 'Category is required'),
  amount: z.coerce.number().min(0.01, 'Amount must be positive'),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  date: z.coerce.date(),
  description: z.string().max(240, 'Keep the description short').optional().nullable(),
})

export type TransactionRequestInput = z.infer<typeof transactionRequestSchema>

export const idSchema = z.object({
  id: z.string().min(1),
})

// Budget schemas
export const budgetSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  monthKey: z.string().min(7),
  planned: z.coerce.number().min(0, 'Budget must be >= 0'),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  notes: z.string().max(240).optional().nullable(),
})

export type BudgetInput = z.infer<typeof budgetSchema>

export const deleteBudgetSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  monthKey: z.string().min(7),
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
})

export type RecurringTemplateInput = z.infer<typeof recurringTemplateSchema>

export const toggleRecurringSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
})

export const applyRecurringSchema = z.object({
  monthKey: z.string().min(7),
  accountId: z.string().min(1),
  templateIds: z.array(z.string()).optional(),
})

// Category schemas
export const categorySchema = z.object({
  name: z.string().min(2),
  type: z.nativeEnum(TransactionType),
  color: z.string().optional().nullable(),
})

export const archiveCategorySchema = z.object({
  id: z.string().min(1),
  isArchived: z.boolean(),
})

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const recoverySchema = z.object({
  email: z.string().email('Provide a valid email address'),
})

export const accountSelectionSchema = z.object({
  accountId: z.string().min(1),
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
})

export type HoldingInput = z.infer<typeof holdingSchema>

export const updateHoldingSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().min(0.000001).max(999999999),
  averageCost: z.coerce.number().min(0),
  notes: z.string().max(240).optional().nullable(),
})

export const deleteHoldingSchema = z.object({
  id: z.string().min(1),
})

export const refreshHoldingPricesSchema = z.object({
  accountId: z.string().min(1),
})

// Balance schemas
export const setBalanceSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  targetBalance: z.coerce.number(),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  monthKey: z.string().min(7, 'Month key is required'),
})
