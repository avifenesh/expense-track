// Finance module - handles transactions, budgets, holdings, and dashboard data
import { Prisma, TransactionType, Currency, AccountType } from "@prisma/client";
import { addMonths, subMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  formatMonthLabel,
  getMonthKey,
  getMonthStartFromKey,
} from "@/utils/date";
import { convertAmount, getLastUpdateTime } from "@/lib/currency";

export type MonetaryStat = {
  label: string;
  amount: number;
  variant?: "positive" | "negative" | "neutral";
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

export type MutualSettlementSummary = {
  status: "settled" | "partner-owes-self" | "self-owes-partner";
  amount: number;
  selfAccountName: string;
  partnerAccountName: string;
};

export type HoldingWithPrice = {
  id: string;
  accountId: string;
  accountName: string;
  categoryId: string;
  categoryName: string;
  symbol: string;
  quantity: number;
  averageCost: number;
  currency: Currency;
  notes: string | null;
  currentPrice: number | null;
  changePercent: number | null;
  marketValue: number;
  costBasis: number;
  gainLoss: number;
  gainLossPercent: number;
  priceAge: Date | null;
  isStale: boolean;
  // Converted values in preferred currency
  currentPriceConverted?: number | null;
  marketValueConverted?: number;
  costBasisConverted?: number;
  gainLossConverted?: number;
};

// Base transaction type with relations
export type TransactionWithDisplay = Omit<
  Prisma.TransactionGetPayload<{
    include: {
      account: true;
      category: true;
    };
  }>,
  "amount" | "month"
> & {
  amount: number;
  convertedAmount: number;
  displayCurrency: Currency;
  month: string;
  // Note: isMutual should be included via Omit, but explicitly adding for type safety
  isMutual: boolean | null;
};

export type DashboardData = {
  month: string;
  stats: MonetaryStat[];
  budgets: CategoryBudgetSummary[];
  transactions: TransactionWithDisplay[];
  recurringTemplates: RecurringTemplateSummary[];
  accounts: Awaited<ReturnType<typeof getAccounts>>;
  categories: Awaited<ReturnType<typeof getCategories>>;
  holdings: HoldingWithPrice[];
  comparison: {
    previousMonth: string;
    previousNet: number;
    change: number;
  };
  history: MonthlyHistoryPoint[];
  exchangeRateLastUpdate: Date | null;
  preferredCurrency?: Currency;
  mutualSummary?: MutualSettlementSummary;
};

const TWO_DECIMAL = 100;

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (!value) return 0;
  const parsed = typeof value === "number" ? value : value.toNumber();
  return Math.round(parsed * TWO_DECIMAL) / TWO_DECIMAL;
}

function sumByType(
  tx: Array<{ type: TransactionType; amount: number }>,
  type: TransactionType
) {
  return tx
    .filter((t) => t.type === type)
    .reduce((acc, curr) => acc + curr.amount, 0);
}

const MUTUAL_SPLIT: Record<AccountType, number> = {
  [AccountType.SELF]: 2 / 3,
  [AccountType.PARTNER]: 1 / 3,
  [AccountType.OTHER]: 0,
};

function buildAccountScopedWhere(
  base: Prisma.TransactionWhereInput,
  accountId?: string,
  accountType?: AccountType
): Prisma.TransactionWhereInput {
  if (!accountId) {
    return base;
  }

  return {
    ...base,
    accountId,
  };
}

type MutualCandidate = {
  convertedAmount: number;
  isMutual: boolean | null; // Prisma generates nullable boolean
  type: TransactionType;
  account: {
    type: AccountType;
    name: string;
  };
};

export function calculateMutualSummary(
  transactions: MutualCandidate[],
  options: { selfAccountName: string; partnerAccountName: string }
): MutualSettlementSummary | undefined {
  const mutualExpenses = transactions.filter(
    (transaction) =>
      transaction.isMutual === true && // Explicitly check for true (not null/undefined)
      transaction.type === TransactionType.EXPENSE &&
      (transaction.account.type === AccountType.SELF ||
        transaction.account.type === AccountType.PARTNER)
  );

  if (mutualExpenses.length === 0) {
    return undefined;
  }

  let actualSelf = 0;
  let actualPartner = 0;
  let expectedSelf = 0;
  let expectedPartner = 0;

  mutualExpenses.forEach((transaction) => {
    const total = transaction.convertedAmount;
    expectedSelf += total * MUTUAL_SPLIT[AccountType.SELF];
    expectedPartner += total * MUTUAL_SPLIT[AccountType.PARTNER];

    if (transaction.account.type === AccountType.SELF) {
      actualSelf += total;
    }

    if (transaction.account.type === AccountType.PARTNER) {
      actualPartner += total;
    }
  });

  const deltaSelf = actualSelf - expectedSelf;
  const tolerance = 0.01;

  if (Math.abs(deltaSelf) <= tolerance) {
    return {
      status: "settled",
      amount: 0,
      selfAccountName: options.selfAccountName,
      partnerAccountName: options.partnerAccountName,
    };
  }

  if (deltaSelf > 0) {
    return {
      status: "partner-owes-self",
      amount: Math.round(deltaSelf * TWO_DECIMAL) / TWO_DECIMAL,
      selfAccountName: options.selfAccountName,
      partnerAccountName: options.partnerAccountName,
    };
  }

  return {
    status: "self-owes-partner",
    amount: Math.round(Math.abs(deltaSelf) * TWO_DECIMAL) / TWO_DECIMAL,
    selfAccountName: options.selfAccountName,
    partnerAccountName: options.partnerAccountName,
  };
}

export async function getAccounts() {
  return prisma.account.findMany({
    orderBy: { name: "asc" },
  });
}

export async function getCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
  });
}

export async function getTransactionsForMonth({
  monthKey,
  accountId,
  preferredCurrency,
  accountType,
}: {
  monthKey: string;
  accountId?: string;
  preferredCurrency?: Currency;
  accountType?: AccountType;
}): Promise<TransactionWithDisplay[]> {
  const monthStart = getMonthStartFromKey(monthKey);
  const nextMonthStart = addMonths(monthStart, 1);
  const where = buildAccountScopedWhere(
    {
      date: {
        gte: monthStart,
        lt: nextMonthStart,
      },
    },
    accountId,
    accountType
  );

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: {
      date: "desc",
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
          console.warn(
            `Currency conversion failed for transaction ${transaction.id}:`,
            error
          );
          // Fall back to original amount
        }
      }

      return {
        ...transaction,
        amount: originalAmount,
        convertedAmount,
        displayCurrency: preferredCurrency || transaction.currency,
        month: getMonthKey(transaction.month),
        isMutual: (transaction as any).isMutual ?? false, // Type assertion: field exists in DB but not in generated types
      } satisfies TransactionWithDisplay;
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
        name: "asc",
      },
    },
  });

  return budgets;
}

export async function getRecurringTemplates({
  accountId,
}: {
  accountId?: string;
}) {
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
      dayOfMonth: "asc",
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
    startMonthKey: template.startMonth
      ? getMonthKey(template.startMonth)
      : null,
    endMonthKey: template.endMonth ? getMonthKey(template.endMonth) : null,
  }));
}

export async function getDashboardData({
  monthKey,
  accountId,
  preferredCurrency,
  accounts: providedAccounts,
}: {
  monthKey: string;
  accountId?: string;
  preferredCurrency?: Currency;
  accounts?: Awaited<ReturnType<typeof getAccounts>>;
}): Promise<DashboardData> {
  const monthStart = getMonthStartFromKey(monthKey);
  const nextMonthStart = addMonths(monthStart, 1);
  const previousMonthStart = subMonths(monthStart, 1);
  const accounts = providedAccounts ?? (await getAccounts());
  const accountRecord = accountId
    ? accounts.find((account) => account.id === accountId)
    : undefined;

  const [
    categories,
    budgets,
    transactions,
    mutualTransactionsRaw,
    recurringTemplates,
    previousTransactionsRaw,
    historyTransactionsRaw,
    exchangeRateLastUpdate,
  ] = await Promise.all([
    getCategories(),
    getBudgetsForMonth({ monthKey, accountId }),
    getTransactionsForMonth({
      monthKey,
      accountId,
      preferredCurrency,
      accountType: accountRecord?.type,
    }),
    prisma.transaction.findMany({
      where: {
        date: {
          gte: monthStart,
          lt: nextMonthStart,
        },
        isMutual: true,
        account: {
          type: {
            in: [AccountType.SELF, AccountType.PARTNER],
          },
        },
      } as any,
      include: {
        account: true,
      },
    }),
    getRecurringTemplates({ accountId }),
    prisma.transaction.findMany({
      where: buildAccountScopedWhere(
        {
          date: {
            gte: previousMonthStart,
            lt: monthStart,
          },
        },
        accountId,
        accountRecord?.type
      ),
      select: {
        type: true,
        amount: true,
        currency: true,
        date: true,
      },
    }),
    prisma.transaction.findMany({
      where: buildAccountScopedWhere(
        {
          month: {
            gte: subMonths(monthStart, 5),
            lte: monthStart,
          },
        },
        accountId,
        accountRecord?.type
      ),
      select: {
        type: true,
        amount: true,
        currency: true,
        date: true,
        month: true,
      },
      orderBy: {
        month: "asc",
      },
    }),
    getLastUpdateTime(),
  ]);

  const transactionsWithNumbers = transactions;

  // Calculate mutual summary for all views, not just Joint account
  let mutualSummary: MutualSettlementSummary | undefined;
  const mutualSummaryCandidates: MutualCandidate[] = await Promise.all(
    mutualTransactionsRaw.map(async (transaction) => {
      const originalAmount = decimalToNumber(transaction.amount);
      let convertedAmount = originalAmount;

      if (preferredCurrency && transaction.currency !== preferredCurrency) {
        try {
          convertedAmount = await convertAmount(
            originalAmount,
            transaction.currency,
            preferredCurrency,
            transaction.date
          );
        } catch (error) {
          console.warn(
            `Currency conversion failed for mutual transaction ${transaction.id}:`,
            error
          );
        }
      }

      return {
        convertedAmount,
        isMutual: (transaction as any).isMutual,
        type: transaction.type,
        account: {
          type: transaction.account.type,
          name: transaction.account.name,
        },
      } satisfies MutualCandidate;
    })
  );
  const selfAccount = accounts.find(
    (account) => account.type === AccountType.SELF
  );
  const partnerAccount = accounts.find(
    (account) => account.type === AccountType.PARTNER
  );

  if (selfAccount && partnerAccount) {
    mutualSummary = calculateMutualSummary(mutualSummaryCandidates, {
      selfAccountName: selfAccount.name,
      partnerAccountName: partnerAccount.name,
    });
  }

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

  const projectedNet =
    actualIncome +
    Math.max(remainingIncome, 0) -
    (actualExpense + Math.max(remainingExpense, 0));
  const actualNet = actualIncome - actualExpense;
  const plannedNet = plannedIncome - plannedExpense;

  // Convert previous month's transactions to preferred currency
  const previousTransactionsConverted = await Promise.all(
    previousTransactionsRaw.map(async (transaction) => {
      const originalAmount = decimalToNumber(transaction.amount);
      let convertedAmount = originalAmount;

      if (preferredCurrency && transaction.currency !== preferredCurrency) {
        try {
          convertedAmount = await convertAmount(
            originalAmount,
            transaction.currency,
            preferredCurrency,
            transaction.date
          );
        } catch (error) {
          console.warn(
            `Currency conversion failed for previous transaction:`,
            error
          );
        }
      }

      return {
        type: transaction.type,
        amount: convertedAmount,
      };
    })
  );

  const previousIncome = sumByType(
    previousTransactionsConverted,
    TransactionType.INCOME
  );
  const previousExpense = sumByType(
    previousTransactionsConverted,
    TransactionType.EXPENSE
  );

  const previousNet = previousIncome - previousExpense;
  const change = actualNet - previousNet;

  const expensesByCategory = new Map<string, number>();
  const incomeByCategory = new Map<string, number>();

  transactionsWithNumbers.forEach((transaction) => {
    const map =
      transaction.type === TransactionType.EXPENSE
        ? expensesByCategory
        : incomeByCategory;
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
      budget.category.type === TransactionType.EXPENSE
        ? planned - actual
        : planned - actual;

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

  // Convert history transactions to preferred currency
  const historyTransactionsConverted = await Promise.all(
    historyTransactionsRaw.map(async (transaction) => {
      const originalAmount = decimalToNumber(transaction.amount);
      let convertedAmount = originalAmount;

      if (preferredCurrency && transaction.currency !== preferredCurrency) {
        try {
          convertedAmount = await convertAmount(
            originalAmount,
            transaction.currency,
            preferredCurrency,
            transaction.date
          );
        } catch (error) {
          console.warn(
            `Currency conversion failed for history transaction:`,
            error
          );
        }
      }

      return {
        type: transaction.type,
        amount: convertedAmount,
        month: transaction.month as Date,
      };
    })
  );

  const historySeed = new Map<string, { income: number; expense: number }>();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const key = getMonthKey(subMonths(monthStart, offset));
    historySeed.set(key, { income: 0, expense: 0 });
  }

  const historyGrouped = historyTransactionsConverted.reduce((acc, entry) => {
    const key = getMonthKey(entry.month);
    const existing = acc.get(key) ?? { income: 0, expense: 0 };
    if (entry.type === TransactionType.INCOME) {
      existing.income += entry.amount;
    } else {
      existing.expense += entry.amount;
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
      label: "Actual net",
      amount: actualNet,
      variant: actualNet >= 0 ? "positive" : "negative",
      helper: `${formatMonthLabel(monthKey)} performance`,
    },
    {
      label: "Projected end of month",
      amount: projectedNet,
      variant: projectedNet >= 0 ? "positive" : "negative",
      helper: "Includes planned budgets",
    },
    {
      label: "Remaining budgets",
      amount: Math.max(remainingExpense, 0),
      variant: remainingExpense <= 0 ? "neutral" : "negative",
      helper: "Expense budgets left to spend",
    },
    {
      label: "Planned net",
      amount: plannedNet,
      variant: plannedNet >= 0 ? "positive" : "negative",
      helper: "Based on monthly budgets",
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
    holdings: [], // Will be populated separately in page.tsx
    comparison: {
      previousMonth: getMonthKey(previousMonthStart),
      previousNet,
      change,
    },
    history,
    exchangeRateLastUpdate,
    preferredCurrency,
    mutualSummary,
  };
}

export async function getHoldingsWithPrices({
  accountId,
  preferredCurrency,
}: {
  accountId?: string;
  preferredCurrency?: Currency;
}): Promise<HoldingWithPrice[]> {
  try {
    const where: any = {}; // Type assertion workaround for Prisma.HoldingWhereInput
    if (accountId) {
      where.accountId = accountId;
    }

    const holdings = await (prisma as any).holding.findMany({
      where,
      include: {
        account: true,
        category: true,
      },
      orderBy: {
        symbol: "asc",
      },
    });

  const { getStockPrice } = await import("@/lib/stock-api");

  const enriched = await Promise.all(
    holdings.map(async (holding: any) => {
      // Type assertion: Prisma-generated Holding type
      let currentPrice: number | null = null;
      let changePercent: number | null = null;
      let priceAge: Date | null = null;
      let isStale = false;

      try {
        const priceData = await getStockPrice(holding.symbol);
        currentPrice = priceData.price;
        changePercent = priceData.changePercent;
        priceAge = priceData.fetchedAt;
        isStale = priceData.isStale;
      } catch (error) {
        console.warn(`Failed to get price for ${holding.symbol}:`, error);
      }

      const quantity = decimalToNumber(holding.quantity);
      const averageCost = decimalToNumber(holding.averageCost);
      const costBasis = quantity * averageCost;
      const marketValue =
        currentPrice !== null ? quantity * currentPrice : costBasis;
      const gainLoss = marketValue - costBasis;
      const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

      // Currency conversion
      let currentPriceConverted: number | null = null;
      let marketValueConverted = marketValue;
      let costBasisConverted = costBasis;
      let gainLossConverted = gainLoss;

      if (preferredCurrency && holding.currency !== preferredCurrency) {
        try {
          if (currentPrice !== null) {
            currentPriceConverted = await convertAmount(
              currentPrice,
              holding.currency,
              preferredCurrency,
              new Date()
            );
          }
          marketValueConverted = await convertAmount(
            marketValue,
            holding.currency,
            preferredCurrency,
            new Date()
          );
          costBasisConverted = await convertAmount(
            costBasis,
            holding.currency,
            preferredCurrency,
            new Date()
          );
          gainLossConverted = marketValueConverted - costBasisConverted;
        } catch (error) {
          console.warn(
            `Currency conversion failed for holding ${holding.symbol}:`,
            error
          );
        }
      }

      return {
        id: holding.id,
        accountId: holding.accountId,
        accountName: holding.account.name,
        categoryId: holding.categoryId,
        categoryName: holding.category.name,
        symbol: holding.symbol,
        quantity,
        averageCost,
        currency: holding.currency,
        notes: holding.notes,
        currentPrice,
        changePercent,
        marketValue,
        costBasis,
        gainLoss,
        gainLossPercent,
        priceAge,
        isStale,
        currentPriceConverted,
        marketValueConverted,
        costBasisConverted,
        gainLossConverted,
      };
    })
  );

  return enriched;
  } catch (error) {
    console.error('Failed to fetch holdings:', error);
    return [];
  }
}
