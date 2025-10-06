import { streamText, stepCountIs } from 'ai'
import { model, fastModel, tools, systemPrompt } from '@/lib/ai/bedrock'
import { buildFinancialContext } from '@/lib/ai/context'
import { requireSession } from '@/lib/auth-server'
import { Currency } from '@prisma/client'

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    // Authentication check
    const session = await requireSession()

    // Parse request body
    const { messages, accountId, monthKey, preferredCurrency, useFallback } = await req.json()

    if (!accountId || !monthKey) {
      return new Response('Missing accountId or monthKey', { status: 400 })
    }

    // Build financial context
    const context = await buildFinancialContext(
      accountId,
      monthKey,
      preferredCurrency as Currency | undefined
    )

    // Filter out messages with empty content (Bedrock requirement)
    const validMessages = messages.filter((msg: any) => {
      return msg.content && (
        typeof msg.content === 'string'
          ? msg.content.trim().length > 0
          : Array.isArray(msg.content) && msg.content.length > 0
      )
    })

    // Log tools for debugging
    console.log('Tools config:', JSON.stringify(tools, null, 2))

    // Select model based on explicit fallback flag
    const selectedModel = useFallback ? fastModel : model
    const result = streamText({
      model: selectedModel,
      system: `${systemPrompt}\n\n=== CURRENT FINANCIAL DATA ===\n${context}`,
      messages: validMessages,
      tools: tools as any,
      stopWhen: stepCountIs(2),
      maxRetries: useFallback ? 3 : 0,
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
