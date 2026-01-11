import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import { z } from 'zod'
import { getTransactionsForMonth, getDashboardData } from '@/lib/finance'
import {
  createTransactionAction,
  updateTransactionAction,
  deleteTransactionAction,
  createHoldingAction,
  updateHoldingAction,
  deleteHoldingAction,
} from '@/app/actions'
import type { TransactionType, Currency } from '@prisma/client'

// Initialize Bedrock client
// Supports both API key (newer, simpler) and IAM credentials (traditional)
export const bedrock = createAmazonBedrock({
  region: process.env.AWS_BEDROCK_REGION || 'us-east-1',
  // API key authentication (if available)
  ...(process.env.AWS_BEDROCK_API_KEY && {
    apiKey: process.env.AWS_BEDROCK_API_KEY,
  }),
  // Fallback to IAM credentials
  ...(!process.env.AWS_BEDROCK_API_KEY && {
    accessKeyId: process.env.AWS_BEDROCK_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_BEDROCK_SECRET_ACCESS_KEY!,
  }),
})

// Model configuration - Claude 4.5 Haiku (fast, cost-effective)
// Using US inference profile for on-demand access
export const model = bedrock('us.anthropic.claude-haiku-4-5-20250514-v1:0')

// Currency and TransactionType enums for Zod
const currencyEnum = z.enum(['USD', 'EUR', 'ILS'])
const transactionTypeEnum = z.enum(['INCOME', 'EXPENSE'])

// Tool type definition for AI SDK compatibility
type ToolConfig = {
  description: string
  parameters: z.ZodType
  execute: (params: Record<string, unknown>) => Promise<unknown>
}

// Helper to create typed tools (workaround for Zod v4 compatibility)
function createTool<TParams extends z.ZodType, TResult>(config: {
  description: string
  parameters: TParams
  execute: (params: z.infer<TParams>) => Promise<TResult>
}): ToolConfig {
  return {
    description: config.description,
    parameters: config.parameters,
    execute: config.execute as (params: Record<string, unknown>) => Promise<unknown>,
  }
}

// AI Tools - using helper function for proper typing with Zod v4
export const tools: Record<string, ToolConfig> = {
  get_transactions: createTool({
    description:
      'Get transactions for a specific month, optionally filtered by account. Use this to answer questions about spending history.',
    parameters: z.object({
      monthKey: z.string().describe('Month in YYYY-MM format'),
      accountId: z.string().optional().describe('Optional account ID to filter by'),
    }),
    execute: async ({ monthKey, accountId }: { monthKey: string; accountId?: string }) => {
      const transactions = await getTransactionsForMonth({
        monthKey,
        accountId,
      })
      return {
        success: true,
        count: transactions.length,
        transactions: transactions.map((t) => ({
          date: t.date,
          type: t.type,
          amount: t.convertedAmount,
          category: t.category.name,
          account: t.account.name,
          description: t.description,
        })),
      }
    },
  }),

  search_transactions: createTool({
    description: 'Search transactions with flexible filters (date range, category, text, amount).',
    parameters: z.object({
      accountId: z.string().optional(),
      monthKey: z.string().optional().describe('Base month YYYY-MM for default range'),
      from: z.string().optional().describe('Start date ISO (inclusive)'),
      to: z.string().optional().describe('End date ISO (exclusive)'),
      categoryId: z.string().optional(),
      type: transactionTypeEnum.optional(),
      text: z.string().optional().describe('Search in description/category/account'),
      minAmount: z.number().optional(),
      maxAmount: z.number().optional(),
    }),
    execute: async (args: {
      accountId?: string
      monthKey?: string
      from?: string
      to?: string
      categoryId?: string
      type?: 'INCOME' | 'EXPENSE'
      text?: string
      minAmount?: number
      maxAmount?: number
    }) => {
      const { prisma } = await import('@/lib/prisma')
      const { getMonthStartFromKey } = await import('@/utils/date')

      let gte: Date | undefined
      let lt: Date | undefined
      if (args.from) gte = new Date(args.from)
      if (args.to) lt = new Date(args.to)
      if (!gte && args.monthKey) gte = getMonthStartFromKey(args.monthKey)
      if (!lt && args.monthKey) {
        const start = getMonthStartFromKey(args.monthKey)
        lt = new Date(start)
        lt.setMonth(lt.getMonth() + 1)
      }

      const where: Record<string, unknown> = {}
      if (gte || lt) where.date = { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) }
      if (args.accountId) where.accountId = args.accountId
      if (args.categoryId) where.categoryId = args.categoryId
      if (args.type) where.type = args.type
      if (args.text) {
        const q = args.text.trim()
        where.OR = [
          { description: { contains: q, mode: 'insensitive' } },
          { account: { name: { contains: q, mode: 'insensitive' } } },
          { category: { name: { contains: q, mode: 'insensitive' } } },
        ]
      }

      const results = await prisma.transaction.findMany({
        where,
        include: { account: true, category: true },
        orderBy: { date: 'desc' },
        take: 200,
      })

      const filtered = results.filter((t) => {
        const amt = Number(t.amount)
        if (typeof args.minAmount === 'number' && amt < args.minAmount) return false
        if (typeof args.maxAmount === 'number' && amt > args.maxAmount) return false
        return true
      })

      return filtered.map((t) => ({
        id: t.id,
        date: t.date,
        type: t.type,
        amount: Number(t.amount),
        currency: t.currency,
        category: t.category?.name,
        account: t.account?.name,
        description: t.description,
      }))
    },
  }),

  create_transaction: createTool({
    description: 'Create a new income or expense transaction.',
    parameters: z.object({
      accountId: z.string().describe('Account ID'),
      categoryId: z.string().describe('Category ID'),
      type: transactionTypeEnum.describe('Transaction type'),
      amount: z.number().describe('Amount in transaction currency'),
      currency: currencyEnum.optional().describe('Currency code'),
      date: z.string().optional().describe('ISO date string (YYYY-MM-DD)'),
      description: z.string().optional().describe('Optional description'),
      isRecurring: z.boolean().optional().describe('Whether this is part of a recurring template'),
      recurringTemplateId: z.string().optional().describe('Optional recurring template ID'),
    }),
    execute: async (args: {
      accountId: string
      categoryId: string
      type: 'INCOME' | 'EXPENSE'
      amount: number
      currency?: 'USD' | 'EUR' | 'ILS'
      date?: string
      description?: string
      isRecurring?: boolean
      recurringTemplateId?: string
    }) => {
      return createTransactionAction({
        accountId: args.accountId,
        categoryId: args.categoryId,
        type: args.type as TransactionType,
        amount: args.amount,
        currency: (args.currency as Currency) ?? undefined,
        date: args.date ? new Date(args.date) : new Date(),
        description: args.description,
        isRecurring: args.isRecurring ?? false,
        recurringTemplateId: args.recurringTemplateId,
      })
    },
  }),

  update_transaction: createTool({
    description: 'Update an existing transaction. Provide all fields along with the id.',
    parameters: z.object({
      id: z.string().describe('Transaction ID'),
      accountId: z.string(),
      categoryId: z.string(),
      type: transactionTypeEnum,
      amount: z.number(),
      currency: currencyEnum,
      date: z.string().describe('ISO date string (YYYY-MM-DD)'),
      description: z.string().optional(),
      isRecurring: z.boolean().optional(),
    }),
    execute: async (args: {
      id: string
      accountId: string
      categoryId: string
      type: 'INCOME' | 'EXPENSE'
      amount: number
      currency: 'USD' | 'EUR' | 'ILS'
      date: string
      description?: string
      isRecurring?: boolean
    }) => {
      return updateTransactionAction({
        id: args.id,
        accountId: args.accountId,
        categoryId: args.categoryId,
        type: args.type as TransactionType,
        amount: args.amount,
        currency: args.currency as Currency,
        date: new Date(args.date),
        description: args.description,
        isRecurring: args.isRecurring ?? false,
      })
    },
  }),

  delete_transaction: createTool({
    description: 'Delete a transaction by id.',
    parameters: z.object({
      id: z.string().describe('Transaction ID'),
    }),
    execute: async ({ id }: { id: string }) => {
      return deleteTransactionAction({ id })
    },
  }),

  create_holding: createTool({
    description: 'Add a new holding (stock/ETF/savings). Category must be marked as holding.',
    parameters: z.object({
      accountId: z.string(),
      categoryId: z.string(),
      symbol: z.string().describe('Ticker symbol, uppercase'),
      quantity: z.number(),
      averageCost: z.number(),
      currency: currencyEnum,
      notes: z.string().optional(),
    }),
    execute: async (args: {
      accountId: string
      categoryId: string
      symbol: string
      quantity: number
      averageCost: number
      currency: 'USD' | 'EUR' | 'ILS'
      notes?: string
    }) => {
      return createHoldingAction({
        accountId: args.accountId,
        categoryId: args.categoryId,
        symbol: args.symbol,
        quantity: args.quantity,
        averageCost: args.averageCost,
        currency: args.currency as Currency,
        notes: args.notes ?? undefined,
      })
    },
  }),

  update_holding: createTool({
    description: 'Update an existing holding by id (quantity, averageCost, notes).',
    parameters: z.object({
      id: z.string(),
      quantity: z.number(),
      averageCost: z.number(),
      notes: z.string().optional(),
    }),
    execute: async (args: { id: string; quantity: number; averageCost: number; notes?: string }) => {
      return updateHoldingAction({
        id: args.id,
        quantity: args.quantity,
        averageCost: args.averageCost,
        notes: args.notes ?? undefined,
      })
    },
  }),

  delete_holding: createTool({
    description: 'Delete a holding by id.',
    parameters: z.object({
      id: z.string(),
    }),
    execute: async ({ id }: { id: string }) => {
      return deleteHoldingAction({ id })
    },
  }),

  recommend_savings: createTool({
    description: 'Analyze this month and recommend concrete next steps to save money.',
    parameters: z.object({
      accountId: z.string().describe('Account ID to scope analysis'),
      monthKey: z.string().describe('Month in YYYY-MM format'),
      preferredCurrency: currencyEnum.optional(),
    }),
    execute: async ({
      accountId,
      monthKey,
      preferredCurrency,
    }: {
      accountId: string
      monthKey: string
      preferredCurrency?: 'USD' | 'EUR' | 'ILS'
    }) => {
      const data = await getDashboardData({
        accountId,
        monthKey,
        preferredCurrency: preferredCurrency as Currency | undefined,
      })

      const overspends = data.budgets
        .filter((b) => b.categoryType === 'EXPENSE' && b.actual > b.planned)
        .map((b) => ({
          categoryName: b.categoryName,
          overBy: Number((b.actual - b.planned).toFixed(2)),
          actual: Number(b.actual.toFixed(2)),
          planned: Number(b.planned.toFixed(2)),
        }))
        .sort((a, b) => b.overBy - a.overBy)
        .slice(0, 5)

      const topSpend = data.budgets
        .filter((b) => b.categoryType === 'EXPENSE')
        .map((b) => ({
          name: b.categoryName,
          actual: Number(b.actual.toFixed(2)),
        }))
        .sort((a, b) => b.actual - a.actual)
        .slice(0, 5)

      const last = data.history[data.history.length - 1]
      const prev = data.history[data.history.length - 2]
      const trendingWorse = prev ? last.net < prev.net : false

      const suggestions: Array<{
        title: string
        action: string
        rationale: string
      }> = []

      if (overspends.length > 0) {
        const catList = overspends.map((o) => `${o.categoryName} (${o.overBy})`).join(', ')
        suggestions.push({
          title: 'Reduce overspending in top categories',
          action: `Set temporary caps or pause discretionary spend in: ${catList}.`,
          rationale: 'These categories exceeded their planned budgets this month.',
        })
      }

      if (topSpend.length > 0) {
        const top = topSpend
          .slice(0, 3)
          .map((t) => t.name)
          .join(', ')
        suggestions.push({
          title: 'Target high-impact categories',
          action: `Aim for a 10-15% reduction in ${top} for the next two weeks.`,
          rationale: 'Small reductions in the largest categories yield meaningful savings.',
        })
      }

      if (trendingWorse) {
        suggestions.push({
          title: 'Stabilize month-over-month trend',
          action: 'Delay non-essential purchases until the next month and review recurring commitments.',
          rationale: 'Net position is trending down vs previous month.',
        })
      }

      if (data.recurringTemplates.length > 0) {
        suggestions.push({
          title: 'Audit recurring templates',
          action: 'Review active recurring charges; cancel or downsize low-value subscriptions for 1-2 months.',
          rationale: 'Recurring items often accumulate unnoticed and are easy to pause short term.',
        })
      }

      const summary = `Based on ${monthKey}, you can likely save by focusing on ${
        overspends[0]?.categoryName ?? topSpend[0]?.name ?? 'discretionary categories'
      } and trimming 10-15% for the rest of the month.`

      return { summary, overspends, topSpend, suggestions }
    },
  }),

  get_budgets: createTool({
    description: 'Get planned vs actual budgets for a month (and optional account).',
    parameters: z.object({
      monthKey: z.string().describe('YYYY-MM'),
      accountId: z.string().optional().describe('Optional account ID'),
    }),
    execute: async ({ monthKey, accountId }: { monthKey: string; accountId?: string }) => {
      const data = await getDashboardData({ accountId, monthKey })
      return data.budgets
    },
  }),

  upsert_budget: createTool({
    description: 'Create or update a budget for a category in a month.',
    parameters: z.object({
      accountId: z.string(),
      categoryId: z.string(),
      monthKey: z.string().describe('YYYY-MM'),
      planned: z.number(),
      currency: currencyEnum,
      notes: z.string().optional(),
    }),
    execute: async (args: {
      accountId: string
      categoryId: string
      monthKey: string
      planned: number
      currency: 'USD' | 'EUR' | 'ILS'
      notes?: string
    }) => {
      const { upsertBudgetAction } = await import('@/app/actions')
      return upsertBudgetAction({
        accountId: args.accountId,
        categoryId: args.categoryId,
        monthKey: args.monthKey,
        planned: args.planned,
        currency: args.currency as Currency,
        notes: args.notes ?? undefined,
      })
    },
  }),

  delete_budget: createTool({
    description: 'Delete a budget for a category in a month.',
    parameters: z.object({
      accountId: z.string(),
      categoryId: z.string(),
      monthKey: z.string().describe('YYYY-MM'),
    }),
    execute: async (args: { accountId: string; categoryId: string; monthKey: string }) => {
      const { deleteBudgetAction } = await import('@/app/actions')
      return deleteBudgetAction(args)
    },
  }),

  apply_recurring_templates: createTool({
    description: 'Apply active recurring templates into a given month (optionally subset by template IDs).',
    parameters: z.object({
      monthKey: z.string().describe('YYYY-MM'),
      accountId: z.string(),
      templateIds: z.array(z.string()).optional(),
    }),
    execute: async (args: { monthKey: string; accountId: string; templateIds?: string[] }) => {
      const { applyRecurringTemplatesAction } = await import('@/app/actions')
      return applyRecurringTemplatesAction(args)
    },
  }),

  upsert_recurring_template: createTool({
    description: 'Create or update a recurring template.',
    parameters: z.object({
      id: z.string().optional(),
      accountId: z.string(),
      categoryId: z.string(),
      type: transactionTypeEnum,
      amount: z.number(),
      currency: currencyEnum,
      dayOfMonth: z.number(),
      description: z.string().optional(),
      startMonthKey: z.string(),
      endMonthKey: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
    execute: async (args: {
      id?: string
      accountId: string
      categoryId: string
      type: 'INCOME' | 'EXPENSE'
      amount: number
      currency: 'USD' | 'EUR' | 'ILS'
      dayOfMonth: number
      description?: string
      startMonthKey: string
      endMonthKey?: string
      isActive?: boolean
    }) => {
      const { upsertRecurringTemplateAction } = await import('@/app/actions')
      return upsertRecurringTemplateAction({
        ...args,
        type: args.type as TransactionType,
        currency: args.currency as Currency,
        isActive: args.isActive ?? true,
      })
    },
  }),

  toggle_recurring_template: createTool({
    description: 'Enable or disable a recurring template.',
    parameters: z.object({
      id: z.string(),
      isActive: z.boolean(),
    }),
    execute: async (args: { id: string; isActive: boolean }) => {
      const { toggleRecurringTemplateAction } = await import('@/app/actions')
      return toggleRecurringTemplateAction(args)
    },
  }),

  get_holdings: createTool({
    description: 'List holdings with market value, P/L, and price age.',
    parameters: z.object({
      accountId: z.string().optional(),
      preferredCurrency: currencyEnum.optional(),
    }),
    execute: async ({
      accountId,
      preferredCurrency,
    }: {
      accountId?: string
      preferredCurrency?: 'USD' | 'EUR' | 'ILS'
    }) => {
      const { getHoldingsWithPrices } = await import('@/lib/finance')
      return getHoldingsWithPrices({
        accountId,
        preferredCurrency: preferredCurrency as Currency | undefined,
      })
    },
  }),

  analyze_holdings_performance: createTool({
    description: 'Summarize winners/losers and concentration risks in holdings.',
    parameters: z.object({
      accountId: z.string().optional(),
      preferredCurrency: currencyEnum.optional(),
    }),
    execute: async ({
      accountId,
      preferredCurrency,
    }: {
      accountId?: string
      preferredCurrency?: 'USD' | 'EUR' | 'ILS'
    }) => {
      const { getHoldingsWithPrices } = await import('@/lib/finance')
      const holdings = await getHoldingsWithPrices({
        accountId,
        preferredCurrency: preferredCurrency as Currency | undefined,
      })

      const sortedByGain = holdings.slice().sort((a, b) => (b.gainLoss ?? 0) - (a.gainLoss ?? 0))
      const topWinners = sortedByGain.slice(0, 3).map((h) => ({
        symbol: h.symbol,
        gainLoss: h.gainLoss,
        gainLossPercent: h.gainLossPercent,
      }))
      const topLosers = sortedByGain
        .slice(-3)
        .reverse()
        .map((h) => ({
          symbol: h.symbol,
          gainLoss: h.gainLoss,
          gainLossPercent: h.gainLossPercent,
        }))
      const totalMV = holdings.reduce((acc, h) => acc + (h.marketValueConverted ?? h.marketValue), 0)
      const concentration = holdings
        .slice()
        .sort((a, b) => (b.marketValueConverted ?? b.marketValue) - (a.marketValueConverted ?? a.marketValue))
        .slice(0, 5)
        .map((h) => ({
          symbol: h.symbol,
          weight: Number((((h.marketValueConverted ?? h.marketValue) / (totalMV || 1)) * 100).toFixed(2)),
        }))

      return {
        topWinners,
        topLosers,
        concentration,
        totalMarketValue: totalMV,
      }
    },
  }),

  refresh_exchange_rates: createTool({
    description: 'Refresh cached exchange rates before running currency-sensitive analysis.',
    parameters: z.object({}),
    execute: async () => {
      const { refreshExchangeRatesAction } = await import('@/app/actions')
      return refreshExchangeRatesAction()
    },
  }),

  forecast_cashflow: createTool({
    description: 'Forecast next 1–3 months net using recent history and budgets.',
    parameters: z.object({
      accountId: z.string().optional(),
      monthKey: z.string().describe('Base month YYYY-MM'),
      horizonMonths: z.number().optional().describe('1-3 months'),
      preferredCurrency: currencyEnum.optional(),
    }),
    execute: async ({
      accountId,
      monthKey,
      horizonMonths,
      preferredCurrency,
    }: {
      accountId?: string
      monthKey: string
      horizonMonths?: number
      preferredCurrency?: 'USD' | 'EUR' | 'ILS'
    }) => {
      const data = await getDashboardData({
        accountId,
        monthKey,
        preferredCurrency: preferredCurrency as Currency | undefined,
      })

      const horizon = Math.min(Math.max(horizonMonths ?? 2, 1), 3)
      const last = data.history.slice(-3)
      const avgNet = last.length ? last.reduce((acc, p) => acc + p.net, 0) / last.length : 0

      const budgetsNet = (() => {
        const income = data.budgets.filter((b) => b.categoryType === 'INCOME').reduce((acc, b) => acc + b.planned, 0)
        const expense = data.budgets.filter((b) => b.categoryType === 'EXPENSE').reduce((acc, b) => acc + b.planned, 0)
        return income - expense
      })()

      const forecast = Array.from({ length: horizon }, (_, i) => ({
        monthOffset: i + 1,
        projectedNet: Number((avgNet * 0.5 + budgetsNet * 0.5).toFixed(2)),
      }))

      return {
        baseMonth: monthKey,
        horizon,
        forecast,
        recentAvgNet: Number(avgNet.toFixed(2)),
        budgetsNet: Number(budgetsNet.toFixed(2)),
      }
    },
  }),

  get_stock_price: createTool({
    description: 'Get the latest cached price and freshness for a stock/ETF symbol (USD).',
    parameters: z.object({
      symbol: z.string().describe('Ticker symbol, e.g., AAPL'),
    }),
    execute: async ({ symbol }: { symbol: string }) => {
      const { getStockPrice } = await import('@/lib/stock-api')
      return getStockPrice(symbol.toUpperCase())
    },
  }),

  refresh_stock_prices: createTool({
    description: 'Refresh and cache prices for a list of symbols (Alpha Vantage, rate-limited).',
    parameters: z.object({
      symbols: z.array(z.string()),
    }),
    execute: async ({ symbols }: { symbols: string[] }) => {
      const { refreshStockPrices } = await import('@/lib/stock-api')
      return refreshStockPrices(symbols)
    },
  }),

  get_exchange_rate: createTool({
    description: 'Get exchange rate from one currency to another (uses cache or fetch).',
    parameters: z.object({
      from: currencyEnum,
      to: currencyEnum,
    }),
    execute: async ({ from, to }: { from: 'USD' | 'EUR' | 'ILS'; to: 'USD' | 'EUR' | 'ILS' }) => {
      const { getExchangeRate } = await import('@/lib/currency')
      const rate = await getExchangeRate(from as Currency, to as Currency)
      return { from, to, rate }
    },
  }),

  get_exchange_rates: createTool({
    description: 'Fetch the latest exchange rates for a base currency (Frankfurter).',
    parameters: z.object({
      base: currencyEnum,
    }),
    execute: async ({ base }: { base: 'USD' | 'EUR' | 'ILS' }) => {
      const { fetchExchangeRates } = await import('@/lib/currency')
      return fetchExchangeRates(base as Currency)
    },
  }),
}

// System prompt
export const systemPrompt = `You are a personal financial advisor for Avi and Serena, a couple managing their finances together.

Your role:
- Help them track income and expenses
- Provide insights on spending patterns
- Assist with budget planning and monitoring
- Analyze their investment portfolio
- Forecast future cashflow
- Answer questions about their financial data

Guidelines:
- Be conversational, friendly, and supportive
- Use the tools available to provide accurate, data-driven answers
- When creating transactions, budgets, or holdings, confirm the details with the user first
- Format monetary amounts clearly with currency symbols
- Highlight important insights (overspending, savings opportunities, etc.)
- Keep answers concise but informative
- When users refer to purchases under generic categories (e.g., Others), use the transaction description text to disambiguate and, if needed, call the search_transactions tool to find matching entries.
- Prefer filtering by description text when multiple entries exist in the same category and month.

Available accounts:
- Avi (personal account)
- Serena (personal account)

When users ask questions, use the appropriate tools to fetch real data rather than guessing.
If you need to create or modify financial data, ask for confirmation first before using the tool.`
