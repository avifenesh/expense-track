import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { buildFinancialContext } from '@/lib/ai/context'
import { requireSession } from '@/lib/auth-server'
import { Currency } from '@prisma/client'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `You are Balance AI, a helpful financial assistant for the Balance Beacon personal finance app.

You have access to the user's financial data including:
- Current month summary (income, expenses, net flow)
- Budget tracking (planned vs actual spending)
- Recent transactions
- Recurring templates
- 6-month spending trends
- Investment holdings

Your role is to:
1. Answer questions about their finances clearly and concisely
2. Identify spending patterns and trends
3. Provide actionable insights and suggestions
4. Help them understand their budget performance
5. Be supportive but honest about financial habits

Guidelines:
- Be concise - users want quick answers
- Use specific numbers from their data when relevant
- Don't lecture - give practical advice
- If you don't have enough data, say so
- Never make up numbers or transactions
- Format currency amounts consistently
- Use bullet points for lists`

export async function POST(request: Request) {
  try {
    // Require authentication
    const session = await requireSession()
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await request.json()
    const { messages, accountId, monthKey, preferredCurrency } = body

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!accountId || !monthKey) {
      return new Response(JSON.stringify({ error: 'accountId and monthKey required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build financial context from user's data
    const financialContext = await buildFinancialContext(
      accountId,
      monthKey,
      (preferredCurrency as Currency) || Currency.USD,
    )

    // Stream response using Gemini Flash
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = streamText({
      model: google('gemini-2.0-flash') as any,
      system: `${SYSTEM_PROMPT}\n\n=== USER'S FINANCIAL DATA ===\n${financialContext}`,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      maxOutputTokens: 1024,
      temperature: 0.7,
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
