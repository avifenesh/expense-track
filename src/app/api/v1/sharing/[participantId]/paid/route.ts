import { NextRequest, NextResponse } from 'next/server'
import { PATCH as PaidHandler } from '@/app/api/v1/expenses/shares/[id]/paid/route'

type RouteParams = { params: Promise<{ participantId: string }> }

/**
 * @deprecated Use PATCH /api/v1/expenses/shares/[id]/paid instead.
 * This endpoint is kept for backwards compatibility with existing mobile clients.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  // Map participantId to id for the underlying handler
  const { participantId } = await params
  return PaidHandler(request, { params: Promise.resolve({ id: participantId }) })
}
