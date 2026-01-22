import { NextRequest, NextResponse } from 'next/server'
import { PATCH as PaidHandler } from '@/app/api/v1/expenses/shares/participants/[participantId]/paid/route'

type RouteParams = { params: Promise<{ participantId: string }> }

/**
 * @deprecated Use PATCH /api/v1/expenses/shares/[participantId]/paid instead.
 * This endpoint is kept for backwards compatibility with existing mobile clients.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  return PaidHandler(request, context)
}
