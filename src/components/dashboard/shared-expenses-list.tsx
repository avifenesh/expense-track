'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Currency, PaymentStatus } from '@prisma/client'
import { Bell, Check, X, ChevronDown, ChevronUp, Users } from 'lucide-react'
import { markSharePaidAction, cancelSharedExpenseAction, sendPaymentReminderAction } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/utils/cn'
import { toast } from '@/hooks/useToast'
import { useCsrfToken } from '@/hooks/useCsrfToken'
import type { SharedExpenseSummary } from '@/lib/finance'

export type SharedExpensesListProps = {
  sharedExpenses: SharedExpenseSummary[]
  preferredCurrency: Currency
}

export function SharedExpensesList({ sharedExpenses, preferredCurrency }: SharedExpensesListProps) {
  const router = useRouter()
  const csrfToken = useCsrfToken()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleMarkPaid = (participantId: string) => {
    startTransition(async () => {
      const result = await markSharePaidAction({ participantId, csrfToken })
      if ('error' in result) {
        toast.error(result.error.general?.[0] || 'Could not mark as paid')
        return
      }
      toast.success('Payment recorded')
      router.refresh()
    })
  }

  const handleSendReminder = (participantId: string) => {
    startTransition(async () => {
      const result = await sendPaymentReminderAction({ participantId, csrfToken })
      if ('error' in result) {
        toast.error(result.error.general?.[0] || 'Could not send reminder')
        return
      }
      toast.success('Reminder sent')
      router.refresh()
    })
  }

  const handleCancelSharing = (sharedExpenseId: string) => {
    startTransition(async () => {
      const result = await cancelSharedExpenseAction({ sharedExpenseId, csrfToken })
      if ('error' in result) {
        toast.error(result.error.general?.[0] || 'Could not cancel sharing')
        return
      }
      toast.success('Sharing canceled')
      router.refresh()
    })
  }

  if (sharedExpenses.length === 0) {
    return (
      <Card className="border-white/15 bg-white/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Expenses you shared</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
            <div className="rounded-full bg-white/10 p-3">
              <Users className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-white">No shared expenses</p>
            <p className="text-xs text-slate-400">
              Share a transaction from the Transactions tab to split costs with others.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-white/15 bg-white/10">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white">Expenses you shared</CardTitle>
        <p className="text-sm text-slate-400">Track payments from people you split costs with.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {sharedExpenses.map((expense) => {
          const isExpanded = expandedId === expense.id
          return (
            <div key={expense.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between p-4 text-left hover:bg-white/5 transition"
                onClick={() => setExpandedId(isExpanded ? null : expense.id)}
              >
                <div className="space-y-1">
                  <p className="font-medium text-white">
                    {expense.description || expense.transaction.description || 'Shared expense'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {expense.transaction.category.name} - {new Date(expense.transaction.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-semibold text-white">{formatCurrency(expense.totalAmount, preferredCurrency)}</p>
                    <p className={cn('text-xs', expense.allSettled ? 'text-emerald-400' : 'text-amber-400')}>
                      {expense.allSettled
                        ? 'All settled'
                        : `${formatCurrency(expense.totalOwed, expense.currency)} pending`}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-white/10 p-4 space-y-3">
                  {expense.participants.map((participant) => (
                    <div key={participant.id} className="flex items-center justify-between rounded-lg bg-white/5 p-3">
                      <div>
                        <p className="font-medium text-white">{participant.participant.displayName}</p>
                        <p className="text-xs text-slate-400">{participant.participant.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">
                          {formatCurrency(participant.shareAmount, expense.currency)}
                        </span>
                        {participant.status === PaymentStatus.PAID && (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                            <Check className="h-3 w-3" />
                            Paid
                          </span>
                        )}
                        {participant.status === PaymentStatus.DECLINED && (
                          <span className="flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-300">
                            <X className="h-3 w-3" />
                            Declined
                          </span>
                        )}
                        {participant.status === PaymentStatus.PENDING && (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-amber-300 hover:bg-amber-500/20"
                              onClick={() => handleSendReminder(participant.id)}
                              disabled={isPending}
                              title="Send reminder"
                            >
                              <Bell className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-emerald-300 hover:bg-emerald-500/20"
                              onClick={() => handleMarkPaid(participant.id)}
                              disabled={isPending}
                              title="Mark as paid"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs text-rose-400 hover:bg-rose-500/20"
                      onClick={() => handleCancelSharing(expense.id)}
                      disabled={isPending}
                    >
                      Cancel sharing
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
