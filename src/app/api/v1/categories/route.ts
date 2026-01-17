import { NextRequest } from 'next/server'
import { withApiAuth, parseJsonBody } from '@/lib/api-middleware'
import { createOrReactivateCategory } from '@/lib/services/category-service'
import { categoryApiSchema } from '@/schemas/api'
import { validationError, successResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { TransactionType } from '@prisma/client'

/**
 * GET /api/v1/categories
 *
 * Retrieves categories for the authenticated user.
 *
 * @query type - Optional. Filter by type (INCOME or EXPENSE).
 * @query includeArchived - Optional. Include archived categories (default: false).
 *
 * @returns {Object} { categories: Category[] }
 * @throws {400} Validation error - Invalid type parameter
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {429} Rate limited - Too many requests
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (user) => {
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const includeArchived = searchParams.get('includeArchived') === 'true'

    // Validate type if provided
    if (type !== null && !['INCOME', 'EXPENSE'].includes(type)) {
      return validationError({ type: ['type must be INCOME or EXPENSE'] })
    }

    // Build query filters (categories are user-scoped)
    const where: {
      userId: string
      type?: TransactionType
      isArchived?: boolean
    } = { userId: user.userId }

    if (type) {
      where.type = type as TransactionType
    }

    if (!includeArchived) {
      where.isArchived = false
    }

    // Execute query
    const categories = await prisma.category.findMany({
      where,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    })

    return successResponse({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        color: c.color,
        isArchived: c.isArchived,
        isHolding: c.isHolding,
        userId: c.userId,
      })),
    })
  })
}

/**
 * POST /api/v1/categories
 *
 * Creates a new category or reactivates an archived one with the same name.
 *
 * @body name - Required. Category name.
 * @body type - Required. Category type (INCOME or EXPENSE).
 * @body color - Required. Category color (hex code).
 *
 * @returns {Category} The created/reactivated category with all fields
 * @throws {400} Validation error - Invalid input or duplicate name
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - Subscription expired
 * @throws {429} Rate limited - Too many requests
 */
export async function POST(request: NextRequest) {
  return withApiAuth(
    request,
    async (user) => {
      // Parse and validate input
      const body = await parseJsonBody(request)
      if (body === null) {
        return validationError({ body: ['Invalid JSON'] })
      }

      const parsed = categoryApiSchema.safeParse(body)
      if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
      }

      const data = parsed.data

      // Use service function that handles archived category reactivation
      const result = await createOrReactivateCategory({
        userId: user.userId,
        name: data.name,
        type: data.type,
        color: data.color,
      })

      if (!result.success) {
        return validationError({ name: ['A category with this name already exists'] })
      }

      const category = result.category
      // Return 201 for new, 200 for reactivated - return full category
      return successResponse(
        {
          id: category.id,
          name: category.name,
          type: category.type,
          color: category.color,
          isArchived: category.isArchived,
          isHolding: category.isHolding,
          userId: category.userId,
        },
        result.reactivated ? 200 : 201,
      )
    },
    { requireSubscription: true },
  )
}
