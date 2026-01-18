import { NextRequest } from 'next/server'
import { withApiAuth, parseJsonBody } from '@/lib/api-middleware'
import { validationError, successResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { TransactionType } from '@prisma/client'
import { z } from 'zod'

const bulkCategoriesSchema = z.object({
  categories: z
    .array(
      z.object({
        name: z.string().min(2, 'Category name must be at least 2 characters'),
        type: z.nativeEnum(TransactionType),
        color: z.string().nullable().optional(),
      }),
    )
    .min(1, 'At least one category is required'),
})

/**
 * POST /api/v1/categories/bulk
 *
 * Creates multiple categories at once (or reactivates existing archived ones).
 *
 * @body categories - Required. Array of {name, type, color?}.
 *
 * @returns {Object} { categoriesCreated: number, categories: Category[] }
 * @throws {400} Validation error - Invalid input
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - Subscription expired
 * @throws {429} Rate limited - Too many requests
 */
export async function POST(request: NextRequest) {
  return withApiAuth(
    request,
    async (user) => {
      const body = await parseJsonBody(request)
      if (body === null) {
        return validationError({ body: ['Invalid JSON'] })
      }

      const parsed = bulkCategoriesSchema.safeParse(body)
      if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
      }

      const data = parsed.data

      const createdCategories = await prisma.$transaction(
        data.categories.map((cat) =>
          prisma.category.upsert({
            where: {
              userId_name_type: {
                userId: user.userId,
                name: cat.name,
                type: cat.type,
              },
            },
            create: {
              userId: user.userId,
              name: cat.name,
              type: cat.type,
              color: cat.color ?? null,
            },
            update: {
              color: cat.color ?? undefined,
              isArchived: false,
            },
            select: {
              id: true,
              name: true,
              type: true,
              color: true,
              isArchived: true,
              isHolding: true,
              userId: true,
            },
          }),
        ),
      )

      return successResponse(
        {
          categoriesCreated: createdCategories.length,
          categories: createdCategories,
        },
        201,
      )
    },
    { requireSubscription: true },
  )
}
