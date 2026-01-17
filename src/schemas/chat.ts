import { z } from 'zod'
import { Currency } from '@prisma/client'

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1, 'Message cannot be empty').max(4000, 'Message too long'),
})

export type ChatMessage = z.infer<typeof chatMessageSchema>

export const chatRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1, 'At least one message required')
    .max(50, 'Conversation too long'),
  accountId: z.string().min(1, 'Account ID required'),
  monthKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Invalid month format (expected YYYY-MM with month 01-12)'),
  preferredCurrency: z.nativeEnum(Currency).optional(),
})

export type ChatRequest = z.infer<typeof chatRequestSchema>
