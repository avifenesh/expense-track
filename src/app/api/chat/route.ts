import { streamText, stepCountIs } from 'ai'
import { model, tools, systemPrompt } from '@/lib/ai/bedrock'
import { buildFinancialContext } from '@/lib/ai/context'
import { requireSession } from '@/lib/auth-server'
import { Currency } from '@prisma/client'

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    // Authentication check
    await requireSession();

    // Parse request body
    const { messages, accountId, monthKey, preferredCurrency } = await req.json()

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
    const validMessages = messages.filter(
      (msg: { content: string | unknown[] }) => {
        return (
          msg.content &&
          (typeof msg.content === "string"
            ? msg.content.trim().length > 0
            : Array.isArray(msg.content) && msg.content.length > 0)
        );
      }
    );

    const result = streamText({
      model,
      system: `${systemPrompt}\n\n=== CURRENT FINANCIAL DATA ===\n${context}`,
      messages: validMessages,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: tools as any,
      stopWhen: stepCountIs(2),
    });
    return result.toTextStreamResponse()
  } catch (error) {
    console.error('Chat API error:', error)

    if (error instanceof Error && error.message.includes('session')) {
      return new Response('Unauthorized', { status: 401 })
    }

    return new Response('Internal server error', { status: 500 })
  }
}
