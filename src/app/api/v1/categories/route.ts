import { NextRequest } from 'next/server'
import { withApiAuth, parseJsonBody } from '@/lib/api-middleware'
import { createOrReactivateCategory } from '@/lib/services/category-service'
import { categoryApiSchema } from '@/schemas/api'
import { validationError, successResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { TransactionType } from '@prisma/client'

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

      // Return 201 for new, 200 for reactivated
      return successResponse({ id: result.category.id }, result.reactivated ? 200 : 201)
    },
    { requireSubscription: true },
  )
}
