'use client'

import { Currency } from '@prisma/client'
import { ArrowRight, Scale } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { SettlementBalance } from '@/lib/finance'

export type SettlementSummaryProps = {
  balances: SettlementBalance[]
  preferredCurrency: Currency
}

export function SettlementSummary({ balances, preferredCurrency }: SettlementSummaryProps) {
  if (balances.length === 0) {
    return null
  }

  const totalYouOwe = balances.reduce((sum, b) => sum + b.youOwe, 0)
  const totalTheyOwe = balances.reduce((sum, b) => sum + b.theyOwe, 0)
  const netBalance = totalTheyOwe - totalYouOwe

  return (
    <Card className="border-white/15 bg-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
          <Scale className="h-5 w-5" />
          Settlement Summary
        </CardTitle>
        <p className="text-sm text-slate-400">Outstanding balances with people you share expenses with.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 rounded-xl bg-white/5 p-4">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">You owe</p>
            <p className="text-xl font-bold text-rose-400">{formatCurrency(totalYouOwe, preferredCurrency)}</p>
          </div>
          <div className="flex items-center justify-center">
            <ArrowRight className="h-5 w-5 text-slate-500" />
          </div>
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">They owe</p>
            <p className="text-xl font-bold text-emerald-400">{formatCurrency(totalTheyOwe, preferredCurrency)}</p>
          </div>
        </div>

        <div className={cn('rounded-xl p-4 text-center', netBalance >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10')}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Net balance</p>
          <p className={cn('text-2xl font-bold', netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
            {netBalance >= 0 ? '+' : ''}
            {formatCurrency(netBalance, preferredCurrency)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {netBalance > 0
              ? 'People owe you more than you owe them'
              : netBalance < 0
                ? 'You owe others more than they owe you'
                : 'All settled up!'}
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">By person</h3>
          {balances.map((balance) => (
            <div
              key={balance.userId}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
            >
              <div>
                <p className="font-medium text-white">{balance.userDisplayName}</p>
                <p className="text-xs text-slate-400">{balance.userEmail}</p>
              </div>
              <div className="text-right">
                <p className={cn('font-semibold', balance.netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                  {balance.netBalance >= 0 ? '+' : ''}
                  {formatCurrency(balance.netBalance, preferredCurrency)}
                </p>
                <p className="text-xs text-slate-500">
                  {balance.netBalance > 0
                    ? `They owe you ${formatCurrency(balance.netBalance, preferredCurrency)}`
                    : balance.netBalance < 0
                      ? `You owe ${formatCurrency(Math.abs(balance.netBalance), preferredCurrency)}`
                      : 'Settled'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
