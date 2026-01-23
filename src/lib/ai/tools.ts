import { tool } from 'ai'
import { z } from 'zod'
import { Currency } from '@prisma/client'
import { getCachedDashboardData } from '@/lib/dashboard-cache'
import { getBudgetProgress } from '@/lib/dashboard-ux'
import { getTransactionsForMonth, getHoldingsWithPrices, getSettlementBalance, getSharedExpenses } from '@/lib/finance'

export interface ToolContext {
  accountId: string
  userId: string
  monthKey: string
  preferredCurrency: Currency
}

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  EUR: '€',
  ILS: '₪',
}

function formatCurrency(amount: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency]
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`
}

export function buildTools(ctx: ToolContext) {
  return {
    getMonthSummary: tool({
      description: 'Get the current month summary including total income, expenses, net flow, and budget status',
      inputSchema: z.object({}),
      execute: async () => {
        const data = await getCachedDashboardData({
          monthKey: ctx.monthKey,
          accountId: ctx.accountId,
          preferredCurrency: ctx.preferredCurrency,
        })

        const stats = data.stats ?? []
        const summary = stats.map((s) => ({
          label: s.label,
          amount: formatCurrency(s.amount, ctx.preferredCurrency),
          helper: s.helper,
        }))

        return {
          month: ctx.monthKey,
          currency: ctx.preferredCurrency,
          summary,
          comparison: data.comparison
            ? {
                previousMonth: data.comparison.previousMonth,
                previousNet: formatCurrency(data.comparison.previousNet, ctx.preferredCurrency),
                change: formatCurrency(data.comparison.change, ctx.preferredCurrency),
              }
            : null,
        }
      },
    }),

    getBudgetStatus: tool({
      description: 'Get budget vs actual spending for all categories this month',
      inputSchema: z.object({
        categoryType: z.enum(['INCOME', 'EXPENSE', 'ALL']).optional().describe('Filter by category type'),
      }),
      execute: async ({ categoryType }: { categoryType?: 'INCOME' | 'EXPENSE' | 'ALL' }) => {
        const data = await getCachedDashboardData({
          monthKey: ctx.monthKey,
          accountId: ctx.accountId,
          preferredCurrency: ctx.preferredCurrency,
        })

        let budgets = data.budgets ?? []
        if (categoryType && categoryType !== 'ALL') {
          budgets = budgets.filter((b) => b.categoryType === categoryType)
        }

        if (budgets.length === 0) {
          return { message: 'No budgets set for this month', budgets: [] }
        }

        const formatted = budgets.map((b) => {
          const progress = getBudgetProgress(b)
          const percentUsed = Math.round(progress * 100)

          return {
            category: b.categoryName,
            type: b.categoryType,
            planned: formatCurrency(b.planned, ctx.preferredCurrency),
            actual: formatCurrency(b.actual, ctx.preferredCurrency),
            remaining: formatCurrency(b.remaining, ctx.preferredCurrency),
            percentUsed,
            status: b.remaining < 0 ? 'OVER_BUDGET' : b.remaining === 0 ? 'ON_BUDGET' : 'UNDER_BUDGET',
          }
        })

        const totalPlanned = budgets.reduce((sum, b) => sum + b.planned, 0)
        const totalActual = budgets.reduce((sum, b) => sum + b.actual, 0)

        return {
          month: ctx.monthKey,
          budgets: formatted,
          totals: {
            planned: formatCurrency(totalPlanned, ctx.preferredCurrency),
            actual: formatCurrency(totalActual, ctx.preferredCurrency),
            remaining: formatCurrency(totalPlanned - totalActual, ctx.preferredCurrency),
          },
        }
      },
    }),

    getRecentTransactions: tool({
      description: 'Get recent transactions with optional filtering by type and category name',
      inputSchema: z.object({
        limit: z.number().min(1).max(50).optional().describe('Max transactions to return (default 10)'),
        type: z.enum(['INCOME', 'EXPENSE']).optional().describe('Filter by transaction type'),
        categoryName: z.string().optional().describe('Filter by category name (partial match)'),
      }),
      execute: async ({
        limit = 10,
        type,
        categoryName,
      }: {
        limit?: number
        type?: 'INCOME' | 'EXPENSE'
        categoryName?: string
      }) => {
        const transactions = await getTransactionsForMonth({
          monthKey: ctx.monthKey,
          accountId: ctx.accountId,
          preferredCurrency: ctx.preferredCurrency,
        })

        let filtered = transactions
        if (type) {
          filtered = filtered.filter((t) => t.type === type)
        }
        if (categoryName) {
          const searchLower = categoryName.toLowerCase()
          filtered = filtered.filter((t) => t.category?.name?.toLowerCase().includes(searchLower))
        }

        const limited = filtered.slice(0, limit)

        if (limited.length === 0) {
          return { message: 'No transactions found matching criteria', transactions: [] }
        }

        const formatted = limited.map((t) => ({
          date: t.date.toISOString().split('T')[0],
          category: t.category?.name ?? 'Uncategorized',
          type: t.type,
          amount: formatCurrency(t.convertedAmount, ctx.preferredCurrency),
          description: t.description?.slice(0, 100) ?? null,
          account: t.account?.name ?? 'Unknown',
        }))

        return {
          month: ctx.monthKey,
          count: limited.length,
          totalMatching: filtered.length,
          transactions: formatted,
        }
      },
    }),

    getSpendingTrends: tool({
      description: 'Get 6-month spending history showing income, expenses, and net by month',
      inputSchema: z.object({}),
      execute: async () => {
        const data = await getCachedDashboardData({
          monthKey: ctx.monthKey,
          accountId: ctx.accountId,
          preferredCurrency: ctx.preferredCurrency,
        })

        const history = data.history ?? []
        if (history.length === 0) {
          return { message: 'No historical data available', months: [] }
        }

        const formatted = history.map((h) => ({
          month: h.month,
          income: formatCurrency(h.income, ctx.preferredCurrency),
          expenses: formatCurrency(h.expense, ctx.preferredCurrency),
          net: formatCurrency(h.net, ctx.preferredCurrency),
        }))

        const avgIncome = history.reduce((sum, h) => sum + h.income, 0) / history.length
        const avgExpense = history.reduce((sum, h) => sum + h.expense, 0) / history.length
        const avgNet = history.reduce((sum, h) => sum + h.net, 0) / history.length

        return {
          months: formatted,
          averages: {
            income: formatCurrency(avgIncome, ctx.preferredCurrency),
            expenses: formatCurrency(avgExpense, ctx.preferredCurrency),
            net: formatCurrency(avgNet, ctx.preferredCurrency),
          },
        }
      },
    }),

    getHoldings: tool({
      description: 'Get investment holdings with current prices and performance',
      inputSchema: z.object({}),
      execute: async () => {
        const holdings = await getHoldingsWithPrices({
          accountId: ctx.accountId,
          preferredCurrency: ctx.preferredCurrency,
        })

        if (holdings.length === 0) {
          return { message: 'No investment holdings found', holdings: [] }
        }

        const formatted = holdings.map((h) => ({
          symbol: h.symbol,
          quantity: h.quantity,
          currentPrice: h.currentPrice
            ? formatCurrency(h.currentPriceConverted ?? h.currentPrice, ctx.preferredCurrency)
            : 'N/A',
          marketValue: formatCurrency(h.marketValueConverted ?? h.marketValue, ctx.preferredCurrency),
          costBasis: formatCurrency(h.costBasisConverted ?? h.costBasis, ctx.preferredCurrency),
          gainLoss: formatCurrency(h.gainLossConverted ?? h.gainLoss, ctx.preferredCurrency),
          gainLossPercent: `${h.gainLossPercent >= 0 ? '+' : ''}${h.gainLossPercent.toFixed(2)}%`,
          isStale: h.isStale,
        }))

        const totalValue = holdings.reduce((sum, h) => sum + (h.marketValueConverted ?? h.marketValue), 0)
        const totalCost = holdings.reduce((sum, h) => sum + (h.costBasisConverted ?? h.costBasis), 0)
        const totalGainLoss = totalValue - totalCost

        return {
          holdings: formatted,
          portfolio: {
            totalValue: formatCurrency(totalValue, ctx.preferredCurrency),
            totalCost: formatCurrency(totalCost, ctx.preferredCurrency),
            totalGainLoss: formatCurrency(totalGainLoss, ctx.preferredCurrency),
            totalGainLossPercent:
              totalCost > 0
                ? `${totalGainLoss >= 0 ? '+' : ''}${((totalGainLoss / totalCost) * 100).toFixed(2)}%`
                : 'N/A',
          },
        }
      },
    }),

    getSharedExpenses: tool({
      description: 'Get shared expenses and settlement balances with other users',
      inputSchema: z.object({}),
      execute: async () => {
        const [sharedExpensesResult, balances] = await Promise.all([
          getSharedExpenses(ctx.userId),
          getSettlementBalance(ctx.userId),
        ])

        const formattedExpenses = sharedExpensesResult.items.slice(0, 10).map((e) => ({
          description: e.description ?? e.transaction.category.name,
          date: e.transaction.date.toISOString().split('T')[0],
          totalAmount: formatCurrency(e.totalAmount, e.currency),
          splitType: e.splitType,
          participants: e.participants.map((p) => ({
            name: p.participant.displayName || p.participant.email,
            amount: formatCurrency(p.shareAmount, e.currency),
            status: p.status,
          })),
          allSettled: e.allSettled,
        }))

        const formattedBalances = balances.map((b) => ({
          person: b.userDisplayName || b.userEmail,
          currency: b.currency,
          youOwe: formatCurrency(b.youOwe, b.currency),
          theyOwe: formatCurrency(b.theyOwe, b.currency),
          netBalance: formatCurrency(b.netBalance, b.currency),
          summary:
            b.netBalance > 0
              ? `They owe you ${formatCurrency(b.netBalance, b.currency)}`
              : b.netBalance < 0
                ? `You owe them ${formatCurrency(Math.abs(b.netBalance), b.currency)}`
                : 'Settled',
        }))

        return {
          recentSharedExpenses: formattedExpenses,
          settlementBalances: formattedBalances,
          hasOutstandingBalances: balances.some((b) => b.netBalance !== 0),
        }
      },
    }),
  }
}
