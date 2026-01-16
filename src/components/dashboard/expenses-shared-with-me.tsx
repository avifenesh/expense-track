'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Currency, PaymentStatus } from '@prisma/client'
import { Check, X, Inbox } from 'lucide-react'
import { declineShareAction } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/utils/cn'
import { toast } from '@/hooks/useToast'
import { useCsrfToken } from '@/hooks/useCsrfToken'
import type { ExpenseParticipationSummary } from '@/lib/finance'

export type ExpensesSharedWithMeProps = {
  participations: ExpenseParticipationSummary[]
  preferredCurrency: Currency
}

export function ExpensesSharedWithMe({
  participations,
  preferredCurrency: _preferredCurrency,
}: ExpensesSharedWithMeProps) {
  const router = useRouter()
  const csrfToken = useCsrfToken()
  const [isPending, startTransition] = useTransition()

  const handleDecline = (participantId: string) => {
    startTransition(async () => {
      const result = await declineShareAction({ participantId, csrfToken })
      if ('error' in result) {
        toast.error(result.error.general?.[0] || 'Could not decline')
        return
      }
      toast.success('Share declined')
      router.refresh()
    })
  }

  const pendingParticipations = participations.filter((p) => p.status === PaymentStatus.PENDING)
  const settledParticipations = participations.filter((p) => p.status !== PaymentStatus.PENDING)

  if (participations.length === 0) {
    return (
      <Card className="border-white/15 bg-white/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Expenses shared with you</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
            <div className="rounded-full bg-white/10 p-3">
              <Inbox className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-white">No shared expenses</p>
            <p className="text-xs text-slate-400">When someone shares an expense with you, it will appear here.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-white/15 bg-white/10">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white">Expenses shared with you</CardTitle>
        <p className="text-sm text-slate-400">Expenses others have split with you. Mark as paid when you settle up.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingParticipations.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-amber-400">Pending</h3>
            {pendingParticipations.map((participation) => (
              <div
                key={participation.id}
                className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
              >
                <div className="space-y-1">
                  <p className="font-medium text-white">
                    {participation.sharedExpense.description ||
                      participation.sharedExpense.transaction.description ||
                      'Shared expense'}
                  </p>
                  <p className="text-xs text-slate-400">
                    From {participation.sharedExpense.owner.displayName} -{' '}
                    {participation.sharedExpense.transaction.category.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(participation.sharedExpense.transaction.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-semibold text-amber-300">
                      {formatCurrency(participation.shareAmount, participation.sharedExpense.currency)}
                    </p>
                    <p className="text-xs text-slate-400">
                      of {formatCurrency(participation.sharedExpense.totalAmount, participation.sharedExpense.currency)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-2 text-rose-400 hover:bg-rose-500/20"
                    onClick={() => handleDecline(participation.id)}
                    disabled={isPending}
                    title="Decline"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {settledParticipations.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">Settled</h3>
            {settledParticipations.map((participation) => (
              <div
                key={participation.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="space-y-1">
                  <p className="font-medium text-white">
                    {participation.sharedExpense.description ||
                      participation.sharedExpense.transaction.description ||
                      'Shared expense'}
                  </p>
                  <p className="text-xs text-slate-400">From {participation.sharedExpense.owner.displayName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-300">
                    {formatCurrency(participation.shareAmount, participation.sharedExpense.currency)}
                  </span>
                  <span
                    className={cn(
                      'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                      participation.status === PaymentStatus.PAID
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300',
                    )}
                  >
                    {participation.status === PaymentStatus.PAID ? (
                      <>
                        <Check className="h-3 w-3" />
                        Paid
                      </>
                    ) : (
                      <>
                        <X className="h-3 w-3" />
                        Declined
                      </>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
