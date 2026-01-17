/**
 * Finance module - Internal utilities
 *
 * @internal These functions are for internal use within the finance module only.
 * Do not import directly - use the public API from '@/lib/finance' instead.
 */
import { Prisma, TransactionType, Currency } from '@prisma/client'
import { convertAmountWithCache, type RateCache } from '@/lib/currency'

const TWO_DECIMAL = 100

export function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (!value) return 0
  const parsed = typeof value === 'number' ? value : value.toNumber()
  return Math.round(parsed * TWO_DECIMAL) / TWO_DECIMAL
}

export function sumByType(
  tx: Array<{ type: TransactionType; amount: number }>,
  type: TransactionType,
): number {
  return tx.filter((t) => t.type === type).reduce((acc, curr) => acc + curr.amount, 0)
}

/**
 * Convert transaction amount using batch-loaded rate cache (sync) or individual lookup (async)
 */
export function convertTransactionAmountSync(
  amount: Prisma.Decimal | number,
  fromCurrency: Currency,
  toCurrency: Currency | undefined,
  rateCache: RateCache,
): number {
  const originalAmount = decimalToNumber(amount)
  if (!toCurrency || fromCurrency === toCurrency) {
    return originalAmount
  }
  return convertAmountWithCache(originalAmount, fromCurrency, toCurrency, rateCache)
}

export function buildAccountScopedWhere(
  base: Prisma.TransactionWhereInput,
  accountId?: string,
): Prisma.TransactionWhereInput {
  const withDeletedFilter = {
    ...base,
    deletedAt: null,
  }

  if (!accountId) {
    return withDeletedFilter
  }

  return {
    ...withDeletedFilter,
    accountId,
  }
}
