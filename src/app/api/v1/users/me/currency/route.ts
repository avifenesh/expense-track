import { NextRequest } from 'next/server'
import { withApiAuth, parseJsonBody } from '@/lib/api-middleware'
import { validationError, successResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { Currency } from '@prisma/client'
import { z } from 'zod'

const updateCurrencySchema = z.object({
  currency: z.nativeEnum(Currency),
})

/**
 * PATCH /api/v1/users/me/currency
 *
 * Updates the authenticated user's preferred currency.
 *
 * @body currency - Required. Currency code (USD, EUR, ILS).
 *
 * @returns {Object} { currency: Currency }
 * @throws {400} Validation error - Invalid currency
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {429} Rate limited - Too many requests
 */
export async function PATCH(request: NextRequest) {
  return withApiAuth(
    request,
    async (user) => {
      const body = await parseJsonBody(request)
      if (body === null) {
        return validationError({ body: ['Invalid JSON'] })
      }

      const parsed = updateCurrencySchema.safeParse(body)
      if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
      }

      const data = parsed.data

      await prisma.user.update({
        where: { id: user.userId },
        data: { preferredCurrency: data.currency },
      })

      return successResponse({ currency: data.currency })
    },
    // Note: No subscription required - this is used during onboarding before user subscribes
  )
}
