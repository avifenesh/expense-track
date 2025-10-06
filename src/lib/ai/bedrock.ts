import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import { tool, jsonSchema } from 'ai'
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

// Model configuration - Claude Sonnet 4.5 (September 2025 - most advanced)
// Using US inference profile for on-demand access
export const model = bedrock('us.anthropic.claude-sonnet-4-20250514-v1:0')
// Fallback model for throttling/overflow: Claude 3.5 Sonnet v2
export const fastModel = bedrock('us.anthropic.claude-3-5-sonnet-20241022-v2:0')

// AI Tools - Standard AI SDK format for Bedrock/Claude: array of tool() instances with Zod schemas
export const tools = [
  // Query transactions for a month
  tool({
    name: 'get_transactions',
    description: 'Get transactions for a specific month, optionally filtered by account. Use this to answer questions about spending history.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        monthKey: { type: 'string', description: 'Month in YYYY-MM format' },
        accountId: { type: 'string', description: 'Optional account ID to filter by' },
      },
      required: ['monthKey'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const { monthKey, accountId } = (args as { monthKey: string; accountId?: string }) || {}

      const transactions = await getTransactionsForMonth({
        monthKey,
        accountId,
      })

      return {
        success: true,
        count: transactions.length,
        transactions: transactions.map(t => ({
          date: t.date,
          type: t.type,
          amount: t.convertedAmount,
          category: t.category.name,
          account: t.account.name,
          description: t.description,
          isMutual: t.isMutual,
        })),
      }
    },
  }),

  // Search transactions by date range, category, description text, and amount range
  tool({
    name: 'search_transactions',
    description: 'Search transactions with flexible filters (date range, category, text, amount).',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        accountId: { type: 'string', nullable: true },
        monthKey: { type: 'string', description: 'Base month YYYY-MM for default range', nullable: true },
        from: { type: 'string', description: 'Start date ISO (inclusive)', nullable: true },
        to: { type: 'string', description: 'End date ISO (exclusive)', nullable: true },
        categoryId: { type: 'string', nullable: true },
        type: { type: 'string', enum: ['INCOME', 'EXPENSE'], nullable: true },
        text: { type: 'string', description: 'Search in description/category/account', nullable: true },
        minAmount: { type: 'number', nullable: true },
        maxAmount: { type: 'number', nullable: true },
      },
      required: [],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const a = (args as any) || {}
      const { accountId, monthKey, from, to, categoryId, type, text, minAmount, maxAmount } = a
      const { prisma } = await import('@/lib/prisma')
      const { getMonthStartFromKey } = await import('@/utils/date')

      // Build date bounds
      let gte: Date | undefined
      let lt: Date | undefined
      if (from) gte = new Date(from)
      if (to) lt = new Date(to)
      if (!gte && monthKey) gte = getMonthStartFromKey(monthKey)
      if (!lt && monthKey) lt = new Date(getMonthStartFromKey(monthKey)) && new Date(new Date(getMonthStartFromKey(monthKey)).setMonth(new Date(getMonthStartFromKey(monthKey)).getMonth() + 1))

      const where: any = {}
      if (gte || lt) where.date = { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) }
      if (accountId) where.accountId = accountId
      if (categoryId) where.categoryId = categoryId
      if (type) where.type = type
      if (text) {
        const q = text.toString().trim()
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

      // Amount range filter post-query (due to Decimal type)
      const filtered = results.filter((t: any) => {
        const amt = Number(t.amount)
        if (typeof minAmount === 'number' && amt < minAmount) return false
        if (typeof maxAmount === 'number' && amt > maxAmount) return false
        return true
      })

      return filtered.map((t: any) => ({
        id: t.id,
        date: t.date,
        type: t.type,
        amount: Number(t.amount),
        currency: t.currency,
        category: t.category?.name,
        account: t.account?.name,
        description: t.description,
        isMutual: t.isMutual,
      }))
    },
  }),

  // Create a new transaction
  tool({
    name: 'create_transaction',
    description: 'Create a new income or expense transaction.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Account ID' },
        categoryId: { type: 'string', description: 'Category ID' },
        type: { type: 'string', enum: ['INCOME', 'EXPENSE'], description: 'Transaction type' },
        amount: { type: 'number', description: 'Amount in transaction currency' },
        currency: { type: 'string', enum: ['USD', 'EUR', 'ILS'], description: 'Currency code', nullable: true },
        date: { type: 'string', description: 'ISO date string (YYYY-MM-DD)', nullable: true },
        description: { type: 'string', description: 'Optional description', nullable: true },
        isMutual: { type: 'boolean', description: 'Whether this is a mutual expense', nullable: true },
        isRecurring: { type: 'boolean', description: 'Whether this is part of a recurring template', nullable: true },
        recurringTemplateId: { type: 'string', description: 'Optional recurring template ID', nullable: true },
      },
      required: ['accountId', 'categoryId', 'type', 'amount'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const a = args as {
        accountId: string
        categoryId: string
        type: TransactionType
        amount: number
        currency?: Currency
        date?: string
        description?: string | null
        isMutual?: boolean
        isRecurring?: boolean
        recurringTemplateId?: string | null
      }

      const result = await createTransactionAction({
        accountId: a.accountId,
        categoryId: a.categoryId,
        type: a.type,
        amount: a.amount,
        currency: (a.currency as Currency | undefined) ?? undefined,
        date: a.date ? new Date(a.date) : new Date(),
        description: a.description ?? undefined,
        isMutual: a.isMutual ?? undefined,
        isRecurring: a.isRecurring ?? undefined,
        recurringTemplateId: a.recurringTemplateId ?? undefined,
      } as any)

      return result
    },
  }),

  // Update an existing transaction (all fields required)
  tool({
    name: 'update_transaction',
    description: 'Update an existing transaction. Provide all fields along with the id.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Transaction ID' },
        accountId: { type: 'string' },
        categoryId: { type: 'string' },
        type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
        amount: { type: 'number' },
        currency: { type: 'string', enum: ['USD', 'EUR', 'ILS'] },
        date: { type: 'string', description: 'ISO date string (YYYY-MM-DD)' },
        description: { type: 'string', nullable: true },
        isMutual: { type: 'boolean', nullable: true },
        isRecurring: { type: 'boolean', nullable: true },
      },
      required: ['id', 'accountId', 'categoryId', 'type', 'amount', 'currency', 'date'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const a = args as {
        id: string
        accountId: string
        categoryId: string
        type: TransactionType
        amount: number
        currency: Currency
        date: string
        description?: string | null
        isMutual?: boolean
        isRecurring?: boolean
      }

      const result = await updateTransactionAction({
        id: a.id,
        accountId: a.accountId,
        categoryId: a.categoryId,
        type: a.type,
        amount: a.amount,
        currency: a.currency,
        date: new Date(a.date),
        description: a.description ?? undefined,
        isMutual: a.isMutual ?? undefined,
        isRecurring: a.isRecurring ?? undefined,
      } as any)

      return result
    },
  }),

  // Delete a transaction
  tool({
    name: 'delete_transaction',
    description: 'Delete a transaction by id.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Transaction ID' },
      },
      required: ['id'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const { id } = (args as { id: string }) || {}
      const result = await deleteTransactionAction({ id })
      return result
    },
  }),

  // Create a new holding (stock/ETF/savings)
  tool({
    name: 'create_holding',
    description: 'Add a new holding (stock/ETF/savings). Category must be marked as holding.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        categoryId: { type: 'string' },
        symbol: { type: 'string', description: 'Ticker symbol, uppercase' },
        quantity: { type: 'number' },
        averageCost: { type: 'number' },
        currency: { type: 'string', enum: ['USD', 'EUR', 'ILS'] },
        notes: { type: 'string', nullable: true },
      },
      required: ['accountId', 'categoryId', 'symbol', 'quantity', 'averageCost', 'currency'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const a = args as {
        accountId: string
        categoryId: string
        symbol: string
        quantity: number
        averageCost: number
        currency: Currency
        notes?: string | null
      }

      const result = await createHoldingAction({
        accountId: a.accountId,
        categoryId: a.categoryId,
        symbol: a.symbol,
        quantity: a.quantity,
        averageCost: a.averageCost,
        currency: a.currency,
        notes: a.notes ?? undefined,
      } as any)

      return result
    },
  }),

  // Update an existing holding
  tool({
    name: 'update_holding',
    description: 'Update an existing holding by id (quantity, averageCost, notes).',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        id: { type: 'string' },
        quantity: { type: 'number' },
        averageCost: { type: 'number' },
        notes: { type: 'string', nullable: true },
      },
      required: ['id', 'quantity', 'averageCost'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const a = args as { id: string; quantity: number; averageCost: number; notes?: string | null }
      const result = await updateHoldingAction({
        id: a.id,
        quantity: a.quantity,
        averageCost: a.averageCost,
        notes: a.notes ?? undefined,
      })
      return result
    },
  }),

  // Delete a holding
  tool({
    name: 'delete_holding',
    description: 'Delete a holding by id.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const { id } = (args as { id: string }) || {}
      const result = await deleteHoldingAction({ id })
      return result
    },
  }),

  // Recommend savings next steps for the month
  tool({
    name: 'recommend_savings',
    description: 'Analyze this month and recommend concrete next steps to save money.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Account ID to scope analysis' },
        monthKey: { type: 'string', description: 'Month in YYYY-MM format' },
        preferredCurrency: { type: 'string', enum: ['USD', 'EUR', 'ILS'], nullable: true },
      },
      required: ['accountId', 'monthKey'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const { accountId, monthKey, preferredCurrency } = (args as {
        accountId: string
        monthKey: string
        preferredCurrency?: Currency
      }) || {}

      const data = await getDashboardData({ accountId, monthKey, preferredCurrency })

      // Identify overspent budgets
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

      // Highest spend categories this month
      const topSpend = data.budgets
        .filter((b) => b.categoryType === 'EXPENSE')
        .map((b) => ({ name: b.categoryName, actual: Number(b.actual.toFixed(2)) }))
        .sort((a, b) => b.actual - a.actual)
        .slice(0, 5)

      // Trend check
      const last = data.history[data.history.length - 1]
      const prev = data.history[data.history.length - 2]
      const trendingWorse = prev ? last.net < prev.net : false

      const suggestions = [] as Array<{ title: string; action: string; rationale: string }>

      if (overspends.length > 0) {
        const catList = overspends.map((o) => `${o.categoryName} (${o.overBy})`).join(', ')
        suggestions.push({
          title: 'Reduce overspending in top categories',
          action: `Set temporary caps or pause discretionary spend in: ${catList}.`,
          rationale: 'These categories exceeded their planned budgets this month.',
        })
      }

      if (topSpend.length > 0) {
        const top = topSpend.slice(0, 3).map((t) => t.name).join(', ')
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

      return {
        summary,
        overspends,
        topSpend,
        suggestions,
      }
    },
  }),

  // Budgets: read
  tool({
    name: 'get_budgets',
    description: 'Get planned vs actual budgets for a month (and optional account).',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        monthKey: { type: 'string', description: 'YYYY-MM' },
        accountId: { type: 'string', description: 'Optional account ID' },
      },
      required: ['monthKey'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const { monthKey, accountId } = (args as { monthKey: string; accountId?: string }) || {}
      const data = await getDashboardData({ accountId, monthKey })
      return data.budgets
    },
  }),

  // Budgets: upsert
  tool({
    name: 'upsert_budget',
    description: 'Create or update a budget for a category in a month.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        categoryId: { type: 'string' },
        monthKey: { type: 'string', description: 'YYYY-MM' },
        planned: { type: 'number' },
        currency: { type: 'string', enum: ['USD', 'EUR', 'ILS'] },
        notes: { type: 'string', nullable: true },
      },
      required: ['accountId', 'categoryId', 'monthKey', 'planned', 'currency'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const a = args as {
        accountId: string
        categoryId: string
        monthKey: string
        planned: number
        currency: Currency
        notes?: string | null
      }
      const { upsertBudgetAction } = await import('@/app/actions')
      const result = await upsertBudgetAction({
        accountId: a.accountId,
        categoryId: a.categoryId,
        monthKey: a.monthKey,
        planned: a.planned,
        currency: a.currency,
        notes: a.notes ?? undefined,
      })
      return result
    },
  }),

  // Budgets: delete
  tool({
    name: 'delete_budget',
    description: 'Delete a budget for a category in a month.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        categoryId: { type: 'string' },
        monthKey: { type: 'string', description: 'YYYY-MM' },
      },
      required: ['accountId', 'categoryId', 'monthKey'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const a = args as { accountId: string; categoryId: string; monthKey: string }
      const { deleteBudgetAction } = await import('@/app/actions')
      const result = await deleteBudgetAction(a)
      return result
    },
  }),

  // Recurring templates: apply
  tool({
    name: 'apply_recurring_templates',
    description: 'Apply active recurring templates into a given month (optionally subset by template IDs).',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        monthKey: { type: 'string', description: 'YYYY-MM' },
        accountId: { type: 'string' },
        templateIds: { type: 'array', items: { type: 'string' }, nullable: true },
      },
      required: ['monthKey', 'accountId'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const a = args as { monthKey: string; accountId: string; templateIds?: string[] }
      const { applyRecurringTemplatesAction } = await import('@/app/actions')
      return applyRecurringTemplatesAction(a)
    },
  }),

  // Recurring templates: upsert
  tool({
    name: 'upsert_recurring_template',
    description: 'Create or update a recurring template.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        id: { type: 'string', nullable: true },
        accountId: { type: 'string' },
        categoryId: { type: 'string' },
        type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
        amount: { type: 'number' },
        currency: { type: 'string', enum: ['USD', 'EUR', 'ILS'] },
        dayOfMonth: { type: 'number' },
        description: { type: 'string', nullable: true },
        startMonthKey: { type: 'string' },
        endMonthKey: { type: 'string', nullable: true },
        isActive: { type: 'boolean', nullable: true },
      },
      required: ['accountId', 'categoryId', 'type', 'amount', 'currency', 'dayOfMonth', 'startMonthKey'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const a = args as any
      const { upsertRecurringTemplateAction } = await import('@/app/actions')
      return upsertRecurringTemplateAction(a)
    },
  }),

  // Recurring templates: toggle
  tool({
    name: 'toggle_recurring_template',
    description: 'Enable or disable a recurring template.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        id: { type: 'string' },
        isActive: { type: 'boolean' },
      },
      required: ['id', 'isActive'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const a = args as { id: string; isActive: boolean }
      const { toggleRecurringTemplateAction } = await import('@/app/actions')
      return toggleRecurringTemplateAction(a)
    },
  }),

  // Mutual settlement summary
  tool({
    name: 'mutual_settlement_summary',
    description: 'Summarize who owes whom based on mutual expenses this month.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Account ID (optional, for scoping other data)' , nullable: true },
        monthKey: { type: 'string', description: 'YYYY-MM' },
        preferredCurrency: { type: 'string', enum: ['USD', 'EUR', 'ILS'], nullable: true },
      },
      required: ['monthKey'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const { accountId, monthKey, preferredCurrency } = (args as { accountId?: string; monthKey: string; preferredCurrency?: Currency }) || {}
      const data = await getDashboardData({ accountId, monthKey, preferredCurrency })
      return data.mutualSummary ?? { status: 'settled', amount: 0 }
    },
  }),

  // Holdings: list with performance
  tool({
    name: 'get_holdings',
    description: 'List holdings with market value, P/L, and price age.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        accountId: { type: 'string', nullable: true },
        preferredCurrency: { type: 'string', enum: ['USD', 'EUR', 'ILS'], nullable: true },
      },
      required: [],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const { accountId, preferredCurrency } = (args as { accountId?: string; preferredCurrency?: Currency }) || {}
      const { getHoldingsWithPrices } = await import('@/lib/finance')
      return getHoldingsWithPrices({ accountId, preferredCurrency })
    },
  }),

  // Holdings: analyze performance
  tool({
    name: 'analyze_holdings_performance',
    description: 'Summarize winners/losers and concentration risks in holdings.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        accountId: { type: 'string', nullable: true },
        preferredCurrency: { type: 'string', enum: ['USD', 'EUR', 'ILS'], nullable: true },
      },
      required: [],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const { accountId, preferredCurrency } = (args as { accountId?: string; preferredCurrency?: Currency }) || {}
      const { getHoldingsWithPrices } = await import('@/lib/finance')
      const holdings = await getHoldingsWithPrices({ accountId, preferredCurrency })

      const sortedByGain = holdings.slice().sort((a, b) => (b.gainLoss ?? 0) - (a.gainLoss ?? 0))
      const topWinners = sortedByGain.slice(0, 3).map(h => ({ symbol: h.symbol, gainLoss: h.gainLoss, gainLossPercent: h.gainLossPercent }))
      const topLosers = sortedByGain.slice(-3).reverse().map(h => ({ symbol: h.symbol, gainLoss: h.gainLoss, gainLossPercent: h.gainLossPercent }))
      const totalMV = holdings.reduce((acc, h) => acc + (h.marketValueConverted ?? h.marketValue), 0)
      const concentration = holdings
        .slice()
        .sort((a, b) => (b.marketValueConverted ?? b.marketValue) - (a.marketValueConverted ?? a.marketValue))
        .slice(0, 5)
        .map(h => ({ symbol: h.symbol, weight: Number((((h.marketValueConverted ?? h.marketValue) / (totalMV || 1)) * 100).toFixed(2)) }))

      return { topWinners, topLosers, concentration, totalMarketValue: totalMV }
    },
  }),

  // FX: refresh exchange rates
  tool({
    name: 'refresh_exchange_rates',
    description: 'Refresh cached exchange rates before running currency-sensitive analysis.',
    inputSchema: jsonSchema({ type: 'object', properties: {}, required: [], additionalProperties: false }),
    execute: async () => {
      const { refreshExchangeRatesAction } = await import('@/app/actions')
      return refreshExchangeRatesAction()
    },
  }),

  // Forecast cashflow 1–3 months
  tool({
    name: 'forecast_cashflow',
    description: 'Forecast next 1–3 months net using recent history and budgets.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        accountId: { type: 'string', nullable: true },
        monthKey: { type: 'string', description: 'Base month YYYY-MM' },
        horizonMonths: { type: 'number', description: '1-3 months', nullable: true },
        preferredCurrency: { type: 'string', enum: ['USD', 'EUR', 'ILS'], nullable: true },
      },
      required: ['monthKey'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const { accountId, monthKey, preferredCurrency, horizonMonths } = (args as { accountId?: string; monthKey: string; preferredCurrency?: Currency; horizonMonths?: number }) || {}
      const data = await getDashboardData({ accountId, monthKey, preferredCurrency })

      const horizon = Math.min(Math.max(horizonMonths ?? 2, 1), 3)
      const last = data.history.slice(-3)
      const avgNet = last.length ? last.reduce((acc, p) => acc + p.net, 0) / last.length : 0

      const budgetsNet = (() => {
        const income = data.budgets.filter(b => b.categoryType === 'INCOME').reduce((acc, b) => acc + b.planned, 0)
        const expense = data.budgets.filter(b => b.categoryType === 'EXPENSE').reduce((acc, b) => acc + b.planned, 0)
        return income - expense
      })()

      const forecast = Array.from({ length: horizon }, (_, i) => ({
        monthOffset: i + 1,
        projectedNet: Number(((avgNet * 0.5) + (budgetsNet * 0.5)).toFixed(2)),
      }))

      return { baseMonth: monthKey, horizon, forecast, recentAvgNet: Number(avgNet.toFixed(2)), budgetsNet: Number(budgetsNet.toFixed(2)) }
    },
  }),

  // Stock/ETF: get cached price and freshness
  tool({
    name: 'get_stock_price',
    description: 'Get the latest cached price and freshness for a stock/ETF symbol (USD).',
    inputSchema: jsonSchema({
      type: 'object',
      properties: { symbol: { type: 'string', description: 'Ticker symbol, e.g., AAPL' } },
      required: ['symbol'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const { symbol } = (args as { symbol: string }) || {}
      const { getStockPrice } = await import('@/lib/stock-api')
      return getStockPrice(symbol.toUpperCase())
    },
  }),

  // Stock/ETF: refresh prices for multiple symbols (rate-limited)
  tool({
    name: 'refresh_stock_prices',
    description: 'Refresh and cache prices for a list of symbols (Alpha Vantage, rate-limited).',
    inputSchema: jsonSchema({
      type: 'object',
      properties: { symbols: { type: 'array', items: { type: 'string' } } },
      required: ['symbols'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const { symbols } = (args as { symbols: string[] }) || { symbols: [] }
      const { refreshStockPrices } = await import('@/lib/stock-api')
      return refreshStockPrices(symbols)
    },
  }),

  // FX: single exchange rate now (with cache fetch if needed)
  tool({
    name: 'get_exchange_rate',
    description: 'Get exchange rate from one currency to another (uses cache or fetch).',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        from: { type: 'string', enum: ['USD', 'EUR', 'ILS'] },
        to: { type: 'string', enum: ['USD', 'EUR', 'ILS'] },
      },
      required: ['from', 'to'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const { from, to } = (args as { from: Currency; to: Currency }) || ({} as any)
      const { getExchangeRate } = await import('@/lib/currency')
      const rate = await getExchangeRate(from, to)
      return { from, to, rate }
    },
  }),

  // FX: fetch and return latest table of rates for a base currency
  tool({
    name: 'get_exchange_rates',
    description: 'Fetch the latest exchange rates for a base currency (Frankfurter).',
    inputSchema: jsonSchema({
      type: 'object',
      properties: { base: { type: 'string', enum: ['USD', 'EUR', 'ILS'] } },
      required: ['base'],
      additionalProperties: false,
    }),
    execute: async (args: unknown) => {
      const { base } = (args as { base: Currency }) || ({} as any)
      const { fetchExchangeRates } = await import('@/lib/currency')
      const data = await fetchExchangeRates(base)
      return data
    },
  }),
] as const

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
- Joint (shared account)

When users ask questions, use the appropriate tools to fetch real data rather than guessing.
If you need to create or modify financial data, ask for confirmation first before using the tool.`
