export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Groceries', color: '#22c55e' },
  { name: 'Dining Out', color: '#f97316' },
  { name: 'Transportation', color: '#3b82f6' },
  { name: 'Utilities', color: '#8b5cf6' },
  { name: 'Entertainment', color: '#ec4899' },
  { name: 'Shopping', color: '#06b6d4' },
  { name: 'Health', color: '#ef4444' },
  { name: 'Housing', color: '#84cc16' },
  { name: 'Insurance', color: '#6366f1' },
  { name: 'Subscriptions', color: '#14b8a6' },
] as const

export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', color: '#10b981' },
  { name: 'Freelance', color: '#06b6d4' },
  { name: 'Investments', color: '#8b5cf6' },
  { name: 'Other Income', color: '#6b7280' },
] as const

export const DEFAULT_HOLDING_CATEGORIES = [
  { name: 'Savings', color: '#16a34a' },
  { name: 'Stocks', color: '#0f172a' },
  { name: 'ETF', color: '#0ea5e9' },
  { name: 'Bonds', color: '#6366f1' },
  { name: 'Crypto', color: '#f59e0b' },
] as const

export type DefaultCategory = {
  name: string
  color: string
}
