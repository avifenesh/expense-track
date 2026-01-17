import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { requireSession, getDbUserAsAuthUser } from '@/lib/auth-server'
import { chatRequestSchema } from '@/schemas'
import { checkRateLimitTyped, incrementRateLimitTyped, getRateLimitHeaders } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { buildTools } from '@/lib/ai/tools'
import { formatMonthLabel } from '@/utils/date'
import { Currency } from '@prisma/client'
import { serverLogger } from '@/lib/server-logger'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  // 1. Authenticate session
  let session
  try {
    session = await requireSession()
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Get user details from database
  const authUser = await getDbUserAsAuthUser(session.userEmail)
  if (!authUser) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const userId = authUser.id

  // 2. Rate limit check (before any expensive operations)
  const rateLimit = checkRateLimitTyped(userId, 'ai_chat')
  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
          ...getRateLimitHeaders(userId, 'ai_chat'),
        },
      },
    )
  }

  // 3. Parse & validate input
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const parsed = chatRequestSchema.safeParse(body)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    return new Response(
      JSON.stringify({
        error: 'Validation failed',
        fields: fieldErrors,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { messages, accountId, monthKey, preferredCurrency } = parsed.data

  // 4. Verify account ownership (server-side authorization)
  let account
  try {
    account = await prisma.account.findFirst({
      where: { id: accountId, deletedAt: null },
      select: { id: true, name: true, userId: true },
    })
  } catch (error) {
    serverLogger.error('Failed to verify account access', { error, accountId, userId })
    return new Response(
      JSON.stringify({ error: 'Failed to verify account access' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!account) {
    return new Response(
      JSON.stringify({ error: 'Account not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (account.userId !== userId) {
    return new Response(
      JSON.stringify({ error: 'You do not have access to this account' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 5. Increment rate limit (after validation passes)
  incrementRateLimitTyped(userId, 'ai_chat')

  // 6. Build tools with verified context (userId from database, not client)
  const currency = preferredCurrency ?? Currency.USD
  const tools = buildTools({
    accountId,
    userId,
    monthKey,
    preferredCurrency: currency,
  })

  // 7. Build system prompt
  const systemPrompt = buildSystemPrompt({
    monthLabel: formatMonthLabel(monthKey),
    accountName: account.name,
    preferredCurrency: currency,
    userName: authUser.displayName,
  })

  try {
    // 8. Stream with Gemini 3 Flash
    const result = streamText({
      model: google('gemini-3-flash-preview'),
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      tools,
      maxOutputTokens: 1024,
      temperature: 0.7,
    })

    return result.toTextStreamResponse()
  } catch (error) {
    serverLogger.error('AI chat stream error', { error, userId, accountId })
    return new Response(
      JSON.stringify({ error: 'Failed to generate response' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
