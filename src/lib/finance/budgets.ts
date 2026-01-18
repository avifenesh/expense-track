// Finance module - budget operations
import { prisma } from '@/lib/prisma'
import { getMonthStartFromKey } from '@/utils/date'
import { decimalToNumber } from './utils'

export async function getBudgetsForMonth({ monthKey, accountId }: { monthKey: string; accountId: string }) {
  const monthStart = getMonthStartFromKey(monthKey)

  const budgets = await prisma.budget.findMany({
    where: {
      month: monthStart,
      accountId,
      deletedAt: null,
    },
    include: {
      category: true,
      account: true,
    },
    orderBy: {
      category: {
        name: 'asc',
      },
    },
  })

  return budgets
}

export async function getMonthlyIncomeGoal({
  monthKey,
  accountId,
}: {
  monthKey: string
  accountId: string
}): Promise<{ amount: number; currency: string; isDefault: boolean } | null> {
  const monthStart = getMonthStartFromKey(monthKey)

  // First try to get a month-specific goal
  const monthGoal = await prisma.monthlyIncomeGoal.findFirst({
    where: {
      accountId,
      month: monthStart,
      deletedAt: null,
    },
  })

  if (monthGoal) {
    return {
      amount: decimalToNumber(monthGoal.amount),
      currency: monthGoal.currency,
      isDefault: false,
    }
  }

  // Fall back to account default
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      defaultIncomeGoal: true,
      defaultIncomeGoalCurrency: true,
    },
  })

  if (account?.defaultIncomeGoal) {
    return {
      amount: decimalToNumber(account.defaultIncomeGoal),
      currency: account.defaultIncomeGoalCurrency ?? 'USD',
      isDefault: true,
    }
  }

  return null
}
