import { describe, expect, it } from 'vitest'
import { AccountType, TransactionType } from '@prisma/client'
import { calculateMutualSummary } from '@/lib/finance'

describe('calculateMutualSummary', () => {
  const options = { selfAccountName: 'Avi', partnerAccountName: 'Serena' }

  it('reports partner owing self when self covers the full mutual expense', () => {
    const result = calculateMutualSummary(
      [
        {
          convertedAmount: 1500,
          isMutual: true,
          type: TransactionType.EXPENSE,
          account: { type: AccountType.SELF, name: 'Avi' },
        },
      ],
      options,
    )

    expect(result).toMatchObject({
      status: 'partner-owes-self',
      amount: 500,
    })
  })

  it('considers split settled when contributions match the 2/3 and 1/3 ratio', () => {
    const settled = calculateMutualSummary(
      [
        {
          convertedAmount: 1000,
          isMutual: true,
          type: TransactionType.EXPENSE,
          account: { type: AccountType.SELF, name: 'Avi' },
        },
        {
          convertedAmount: 500,
          isMutual: true,
          type: TransactionType.EXPENSE,
          account: { type: AccountType.PARTNER, name: 'Serena' },
        },
      ],
      options,
    )

    expect(settled).toMatchObject({ status: 'settled', amount: 0 })
  })

  it('reports self owing partner when partner contributes above their share', () => {
    const result = calculateMutualSummary(
      [
        {
          convertedAmount: 900,
          isMutual: true,
          type: TransactionType.EXPENSE,
          account: { type: AccountType.PARTNER, name: 'Serena' },
        },
      ],
      options,
    )

    expect(result).toMatchObject({
      status: 'self-owes-partner',
      amount: 600,
    })
  })
})
