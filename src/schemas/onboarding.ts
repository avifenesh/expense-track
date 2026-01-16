import { z } from 'zod'
import { Currency, TransactionType } from '@prisma/client'

/**
 * Schema for marking onboarding as complete
 */
export const completeOnboardingSchema = z.object({
  csrfToken: z.string().min(1, 'Security token required'),
})

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>

/**
 * Schema for skipping onboarding (marks as complete without setup)
 */
export const skipOnboardingSchema = z.object({
  csrfToken: z.string().min(1, 'Security token required'),
})

export type SkipOnboardingInput = z.infer<typeof skipOnboardingSchema>

/**
 * Schema for updating preferred currency during onboarding
 */
export const updatePreferredCurrencySchema = z.object({
  currency: z.nativeEnum(Currency),
  csrfToken: z.string().min(1, 'Security token required'),
})

export type UpdatePreferredCurrencyInput = z.infer<typeof updatePreferredCurrencySchema>

/**
 * Schema for creating initial categories during onboarding
 */
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

/**
 * Schema for creating a quick budget during onboarding
 */
export const createQuickBudgetSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  categoryId: z.string().min(1, 'Category is required'),
  monthKey: z.string().min(7, 'Month key is required'),
  planned: z.coerce.number().min(0, 'Budget must be >= 0'),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  csrfToken: z.string().min(1, 'Security token required'),
})

export type CreateQuickBudgetInput = z.infer<typeof createQuickBudgetSchema>

/**
 * Schema for seeding sample data during onboarding
 */
export const seedSampleDataSchema = z.object({
  csrfToken: z.string().min(1, 'Security token required'),
})

export type SeedSampleDataInput = z.infer<typeof seedSampleDataSchema>
