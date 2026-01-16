import { describe, expect, it } from 'vitest'
import { SplitType } from '@prisma/client'
import {
  participantSchema,
  shareExpenseSchema,
  markSharePaidSchema,
  cancelSharedExpenseSchema,
  declineShareSchema,
  userLookupSchema,
  sendPaymentReminderSchema,
} from '@/schemas'

describe('participantSchema', () => {
  it('should accept valid email', () => {
    const result = participantSchema.safeParse({ email: 'test@example.com' })
    expect(result.success).toBe(true)
  })

  it('should reject invalid email', () => {
    const result = participantSchema.safeParse({ email: 'invalid-email' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toBeDefined()
    }
  })

  it('should accept optional shareAmount', () => {
    const result = participantSchema.safeParse({
      email: 'test@example.com',
      shareAmount: 50.0,
    })
    expect(result.success).toBe(true)
  })

  it('should reject negative shareAmount', () => {
    const result = participantSchema.safeParse({
      email: 'test@example.com',
      shareAmount: -10,
    })
    expect(result.success).toBe(false)
  })

  it('should accept optional sharePercentage', () => {
    const result = participantSchema.safeParse({
      email: 'test@example.com',
      sharePercentage: 25,
    })
    expect(result.success).toBe(true)
  })

  it('should reject sharePercentage over 100', () => {
    const result = participantSchema.safeParse({
      email: 'test@example.com',
      sharePercentage: 101,
    })
    expect(result.success).toBe(false)
  })
})

describe('shareExpenseSchema', () => {
  it('should accept valid equal split', () => {
    const result = shareExpenseSchema.safeParse({
      transactionId: 'tx-123',
      splitType: SplitType.EQUAL,
      participants: [{ email: 'friend@example.com' }],
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(true)
  })

  it('should accept valid percentage split', () => {
    const result = shareExpenseSchema.safeParse({
      transactionId: 'tx-123',
      splitType: SplitType.PERCENTAGE,
      participants: [
        { email: 'friend1@example.com', sharePercentage: 30 },
        { email: 'friend2@example.com', sharePercentage: 20 },
      ],
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(true)
  })

  it('should accept valid fixed split', () => {
    const result = shareExpenseSchema.safeParse({
      transactionId: 'tx-123',
      splitType: SplitType.FIXED,
      participants: [
        { email: 'friend1@example.com', shareAmount: 30 },
        { email: 'friend2@example.com', shareAmount: 20 },
      ],
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(true)
  })

  it('should reject empty participants array', () => {
    const result = shareExpenseSchema.safeParse({
      transactionId: 'tx-123',
      splitType: SplitType.EQUAL,
      participants: [],
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.participants).toBeDefined()
    }
  })

  it('should reject missing transactionId', () => {
    const result = shareExpenseSchema.safeParse({
      splitType: SplitType.EQUAL,
      participants: [{ email: 'friend@example.com' }],
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(false)
  })

  it('should reject missing csrfToken', () => {
    const result = shareExpenseSchema.safeParse({
      transactionId: 'tx-123',
      splitType: SplitType.EQUAL,
      participants: [{ email: 'friend@example.com' }],
    })
    expect(result.success).toBe(false)
  })

  it('should reject percentage split over 100%', () => {
    const result = shareExpenseSchema.safeParse({
      transactionId: 'tx-123',
      splitType: SplitType.PERCENTAGE,
      participants: [
        { email: 'friend1@example.com', sharePercentage: 60 },
        { email: 'friend2@example.com', sharePercentage: 50 },
      ],
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.flatten()
      const hasPercentageError =
        errors.formErrors.some((e) => e.includes('percentage')) ||
        errors.fieldErrors.participants?.some((e) => e.includes('percentage'))
      expect(hasPercentageError).toBe(true)
    }
  })

  it('should accept optional description', () => {
    const result = shareExpenseSchema.safeParse({
      transactionId: 'tx-123',
      splitType: SplitType.EQUAL,
      participants: [{ email: 'friend@example.com' }],
      description: 'Dinner split',
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBe('Dinner split')
    }
  })

  it('should reject description over 240 characters', () => {
    const result = shareExpenseSchema.safeParse({
      transactionId: 'tx-123',
      splitType: SplitType.EQUAL,
      participants: [{ email: 'friend@example.com' }],
      description: 'a'.repeat(250),
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(false)
  })
})

describe('markSharePaidSchema', () => {
  it('should accept valid input', () => {
    const result = markSharePaidSchema.safeParse({
      participantId: 'part-123',
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(true)
  })

  it('should reject missing participantId', () => {
    const result = markSharePaidSchema.safeParse({
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(false)
  })

  it('should reject missing csrfToken', () => {
    const result = markSharePaidSchema.safeParse({
      participantId: 'part-123',
    })
    expect(result.success).toBe(false)
  })
})

describe('cancelSharedExpenseSchema', () => {
  it('should accept valid input', () => {
    const result = cancelSharedExpenseSchema.safeParse({
      sharedExpenseId: 'shared-123',
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(true)
  })

  it('should reject missing sharedExpenseId', () => {
    const result = cancelSharedExpenseSchema.safeParse({
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(false)
  })
})

describe('declineShareSchema', () => {
  it('should accept valid input', () => {
    const result = declineShareSchema.safeParse({
      participantId: 'part-123',
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(true)
  })

  it('should reject empty participantId', () => {
    const result = declineShareSchema.safeParse({
      participantId: '',
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(false)
  })
})

describe('userLookupSchema', () => {
  it('should accept valid email', () => {
    const result = userLookupSchema.safeParse({
      email: 'friend@example.com',
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid email', () => {
    const result = userLookupSchema.safeParse({
      email: 'not-an-email',
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toBeDefined()
    }
  })
})

describe('sendPaymentReminderSchema', () => {
  it('should accept valid input', () => {
    const result = sendPaymentReminderSchema.safeParse({
      participantId: 'part-123',
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(true)
  })

  it('should reject missing participantId', () => {
    const result = sendPaymentReminderSchema.safeParse({
      csrfToken: 'token-123',
    })
    expect(result.success).toBe(false)
  })

  it('should reject missing csrfToken', () => {
    const result = sendPaymentReminderSchema.safeParse({
      participantId: 'part-123',
    })
    expect(result.success).toBe(false)
  })
})
