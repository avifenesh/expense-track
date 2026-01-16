import { z } from 'zod'
import { Currency, TransactionType } from '@prisma/client'

export const completeOnboardingSchema = z.object({
  csrfToken: z.string().min(1, 'Security token required'),
})

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>

export const skipOnboardingSchema = z.object({
  csrfToken: z.string().min(1, 'Security token required'),
})

export type SkipOnboardingInput = z.infer<typeof skipOnboardingSchema>

export const updatePreferredCurrencySchema = z.object({
  currency: z.nativeEnum(Currency),
  csrfToken: z.string().min(1, 'Security token required'),
})

export type UpdatePreferredCurrencyInput = z.infer<typeof updatePreferredCurrencySchema>

export const createInitialCategoriesSchema = z.object({
  categories: z
    .array(
      z.object({
        name: z.string().min(2, 'Category name must be at least 2 characters'),
        type: z.nativeEnum(TransactionType),
        color: z.string().nullable().optional(),
      }),
    )
    .min(1, 'At least one category is required'),
  csrfToken: z.string().min(1, 'Security token required'),
})

export type CreateInitialCategoriesInput = z.infer<typeof createInitialCategoriesSchema>

export const createQuickBudgetSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  categoryId: z.string().min(1, 'Category is required'),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (expected YYYY-MM)'),
  planned: z.coerce.number().min(0, 'Budget must be >= 0'),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  csrfToken: z.string().min(1, 'Security token required'),
})

export type CreateQuickBudgetInput = z.infer<typeof createQuickBudgetSchema>

export const seedSampleDataSchema = z.object({
  csrfToken: z.string().min(1, 'Security token required'),
})

export type SeedSampleDataInput = z.infer<typeof seedSampleDataSchema>
