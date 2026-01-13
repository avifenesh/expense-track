'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Currency } from '@prisma/client'
import { Check, X, Bell } from 'lucide-react'
import { DashboardData } from '@/lib/finance'
import { approveTransactionRequestAction, rejectTransactionRequestAction } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/utils/cn'
import { useCsrfToken } from '@/hooks/useCsrfToken'

type TransactionRequest = DashboardData['transactionRequests'][number]

type RequestListProps = {
  requests: TransactionRequest[]
  preferredCurrency: Currency
}

export function RequestList({ requests, preferredCurrency: _preferredCurrency }: RequestListProps) {
  const router = useRouter()
  const csrfToken = useCsrfToken()
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleApprove = (id: string) => {
    startTransition(async () => {
      const result = await approveTransactionRequestAction({ id, csrfToken })
      if ('error' in result) {
        setFeedback({ type: 'error', message: 'Failed to approve request.' })
        return
      }
      setFeedback({ type: 'success', message: 'Request approved and logged.' })
      router.refresh()
    })
  }

  const handleReject = (id: string) => {
    startTransition(async () => {
      const result = await rejectTransactionRequestAction({ id, csrfToken })
      if ('error' in result) {
        setFeedback({ type: 'error', message: 'Failed to reject request.' })
        return
      }
      setFeedback({ type: 'success', message: 'Request rejected.' })
      router.refresh()
    })
  }

  if (requests.length === 0) {
    return null
  }

  return (
    <Card className="border-sky-400/30 bg-sky-500/10 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-sky-500/20 p-2">
            <Bell className="h-4 w-4 text-sky-200" />
          </div>
          <CardTitle className="text-lg font-semibold text-white">Partner requests</CardTitle>
        </div>
        <span className="rounded-full bg-sky-500/20 px-2.5 py-0.5 text-xs font-bold text-sky-100">
          {requests.length} pending
        </span>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        {feedback && (
          <div
            className={cn(
              'rounded-lg px-3 py-2 text-xs font-medium',
              feedback.type === 'success' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200',
            )}
          >
            {feedback.message}
          </div>
        )}
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-white/10"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    {formatCurrency(Number(request.amount), request.currency as Currency)}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-300">
                    {request.category.name}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  <span className="font-medium text-sky-200">{request.from.name}</span> asks you to pay ·{' '}
                  {new Date(request.date).toLocaleDateString()}
                </p>
                {request.description && <p className="text-xs italic text-slate-400">"{request.description}"</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  className="h-8 w-8 rounded-full border border-rose-500/30 bg-rose-500/10 p-0 text-rose-200 hover:bg-rose-500/20"
                  onClick={() => handleReject(request.id)}
                  disabled={isPending}
                  title="Reject request"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  className="h-8 gap-1.5 rounded-full bg-sky-500 px-4 text-xs font-semibold text-white hover:bg-sky-400"
                  onClick={() => handleApprove(request.id)}
                  disabled={isPending}
                >
                  <Check className="h-3.5 w-3.5" />
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
