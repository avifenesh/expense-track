'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TransactionType, Currency } from '@prisma/client'
import { Repeat } from 'lucide-react'
import {
  applyRecurringTemplatesAction,
  toggleRecurringTemplateAction,
  upsertRecurringTemplateAction,
} from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { filterRecurringTemplates } from '@/lib/dashboard-ux'
import { createAccountOptions } from '@/lib/select-options'
import { RecurringTemplateSummary } from '@/lib/finance'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/utils/cn'
import { toast } from '@/hooks/useToast'
import { useCsrfToken } from '@/hooks/useCsrfToken'
import {
  DashboardCategory,
  DashboardAccount,
  DashboardRecurringTemplate,
  transactionTypeOptions,
  typeFilterOptions,
  currencyOptions,
} from './types'

type FormErrors = Partial<Record<string, string[]>>

export type RecurringTabProps = {
  recurringTemplates: DashboardRecurringTemplate[]
  accounts: DashboardAccount[]
  categories: DashboardCategory[]
  activeAccount: string
  monthKey: string
  preferredCurrency: Currency
}

export function RecurringTab({
  recurringTemplates,
  accounts,
  categories,
  activeAccount,
  monthKey,
  preferredCurrency,
}: RecurringTabProps) {
  const router = useRouter()
  const csrfToken = useCsrfToken()

  // Local state
  const [recurringTypeFilter, setRecurringTypeFilter] = useState<'all' | TransactionType>('all')
  const [recurringAccountFilter, setRecurringAccountFilter] = useState<string>(activeAccount)
  const [showInactiveRecurring, setShowInactiveRecurring] = useState(false)
  const [isPendingRecurring, startRecurring] = useTransition()
  const [formErrors, setFormErrors] = useState<FormErrors | null>(null)

  // Derived options
  const accountsOptions = useMemo(() => createAccountOptions(accounts), [accounts])

  const defaultAccountId = activeAccount || accounts[0]?.id || ''

  // Computed
  const filteredRecurring = useMemo(
    () =>
      filterRecurringTemplates(recurringTemplates, {
        type: recurringTypeFilter,
        includeInactive: showInactiveRecurring,
        accountId: recurringAccountFilter || undefined,
      }),
    [recurringTemplates, recurringTypeFilter, showInactiveRecurring, recurringAccountFilter],
  )

  const activeRecurringTemplates = useMemo(
    () => filteredRecurring.filter((template) => template.isActive),
    [filteredRecurring],
  )

  const inactiveRecurringTemplates = useMemo(
    () => filteredRecurring.filter((template) => !template.isActive),
    [filteredRecurring],
  )

  // Handlers
  const handleRecurringSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    setFormErrors(null)
    const form = event.currentTarget
    const formData = new FormData(form)

    const errors: FormErrors = {}
    const categoryId = formData.get('recurringCategoryId') as string
    const amount = Number(formData.get('recurringAmount') || 0)
    const startMonth = formData.get('startMonth') as string

    if (!categoryId) {
      errors.categoryId = ['Please select a category.']
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      errors.amount = ['Enter an amount greater than zero.']
    }

    if (!startMonth) {
      errors.startMonth = ['Please select a start month.']
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    const payload = {
      accountId: (formData.get('recurringAccountId') as string) || defaultAccountId,
      categoryId,
      type: formData.get('recurringType') as TransactionType,
      amount,
      currency: (formData.get('recurringCurrency') as Currency) || Currency.USD,
      dayOfMonth: Number(formData.get('dayOfMonth') || 1),
      description: (formData.get('recurringDescription') as string) || undefined,
      startMonthKey: startMonth,
      endMonthKey: (formData.get('endMonth') as string) || undefined,
      isActive: true,
      csrfToken,
    }

    startRecurring(async () => {
      const result = await upsertRecurringTemplateAction(payload)
      if ('error' in result) {
        const serverErrors = result.error as FormErrors
        setFormErrors(serverErrors)
        toast.error('Unable to save template.')
        return
      }
      toast.success('Recurring template saved.')
      setFormErrors(null)
      form.reset()
      router.refresh()
    })
  }

  const handleRecurringToggle = (template: RecurringTemplateSummary, isActive: boolean) => {
    startRecurring(async () => {
      const result = await toggleRecurringTemplateAction({ id: template.id, isActive, csrfToken })
      if ('error' in result) {
        toast.error('Unable to update template.')
        return
      }
      toast.success(isActive ? 'Template re-activated.' : 'Template paused.')
      router.refresh()
    })
  }

  const handleRecurringApply = () => {
    startRecurring(async () => {
      const result = await applyRecurringTemplatesAction({ monthKey, accountId: activeAccount, csrfToken })
      if ('error' in result) {
        toast.error('Unable to apply templates.')
        return
      }
      const created = result.data?.created ?? 0
      if (created === 0) {
        toast.success('No new recurring items were added for this month.')
      } else {
        toast.success(`${created} recurring item${created > 1 ? 's' : ''} added.`)
      }
      router.refresh()
    })
  }

  return (
    <div role="tabpanel" id="panel-recurring" aria-labelledby="tab-recurring" className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[3fr,2fr]">
        <Card className="border-white/15 bg-white/10">
          <CardHeader className="gap-1">
            <CardTitle
              className="text-lg font-semibold text-white"
              helpText="Manage repeating templates, adjust schedules, and toggle the plans that automate your ledger."
            >
              Recurring plans
            </CardTitle>
            <p className="text-sm text-slate-400">
              Keep predictable cashflow on schedule and pause templates when plans change.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300" htmlFor="recurring-filter-type">
                  Type filter
                </label>
                <Select
                  id="recurring-filter-type"
                  value={recurringTypeFilter}
                  onChange={(event) => setRecurringTypeFilter(event.target.value as typeof recurringTypeFilter)}
                  options={typeFilterOptions}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300" htmlFor="recurring-filter-account">
                  Account filter
                </label>
                <Select
                  id="recurring-filter-account"
                  value={recurringAccountFilter || accountsOptions[0]?.value || ''}
                  onChange={(event) => setRecurringAccountFilter(event.target.value)}
                  options={accountsOptions}
                  disabled={accountsOptions.length === 0}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="secondary"
                  className="text-xs"
                  onClick={() => setShowInactiveRecurring((prev) => !prev)}
                >
                  {showInactiveRecurring ? 'Hide paused templates' : 'Show paused templates'}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Log a new template</h3>
                  <p className="text-xs text-slate-400">Define recurring amounts, cadence, and lifecycle.</p>
                </div>
                <Button type="button" variant="secondary" className="text-xs" onClick={handleRecurringApply}>
                  Apply templates this month
                </Button>
              </div>
              <form
                id="recurring-form"
                onSubmit={handleRecurringSubmit}
                className="grid gap-4 sm:grid-cols-2"
                tabIndex={-1}
              >
                {formErrors?.general && <p className="text-xs text-rose-300 sm:col-span-2">{formErrors.general[0]}</p>}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="recurringType">
                    Type
                  </label>
                  <Select
                    id="recurringType"
                    name="recurringType"
                    options={transactionTypeOptions}
                    defaultValue={TransactionType.EXPENSE}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="recurringAccountId">
                    Account
                  </label>
                  <Select
                    id="recurringAccountId"
                    name="recurringAccountId"
                    defaultValue={defaultAccountId}
                    options={accountsOptions}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="recurringCategoryId">
                    Category
                  </label>
                  <Select
                    id="recurringCategoryId"
                    name="recurringCategoryId"
                    options={categories
                      .filter((category) => !category.isArchived)
                      .map((category) => ({ label: category.name, value: category.id }))}
                    required
                    aria-describedby={formErrors?.categoryId ? 'recurring-categoryId-error' : undefined}
                  />
                  {formErrors?.categoryId && (
                    <p id="recurring-categoryId-error" className="text-xs text-rose-300">
                      {formErrors.categoryId[0]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="recurringAmount">
                    Amount
                  </label>
                  <Input
                    name="recurringAmount"
                    id="recurringAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    aria-describedby={formErrors?.amount ? 'recurring-amount-error' : undefined}
                  />
                  {formErrors?.amount && (
                    <p id="recurring-amount-error" className="text-xs text-rose-300">
                      {formErrors.amount[0]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="recurringCurrency">
                    Currency
                  </label>
                  <Select
                    id="recurringCurrency"
                    name="recurringCurrency"
                    defaultValue={Currency.USD}
                    options={currencyOptions}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="dayOfMonth">
                    Day of month
                  </label>
                  <Input name="dayOfMonth" id="dayOfMonth" type="number" min="1" max="28" defaultValue={1} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="recurringDescription">
                    Description (optional)
                  </label>
                  <Input name="recurringDescription" id="recurringDescription" placeholder="Gym membership" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="startMonth">
                    Start month
                  </label>
                  <Input
                    name="startMonth"
                    id="startMonth"
                    type="month"
                    required
                    aria-describedby={formErrors?.startMonth ? 'recurring-startMonth-error' : undefined}
                  />
                  {formErrors?.startMonth && (
                    <p id="recurring-startMonth-error" className="text-xs text-rose-300">
                      {formErrors.startMonth[0]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="endMonth">
                    End month (optional)
                  </label>
                  <Input name="endMonth" id="endMonth" type="month" />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" loading={isPendingRecurring} className="w-full">
                    Save recurring template
                  </Button>
                </div>
              </form>
            </div>

            <div className="space-y-3">
              {filteredRecurring.length === 0 && (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
                  <div className="rounded-full bg-white/10 p-3">
                    <Repeat className="h-6 w-6 text-slate-300" />
                  </div>
                  {recurringTemplates.length === 0 ? (
                    <>
                      <p className="text-sm font-medium text-white">No auto-repeat items</p>
                      <p className="text-xs text-slate-400">
                        Set up recurring income or expenses that repeat each month.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-white">No matching templates</p>
                      <p className="text-xs text-slate-400">Try adjusting the filters above.</p>
                    </>
                  )}
                </div>
              )}
              {activeRecurringTemplates.map((template) => (
                <div
                  key={template.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 shadow-sm md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 font-medium text-white">
                      <span>{template.categoryName}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        {template.accountName}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {template.type === TransactionType.EXPENSE ? 'Expense' : 'Income'} ·{' '}
                      {formatCurrency(template.amount, preferredCurrency)} · Day {template.dayOfMonth}
                    </div>
                    <div className="text-xs text-slate-400">{template.description || 'No description'}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      className={cn('text-xs', template.isActive ? 'text-slate-400' : 'text-emerald-600')}
                      onClick={() => handleRecurringToggle(template, !template.isActive)}
                    >
                      {template.isActive ? 'Pause' : 'Activate'}
                    </Button>
                  </div>
                </div>
              ))}
              {showInactiveRecurring && inactiveRecurringTemplates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-300">Paused templates</p>
                  {inactiveRecurringTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 shadow-sm md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 font-medium text-white">
                          <span>{template.categoryName}</span>
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-200">
                            {template.accountName}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300">
                          {template.type === TransactionType.EXPENSE ? 'Expense' : 'Income'} ·{' '}
                          {formatCurrency(template.amount, preferredCurrency)} · Day {template.dayOfMonth}
                        </div>
                        <div className="text-xs text-slate-400">{template.description || 'No description'}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-xs text-emerald-200 hover:bg-emerald-500/20"
                          onClick={() => handleRecurringToggle(template, true)}
                        >
                          Activate
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/15 bg-white/10">
          <CardHeader>
            <CardTitle
              className="text-lg font-semibold text-white"
              helpText="Summarizes recurring template volume so you can compare automated flows to your monthly targets."
            >
              Template focus
            </CardTitle>
            <p className="text-sm text-slate-400">See how recurring amounts stack up against your monthly net.</p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-300">Active templates</p>
              <p className="mt-2 text-2xl font-semibold text-white">{activeRecurringTemplates.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-300">Total monthly obligation</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {formatCurrency(
                  activeRecurringTemplates
                    .filter((t) => t.type === TransactionType.EXPENSE)
                    .reduce((sum, template) => sum + template.amount, 0),
                  preferredCurrency,
                )}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-300">Expected recurring income</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {formatCurrency(
                  activeRecurringTemplates
                    .filter((t) => t.type === TransactionType.INCOME)
                    .reduce((sum, template) => sum + template.amount, 0),
                  preferredCurrency,
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
