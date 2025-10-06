'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { Currency } from '@prisma/client'
import { RefreshCcw, TrendingUp } from 'lucide-react'
import {
  createHoldingAction,
  deleteHoldingAction,
  refreshHoldingPricesAction,
} from '@/app/actions'
import type { DashboardData, HoldingWithPrice } from '@/lib/finance'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/utils/cn'
import { formatCurrency } from '@/utils/format'

type Feedback = { type: 'success' | 'error'; message: string }

type SelectOption = { label: string; value: string }

type HoldingsTabProps = {
  activeAccount: string
  accountsOptions: SelectOption[]
  categories: DashboardData['categories']
  preferredCurrency: Currency
  onSelectAccount: (accountId: string) => void
}

type HoldingsResponse = {
  holdings: HoldingWithPrice[]
  accountId: string
}

const currencyOptions: Array<{ label: string; value: Currency }> = [
  { label: '$ USD', value: Currency.USD },
  { label: '€ EUR', value: Currency.EUR },
  { label: '₪ ILS', value: Currency.ILS },
]

export default function HoldingsTab({
  activeAccount,
  accountsOptions,
  categories,
  preferredCurrency,
  onSelectAccount,
}: HoldingsTabProps) {
  const [holdings, setHoldings] = useState<HoldingWithPrice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPendingAction, startAction] = useTransition()

  const loadHoldings = useCallback(
    async (accountId: string, signal?: AbortSignal) => {
      if (!accountId) return

      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({ accountId, preferredCurrency })
        const response = await fetch(`/api/holdings?${params.toString()}`, {
          signal,
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error('Request failed')
        }

        const payload = (await response.json()) as HoldingsResponse
        if (signal?.aborted) return
        setHoldings(payload.holdings ?? [])
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          return
        }
        if (signal?.aborted) return
        setError('Unable to load holdings')
        setHoldings([])
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false)
        }
      }
    },
    [preferredCurrency],
  )

  useEffect(() => {
    if (!activeAccount) return

    const controller = new AbortController()
    loadHoldings(activeAccount, controller.signal)
    return () => controller.abort()
  }, [activeAccount, loadHoldings])

  const holdingCategories = useMemo(
    () => categories.filter((category) => category.isHolding && !category.isArchived),
    [categories],
  )

  const handleCreate: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    const payload = {
      accountId: (formData.get('accountId') as string) || activeAccount,
      categoryId: formData.get('categoryId') as string,
      symbol: (formData.get('symbol') as string).toUpperCase(),
      quantity: Number(formData.get('quantity') || 0),
      averageCost: Number(formData.get('averageCost') || 0),
      currency: (formData.get('currency') as Currency) || Currency.USD,
      notes: (formData.get('notes') as string) || undefined,
    }

    setFeedback(null)

    startAction(async () => {
      const result = await createHoldingAction(payload)
      if (result?.error) {
        setFeedback({
          type: 'error',
          message: Object.values(result.error).flat().join(', ') || 'Unable to add holding',
        })
        return
      }

      setFeedback({ type: 'success', message: 'Holding added successfully' })
      form.reset()
      await loadHoldings(payload.accountId)
    })
  }

  const handleDelete = (holdingId: string, symbol: string) => {
    if (!window.confirm(`Delete ${symbol} holding?`)) {
      return
    }

    setFeedback(null)

    startAction(async () => {
      const result = await deleteHoldingAction({ id: holdingId })
      if ('error' in result) {
        setFeedback({ type: 'error', message: 'Failed to delete holding' })
        return
      }

      setFeedback({ type: 'success', message: 'Holding deleted' })
      await loadHoldings(activeAccount)
    })
  }

  const handleRefreshPrices = () => {
    setFeedback(null)

    startAction(async () => {
      const result = await refreshHoldingPricesAction({ accountId: activeAccount })
      if ('error' in result) {
        setFeedback({ type: 'error', message: 'Failed to refresh prices' })
        return
      }

      setFeedback({
        type: 'success',
        message: `Updated ${result.updated ?? 0} price${(result.updated ?? 0) === 1 ? '' : 's'}`,
      })
      await loadHoldings(activeAccount)
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <Card className="border-white/15 bg-white/10 h-fit">
        <CardHeader className="gap-1">
          <CardTitle
            className="text-lg font-semibold text-white"
            helpText="Register a new position with quantity, cost basis, and notes so valuations stay accurate."
          >
            Add holding
          </CardTitle>
          <p className="text-sm text-slate-400">Track stocks, ETFs, or other investments with live market prices.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300" htmlFor="holdingAccount">
                Account
              </label>
              <Select
                name="accountId"
                id="holdingAccount"
                value={activeAccount}
                onChange={(event) => onSelectAccount(event.target.value)}
                options={accountsOptions}
                disabled={accountsOptions.length === 0}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300" htmlFor="holdingCategory">
                Category
              </label>
              <Select
                name="categoryId"
                id="holdingCategory"
                options={holdingCategories.map((category) => ({ label: category.name, value: category.id }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300" htmlFor="symbol">
                  Symbol
                </label>
                <Input name="symbol" id="symbol" placeholder="e.g. AMZN, SPY" required className="uppercase" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300" htmlFor="quantity">
                  Quantity
                </label>
                <Input name="quantity" id="quantity" type="number" step="0.000001" placeholder="100" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300" htmlFor="averageCost">
                  Avg Cost
                </label>
                <Input name="averageCost" id="averageCost" type="number" step="0.01" placeholder="150.00" required />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300" htmlFor="holdingCurrency">
                  Currency
                </label>
                <Select
                  name="currency"
                  id="holdingCurrency"
                  options={currencyOptions.map((option) => ({ label: option.label, value: option.value }))}
                  defaultValue={Currency.USD}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300" htmlFor="holdingNotes">
                Notes (optional)
              </label>
              <Textarea name="notes" id="holdingNotes" rows={2} placeholder="Investment thesis or notes" />
            </div>
            <Button type="submit" className="w-full" disabled={isPendingAction}>
              {isPendingAction ? 'Saving…' : 'Add holding'}
            </Button>
            {feedback && (
              <div
                className={cn(
                  'rounded-lg px-3 py-2 text-xs',
                  feedback.type === 'success' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200',
                )}
              >
                {feedback.message}
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-rose-500/20 px-3 py-2 text-xs text-rose-200">{error}</div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="border-white/15 bg-white/10">
        <CardHeader className="gap-1 flex-row items-start justify-between">
          <div>
            <CardTitle
              className="text-lg font-semibold text-white"
              helpText="Review each holding’s market value, gain/loss, and sync price data for the selected account."
              helpPlacement="left"
            >
              Your holdings
            </CardTitle>
            <p className="text-sm text-slate-400">
              Stocks and ETFs tracked with live market prices. Values update on refresh.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={handleRefreshPrices}
            disabled={isPendingAction || holdings.length === 0 || !activeAccount}
            className="gap-2"
          >
            <RefreshCcw className={cn('h-4 w-4', isPendingAction && 'animate-spin')} />
            Refresh prices
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center text-sm text-slate-400">
              <TrendingUp className="mx-auto mb-2 h-8 w-8 animate-pulse text-slate-500" />
              <p>Loading holdings…</p>
            </div>
          )}
          {!isLoading && holdings.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center text-sm text-slate-400">
              <TrendingUp className="mx-auto mb-2 h-8 w-8 text-slate-500" />
              <p>No holdings tracked yet.</p>
              <p className="mt-1 text-xs">Add your first stock or ETF to start tracking portfolio value.</p>
            </div>
          )}
          {holdings.map((holding) => {
            const staleBadge =
              holding.priceAge && holding.isStale ? (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
                  Stale
                </span>
              ) : null

            const priceAge = holding.priceAge
              ? new Date(holding.priceAge).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Unknown'

            return (
              <div key={holding.id} className="space-y-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sm font-bold tracking-wide text-sky-200">
                      {holding.symbol}
                    </span>
                    <span className="text-xs text-slate-400">×{holding.quantity}</span>
                    {staleBadge}
                  </div>
                  <button
                    onClick={() => handleDelete(holding.id, holding.symbol)}
                    className="text-xs text-rose-400 transition hover:text-rose-300"
                  >
                    Delete
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Market Value</p>
                    <p className="font-semibold text-white">{formatCurrency(holding.marketValue, holding.currency)}</p>
                    {holding.currency !== preferredCurrency && holding.marketValueConverted !== undefined && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {formatCurrency(holding.marketValueConverted, preferredCurrency)}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Cost Basis</p>
                    <p className="text-slate-300">{formatCurrency(holding.costBasis, holding.currency)}</p>
                    {holding.currency !== preferredCurrency && holding.costBasisConverted !== undefined && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {formatCurrency(holding.costBasisConverted, preferredCurrency)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400">Gain/Loss: </span>
                    <span className={cn('font-medium', holding.gainLoss >= 0 ? 'text-emerald-300' : 'text-rose-400')}>
                      {formatCurrency(holding.gainLoss, holding.currency)} ({holding.gainLossPercent.toFixed(2)}%)
                    </span>
                    {holding.currency !== preferredCurrency && holding.gainLossConverted !== undefined && (
                      <span className="ml-1 text-slate-400">
                        ({formatCurrency(holding.gainLossConverted, preferredCurrency)})
                      </span>
                    )}
                  </div>
                  {holding.currentPrice && (
                    <div className="text-slate-400">
                      @ {formatCurrency(holding.currentPrice, holding.currency)}
                      {holding.currency !== preferredCurrency && holding.currentPriceConverted && (
                        <span className="ml-1">({formatCurrency(holding.currentPriceConverted, preferredCurrency)})</span>
                      )}
                    </div>
                  )}
                </div>

                {holding.notes && (
                  <p className="border-t border-white/5 pt-2 text-xs text-slate-400">{holding.notes}</p>
                )}

                <p className="text-[10px] text-slate-500">Last updated: {priceAge}</p>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
