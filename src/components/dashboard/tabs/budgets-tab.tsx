'use client'

import { useMemo, useState, useTransition, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { TransactionType, Currency } from '@prisma/client'
import { FileSpreadsheet } from 'lucide-react'
import { deleteBudgetAction, upsertBudgetAction, upsertMonthlyIncomeGoalAction } from '@/app/actions'
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
import { useFormValidation, validators } from '@/hooks/useFormValidation'
import { DashboardCategory, DashboardAccount, DashboardBudget, typeFilterOptions, currencyOptions } from './types'
import type { MonthlyIncomeGoalSummary } from '@/lib/finance'

type FormErrors = Partial<Record<string, string[]>>

export type BudgetsTabProps = {
  budgets: DashboardBudget[]
  accounts: DashboardAccount[]
  categories: DashboardCategory[]
  activeAccount: string
  monthKey: string
  preferredCurrency: Currency
  monthlyIncomeGoal?: MonthlyIncomeGoalSummary
  actualIncome?: number
}

export function BudgetsTab({
  budgets,
  accounts,
  categories,
  activeAccount,
  monthKey,
  preferredCurrency,
  monthlyIncomeGoal,
  actualIncome = 0,
}: BudgetsTabProps) {
  const router = useRouter()
  const csrfToken = useCsrfToken()

  // Form validation with blur-based validation
  const validation = useFormValidation({
    categoryId: { rules: [validators.required('Please select a category.')], validateOnBlur: true },
    planned: { rules: [validators.nonNegativeNumber('Enter a valid planned amount.')], validateOnBlur: true },
  })

  // Local state
  const [budgetAccountFilter, setBudgetAccountFilter] = useState<string>(activeAccount)
  const [budgetTypeFilter, setBudgetTypeFilter] = useState<'all' | TransactionType>('all')
  const [isPendingBudget, startBudget] = useTransition()
  const [isPendingIncomeGoal, startIncomeGoal] = useTransition()
  const [formErrors, setFormErrors] = useState<FormErrors | null>(null)
  const [incomeGoalErrors, setIncomeGoalErrors] = useState<FormErrors | null>(null)
  const [deletingBudgetKey, setDeletingBudgetKey] = useState<string | null>(null)
  const [editingBudget, setEditingBudget] = useState<DashboardBudget | null>(null)
  const isEditingBudget = Boolean(editingBudget)
  const budgetFormRef = useRef<HTMLFormElement>(null)

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

    // In edit mode, use editingBudget values for disabled fields
    const accountId = editingBudget
      ? editingBudget.accountId
      : (formData.get('budgetAccountId') as string) || defaultAccountId
    const categoryId = editingBudget
      ? editingBudget.categoryId
      : (formData.get('budgetCategoryId') as string)
    const planned = Number(formData.get('planned') || 0)

    // Skip categoryId validation in edit mode (field is disabled)
    const isValid = isEditingBudget
      ? validation.validateField('planned', String(planned))
      : validation.validateAll({ categoryId, planned: String(planned) })

    if (!isValid) {
      setFormErrors(validation.errors)
      return
    }

    const payload = {
      accountId,
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
        validation.setFieldsFromServer(serverErrors)
        toast.error('Unable to save budget.')
        return
      }
      toast.success(isEditingBudget ? 'Budget updated.' : 'Budget created.')
      setFormErrors(null)
      setEditingBudget(null)
      validation.resetAll()
      form.reset()
      router.refresh()
    })
  }

  const handleBudgetDelete = (categoryId: string, accountIdForBudget: string) => {
    const budgetKey = `${categoryId}-${accountIdForBudget}`
    setDeletingBudgetKey(budgetKey)

    startBudget(async () => {
      const result = await deleteBudgetAction({
        categoryId,
        accountId: accountIdForBudget,
        monthKey,
        csrfToken,
      })
      setDeletingBudgetKey(null)
      if ('error' in result) {
        toast.error('Unable to remove budget.')
        return
      }
      toast.success('Budget removed.')
      router.refresh()
    })
  }

  const handleBudgetEdit = useCallback((budget: DashboardBudget) => {
    setEditingBudget(budget)
    setFormErrors(null)
    validation.resetAll()

    requestAnimationFrame(() => {
      const form = budgetFormRef.current
      if (!form) {
        toast.error('Unable to load budget editor. Please try again.')
        setEditingBudget(null)
        return
      }

      const accountSelect = form.elements.namedItem('budgetAccountId') as HTMLSelectElement
      const categorySelect = form.elements.namedItem('budgetCategoryId') as HTMLSelectElement
      const plannedInput = form.elements.namedItem('planned') as HTMLInputElement
      const currencySelect = form.elements.namedItem('budgetCurrency') as HTMLSelectElement

      if (accountSelect) accountSelect.value = budget.accountId
      if (categorySelect) categorySelect.value = budget.categoryId
      if (plannedInput) plannedInput.value = String(budget.planned)
      if (currencySelect) currencySelect.value = preferredCurrency

      form.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [validation, preferredCurrency])

  const handleCancelBudgetEdit = useCallback(() => {
    setEditingBudget(null)
    setFormErrors(null)
    validation.resetAll()
    budgetFormRef.current?.reset()
  }, [validation])

  const handleIncomeGoalSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    setIncomeGoalErrors(null)
    const form = event.currentTarget
    const formData = new FormData(form)

    const amount = Number(formData.get('incomeGoalAmount') || 0)
    if (amount < 0.01) {
      setIncomeGoalErrors({ amount: ['Income goal must be at least 0.01'] })
      return
    }

    const payload = {
      accountId: (formData.get('incomeGoalAccountId') as string) || defaultAccountId,
      monthKey,
      amount,
      currency: (formData.get('incomeGoalCurrency') as Currency) || preferredCurrency,
      setAsDefault: formData.get('setAsDefault') === 'on',
      csrfToken,
    }

    startIncomeGoal(async () => {
      const result = await upsertMonthlyIncomeGoalAction(payload)
      if ('error' in result) {
        const serverErrors = result.error as FormErrors
        setIncomeGoalErrors(serverErrors)
        toast.error('Unable to save income goal.')
        return
      }
      toast.success('Income goal saved.')
      setIncomeGoalErrors(null)
      router.refresh()
    })
  }

  // Calculate income goal progress
  const incomeGoalAmount = monthlyIncomeGoal?.amount ?? 0
  const incomeProgress = incomeGoalAmount > 0 ? Math.min((actualIncome / incomeGoalAmount) * 100, 100) : 0
  const incomeRemaining = incomeGoalAmount > 0 ? incomeGoalAmount - actualIncome : 0

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
              const budgetKey = `${budget.categoryId}-${budget.accountId}`
              const isDeleting = deletingBudgetKey === budgetKey

              return (
                <div
                  key={`${budget.categoryId}-${budget.budgetId}`}
                  className={cn(
                    'rounded-2xl border border-white/10 bg-white/5 px-4 py-4',
                    isDeleting && 'opacity-50 animate-pulse',
                  )}
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
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs text-blue-200 hover:bg-blue-500/20"
                        onClick={() => handleBudgetEdit(budget)}
                        disabled={isDeleting || isPendingBudget}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs text-rose-200 hover:bg-rose-500/20"
                        onClick={() => handleBudgetDelete(budget.categoryId, budget.accountId)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? 'Removing...' : 'Remove'}
                      </Button>
                    </div>
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

          {/* Income Goal Section */}
          <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">Monthly income goal</h3>
              <p className="text-xs text-slate-400">
                Set an expected income target for freelancers or variable income.
                {monthlyIncomeGoal?.isDefault && ' (Using account default)'}
              </p>
            </div>

            {incomeGoalAmount > 0 ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-300">
                    Target: {formatCurrency(incomeGoalAmount, preferredCurrency)}
                  </span>
                  <span className="text-sm text-slate-300">
                    Actual: {formatCurrency(actualIncome, preferredCurrency)} ({Math.round(incomeProgress)}%)
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-valuenow={Math.round(incomeProgress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Income goal progress"
                >
                  <div
                    className="h-2 rounded-full bg-emerald-400/80 transition-all duration-300 ease-out"
                    style={{ width: `${incomeProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-300">
                  {incomeRemaining > 0
                    ? `${formatCurrency(incomeRemaining, preferredCurrency)} to go`
                    : 'Goal reached!'}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No income goal set for this month.</p>
            )}

            <form onSubmit={handleIncomeGoalSubmit} className="space-y-4 pt-2 border-t border-white/10">
              {incomeGoalErrors?.general && (
                <p className="text-xs text-rose-300">{incomeGoalErrors.general[0]}</p>
              )}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="incomeGoalAccountId">
                    Account
                  </label>
                  <Select
                    id="incomeGoalAccountId"
                    name="incomeGoalAccountId"
                    defaultValue={defaultAccountId}
                    options={accountsOptions}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="incomeGoalAmount">
                    Target amount
                  </label>
                  <Input
                    id="incomeGoalAmount"
                    name="incomeGoalAmount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={incomeGoalAmount || ''}
                    placeholder="e.g. 5000"
                  />
                  {incomeGoalErrors?.amount && (
                    <p className="text-xs text-rose-300">{incomeGoalErrors.amount[0]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="incomeGoalCurrency">
                    Currency
                  </label>
                  <Select
                    id="incomeGoalCurrency"
                    name="incomeGoalCurrency"
                    defaultValue={monthlyIncomeGoal?.currency || preferredCurrency}
                    options={currencyOptions}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="setAsDefault"
                  name="setAsDefault"
                  className="h-4 w-4 rounded border-white/20 bg-white/5 text-emerald-500"
                  defaultChecked={monthlyIncomeGoal?.isDefault}
                />
                <label htmlFor="setAsDefault" className="text-xs text-slate-300">
                  Use as default for future months
                </label>
              </div>
              <Button type="submit" loading={isPendingIncomeGoal} className="w-full" variant="outline">
                Save income goal
              </Button>
            </form>
          </div>

          <form
            id="budget-form"
            ref={budgetFormRef}
            onSubmit={handleBudgetSubmit}
            className={cn(
              'space-y-4 rounded-2xl border p-5',
              isEditingBudget
                ? 'border-blue-500/30 bg-blue-500/5'
                : 'border-white/10 bg-white/5',
            )}
            tabIndex={-1}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">
                  {isEditingBudget ? `Edit budget: ${editingBudget?.categoryName}` : 'Add or update a budget'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isEditingBudget
                    ? 'Update the planned amount. Account and category cannot be changed.'
                    : 'Capture limits for priority categories and accounts.'}
                </p>
              </div>
              {isEditingBudget && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-xs text-slate-300 hover:bg-white/10"
                  onClick={handleCancelBudgetEdit}
                >
                  Cancel
                </Button>
              )}
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
                  disabled={isEditingBudget}
                  title={isEditingBudget ? 'Account cannot be changed when editing a budget' : undefined}
                />
                {isEditingBudget && (
                  <p className="text-xs text-slate-500">Account is part of the budget key and cannot be changed.</p>
                )}
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
                  disabled={isEditingBudget}
                  title={isEditingBudget ? 'Category cannot be changed when editing a budget' : undefined}
                  onBlur={(e) => validation.validateField('categoryId', e.target.value)}
                  onChange={() => validation.getFieldProps('categoryId').onChange()}
                  error={validation.fields.categoryId?.touched && !!validation.fields.categoryId?.error}
                  valid={validation.fields.categoryId?.touched && validation.fields.categoryId?.valid}
                  aria-describedby={
                    formErrors?.categoryId || validation.fields.categoryId?.error
                      ? 'budget-categoryId-error'
                      : undefined
                  }
                />
                {isEditingBudget ? (
                  <p className="text-xs text-slate-500">Category is part of the budget key and cannot be changed.</p>
                ) : (
                  (formErrors?.categoryId || validation.fields.categoryId?.error) && (
                    <p id="budget-categoryId-error" className="text-xs text-rose-300" role="alert">
                      {formErrors?.categoryId?.[0] || validation.fields.categoryId?.error}
                    </p>
                  )
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
                  required
                  onBlur={(e) => validation.validateField('planned', e.target.value)}
                  onChange={() => validation.getFieldProps('planned').onChange()}
                  error={validation.fields.planned?.touched && !!validation.fields.planned?.error}
                  valid={validation.fields.planned?.touched && validation.fields.planned?.valid}
                  aria-describedby={
                    formErrors?.planned || validation.fields.planned?.error ? 'budget-planned-error' : undefined
                  }
                />
                {(formErrors?.planned || validation.fields.planned?.error) && (
                  <p id="budget-planned-error" className="text-xs text-rose-300" role="alert">
                    {formErrors?.planned?.[0] || validation.fields.planned?.error}
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
              {isEditingBudget ? 'Update budget' : 'Save budget'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
