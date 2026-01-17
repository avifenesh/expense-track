// Finance module - transaction operations
import { Currency } from '@prisma/client'
import { addMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { getMonthKey, getMonthStartFromKey } from '@/utils/date'
import { batchLoadExchangeRates } from '@/lib/currency'
import { decimalToNumber, convertTransactionAmountSync, buildAccountScopedWhere } from './utils'
import type { TransactionWithDisplay } from './types'

export async function getTransactionsForMonth({
  monthKey,
  accountId,
  preferredCurrency,
}: {
  monthKey: string
  accountId?: string
  preferredCurrency?: Currency
}): Promise<TransactionWithDisplay[]> {
  const monthStart = getMonthStartFromKey(monthKey)
  const nextMonthStart = addMonths(monthStart, 1)
  const where = buildAccountScopedWhere(
    {
      date: {
        gte: monthStart,
        lt: nextMonthStart,
      },
    },
    accountId,
  )

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: {
      date: 'desc',
    },
    include: {
      category: true,
      account: true,
    },
  })

  // Batch load exchange rates in one query (fixes N+1)
  const rateCache = await batchLoadExchangeRates()

  const converted = transactions.map((transaction) => {
    const originalAmount = decimalToNumber(transaction.amount)
    const convertedAmount = convertTransactionAmountSync(
      transaction.amount,
      transaction.currency,
      preferredCurrency,
      rateCache,
    )

    return {
      ...transaction,
      amount: originalAmount,
      convertedAmount,
      displayCurrency: preferredCurrency || transaction.currency,
      month: getMonthKey(transaction.month),
    } satisfies TransactionWithDisplay
  })

  return converted
}
