'use client'

import { Currency } from '@prisma/client'
import type {
  StatBreakdown,
  NetThisMonthBreakdown,
  OnTrackForBreakdown,
  LeftToSpendBreakdown,
  MonthlyTargetBreakdown,
  IncomeSource,
} from '@/lib/finance'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/utils/cn'

type StatBreakdownProps = {
  breakdown: StatBreakdown
  currency: Currency
}

function formatIncomeSource(source: IncomeSource): string {
  switch (source) {
    case 'goal':
      return 'income goal'
    case 'recurring':
      return 'recurring templates'
    case 'budget':
      return 'budgets'
    case 'none':
      return 'none set'
  }
}

function BreakdownRow({
  label,
  amount,
  currency,
  variant,
  isTotal,
}: {
  label: string
  amount: number
  currency: Currency
  variant?: 'positive' | 'negative' | 'neutral'
  isTotal?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between gap-2', isTotal && 'border-t border-white/20 pt-2 mt-2')}>
      <span className={cn('text-xs', isTotal ? 'font-semibold text-white' : 'text-slate-300')}>{label}</span>
      <span
        className={cn(
          'text-xs font-medium tabular-nums',
          isTotal && 'font-semibold',
          variant === 'positive' && 'text-emerald-300',
          variant === 'negative' && 'text-rose-300',
          (variant === 'neutral' || !variant) && 'text-white',
        )}
      >
        {variant === 'positive' && '+'}
        {variant === 'negative' && '-'}
        {formatCurrency(Math.abs(amount), currency)}
      </span>
    </div>
  )
}

function NetThisMonthBreakdownView({ data, currency }: { data: NetThisMonthBreakdown; currency: Currency }) {
  return (
    <div className="space-y-1.5">
      <BreakdownRow label="Income" amount={data.income} currency={currency} variant="positive" />
      <BreakdownRow label="Expenses" amount={data.expense} currency={currency} variant="negative" />
      <BreakdownRow
        label="Net"
        amount={data.net}
        currency={currency}
        variant={data.net >= 0 ? 'positive' : 'negative'}
        isTotal
      />
    </div>
  )
}

function OnTrackForBreakdownView({ data, currency }: { data: OnTrackForBreakdown; currency: Currency }) {
  return (
    <div className="space-y-1.5">
      <BreakdownRow label="Actual income" amount={data.actualIncome} currency={currency} variant="positive" />
      <BreakdownRow
        label={`Expected remaining (${formatIncomeSource(data.incomeSource)})`}
        amount={data.expectedRemainingIncome}
        currency={currency}
        variant="positive"
      />
      <BreakdownRow label="Actual expenses" amount={data.actualExpense} currency={currency} variant="negative" />
      <BreakdownRow
        label="Remaining budgeted"
        amount={data.remainingBudgetedExpense}
        currency={currency}
        variant="negative"
      />
      <BreakdownRow
        label="Projected"
        amount={data.projected}
        currency={currency}
        variant={data.projected >= 0 ? 'positive' : 'negative'}
        isTotal
      />
    </div>
  )
}

function LeftToSpendBreakdownView({ data, currency }: { data: LeftToSpendBreakdown; currency: Currency }) {
  return (
    <div className="space-y-1.5">
      <BreakdownRow label="Total budgeted" amount={data.totalPlanned} currency={currency} />
      <BreakdownRow label="Spent so far" amount={data.totalActual} currency={currency} variant="negative" />
      <BreakdownRow
        label="Remaining"
        amount={data.totalRemaining}
        currency={currency}
        variant={data.totalRemaining > 0 ? 'neutral' : 'negative'}
        isTotal
      />

      {data.categories.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">By category</p>
          {data.categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-slate-300">{cat.name}</span>
              <span
                className={cn(
                  'text-xs font-medium tabular-nums',
                  cat.remaining > 0 ? 'text-slate-200' : 'text-rose-300',
                )}
              >
                {formatCurrency(cat.remaining, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MonthlyTargetBreakdownView({ data, currency }: { data: MonthlyTargetBreakdown; currency: Currency }) {
  return (
    <div className="space-y-1.5">
      <BreakdownRow
        label={`Planned income (${formatIncomeSource(data.incomeSource)})`}
        amount={data.plannedIncome}
        currency={currency}
        variant="positive"
      />
      <BreakdownRow label="Budgeted expenses" amount={data.plannedExpense} currency={currency} variant="negative" />
      <BreakdownRow
        label="Target"
        amount={data.target}
        currency={currency}
        variant={data.target >= 0 ? 'positive' : 'negative'}
        isTotal
      />
    </div>
  )
}

export function StatBreakdownPanel({ breakdown, currency }: StatBreakdownProps) {
  switch (breakdown.type) {
    case 'net-this-month':
      return <NetThisMonthBreakdownView data={breakdown} currency={currency} />
    case 'on-track-for':
      return <OnTrackForBreakdownView data={breakdown} currency={currency} />
    case 'left-to-spend':
      return <LeftToSpendBreakdownView data={breakdown} currency={currency} />
    case 'monthly-target':
      return <MonthlyTargetBreakdownView data={breakdown} currency={currency} />
    default:
      return null
  }
}
