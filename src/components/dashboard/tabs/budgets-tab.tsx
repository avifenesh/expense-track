'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TransactionType, Currency } from '@prisma/client'
import { FileSpreadsheet } from 'lucide-react'
import { deleteBudgetAction, upsertBudgetAction } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { filterBudgets, getBudgetProgress, getBudgetTotals } from '@/lib/dashboard-ux'
import { createAccountOptions } from '@/lib/select-options'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/utils/cn'
import { toast } from '@/hooks/useToast'
import { useCsrfToken } from '@/hooks/useCsrfToken'
import { DashboardCategory, DashboardAccount, DashboardBudget, typeFilterOptions, currencyOptions } from './types'

type FormErrors = Partial<Record<string, string[]>>

export type BudgetsTabProps = {
  budgets: DashboardBudget[]
  accounts: DashboardAccount[]
  categories: DashboardCategory[]
  activeAccount: string
  monthKey: string
  preferredCurrency: Currency
}

export function BudgetsTab({
  budgets,
  accounts,
  categories,
  activeAccount,
  monthKey,
  preferredCurrency,
}: BudgetsTabProps) {
  const router = useRouter()
  const csrfToken = useCsrfToken()

  // Local state
  const [budgetAccountFilter, setBudgetAccountFilter] = useState<string>(activeAccount)
  const [budgetTypeFilter, setBudgetTypeFilter] = useState<'all' | TransactionType>('all')
  const [isPendingBudget, startBudget] = useTransition()
  const [formErrors, setFormErrors] = useState<FormErrors | null>(null)

  // Derived options
  const accountsOptions = useMemo(() => createAccountOptions(accounts), [accounts])

  const defaultAccountId = activeAccount || accounts[0]?.id || ''

  // Computed
  const filteredBudgets = useMemo(
    () =>
      filterBudgets(budgets, {
        accountId: budgetAccountFilter || undefined,
        type: budgetTypeFilter,
      }),
    [budgets, budgetAccountFilter, budgetTypeFilter],
  )

  const budgetTotals = useMemo(() => getBudgetTotals(filteredBudgets), [filteredBudgets])

  // Handlers
  const handleBudgetSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    setFormErrors(null)
    const form = event.currentTarget
    const formData = new FormData(form)

    const errors: FormErrors = {}
    const categoryId = formData.get('budgetCategoryId') as string
    const planned = Number(formData.get('planned') || 0)

    if (!categoryId) {
      errors.categoryId = ['Please select a category.']
    }

    if (!Number.isFinite(planned) || planned < 0) {
      errors.planned = ['Enter a valid planned amount.']
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    const payload = {
      accountId: (formData.get('budgetAccountId') as string) || defaultAccountId,
      categoryId,
      monthKey,
      planned,
      currency: (formData.get('budgetCurrency') as Currency) || Currency.USD,
      notes: (formData.get('notes') as string) || undefined,
      csrfToken,
    }

    startBudget(async () => {
      const result = await upsertBudgetAction(payload)
      if ('error' in result) {
        const serverErrors = result.error as FormErrors
        setFormErrors(serverErrors)
        toast.error('Could not save budget.')
        return
      }
      toast.success('Budget updated.')
      setFormErrors(null)
      form.reset()
      router.refresh()
    })
  }

  const handleBudgetDelete = (categoryId: string, accountIdForBudget: string) => {
    startBudget(async () => {
      const result = await deleteBudgetAction({
        categoryId,
        accountId: accountIdForBudget,
        monthKey,
        csrfToken,
      })
      if ('error' in result) {
        toast.error('Could not remove budget entry.')
        return
      }
      toast.success('Budget removed.')
      router.refresh()
    })
  }

  return (
    <div role="tabpanel" id="panel-budgets" aria-labelledby="tab-budgets" className="space-y-6">
      <Card className="border-white/15 bg-white/10">
        <CardHeader className="gap-1">
          <CardTitle
            className="text-lg font-semibold text-white"
            helpText="Tune filters and edit plan amounts; progress bars show how actuals track against budgets."
          >
            Monthly budgets
          </CardTitle>
          <p className="text-sm text-slate-400">
            Compare planned versus actual spending and stay ahead of upcoming obligations.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300" htmlFor="budget-filter-account-panel">
                Account filter
              </label>
              <Select
                id="budget-filter-account-panel"
                value={budgetAccountFilter || accountsOptions[0]?.value || ''}
                onChange={(event) => setBudgetAccountFilter(event.target.value)}
                options={accountsOptions}
                disabled={accountsOptions.length === 0}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300" htmlFor="budget-filter-type-panel">
                Type filter
              </label>
              <Select
                id="budget-filter-type-panel"
                value={budgetTypeFilter}
                onChange={(event) => setBudgetTypeFilter(event.target.value as typeof budgetTypeFilter)}
                options={typeFilterOptions}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300" htmlFor="budget-summary-expense-panel">
                Expense utilization
              </label>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                {formatCurrency(budgetTotals.expenseActual, preferredCurrency)} of{' '}
                {formatCurrency(budgetTotals.expensePlanned, preferredCurrency)} spent
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300" htmlFor="budget-summary-income-panel">
                Income realized
              </label>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                {formatCurrency(budgetTotals.incomeActual, preferredCurrency)} of{' '}
                {formatCurrency(budgetTotals.incomePlanned, preferredCurrency)} received
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {filteredBudgets.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
                <div className="rounded-full bg-white/10 p-3">
                  <FileSpreadsheet className="h-6 w-6 text-slate-300" />
                </div>
                {budgets.length === 0 ? (
                  <>
                    <p className="text-sm font-medium text-white">No budgets yet</p>
                    <p className="text-xs text-slate-400">
                      Set spending limits to stay on track. Scroll down to add your first budget.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-white">No matching budgets</p>
                    <p className="text-xs text-slate-400">Try adjusting the filters above.</p>
                  </>
                )}
              </div>
            )}
            {filteredBudgets.map((budget) => {
              const progress = getBudgetProgress(budget)
              const remainingLabel = `${
                budget.categoryType === TransactionType.EXPENSE ? 'Remaining' : 'To receive'
              }: ${formatCurrency(budget.remaining, preferredCurrency)}`
              const actualLabel = budget.categoryType === TransactionType.EXPENSE ? 'spent' : 'received'
              const progressColor =
                budget.categoryType === TransactionType.EXPENSE ? 'bg-rose-400/80' : 'bg-emerald-300/80'

              return (
                <div
                  key={`${budget.categoryId}-${budget.budgetId}`}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                        <span>{budget.categoryName}</span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-slate-200">
                          {budget.accountName}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-300">
                        {formatCurrency(budget.actual, preferredCurrency)} {actualLabel} /{' '}
                        {formatCurrency(budget.planned, preferredCurrency)} planned
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs text-rose-200 hover:bg-rose-500/20"
                      onClick={() => handleBudgetDelete(budget.categoryId, budget.accountId)}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="mt-3">
                    <div className="sr-only" role="status">
                      {formatCurrency(budget.actual, preferredCurrency)} of{' '}
                      {formatCurrency(budget.planned, preferredCurrency)} {actualLabel}
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10" role="presentation">
                      <div
                        className={cn('h-2 rounded-full transition-all duration-300 ease-out', progressColor)}
                        style={{ width: `${progress * 100}%` }}
                        role="progressbar"
                        aria-valuenow={Math.round(progress * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${budget.categoryName} progress`}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-300">{remainingLabel}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <form
            id="budget-form"
            onSubmit={handleBudgetSubmit}
            className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5"
            tabIndex={-1}
          >
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">Add or update a budget</h3>
              <p className="text-xs text-slate-400">Capture limits for priority categories and accounts.</p>
            </div>
            {formErrors?.general && <p className="text-xs text-rose-300">{formErrors.general[0]}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300" htmlFor="budgetAccountId">
                  Account
                </label>
                <Select
                  id="budgetAccountId"
                  name="budgetAccountId"
                  defaultValue={defaultAccountId}
                  options={accountsOptions}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300" htmlFor="budgetCategoryId">
                  Category
                </label>
                <Select
                  id="budgetCategoryId"
                  name="budgetCategoryId"
                  options={categories
                    .filter((category) => category.type === TransactionType.EXPENSE && !category.isArchived)
                    .map((category) => ({ label: category.name, value: category.id }))}
                  required
                  aria-describedby={formErrors?.categoryId ? 'budget-categoryId-error' : undefined}
                />
                {formErrors?.categoryId && (
                  <p id="budget-categoryId-error" className="text-xs text-rose-300">
                    {formErrors.categoryId[0]}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300" htmlFor="planned">
                  Planned amount
                </label>
                <Input
                  name="planned"
                  id="planned"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required
                  aria-describedby={formErrors?.planned ? 'budget-planned-error' : undefined}
                />
                {formErrors?.planned && (
                  <p id="budget-planned-error" className="text-xs text-rose-300">
                    {formErrors.planned[0]}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300" htmlFor="budgetCurrency">
                  Currency
                </label>
                <Select
                  id="budgetCurrency"
                  name="budgetCurrency"
                  defaultValue={Currency.USD}
                  options={currencyOptions}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-medium text-slate-300" htmlFor="notes">
                  Notes (optional)
                </label>
                <Input name="notes" id="notes" placeholder="Context or limit" />
              </div>
            </div>
            <Button type="submit" loading={isPendingBudget} className="w-full">
              Save budget
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
