// Finance module - budget operations
import { prisma } from '@/lib/prisma'
import { getMonthStartFromKey } from '@/utils/date'

export async function getBudgetsForMonth({ monthKey, accountId }: { monthKey: string; accountId: string }) {
  const monthStart = getMonthStartFromKey(monthKey)

  const budgets = await prisma.budget.findMany({
    where: {
      month: monthStart,
      accountId,
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
