// Finance module - recurring template operations
import { prisma } from '@/lib/prisma'
import { getMonthKey } from '@/utils/date'
import { decimalToNumber } from './utils'
import type { RecurringTemplateSummary } from './types'

export async function getRecurringTemplates({ accountId }: { accountId: string }) {
  const templates = await prisma.recurringTemplate.findMany({
    where: { accountId, deletedAt: null },
    include: {
      category: true,
      account: true,
    },
    orderBy: {
      dayOfMonth: 'asc',
    },
  })

  return templates.map<RecurringTemplateSummary>((template) => ({
    id: template.id,
    accountId: template.accountId,
    categoryId: template.categoryId,
    type: template.type,
    amount: decimalToNumber(template.amount),
    currency: template.currency,
    description: template.description,
    dayOfMonth: template.dayOfMonth,
    isActive: template.isActive,
    accountName: template.account.name,
    categoryName: template.category.name,
    startMonthKey: template.startMonth ? getMonthKey(template.startMonth) : null,
    endMonthKey: template.endMonth ? getMonthKey(template.endMonth) : null,
  }))
}
