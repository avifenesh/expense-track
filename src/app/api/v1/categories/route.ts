import { NextRequest } from 'next/server'
import { withApiAuth, parseJsonBody } from '@/lib/api-middleware'
import { createCategory } from '@/lib/services/category-service'
import { categoryApiSchema } from '@/schemas/api'
import { validationError, successResponse, serverError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { TransactionType } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { serverLogger } from '@/lib/server-logger'

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

      // Execute create with proper error handling
      try {
        const category = await createCategory({
          userId: user.userId,
          name: data.name,
          type: data.type,
          color: data.color,
        })
        return successResponse({ id: category.id }, 201)
      } catch (error) {
        // Distinguish error types for better client feedback
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2002') {
            return validationError({ name: ['A category with this name already exists'] })
          }
        }
        serverLogger.error('Failed to create category', { action: 'POST /api/v1/categories', userId: user.userId }, error)
        return serverError('Unable to create category')
      }
    },
    { requireSubscription: true },
  )
}
