import { Prisma, TransactionType, Currency } from '@prisma/client';
import { addMonths, subMonths } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { formatMonthLabel, getMonthKey, getMonthStart, getMonthStartFromKey } from '@/utils/date';
import { convertAmount, getLastUpdateTime } from '@/lib/currency';

export type MonetaryStat = {
  label: string;
  amount: number;
  variant?: 'positive' | 'negative' | 'neutral';
  helper?: string;
};

export type CategoryBudgetSummary = {
  budgetId: string;
  accountId: string;
  accountName: string;
  categoryId: string;
  categoryName: string;
  categoryType: TransactionType;
  planned: number;
  actual: number;
  remaining: number;
  month: string;
};

export type MonthlyHistoryPoint = {
  month: string;
  income: number;
  expense: number;
  net: number;
};

export type RecurringTemplateSummary = {
  id: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: number;
  description: string | null;
  dayOfMonth: number;
  isActive: boolean;
  accountName: string;
  categoryName: string;
  startMonthKey: string | null;
  endMonthKey: string | null;
};

export type DashboardData = {
  month: string;
  stats: MonetaryStat[];
  budgets: CategoryBudgetSummary[];
  transactions: Awaited<ReturnType<typeof getTransactionsForMonth>>;
  recurringTemplates: RecurringTemplateSummary[];
  accounts: Awaited<ReturnType<typeof getAccounts>>;
  categories: Awaited<ReturnType<typeof getCategories>>;
  comparison: {
    previousMonth: string;
    previousNet: number;
    change: number;
  };
  history: MonthlyHistoryPoint[];
  exchangeRateLastUpdate: Date | null;
  preferredCurrency?: Currency;
};

const TWO_DECIMAL = 100;

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (!value) return 0;
  const parsed = typeof value === 'number' ? value : value.toNumber();
  return Math.round(parsed * TWO_DECIMAL) / TWO_DECIMAL;
}

function sumByType(tx: Array<{ type: TransactionType; amount: number }>, type: TransactionType) {
  return tx.filter((t) => t.type === type).reduce((acc, curr) => acc + curr.amount, 0);
}

export async function getAccounts() {
  return prisma.account.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function getCategories() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function getTransactionsForMonth({
  monthKey,
  accountId,
  preferredCurrency,
}: {
  monthKey: string;
  accountId?: string;
  preferredCurrency?: Currency;
}) {
  const monthStart = getMonthStartFromKey(monthKey);
  const nextMonthStart = addMonths(monthStart, 1);
  const where: Prisma.TransactionWhereInput = {
    date: {
      gte: monthStart,
      lt: nextMonthStart,
    },
  };
  if (accountId) {
    where.accountId = accountId;
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: {
      date: 'desc',
    },
    include: {
      category: true,
      account: true,
    },
  });

  const converted = await Promise.all(
    transactions.map(async (transaction) => {
      const originalAmount = decimalToNumber(transaction.amount);
      let convertedAmount = originalAmount;

      // Convert if preferred currency is different from transaction currency
      if (preferredCurrency && transaction.currency !== preferredCurrency) {
        try {
          convertedAmount = await convertAmount(
            originalAmount,
            transaction.currency,
            preferredCurrency,
            transaction.date
          );
        } catch (error) {
          console.warn(`Currency conversion failed for transaction ${transaction.id}:`, error);
          // Fall back to original amount
        }
      }

      return {
        ...transaction,
        amount: originalAmount,
        convertedAmount,
        displayCurrency: preferredCurrency || transaction.currency,
        month: getMonthKey(transaction.month),
      };
    })
  );

  return converted;
}

export async function getBudgetsForMonth({
  monthKey,
  accountId,
}: {
  monthKey: string;
  accountId?: string;
}) {
  const monthStart = getMonthStartFromKey(monthKey);
  const where: Prisma.BudgetWhereInput = {
    month: monthStart,
  };

  if (accountId) {
    where.accountId = accountId;
  }

  const budgets = await prisma.budget.findMany({
    where,
    include: {
      category: true,
      account: true,
    },
    orderBy: {
      category: {
        name: 'asc',
      },
    },
  });

  return budgets;
}

export async function getRecurringTemplates({ accountId }: { accountId?: string }) {
  const where: Prisma.RecurringTemplateWhereInput = {};
  if (accountId) {
    where.accountId = accountId;
  }

  const templates = await prisma.recurringTemplate.findMany({
    where,
    include: {
      category: true,
      account: true,
    },
    orderBy: {
      dayOfMonth: 'asc',
    },
  });

  return templates.map<RecurringTemplateSummary>((template) => ({
    id: template.id,
    accountId: template.accountId,
    categoryId: template.categoryId,
    type: template.type,
    amount: decimalToNumber(template.amount),
    description: template.description,
    dayOfMonth: template.dayOfMonth,
    isActive: template.isActive,
    accountName: template.account.name,
    categoryName: template.category.name,
    startMonthKey: template.startMonth ? getMonthKey(template.startMonth) : null,
    endMonthKey: template.endMonth ? getMonthKey(template.endMonth) : null,
  }));
}

export async function getDashboardData({
  monthKey,
  accountId,
  preferredCurrency,
}: {
  monthKey: string;
  accountId?: string;
  preferredCurrency?: Currency;
}): Promise<DashboardData> {
  const monthStart = getMonthStartFromKey(monthKey);
  const nextMonthStart = addMonths(monthStart, 1);
  const previousMonthStart = subMonths(monthStart, 1);
  const accountFilter = accountId ? { accountId } : undefined;

  const [accounts, categories, budgets, transactions, recurringTemplates, previousTotals, historyRaw, exchangeRateLastUpdate] =
    await Promise.all([
      getAccounts(),
      getCategories(),
      getBudgetsForMonth({ monthKey, accountId }),
      getTransactionsForMonth({ monthKey, accountId, preferredCurrency }),
      getRecurringTemplates({ accountId }),
      prisma.transaction.groupBy({
        by: ['type'],
        where: {
          date: {
            gte: previousMonthStart,
            lt: monthStart,
          },
          ...(accountFilter ?? {}),
        },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ['month', 'type'],
        where: {
          month: {
            gte: subMonths(monthStart, 5),
            lte: monthStart,
          },
          ...(accountFilter ?? {}),
        },
        _sum: { amount: true },
        orderBy: {
          month: 'asc',
        },
      }),
      getLastUpdateTime(),
    ]);

  const transactionsWithNumbers = transactions;

  // Use converted amounts for calculations when preferred currency is set
  const totals = transactionsWithNumbers.map((t) => ({
    type: t.type,
    amount: t.convertedAmount,
  }));

  const actualIncome = sumByType(totals, TransactionType.INCOME);
  const actualExpense = sumByType(totals, TransactionType.EXPENSE);

  const plannedIncome = budgets
    .filter((budget) => budget.category.type === TransactionType.INCOME)
    .reduce((acc, curr) => acc + decimalToNumber(curr.planned), 0);

  const plannedExpense = budgets
    .filter((budget) => budget.category.type === TransactionType.EXPENSE)
    .reduce((acc, curr) => acc + decimalToNumber(curr.planned), 0);

  const remainingIncome = plannedIncome - actualIncome;
  const remainingExpense = plannedExpense - actualExpense;

  const projectedNet = actualIncome + Math.max(remainingIncome, 0) - (actualExpense + Math.max(remainingExpense, 0));
  const actualNet = actualIncome - actualExpense;
  const plannedNet = plannedIncome - plannedExpense;

  const previousIncome = sumByType(
    previousTotals.map((total) => ({ type: total.type, amount: decimalToNumber(total._sum.amount) })),
    TransactionType.INCOME,
  );

  const previousExpense = sumByType(
    previousTotals.map((total) => ({ type: total.type, amount: decimalToNumber(total._sum.amount) })),
    TransactionType.EXPENSE,
  );

  const previousNet = previousIncome - previousExpense;
  const change = actualNet - previousNet;

  const expensesByCategory = new Map<string, number>();
  const incomeByCategory = new Map<string, number>();

  transactionsWithNumbers.forEach((transaction) => {
    const map = transaction.type === TransactionType.EXPENSE ? expensesByCategory : incomeByCategory;
    const current = map.get(transaction.categoryId) ?? 0;
    map.set(transaction.categoryId, current + transaction.convertedAmount);
  });

  const budgetsSummary: CategoryBudgetSummary[] = budgets.map((budget) => {
    const planned = decimalToNumber(budget.planned);
    const actual =
      budget.category.type === TransactionType.EXPENSE
        ? expensesByCategory.get(budget.categoryId) ?? 0
        : incomeByCategory.get(budget.categoryId) ?? 0;
    const remaining =
      budget.category.type === TransactionType.EXPENSE ? planned - actual : planned - actual;

    return {
      budgetId: budget.id,
      accountId: budget.accountId,
      accountName: budget.account.name,
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      categoryType: budget.category.type,
      planned,
      actual,
      remaining,
      month: monthKey,
    };
  });

  const historySeed = new Map<string, { income: number; expense: number }>();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const key = getMonthKey(subMonths(monthStart, offset));
    historySeed.set(key, { income: 0, expense: 0 });
  }

  const historyGrouped = historyRaw.reduce((acc, entry) => {
    const key = getMonthKey(entry.month as Date);
    const existing = acc.get(key) ?? { income: 0, expense: 0 };
    const amount = decimalToNumber(entry._sum.amount);
    if (entry.type === TransactionType.INCOME) {
      existing.income += amount;
    } else {
      existing.expense += amount;
    }
    acc.set(key, existing);
    return acc;
  }, historySeed);

  const history: MonthlyHistoryPoint[] = Array.from(historyGrouped.entries())
    .map(([key, value]) => ({
      month: key,
      income: value.income,
      expense: value.expense,
      net: value.income - value.expense,
    }))
    .sort((a, b) => (a.month > b.month ? 1 : -1));

  const stats: MonetaryStat[] = [
    {
      label: 'Actual net',
      amount: actualNet,
      variant: actualNet >= 0 ? 'positive' : 'negative',
      helper: `${formatMonthLabel(monthKey)} performance`,
    },
    {
      label: 'Projected end of month',
      amount: projectedNet,
      variant: projectedNet >= 0 ? 'positive' : 'negative',
      helper: 'Includes planned budgets',
    },
    {
      label: 'Remaining budgets',
      amount: Math.max(remainingExpense, 0),
      variant: remainingExpense <= 0 ? 'neutral' : 'negative',
      helper: 'Expense budgets left to spend',
    },
    {
      label: 'Planned net',
      amount: plannedNet,
      variant: plannedNet >= 0 ? 'positive' : 'negative',
      helper: 'Based on monthly budgets',
    },
  ];

  return {
    month: monthKey,
    stats,
    budgets: budgetsSummary,
    transactions: transactionsWithNumbers,
    recurringTemplates,
    accounts,
    categories,
    comparison: {
      previousMonth: getMonthKey(previousMonthStart),
      previousNet,
      change,
    },
    history,
    exchangeRateLastUpdate,
    preferredCurrency,
  };
}
