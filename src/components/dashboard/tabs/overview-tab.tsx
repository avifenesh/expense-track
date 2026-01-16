'use client'

import { useMemo, useState } from 'react'
import { TransactionType, Currency } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkline } from '@/components/dashboard/sparkline'
import { RequestList } from '@/components/dashboard/request-list'
import { filterBudgets, getBudgetProgress, getHighlightedBudgets } from '@/lib/dashboard-ux'
import { formatCurrency, formatRelativeAmount } from '@/utils/format'
import { formatMonthLabel } from '@/utils/date'
import { cn } from '@/utils/cn'
import { DashboardBudget, DashboardTransactionRequest, HistoryPoint } from './types'

export type OverviewTabProps = {
  history: HistoryPoint[]
  comparison: {
    previousMonth: string
    previousNet: number
    change: number
  }
  budgets: DashboardBudget[]
  transactionRequests: DashboardTransactionRequest[]
  activeAccount: string
  preferredCurrency: Currency
  onNavigateToBudgets: () => void
}

export function OverviewTab({
  history,
  comparison,
  budgets,
  transactionRequests,
  activeAccount,
  preferredCurrency,
  onNavigateToBudgets,
}: OverviewTabProps) {
  const [highlightLimit] = useState(3)

  const historyWithLabels = useMemo(
    () =>
      history.map((point) => ({
        ...point,
        label: formatMonthLabel(point.month),
      })),
    [history],
  )

  const netHistory = useMemo(() => historyWithLabels.map((point) => point.net), [historyWithLabels])

  const highlightedBudgets = useMemo(
    () => getHighlightedBudgets(filterBudgets(budgets, { accountId: activeAccount || undefined }), highlightLimit),
    [budgets, activeAccount, highlightLimit],
  )

  return (
    <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" className="space-y-6">
      {/* Shared requests shown prominently at top */}
      {transactionRequests.length > 0 && (
        <RequestList requests={transactionRequests} preferredCurrency={preferredCurrency} />
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-white/15 bg-white/10">
          <CardHeader>
            <CardTitle
              className="text-lg font-semibold text-white"
              helpText="Tracks six months of net cashflow so you can spot spending shifts."
            >
              Spending trend
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <Sparkline
                values={netHistory}
                strokeClassName="stroke-sky-300"
                fillClassName="fill-sky-300/20"
                className="h-24"
                ariaLabel="Historical net cashflow trend"
              />
            </div>
            <div className="space-y-3 text-sm text-slate-200">
              {historyWithLabels.map((point) => (
                <div
                  key={point.month}
                  className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium text-white">{point.label}</div>
                    <div className="text-xs text-slate-400">
                      Income {formatRelativeAmount(point.income, preferredCurrency)} · Expenses{' '}
                      {formatRelativeAmount(-point.expense, preferredCurrency)}
                    </div>
                  </div>
                  <div className={cn('text-sm font-semibold', point.net >= 0 ? 'text-emerald-300' : 'text-rose-400')}>
                    {formatRelativeAmount(point.net, preferredCurrency)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/15 bg-white/10">
          <CardHeader>
            <CardTitle
              className="text-lg font-semibold text-white"
              helpText="Summarizes net changes, remaining budgets, and expected income for the current month."
            >
              Month at a glance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-300">
                <span>Net compared to last month</span>
                <span
                  className={cn('text-sm font-semibold', comparison.change >= 0 ? 'text-emerald-300' : 'text-rose-300')}
                >
                  {formatRelativeAmount(comparison.change, preferredCurrency)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-300">
                {formatMonthLabel(comparison.previousMonth)} net:{' '}
                {formatCurrency(comparison.previousNet, preferredCurrency)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="text-xs uppercase tracking-wide text-slate-300">Budgets remaining</span>
              <div className="mt-2 text-xl font-semibold text-white">
                {formatCurrency(
                  budgets
                    .filter((budget) => budget.categoryType === TransactionType.EXPENSE)
                    .reduce((sum, budget) => sum + budget.remaining, 0),
                  preferredCurrency,
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="text-xs uppercase tracking-wide text-slate-300">Income still expected</span>
              <div className="mt-2 text-xl font-semibold text-white">
                {formatCurrency(
                  budgets
                    .filter((budget) => budget.categoryType === TransactionType.INCOME)
                    .reduce((sum, budget) => sum + budget.remaining, 0),
                  preferredCurrency,
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {highlightedBudgets.length > 0 && (
        <Card className="border-white/15 bg-white/10">
          <CardHeader className="flex flex-col gap-3 text-slate-300 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle
                className="text-lg font-semibold text-white"
                helpText="Surfaces the budgets closest to their limits so you can adjust spending early."
              >
                Highlighted budgets
              </CardTitle>
              <p className="text-sm text-slate-300">A quick snapshot of the categories closest to their limits.</p>
            </div>
            <Button type="button" variant="secondary" onClick={onNavigateToBudgets}>
              Manage budgets
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {highlightedBudgets.map((budget) => {
              const progress = getBudgetProgress(budget)
              const progressColor =
                budget.categoryType === TransactionType.EXPENSE ? 'bg-rose-400/80' : 'bg-emerald-300/80'
              const actualLabel = budget.categoryType === TransactionType.EXPENSE ? 'spent' : 'received'
              const remainingLabel = `${
                budget.categoryType === TransactionType.EXPENSE ? 'Remaining' : 'To receive'
              }: ${formatCurrency(budget.remaining, preferredCurrency)}`
              return (
                <div
                  key={`${budget.categoryId}-${budget.budgetId}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                        <span>{budget.categoryName}</span>
                        <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium text-slate-200">
                          {budget.accountName}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        {formatCurrency(budget.actual, preferredCurrency)} {actualLabel} /{' '}
                        {formatCurrency(budget.planned, preferredCurrency)} planned
                      </p>
                    </div>
                    <span className="text-sm font-medium text-slate-200">{Math.round(progress * 100)}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10" role="presentation">
                    <div
                      className={cn('h-2 rounded-full transition-all duration-300 ease-out', progressColor)}
                      style={{ width: `${progress * 100}%` }}
                      aria-hidden
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-300">{remainingLabel}</p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
