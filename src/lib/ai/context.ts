import { getDashboardData } from '@/lib/finance'
import { formatMonthLabel } from '@/utils/date'
import { Currency } from '@prisma/client'

export async function buildFinancialContext(
  accountId: string,
  monthKey: string,
  preferredCurrency?: Currency
): Promise<string> {
  // Get the same dashboard data the user sees
  const data = await getDashboardData({
    monthKey,
    accountId,
    preferredCurrency,
  })

  const accounts = Array.isArray(data.accounts) ? data.accounts : []
  const budgets = Array.isArray(data.budgets) ? data.budgets : []
  const transactions = Array.isArray(data.transactions) ? data.transactions : []
  const history = Array.isArray(data.history) ? data.history : []
  const holdings = Array.isArray(data.holdings) ? data.holdings : []
  const recurringTemplates = Array.isArray(data.recurringTemplates) ? data.recurringTemplates : []
  const categories = Array.isArray(data.categories) ? data.categories : []

  const selectedAccountName =
    accounts.find(a => a.id === accountId)?.name || 'All Accounts'

  const activeTemplates = recurringTemplates.filter(t => t?.isActive)
  const recentTransactions = transactions.slice(0, 10)
  const incomeCategories = categories.filter(c => c?.type === 'INCOME' && !c?.isArchived)
  const expenseCategories = categories.filter(c => c?.type === 'EXPENSE' && !c?.isArchived)

  const currencySymbol = preferredCurrency === Currency.EUR ? '€' :
                        preferredCurrency === Currency.ILS ? '₪' : '$'

  // Format context for AI
  const context = `
Current Month: ${formatMonthLabel(monthKey)}
Selected Account: ${selectedAccountName}
Preferred Currency: ${preferredCurrency || 'USD'}

=== CURRENT MONTH SUMMARY ===
${(data.stats ?? []).map(stat => `${stat.label}: ${currencySymbol}${Number(stat.amount ?? 0).toFixed(2)}`).join('\n')}

=== BUDGETS (Planned vs Actual) ===
${budgets.length > 0 ? budgets.map(b =>
  `${b.categoryName} (${b.categoryType}): ${currencySymbol}${Number(b.actual ?? 0).toFixed(2)} / ${currencySymbol}${Number(b.planned ?? 0).toFixed(2)} (${currencySymbol}${Number(b.remaining ?? (Number(b.planned ?? 0) - Number(b.actual ?? 0))).toFixed(2)} remaining)`
).join('\n') : 'No budgets set for this month'}

=== RECENT TRANSACTIONS (Last 10) ===
${recentTransactions.length > 0 ? recentTransactions.map(t => {
  const d = t?.date instanceof Date ? t.date : new Date(t?.date as any)
  const dateStr = isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]
  const cat = t?.category?.name ?? 'Uncategorized'
  const acct = t?.account?.name ?? 'Unknown Account'
  const amt = Number(t?.convertedAmount ?? 0)
  const desc = (t?.description ?? '').toString().trim()
  return `${dateStr}: ${cat} - ${currencySymbol}${amt.toFixed(2)} (${acct})${t?.isMutual ? ' [Mutual]' : ''}${desc ? ` — ${desc.slice(0, 120)}` : ''}`
}).join('\n') : 'No transactions this month'}

=== RECURRING TEMPLATES ===
${activeTemplates.length > 0 ? activeTemplates.map(t =>
  `${t.categoryName}: ${currencySymbol}${Number(t.amount ?? 0).toFixed(2)} on day ${t.dayOfMonth} (${t.type})`
).join('\n') : 'No active recurring templates'}

=== 6-MONTH TREND ===
${history.map(h =>
  `${h.month}: Income ${currencySymbol}${Number(h.income ?? 0).toFixed(0)}, Expenses ${currencySymbol}${Number(h.expense ?? 0).toFixed(0)}, Net ${currencySymbol}${Number(h.net ?? 0).toFixed(0)}`
).join('\n')}

=== INVESTMENT HOLDINGS ===
${holdings.length > 0 ? holdings.map(h => {
  const price = typeof h.currentPrice === 'number' ? h.currentPrice : undefined
  const mv = Number(h.marketValue ?? (Number(h.quantity ?? 0) * Number(price ?? 0)))
  const gl = Number(h.gainLoss ?? 0)
  const glp = Number(h.gainLossPercent ?? (price ? (gl / (mv - gl)) * 100 : 0))
  return `${h.symbol}: ${Number(h.quantity ?? 0)} shares @ ${currencySymbol}${price?.toFixed(2) ?? 'N/A'} = ${currencySymbol}${mv.toFixed(2)} (${gl >= 0 ? '+' : ''}${glp.toFixed(2)}%)`
}).join('\n') : 'No holdings'}

=== MUTUAL EXPENSES ===
${data.mutualSummary ?
  data.mutualSummary.status === 'settled'
    ? 'Mutual expenses are balanced - no settlement needed'
    : `${data.mutualSummary.status === 'partner-owes-self'
        ? `${data.mutualSummary.partnerAccountName ?? 'Partner'} owes ${data.mutualSummary.selfAccountName ?? 'You'}`
        : `${data.mutualSummary.selfAccountName ?? 'You'} owes ${data.mutualSummary.partnerAccountName ?? 'Partner'}`} ${currencySymbol}${Number(data.mutualSummary.amount ?? 0).toFixed(2)}`
  : 'No mutual expenses this month'}

=== AVAILABLE CATEGORIES ===
Income: ${incomeCategories.map(c => `${c.name} (${c.id})`).join(', ')}
Expense: ${expenseCategories.map(c => `${c.name} (${c.id})`).join(', ')}

=== AVAILABLE ACCOUNTS ===
${accounts.map(a => `${a.name} (${a.id})`).join(', ')}
`.trim()

  return context
}
