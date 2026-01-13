'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Currency } from '@prisma/client'
import { setBalanceAction } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/utils/cn'
import { useCsrfToken } from '@/hooks/useCsrfToken'

type Feedback = { type: 'success' | 'error'; message: string }

export type BalanceFormProps = {
  activeAccount: string
  monthKey: string
  preferredCurrency: Currency
  currentNet: number
  onClose: () => void
}

export function BalanceForm({ activeAccount, monthKey, preferredCurrency, currentNet, onClose }: BalanceFormProps) {
  const router = useRouter()
  const csrfToken = useCsrfToken()
  const [balanceAmount, setBalanceAmount] = useState('')
  const [balanceFeedback, setBalanceFeedback] = useState<Feedback | null>(null)
  const [isPendingBalance, startBalance] = useTransition()

  const handleSetBalance = () => {
    const parsedAmount = Number.parseFloat(balanceAmount)
    if (!Number.isFinite(parsedAmount)) {
      setBalanceFeedback({ type: 'error', message: 'Enter a valid amount.' })
      return
    }

    startBalance(async () => {
      const result = await setBalanceAction({
        accountId: activeAccount,
        targetBalance: parsedAmount,
        currency: preferredCurrency,
        monthKey,
        csrfToken,
      })

      if ('error' in result) {
        const firstErrorSet = Object.values(result.error)[0]
        const message: string =
          Array.isArray(firstErrorSet) && firstErrorSet.length > 0
            ? (firstErrorSet[0] ?? 'Unable to set balance.')
            : 'Unable to set balance.'
        setBalanceFeedback({ type: 'error', message })
        return
      }

      const adjustment = result.data.adjustment
      if (adjustment === 0) {
        setBalanceFeedback({ type: 'success', message: 'Balance already matches.' })
      } else {
        const sign = adjustment > 0 ? '+' : ''
        setBalanceFeedback({
          type: 'success',
          message: `Balance set. Adjustment: ${sign}${formatCurrency(adjustment, preferredCurrency)}`,
        })
      }
      setBalanceAmount('')
      onClose()
      router.refresh()
    })
  }

  const handleCancel = () => {
    onClose()
    setBalanceAmount('')
    setBalanceFeedback(null)
  }

  return (
    <Card className="border-white/15 bg-white/10">
      <CardHeader className="gap-1">
        <CardTitle className="text-lg font-semibold text-white">Set current balance</CardTitle>
        <p className="text-sm text-slate-300">
          Enter your actual current balance. We&apos;ll create an adjustment transaction to match it.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-300">
            <span>Current net this month</span>
            <span className="text-sm font-semibold text-white">{formatCurrency(currentNet, preferredCurrency)}</span>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300" htmlFor="balanceAmount">
              Target balance
            </label>
            <Input
              id="balanceAmount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={balanceAmount}
              onChange={(e) => setBalanceAmount(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="button" onClick={handleSetBalance} loading={isPendingBalance} className="flex-1">
              Set balance
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
        {balanceFeedback && (
          <p
            role="status"
            className={cn('text-xs', balanceFeedback.type === 'error' ? 'text-rose-600' : 'text-emerald-600')}
          >
            {balanceFeedback.message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
