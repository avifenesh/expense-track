'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Currency } from '@prisma/client'
import { ArrowRight, Scale, Check, Bell } from 'lucide-react'
import { settleAllWithUserAction } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/utils/cn'
import { toast } from '@/hooks/useToast'
import { useCsrfToken } from '@/hooks/useCsrfToken'
import type { SettlementBalance, PaymentHistoryItem } from '@/lib/finance'

export type SettlementSummaryProps = {
  balances: SettlementBalance[]
  preferredCurrency: Currency
  paymentHistory?: PaymentHistoryItem[]
}

export function SettlementSummary({ balances, preferredCurrency, paymentHistory = [] }: SettlementSummaryProps) {
  const router = useRouter()
  const csrfToken = useCsrfToken()
  const [isPending, startTransition] = useTransition()

  const handleSettleAll = (targetUserId: string, currency: Currency) => {
    startTransition(async () => {
      const result = await settleAllWithUserAction({ targetUserId, currency, csrfToken })
      if ('error' in result) {
        toast.error(result.error.general?.[0] || 'Unable to settle expenses.')
        return
      }
      toast.success(`Settled ${result.data.settledCount} expense${result.data.settledCount === 1 ? '' : 's'}`)
      router.refresh()
    })
  }

  if (balances.length === 0) {
    return null
  }

  // Group totals by currency to avoid mixing different currency amounts
  const currencies = [...new Set(balances.map((b) => b.currency))]
  const totalsByCurrency = currencies.map((currency) => {
    const currencyBalances = balances.filter((b) => b.currency === currency)
    const youOwe = currencyBalances.reduce((sum, b) => sum + b.youOwe, 0)
    const theyOwe = currencyBalances.reduce((sum, b) => sum + b.theyOwe, 0)
    return { currency, youOwe, theyOwe, netBalance: theyOwe - youOwe }
  })

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
        {totalsByCurrency.map((totals) => (
          <div key={totals.currency} className="space-y-2">
            {currencies.length > 1 && (
              <p className="text-xs font-medium text-slate-500">{totals.currency}</p>
            )}
            <div className="grid grid-cols-3 gap-4 rounded-xl bg-white/5 p-4">
              <div className="text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">You owe</p>
                <p className="text-xl font-bold text-rose-400">{formatCurrency(totals.youOwe, totals.currency)}</p>
              </div>
              <div className="flex items-center justify-center">
                <ArrowRight className="h-5 w-5 text-slate-500" />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">They owe</p>
                <p className="text-xl font-bold text-emerald-400">{formatCurrency(totals.theyOwe, totals.currency)}</p>
              </div>
            </div>
            <div className={cn('rounded-xl p-3 text-center', totals.netBalance >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10')}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Net balance</p>
              <p className={cn('text-xl font-bold', totals.netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {totals.netBalance >= 0 ? '+' : ''}
                {formatCurrency(totals.netBalance, totals.currency)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {totals.netBalance > 0
                  ? 'People owe you more than you owe them'
                  : totals.netBalance < 0
                    ? 'You owe others more than they owe you'
                    : 'All settled up!'}
              </p>
            </div>
          </div>
        ))}

        <div className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">By person</h3>
          {balances.map((balance) => (
            <div
              key={`${balance.userId}-${balance.currency}`}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
            >
              <div>
                <p className="font-medium text-white">{balance.userDisplayName}</p>
                <p className="text-xs text-slate-400">{balance.userEmail}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className={cn('font-semibold', balance.netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                    {balance.netBalance >= 0 ? '+' : ''}
                    {formatCurrency(balance.netBalance, balance.currency)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {balance.netBalance > 0
                      ? `They owe you ${formatCurrency(balance.netBalance, balance.currency)}`
                      : balance.netBalance < 0
                        ? `You owe ${formatCurrency(Math.abs(balance.netBalance), balance.currency)}`
                        : 'Settled'}
                  </p>
                </div>
                {balance.netBalance > 0 && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 min-h-0 px-2 py-1 text-xs text-amber-300 opacity-50 cursor-not-allowed"
                      disabled
                      title="Reminders coming soon"
                    >
                      <Bell className="mr-1 h-3.5 w-3.5" />
                      Remind
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 min-h-0 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20"
                      onClick={() => handleSettleAll(balance.userId, balance.currency)}
                      disabled={isPending}
                      title="Mark all pending payments from this person as received"
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Settle
                    </Button>
                  </div>
                )}
                {balance.netBalance === 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                    <Check className="h-3 w-3" />
                    Settled
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {paymentHistory.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">Recent Activity</h3>
            <div className="space-y-1">
              {paymentHistory.map((item) => (
                <div
                  key={item.participantId}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        item.direction === 'received' ? 'bg-emerald-400' : 'bg-rose-400'
                      )}
                    />
                    <span className="text-slate-300">
                      {item.direction === 'received' ? (
                        <>
                          <span className="font-medium text-white">{item.userDisplayName}</span> paid you
                        </>
                      ) : (
                        <>
                          You paid <span className="font-medium text-white">{item.userDisplayName}</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn('font-medium', item.direction === 'received' ? 'text-emerald-400' : 'text-rose-400')}
                    >
                      {item.direction === 'received' ? '+' : '-'}
                      {formatCurrency(item.amount, item.currency)}
                    </span>
                    <p className="text-xs text-slate-500">
                      {new Date(item.paidAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
