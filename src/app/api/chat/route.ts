import { streamText, stepCountIs } from 'ai'
import { model, createTools, systemPrompt } from '@/lib/ai/bedrock'
import { buildFinancialContext } from '@/lib/ai/context'
import { requireSession, getAuthUserFromSession } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { Currency } from '@prisma/client'

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    // Authentication check
    const session = await requireSession()
    const authUser = getAuthUserFromSession(session)
    if (!authUser) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Parse request body with error handling
    let body: { messages?: unknown; accountId?: string; monthKey?: string; preferredCurrency?: string }
    try {
      body = await req.json()
    } catch {
      return new Response('Invalid JSON in request body', { status: 400 })
    }

    const { messages, accountId, monthKey, preferredCurrency } = body

    if (!accountId || !monthKey) {
      return new Response('Missing accountId or monthKey', { status: 400 })
    }

    // Verify account access and get all allowed account IDs
    const account = await prisma.account.findUnique({ where: { id: accountId } })
    if (!account || !authUser.accountNames.includes(account.name)) {
      return new Response('Forbidden: You do not have access to this account', { status: 403 })
    }

    // Get all account IDs the user can access (for AI tool scoping)
    const allowedAccounts = await prisma.account.findMany({
      where: { name: { in: authUser.accountNames } },
      select: { id: true },
    })
    const allowedAccountIds = allowedAccounts.map((a) => a.id)

    // Build financial context
    const context = await buildFinancialContext(accountId, monthKey, preferredCurrency as Currency | undefined)

    // Validate messages array
    if (!Array.isArray(messages)) {
      return new Response('Missing or invalid messages array', { status: 400 })
    }

    // Filter out messages with empty content (Bedrock requirement)
    const validMessages = messages.filter((msg: { content: string | unknown[] }) => {
      return (
        msg.content &&
        (typeof msg.content === 'string'
          ? msg.content.trim().length > 0
          : Array.isArray(msg.content) && msg.content.length > 0)
      )
    })

    // Create account-scoped tools for this user
    const scopedTools = createTools(allowedAccountIds)

    const result = streamText({
      model,
      system: `${systemPrompt}\n\n=== CURRENT FINANCIAL DATA ===\n${context}`,
      messages: validMessages,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: scopedTools as any,
      stopWhen: stepCountIs(2),
    })
    return result.toTextStreamResponse()
  } catch (error) {
    console.error('Chat API error:', error)

    if (error instanceof Error && error.message.includes('session')) {
      return new Response('Unauthorized', { status: 401 })
    }

    return new Response('Internal server error', { status: 500 })
  }
}
