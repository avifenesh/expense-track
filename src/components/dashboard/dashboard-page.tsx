'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { TransactionType, Currency, AccountType } from '@prisma/client'
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  CreditCard,
  FileSpreadsheet,
  Gauge,
  Layers,
  PiggyBank,
  RefreshCcw,
  Repeat,
  Sparkles,
  Tags,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  archiveCategoryAction,
  applyRecurringTemplatesAction,
  createCategoryAction,
  createTransactionAction,
  updateTransactionAction,
  deleteBudgetAction,
  deleteTransactionAction,
  logoutAction,
  toggleRecurringTemplateAction,
  upsertBudgetAction,
  upsertRecurringTemplateAction,
  persistActiveAccountAction,
  refreshExchangeRatesAction,
  createHoldingAction,
  deleteHoldingAction,
  refreshHoldingPricesAction,
} from '@/app/actions'
import { Sparkline } from '@/components/dashboard/sparkline'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DashboardData, RecurringTemplateSummary } from '@/lib/finance'
import {
  filterBudgets,
  getBudgetProgress,
  getHighlightedBudgets,
  filterTransactions,
  filterRecurringTemplates,
  filterCategories,
  getBudgetTotals,
} from '@/lib/dashboard-ux'
import { formatCurrency, formatRelativeAmount } from '@/utils/format'
import { formatMonthLabel, shiftMonth } from '@/utils/date'
import { cn } from '@/utils/cn'

export function normalizeDateInput(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }

  const [yearPart, monthPart, dayPart] = value.split('-')
  if (!yearPart || !monthPart || !dayPart) {
    return null
  }

  const year = Number(yearPart)
  const monthIndex = Number(monthPart) - 1
  const day = Number(dayPart)

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) {
    return null
  }
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) {
    return null
  }

  const utcDate = new Date(Date.UTC(year, monthIndex, day))

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== monthIndex ||
    utcDate.getUTCDate() !== day
  ) {
    return null
  }

  return utcDate
}

type Feedback = { type: 'success' | 'error'; message: string }
type TabValue = 'overview' | 'budgets' | 'transactions' | 'recurring' | 'categories' | 'holdings'

type DashboardPageProps = {
  data: DashboardData
  monthKey: string
  accountId: string
}

type DashboardTransaction = DashboardData['transactions'][number]

const transactionTypeOptions = [
  { label: 'Expense', value: TransactionType.EXPENSE },
  { label: 'Income', value: TransactionType.INCOME },
]

const typeFilterOptions = [
  { label: 'All types', value: 'all' as const },
  { label: 'Expense', value: TransactionType.EXPENSE },
  { label: 'Income', value: TransactionType.INCOME },
]

const currencyOptions = [
  { label: '$ USD', value: Currency.USD },
  { label: '€ EUR', value: Currency.EUR },
  { label: '₪ ILS', value: Currency.ILS },
]

const TABS: Array<{
  value: TabValue
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { value: 'overview', label: 'Overview', description: 'Review trends, forecasts, and highlighted budgets.', icon: Gauge },
  { value: 'budgets', label: 'Budgets', description: 'Plan spending by account and category with progress tracking.', icon: FileSpreadsheet },
  { value: 'transactions', label: 'Transactions', description: 'Capture new activity and reconcile existing entries.', icon: CreditCard },
  { value: 'recurring', label: 'Recurring', description: 'Manage predictable inflows and outflows over time.', icon: Repeat },
  { value: 'categories', label: 'Categories', description: 'Curate the taxonomy that powers reports and automations.', icon: Tags },
  { value: 'holdings', label: 'Holdings', description: 'Track stocks, ETFs, and investment portfolios with live valuations.', icon: TrendingUp },
]

const STAT_VARIANT_STYLES: Record<NonNullable<DashboardData['stats'][number]['variant']>, {
  border: string
  chip: string
  chipText: string
  icon: string
}> = {
  positive: {
    border: 'border-emerald-400/40',
    chip: 'bg-emerald-400/20',
    chipText: 'text-emerald-200',
    icon: 'text-emerald-200',
  },
  negative: {
    border: 'border-rose-400/40',
    chip: 'bg-rose-400/20',
    chipText: 'text-rose-200',
    icon: 'text-rose-200',
  },
  neutral: {
    border: 'border-white/15',
    chip: 'bg-white/15',
    chipText: 'text-slate-200',
    icon: 'text-slate-200',
  },
}

const STAT_TOOLTIPS: Record<string, string> = {
  'Actual net': 'Reflects all income minus expenses captured for the current month.',
  'Projected end of month': 'Blends current activity with budget forecasts to estimate month-end balance.',
  'Remaining budgets': 'Shows unspent expense allocations so you know how much room is left.',
  'Planned net': 'Represents the net position if every monthly budget posts as scheduled.',
}

const DEFAULT_STAT_TOOLTIP = 'Monitors this monthly metric based on your recorded data and budgets.'

function resolveStatIcon(label: string) {
  const normalized = label.toLowerCase()
  if (normalized.includes('expense') || normalized.includes('outflow')) {
    return PiggyBank
  }
  if (normalized.includes('income') || normalized.includes('inflow')) {
    return Wallet
  }
  if (normalized.includes('budget')) {
    return Layers
  }
  return TrendingUp
}

export function DashboardPage({ data, monthKey, accountId }: DashboardPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Get user's preferred currency for formatting
  const preferredCurrency = data.preferredCurrency || Currency.USD

  const initialAccountId = accountId ?? data.accounts[0]?.id ?? ''
  const initialAccountRecord = data.accounts.find((account) => account.id === initialAccountId) ?? null
  const defaultExpenseCategoryId =
    data.categories.find((category) => category.type === TransactionType.EXPENSE && !category.isArchived)?.id ?? ''
  const initialTransactionAccountFilterValue =
    initialAccountRecord?.type === AccountType.JOINT ? 'all' : initialAccountId
  const [activeAccount, setActiveAccount] = useState<string>(initialAccountId)
  const [transactionFormState, setTransactionFormState] = useState<{
    type: TransactionType
    accountId: string
    categoryId: string
    amount: string
    currency: Currency
    date: string
    description: string
    isRecurring: boolean
    isMutual: boolean
  }>({
    type: TransactionType.EXPENSE,
    accountId: initialAccountId,
    categoryId: defaultExpenseCategoryId,
    amount: '',
    currency: Currency.USD,
    date: `${monthKey}-01`,
    description: '',
    isRecurring: false,
    isMutual: false,
  })
  const [editingTransaction, setEditingTransaction] = useState<DashboardTransaction | null>(null)
  const [transactionFeedback, setTransactionFeedback] = useState<Feedback | null>(null)
  const [budgetFeedback, setBudgetFeedback] = useState<Feedback | null>(null)
  const [recurringFeedback, setRecurringFeedback] = useState<Feedback | null>(null)
  const [categoryFeedback, setCategoryFeedback] = useState<Feedback | null>(null)
  const [accountFeedback, setAccountFeedback] = useState<Feedback | null>(null)
  const [activeTab, setActiveTab] = useState<TabValue>('overview')
  const [budgetAccountFilter, setBudgetAccountFilter] = useState<string>(initialAccountId)
  const [budgetTypeFilter, setBudgetTypeFilter] = useState<'all' | TransactionType>('all')
  const [transactionFilterType, setTransactionFilterType] = useState<'all' | TransactionType>('all')
  const [transactionAccountFilter, setTransactionAccountFilter] = useState<string>(initialTransactionAccountFilterValue)
  const [transactionSearch, setTransactionSearch] = useState('')
  const [recurringTypeFilter, setRecurringTypeFilter] = useState<'all' | TransactionType>('all')
  const [recurringAccountFilter, setRecurringAccountFilter] = useState<string>(initialAccountId)
  const [showInactiveRecurring, setShowInactiveRecurring] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<'all' | TransactionType>('all')
  const [showArchivedCategories, setShowArchivedCategories] = useState(false)

  const [isPendingTransaction, startTransaction] = useTransition()
  const [isPendingBudget, startBudget] = useTransition()
  const [isPendingRecurring, startRecurring] = useTransition()
  const [isPendingCategory, startCategory] = useTransition()
  const [isPendingAccount, startPersistAccount] = useTransition()
  const [isPendingLogout, startLogout] = useTransition()
  const [isPendingRates, startRates] = useTransition()

  const accountsOptions = useMemo(
    () => data.accounts.map((account) => ({ label: account.name, value: account.id })),
    [data.accounts],
  )

  const activeAccountRecord = useMemo(
    () => data.accounts.find((account) => account.id === activeAccount) ?? null,
    [data.accounts, activeAccount],
  )
  const isJointAccountView = activeAccountRecord?.type === AccountType.JOINT

  const transactionAccountOptions = useMemo(() => {
    if (!isJointAccountView) {
      return accountsOptions
    }

    return [{ label: 'All accounts', value: 'all' }, ...accountsOptions]
  }, [accountsOptions, isJointAccountView])

  const selfAccountName = useMemo(
    () => data.accounts.find((account) => account.type === AccountType.SELF)?.name ?? 'Self',
    [data.accounts],
  )

  const partnerAccountName = useMemo(
    () => data.accounts.find((account) => account.type === AccountType.PARTNER)?.name ?? 'Partner',
    [data.accounts],
  )

  const getDefaultCategoryId = useCallback(
    (type: TransactionType) =>
      data.categories.find((category) => category.type === type && !category.isArchived)?.id ?? '',
    [data.categories],
  )

  const defaultTransactionAccountFilter =
    activeAccountRecord?.type === AccountType.JOINT ? 'all' : activeAccount || ''

  const mutualSummaryForView = isJointAccountView ? data.mutualSummary : undefined

  const mutualSummaryDisplay = useMemo(() => {
    if (!mutualSummaryForView) {
      return null
    }

    const ratioText = `Split: 2/3 ${mutualSummaryForView.selfAccountName} · 1/3 ${mutualSummaryForView.partnerAccountName}.`

    if (mutualSummaryForView.status === 'settled' || mutualSummaryForView.amount <= 0.01) {
      return {
        headline: 'Shared expenses are settled for this month.',
        helper: ratioText,
      }
    }

    const formattedAmount = formatCurrency(mutualSummaryForView.amount, preferredCurrency)

    if (mutualSummaryForView.status === 'partner-owes-self') {
      return {
        headline: `${mutualSummaryForView.partnerAccountName} owes ${mutualSummaryForView.selfAccountName} ${formattedAmount}.`,
        helper: ratioText,
      }
    }

    return {
      headline: `${mutualSummaryForView.selfAccountName} owes ${mutualSummaryForView.partnerAccountName} ${formattedAmount}.`,
      helper: ratioText,
    }
  }, [mutualSummaryForView, preferredCurrency])

  const isEditingTransaction = Boolean(editingTransaction)

  useEffect(() => {
    if (!accountId) return
    setActiveAccount(accountId)
  }, [accountId])

  useEffect(() => {
    if (!accountFeedback) return
    const timer = window.setTimeout(() => setAccountFeedback(null), 4000)
    return () => window.clearTimeout(timer)
  }, [accountFeedback])

  const filteredCategories = useMemo(
    () => data.categories.filter((category) => category.type === transactionFormState.type && !category.isArchived),
    [data.categories, transactionFormState.type],
  )

  const transactionCategoryOptions = useMemo(
    () => filteredCategories.map((category) => ({ label: category.name, value: category.id })),
    [filteredCategories],
  )

  const holdingsCategories = useMemo(
    () => data.categories.filter((category) => category.isHolding),
    [data.categories],
  )

  const defaultAccountId = activeAccount || data.accounts[0]?.id || ''

  const historyWithLabels = data.history.map((point) => ({
    ...point,
    label: formatMonthLabel(point.month),
  }))

  const netHistory = historyWithLabels.map((point) => point.net)
  const latestHistory = historyWithLabels.at(-1)
  const previousHistory = historyWithLabels.at(-2)
  const netDelta = latestHistory && previousHistory ? latestHistory.net - previousHistory.net : 0
  const netStat = data.stats.find((stat) => stat.label.toLowerCase().includes('net'))
  const [highlightLimit] = useState(3)

  useEffect(() => {
    if (!activeAccount) return
    setBudgetAccountFilter(activeAccount)
    setTransactionAccountFilter(defaultTransactionAccountFilter)
    setRecurringAccountFilter(activeAccount)
  }, [activeAccount, activeAccountRecord, defaultTransactionAccountFilter])

  useEffect(() => {
    if (!activeAccount || editingTransaction) return
    setTransactionFormState((prev) => ({
      ...prev,
      accountId: activeAccount,
    }))
  }, [activeAccount, editingTransaction])

  useEffect(() => {
    if (editingTransaction) return
    if (filteredCategories.length === 0) {
      setTransactionFormState((prev) => ({ ...prev, categoryId: '' }))
      return
    }

    setTransactionFormState((prev) => {
      if (filteredCategories.some((category) => category.id === prev.categoryId)) {
        return prev
      }

      return {
        ...prev,
        categoryId: filteredCategories[0].id,
      }
    })
  }, [filteredCategories, editingTransaction])

  useEffect(() => {
    if (editingTransaction) return
    setTransactionFormState((prev) => ({
      ...prev,
      date: `${monthKey}-01`,
    }))
  }, [monthKey, editingTransaction])

  const resetTransactionForm = useCallback(() => {
    const fallbackAccountId = activeAccount || data.accounts[0]?.id || ''
    setTransactionFormState({
      type: TransactionType.EXPENSE,
      accountId: fallbackAccountId,
      categoryId: getDefaultCategoryId(TransactionType.EXPENSE),
      amount: '',
      currency: Currency.USD,
      date: `${monthKey}-01`,
      description: '',
      isRecurring: false,
      isMutual: false,
    })
    setEditingTransaction(null)
  }, [activeAccount, data.accounts, getDefaultCategoryId, monthKey])

  const handleTransactionTypeChange = useCallback(
    (nextType: TransactionType) => {
      setTransactionFormState((prev) => {
        const categoryStillValid = data.categories.some(
          (category) => category.id === prev.categoryId && category.type === nextType && !category.isArchived,
        )
        const nextCategoryId = categoryStillValid ? prev.categoryId : getDefaultCategoryId(nextType)

        return {
          ...prev,
          type: nextType,
          categoryId: nextCategoryId,
          isMutual: nextType === TransactionType.EXPENSE ? prev.isMutual : false,
        }
      })
    },
    [data.categories, getDefaultCategoryId],
  )

  const handleTransactionEdit = useCallback(
    (transaction: DashboardTransaction) => {
      setActiveTab('transactions')
      setEditingTransaction(transaction)
      const isoDate = new Date(transaction.date).toISOString().slice(0, 10)
      setTransactionFormState({
        type: transaction.type,
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
        amount: transaction.amount.toFixed(2),
        currency: transaction.currency,
        date: isoDate,
        description: transaction.description ?? '',
        isRecurring: transaction.isRecurring,
        isMutual: transaction.type === TransactionType.EXPENSE ? (transaction.isMutual ?? false) : false,
      })
      setTransactionFeedback(null)
    },
    [],
  )

  const handleCancelTransactionEdit = useCallback(() => {
    resetTransactionForm()
    setTransactionFeedback(null)
  }, [resetTransactionForm])

  const filteredBudgets = useMemo(
    () =>
      filterBudgets(data.budgets, {
        accountId: budgetAccountFilter || undefined,
        type: budgetTypeFilter,
      }),
    [data.budgets, budgetAccountFilter, budgetTypeFilter],
  )

  const highlightedBudgets = useMemo(
    () => getHighlightedBudgets(filterBudgets(data.budgets, { accountId: activeAccount || undefined }), highlightLimit),
    [data.budgets, activeAccount, highlightLimit],
  )

  const budgetTotals = useMemo(() => getBudgetTotals(filteredBudgets), [filteredBudgets])

  const filteredTransactions = useMemo(
    () =>
      filterTransactions(data.transactions, {
        type: transactionFilterType,
        search: transactionSearch,
        accountId:
          transactionAccountFilter === 'all' ? undefined : transactionAccountFilter || undefined,
      }),
    [data.transactions, transactionFilterType, transactionSearch, transactionAccountFilter],
  )

  const filteredRecurring = useMemo(
    () =>
      filterRecurringTemplates(data.recurringTemplates, {
        type: recurringTypeFilter,
        includeInactive: showInactiveRecurring,
        accountId: recurringAccountFilter || undefined,
      }),
    [data.recurringTemplates, recurringTypeFilter, showInactiveRecurring, recurringAccountFilter],
  )

  const activeRecurringTemplates = useMemo(
    () => filteredRecurring.filter((template) => template.isActive),
    [filteredRecurring],
  )

  const inactiveRecurringTemplates = useMemo(
    () => filteredRecurring.filter((template) => !template.isActive),
    [filteredRecurring],
  )

  const filteredCategoryList = useMemo(
    () =>
      filterCategories(data.categories, {
        search: categorySearch,
        type: categoryTypeFilter,
        includeArchived: showArchivedCategories,
      }),
    [data.categories, categorySearch, categoryTypeFilter, showArchivedCategories],
  )

  const handleParamUpdate = (key: string, value?: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const handleMonthChange = (direction: number) => {
    const nextKey = shiftMonth(monthKey, direction)
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', nextKey)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const handleAccountSelect = (value: string) => {
    setActiveAccount(value)
    handleParamUpdate('account', value)
    const accountLabel = accountsOptions.find((option) => option.value === value)?.label ?? 'Account'
    startPersistAccount(async () => {
      const result = await persistActiveAccountAction({ accountId: value })
      if (result?.error) {
        const firstErrorSet = Object.values(result.error)[0]
        const message: string =
          Array.isArray(firstErrorSet) && firstErrorSet.length > 0
            ? firstErrorSet[0] ?? 'Unable to remember selection.'
            : 'Unable to remember selection.'
        setAccountFeedback({ type: 'error', message })
        return
      }
      setAccountFeedback({ type: 'success', message: `${accountLabel} will open by default next time.` })
    })
  }

  const handleLogout = () => {
    startLogout(async () => {
      await logoutAction()
      router.push('/login')
      router.refresh()
    })
  }

  const handleRefreshRates = () => {
    startRates(async () => {
      await refreshExchangeRatesAction()
      router.refresh()
    })
  }

  const handleTransactionSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()

    if (!transactionFormState.categoryId) {
      setTransactionFeedback({ type: 'error', message: 'Please select a category.' })
      return
    }

    const dateInput = normalizeDateInput(transactionFormState.date)
    if (!dateInput) {
      setTransactionFeedback({ type: 'error', message: 'Please select a valid date.' })
      return
    }

    const parsedAmount = Number.parseFloat(transactionFormState.amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setTransactionFeedback({ type: 'error', message: 'Enter an amount greater than zero.' })
      return
    }

    const description = transactionFormState.description.trim()

    const payload = {
      accountId: transactionFormState.accountId || activeAccount || defaultAccountId,
      categoryId: transactionFormState.categoryId,
      type: transactionFormState.type,
      amount: parsedAmount,
      currency: transactionFormState.currency,
      date: dateInput,
      description: description.length > 0 ? description : undefined,
      isRecurring: transactionFormState.isRecurring,
      isMutual: transactionFormState.type === TransactionType.EXPENSE && transactionFormState.isMutual,
    }

    startTransaction(async () => {
      const result = editingTransaction
        ? await updateTransactionAction({ id: editingTransaction.id, ...payload })
        : await createTransactionAction(payload)

      if (result?.error) {
        setTransactionFeedback({
          type: 'error',
          message: editingTransaction
            ? 'Unable to update transaction. Please check required fields.'
            : 'Unable to save transaction. Please check required fields.',
        })
        return
      }

      setTransactionFeedback({
        type: 'success',
        message: editingTransaction ? 'Transaction updated.' : 'Transaction saved.',
      })
      resetTransactionForm()
      router.refresh()
    })
  }

  const handleTransactionDelete = (id: string) => {
    startTransaction(async () => {
      const result = await deleteTransactionAction({ id })
      if (result?.error) {
        setTransactionFeedback({ type: 'error', message: 'Could not delete transaction.' })
        return
      }
      if (editingTransaction?.id === id) {
        resetTransactionForm()
      }
      setTransactionFeedback({ type: 'success', message: 'Transaction removed.' })
      router.refresh()
    })
  }

  const handleBudgetSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    const payload = {
      accountId: (formData.get('budgetAccountId') as string) || defaultAccountId,
      categoryId: formData.get('budgetCategoryId') as string,
      monthKey,
      planned: Number(formData.get('planned') || 0),
      currency: (formData.get('budgetCurrency') as Currency) || Currency.USD,
      notes: (formData.get('notes') as string) || undefined,
    }

    startBudget(async () => {
      const result = await upsertBudgetAction(payload)
      if (result?.error) {
        setBudgetFeedback({ type: 'error', message: 'Could not save budget.' })
        return
      }
      setBudgetFeedback({ type: 'success', message: 'Budget updated.' })
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
      })
      if (result?.error) {
        setBudgetFeedback({ type: 'error', message: 'Could not remove budget entry.' })
        return
      }
      setBudgetFeedback({ type: 'success', message: 'Budget removed.' })
      router.refresh()
    })
  }

  const handleRecurringSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    const payload = {
      accountId: (formData.get('recurringAccountId') as string) || defaultAccountId,
      categoryId: formData.get('recurringCategoryId') as string,
      type: formData.get('recurringType') as TransactionType,
      amount: Number(formData.get('recurringAmount') || 0),
      currency: (formData.get('recurringCurrency') as Currency) || Currency.USD,
      dayOfMonth: Number(formData.get('dayOfMonth') || 1),
      description: (formData.get('recurringDescription') as string) || undefined,
      startMonthKey: formData.get('startMonth') as string,
      endMonthKey: (formData.get('endMonth') as string) || undefined,
      isActive: true,
    }

    startRecurring(async () => {
      const result = await upsertRecurringTemplateAction(payload)
      if (result?.error) {
        setRecurringFeedback({ type: 'error', message: 'Could not save recurring template.' })
        return
      }
      setRecurringFeedback({ type: 'success', message: 'Recurring template saved.' })
      form.reset()
      router.refresh()
    })
  }

  const handleRecurringToggle = (template: RecurringTemplateSummary, isActive: boolean) => {
    startRecurring(async () => {
      const result = await toggleRecurringTemplateAction({ id: template.id, isActive })
      if (result?.error) {
        setRecurringFeedback({ type: 'error', message: 'Could not update recurring template.' })
        return
      }
      setRecurringFeedback({ type: 'success', message: isActive ? 'Template re-activated.' : 'Template paused.' })
      router.refresh()
    })
  }

  const handleRecurringApply = () => {
    startRecurring(async () => {
      const result = await applyRecurringTemplatesAction({ monthKey, accountId: activeAccount })
      if (result?.error) {
        setRecurringFeedback({ type: 'error', message: 'Could not apply recurring items.' })
        return
      }
      const created = result?.created ?? 0
      if (created === 0) {
        setRecurringFeedback({ type: 'success', message: 'No new recurring items were added for this month.' })
      } else {
        setRecurringFeedback({ type: 'success', message: `${created} recurring item${created > 1 ? 's' : ''} added.` })
      }
      router.refresh()
    })
  }

  const handleCategorySubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    const payload = {
      name: formData.get('categoryName') as string,
      type: formData.get('categoryType') as TransactionType,
      color: (formData.get('categoryColor') as string) || undefined,
    }

    startCategory(async () => {
      const result = await createCategoryAction(payload)
      if (result?.error) {
        setCategoryFeedback({ type: 'error', message: 'Could not create category.' })
        return
      }
      setCategoryFeedback({ type: 'success', message: 'Category added.' })
      form.reset()
      router.refresh()
    })
  }

  const handleCategoryArchive = (id: string, isArchived: boolean) => {
    startCategory(async () => {
      const result = await archiveCategoryAction({ id, isArchived })
      if (result?.error) {
        setCategoryFeedback({ type: 'error', message: 'Unable to update category.' })
        return
      }
      setCategoryFeedback({ type: 'success', message: isArchived ? 'Category archived.' : 'Category reactivated.' })
      router.refresh()
    })
  }

  const netDeltaVariant = netDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'
  const activeTabMeta = TABS.find((tab) => tab.value === activeTab)

  const handleNavigateToTab = (tab: TabValue, anchor?: string) => {
    setActiveTab(tab)
    if (anchor) {
      requestAnimationFrame(() => {
        document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 lg:gap-10 lg:px-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl lg:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),_transparent_55%)]" aria-hidden />
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-200 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Financial clarity
            </span>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Balance Beacon</h1>
              <p className="text-sm leading-relaxed text-slate-200/80">
                Track personal, partner, and shared spending with insights that highlight what changed and where to focus your next dollar.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-100/80">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                <CalendarRange className="h-3.5 w-3.5" />
                {formatMonthLabel(monthKey)}
              </span>
              {netStat && (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-200">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {formatRelativeAmount(netStat.amount)} net flow
                </span>
              )}
            </div>
          </div>

          <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl bg-white/10 p-5 backdrop-blur lg:max-w-sm">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-200/80">
              <span>Cashflow snapshot</span>
              <RefreshCcw className="h-4 w-4 opacity-70" />
            </div>
            <div className="h-28 w-full">
              <Sparkline values={netHistory} strokeClassName="stroke-white" fillClassName="fill-white/15" ariaLabel="Net cashflow snapshot" />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-slate-100/80">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-200/70">Income this month</p>
                <p className="text-lg font-semibold text-white">{formatCurrency(latestHistory?.income ?? 0, preferredCurrency)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-200/70">Spending this month</p>
                <p className="text-lg font-semibold text-white">{formatCurrency(latestHistory?.expense ?? 0, preferredCurrency)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-200/70">Change vs last month</p>
                <p className={cn('text-lg font-semibold', netDeltaVariant)}>{formatRelativeAmount(netDelta, preferredCurrency)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-200/70">Accounts tracked</p>
                <p className="text-lg font-semibold text-white">{data.accounts.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-2 py-1 backdrop-blur">
            <Button
              type="button"
              variant="ghost"
              className="h-9 w-9 rounded-full text-white/90 transition hover:bg-white/20"
              onClick={() => handleMonthChange(-1)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 px-3 text-sm font-medium text-white">
              <CalendarRange className="h-4 w-4" />
              {formatMonthLabel(monthKey)}
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-9 w-9 rounded-full text-white/90 transition hover:bg-white/20"
              onClick={() => handleMonthChange(1)}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-col items-stretch gap-3 text-xs sm:flex-row sm:items-center">
            <div className="flex flex-1 flex-col text-xs">
              <Select
                className="min-w-[220px] rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-inner shadow-slate-950/20 focus:border-sky-400"
                value={activeAccount || accountsOptions[0]?.value || ''}
                onChange={(event) => handleAccountSelect(event.target.value)}
                options={accountsOptions}
                aria-label="Filter by account"
                disabled={accountsOptions.length === 0 || isPendingAccount}
              />
              {accountFeedback && (
                <span
                  className={cn(
                    'mt-2 text-right',
                    accountFeedback.type === 'error' ? 'text-rose-300' : 'text-emerald-300',
                  )}
                >
                  {accountFeedback.message}
                </span>
              )}
            </div>
            {data.exchangeRateLastUpdate && (
              <div className="flex flex-col items-start sm:items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full px-4 py-2 text-sm font-medium text-white/80"
                  onClick={handleRefreshRates}
                  loading={isPendingRates}
                  title="Refresh exchange rates from Frankfurter API"
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Update rates
                </Button>
                <span className="mt-1 text-xs text-slate-400">
                  Last updated: {new Date(data.exchangeRateLastUpdate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-4 py-2 text-sm font-medium text-white/80"
              onClick={handleLogout}
              loading={isPendingLogout}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.stats.map((stat) => {
          const variantKey = stat.variant ?? 'neutral'
          const styles = STAT_VARIANT_STYLES[variantKey]
          const Icon = resolveStatIcon(stat.label)
        return (
          <Card
            key={stat.label}
            className={cn(
              'border-white/20 bg-white/10 transition hover:-translate-y-1',
              styles.border,
            )}
          >
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2 text-slate-300">
              <div className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-300">{stat.label}</span>
                {stat.helper && <p className="text-xs text-slate-400">{stat.helper}</p>}
              </div>
              <div className="flex items-start gap-2">
                <InfoTooltip
                  description={STAT_TOOLTIPS[stat.label] ?? DEFAULT_STAT_TOOLTIP}
                  label={`Explain ${stat.label}`}
                  placement="left"
                />
                <span className={cn('inline-flex items-center justify-center rounded-full p-2 backdrop-blur', styles.chip)}>
                  <Icon className={cn('h-4 w-4', styles.icon)} />
                </span>
              </div>
            </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tracking-tight text-white">{formatCurrency(stat.amount, preferredCurrency)}</p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">Financial workspace</h2>
            <p className="text-sm text-slate-400">Navigate budgets, transactions, rules, and taxonomy without scrolling through a single feed.</p>
          </div>
          <nav className="flex flex-wrap gap-2" role="tablist" aria-label="Dashboard sections">
            {TABS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                id={`tab-${value}`}
                role="tab"
                type="button"
                aria-selected={activeTab === value}
                aria-controls={`panel-${value}`}
                onClick={() => setActiveTab(value)}
                className={cn(
                  'group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900',
                  activeTab === value
                    ? 'border-white/40 bg-white/20 text-white shadow-lg'
                    : 'border-white/15 bg-white/5 text-slate-200 hover:border-white/25 hover:bg-white/10',
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
        {activeTabMeta && <p className="text-sm text-slate-400">{activeTabMeta.description}</p>}

        {activeTab === 'overview' && (
          <div
            role="tabpanel"
            id="panel-overview"
            aria-labelledby="tab-overview"
            className="space-y-6"
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-white/15 bg-white/10">
                <CardHeader>
                  <CardTitle
                    className="text-lg font-semibold text-white"
                    helpText="Tracks six months of net cashflow so you can spot spending shifts."
                  >
                    Spending trend
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <Sparkline
                      values={netHistory}
                      strokeClassName="stroke-sky-300"
                      fillClassName="fill-sky-300/20"
                      className="h-24"
                      ariaLabel="Historical net cashflow trend"
                    />
                  </div>
                  <div className="space-y-3 text-sm text-slate-200">
                    {historyWithLabels.map((point) => (
                      <div
                        key={point.month}
                        className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="font-medium text-white">{point.label}</div>
                          <div className="text-xs text-slate-400">
                            Income {formatRelativeAmount(point.income)} · Expenses {formatRelativeAmount(-point.expense)}
                          </div>
                        </div>
                        <div className={cn('text-sm font-semibold', point.net >= 0 ? 'text-emerald-300' : 'text-rose-400')}>
                          {formatRelativeAmount(point.net)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/15 bg-white/10">
                <CardHeader>
                  <CardTitle
                    className="text-lg font-semibold text-white"
                    helpText="Summarizes net changes, remaining budgets, and expected income for the current month."
                  >
                    Month at a glance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-200">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-300">
                      <span>Net compared to last month</span>
                      <span className={cn('text-sm font-semibold', data.comparison.change >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                        {formatRelativeAmount(data.comparison.change, preferredCurrency)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-300">
                      {formatMonthLabel(data.comparison.previousMonth)} net: {formatCurrency(data.comparison.previousNet, preferredCurrency)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <span className="text-xs uppercase tracking-wide text-slate-300">Budgets remaining</span>
                    <div className="mt-2 text-xl font-semibold text-white">
                      {formatCurrency(
                        data.budgets
                          .filter((budget) => budget.categoryType === TransactionType.EXPENSE)
                          .reduce((sum, budget) => sum + budget.remaining, 0),
                        preferredCurrency
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <span className="text-xs uppercase tracking-wide text-slate-300">Income still expected</span>
                    <div className="mt-2 text-xl font-semibold text-white">
                      {formatCurrency(
                        data.budgets
                          .filter((budget) => budget.categoryType === TransactionType.INCOME)
                          .reduce((sum, budget) => sum + budget.remaining, 0),
                        preferredCurrency
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-white/15 bg-white/10">
              <CardHeader>
                <CardTitle
                  className="text-lg font-semibold text-white"
                  helpText="Launches your most common finance workflows without leaving the dashboard."
                >
                  Quick actions
                </CardTitle>
                <p className="text-sm text-slate-300">Jump straight to the tools you use most frequently.</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Button
                    type="button"
                    variant="secondary"
                    className="justify-start gap-3"
                    onClick={() => handleNavigateToTab('transactions', 'transaction-form')}
                  >
                    <CreditCard className="h-4 w-4" />
                    Log a transaction
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="justify-start gap-3"
                    onClick={() => handleNavigateToTab('budgets', 'budget-form')}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Update a budget
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="justify-start gap-3"
                    onClick={() => handleNavigateToTab('recurring', 'recurring-form')}
                  >
                    <Repeat className="h-4 w-4" />
                    Manage recurring plan
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="justify-start gap-3"
                    onClick={() => handleNavigateToTab('categories', 'category-form')}
                  >
                    <Tags className="h-4 w-4" />
                    Add a category
                  </Button>
                </div>
              </CardContent>
            </Card>

            {highlightedBudgets.length > 0 && (
              <Card className="border-white/15 bg-white/10">
                <CardHeader className="flex flex-col gap-3 text-slate-300 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle
                      className="text-lg font-semibold text-white"
                      helpText="Surfaces the budgets closest to their limits so you can adjust spending early."
                    >
                      Highlighted budgets
                    </CardTitle>
                    <p className="text-sm text-slate-300">A quick snapshot of the categories closest to their limits.</p>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => setActiveTab('budgets')}>
                    Manage budgets
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {highlightedBudgets.map((budget) => {
                    const progress = budget.planned > 0 ? Math.min(budget.actual / budget.planned, 1) : 0
                    const progressColor =
                      budget.categoryType === TransactionType.EXPENSE ? 'bg-rose-400/80' : 'bg-emerald-300/80'
                    const actualLabel = budget.categoryType === TransactionType.EXPENSE ? 'spent' : 'received'
                    const remainingLabel = `${
                      budget.categoryType === TransactionType.EXPENSE ? 'Remaining' : 'To receive'
                    }: ${formatCurrency(budget.remaining, preferredCurrency)}`
                    return (
                      <div
                        key={`${budget.categoryId}-${budget.budgetId}`}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                              <span>{budget.categoryName}</span>
                              <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium text-slate-200">
                                {budget.accountName}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300">
                              {formatCurrency(budget.actual, preferredCurrency)} {actualLabel} / {formatCurrency(budget.planned, preferredCurrency)} planned
                            </p>
                          </div>
                          <span className="text-sm font-medium text-slate-200">
                            {Math.round(progress * 100)}%
                          </span>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10" role="presentation">
                          <div
                            className={cn('h-2 rounded-full transition-all duration-300 ease-out', progressColor)}
                            style={{ width: `${progress * 100}%` }}
                            aria-hidden
                          />
                        </div>
                        <p className="mt-2 text-xs text-slate-300">{remainingLabel}</p>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'budgets' && (
          <div
            role="tabpanel"
            id="panel-budgets"
            aria-labelledby="tab-budgets"
            className="space-y-6"
          >
            <Card className="border-white/15 bg-white/10">
              <CardHeader className="gap-1">
                <CardTitle
                  className="text-lg font-semibold text-white"
                  helpText="Tune filters and edit plan amounts; progress bars show how actuals track against budgets."
                >
                  Monthly budgets
                </CardTitle>
                <p className="text-sm text-slate-400">Compare planned versus actual spending and stay ahead of upcoming obligations.</p>
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
                      {formatCurrency(budgetTotals.expenseActual, preferredCurrency)} of {formatCurrency(budgetTotals.expensePlanned, preferredCurrency)} spent
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300" htmlFor="budget-summary-income-panel">
                      Income realized
                    </label>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                      {formatCurrency(budgetTotals.incomeActual, preferredCurrency)} of {formatCurrency(budgetTotals.incomePlanned, preferredCurrency)} received
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {filteredBudgets.length === 0 && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
                      {data.budgets.length === 0 ? (
                        <>No budgets yet for this month. Use the form below to set your first plan.</>
                      ) : (
                        <>No budgets match the current filters.</>
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
                              {formatCurrency(budget.actual, preferredCurrency)} {actualLabel} / {formatCurrency(budget.planned, preferredCurrency)} planned
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
                            {formatCurrency(budget.actual, preferredCurrency)} of {formatCurrency(budget.planned, preferredCurrency)} {actualLabel}
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
                <form id="budget-form" onSubmit={handleBudgetSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5" tabIndex={-1}>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">Add or update a budget</h3>
                    <p className="text-xs text-slate-400">Capture limits for priority categories and accounts.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-300" htmlFor="budgetAccountId">
                        Account
                      </label>
                      <Select
                        id="budgetAccountId"
                        name="budgetAccountId"
                        defaultValue={defaultAccountId}
                        options={data.accounts.map((account) => ({ label: account.name, value: account.id }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-300" htmlFor="budgetCategoryId">
                        Category
                      </label>
                      <Select
                        id="budgetCategoryId"
                        name="budgetCategoryId"
                        options={data.categories
                          .filter((category) => category.type === TransactionType.EXPENSE && !category.isArchived)
                          .map((category) => ({ label: category.name, value: category.id }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-300" htmlFor="planned">
                        Planned amount
                      </label>
                      <Input name="planned" id="planned" type="number" min="0" step="0.01" placeholder="0.00" required />
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
                  {budgetFeedback && (
                    <p
                      role="status"
                      className={cn('text-xs', budgetFeedback.type === 'error' ? 'text-rose-600' : 'text-emerald-600')}
                    >
                      {budgetFeedback.message}
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div
            role="tabpanel"
            id="panel-transactions"
            aria-labelledby="tab-transactions"
            className="space-y-6"
          >
            <div className="grid gap-6 xl:grid-cols-[2fr,3fr]">
              <Card className="border-white/15 bg-white/10">
                <CardHeader className="gap-1">
                  <CardTitle
                    className="text-lg font-semibold text-white"
                    helpText="Record income or expenses with account, category, currency, and optional notes."
                  >
                    Log a transaction
                  </CardTitle>
                  <p className="text-sm text-slate-400">Capture new activity and classify it without leaving the keyboard.</p>
                </CardHeader>
                <CardContent>
                  <form id="transaction-form" onSubmit={handleTransactionSubmit} className="grid gap-4" tabIndex={-1}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300" htmlFor="transactionType">
                          Type
                        </label>
                        <Select
                          id="transactionType"
                          name="type"
                          value={transactionFormState.type}
                          onChange={(event) => handleTransactionTypeChange(event.target.value as TransactionType)}
                          options={transactionTypeOptions}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300" htmlFor="transactionAccount">
                          Account
                        </label>
                        <Select
                          id="transactionAccount"
                          name="accountId"
                          value={transactionFormState.accountId}
                          onChange={(event) =>
                            setTransactionFormState((prev) => ({
                              ...prev,
                              accountId: event.target.value,
                            }))
                          }
                          options={data.accounts.map((account) => ({ label: account.name, value: account.id }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300" htmlFor="transactionCategory">
                          Category
                        </label>
                        <Select
                          id="transactionCategory"
                          name="categoryId"
                          value={transactionFormState.categoryId}
                          onChange={(event) =>
                            setTransactionFormState((prev) => ({
                              ...prev,
                              categoryId: event.target.value,
                            }))
                          }
                          options={transactionCategoryOptions}
                          required
                          disabled={transactionCategoryOptions.length === 0}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300" htmlFor="transactionAmount">
                          Amount
                        </label>
                        <Input
                          name="amount"
                          id="transactionAmount"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          required
                          value={transactionFormState.amount}
                          onChange={(event) =>
                            setTransactionFormState((prev) => ({
                              ...prev,
                              amount: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300" htmlFor="transactionCurrency">
                          Currency
                        </label>
                        <Select
                          id="transactionCurrency"
                          name="currency"
                          value={transactionFormState.currency}
                          onChange={(event) =>
                            setTransactionFormState((prev) => ({
                              ...prev,
                              currency: event.target.value as Currency,
                            }))
                          }
                          options={currencyOptions}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300" htmlFor="transactionDate">
                          Date
                        </label>
                        <Input
                          name="date"
                          id="transactionDate"
                          type="date"
                          required
                          value={transactionFormState.date}
                          onChange={(event) =>
                            setTransactionFormState((prev) => ({
                              ...prev,
                              date: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <div className="flex items-center gap-2">
                          <input
                            id="isRecurring"
                            name="isRecurring"
                            type="checkbox"
                            className="h-4 w-4 rounded border border-white/30 bg-white/10 text-sky-400 focus:ring-sky-400/40"
                            checked={transactionFormState.isRecurring}
                            onChange={(event) =>
                              setTransactionFormState((prev) => ({
                                ...prev,
                                isRecurring: event.target.checked,
                              }))
                            }
                          />
                          <label htmlFor="isRecurring" className="text-xs text-slate-300">
                            Permanent (recurring) transaction
                          </label>
                        </div>
                        {transactionFormState.type === TransactionType.EXPENSE && (
                          <div className="flex items-center gap-2">
                            <input
                              id="isMutual"
                              name="isMutual"
                              type="checkbox"
                              className="h-4 w-4 rounded border border-white/30 bg-white/10 text-sky-400 focus:ring-sky-400/40"
                              checked={transactionFormState.isMutual}
                              onChange={(event) =>
                                setTransactionFormState((prev) => ({
                                  ...prev,
                                  isMutual: event.target.checked,
                                }))
                              }
                            />
                            <label htmlFor="isMutual" className="text-xs text-slate-300">
                              Mutual expense (2/3 {selfAccountName} · 1/3 {partnerAccountName})
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-300" htmlFor="transactionDescription">
                        Description
                      </label>
                      <Textarea
                        name="description"
                        id="transactionDescription"
                        rows={2}
                        placeholder="Optional memo"
                        value={transactionFormState.description}
                        onChange={(event) =>
                          setTransactionFormState((prev) => ({
                            ...prev,
                            description: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex w-full flex-col gap-2 sm:flex-row">
                        <Button type="submit" loading={isPendingTransaction} className="w-full sm:w-auto">
                          {isEditingTransaction ? 'Update transaction' : 'Save transaction'}
                        </Button>
                        {isEditingTransaction && (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={handleCancelTransactionEdit}
                            disabled={isPendingTransaction}
                          >
                            Cancel edit
                          </Button>
                        )}
                      </div>
                    </div>
                    {transactionFeedback && (
                      <p
                        role="status"
                        className={cn('text-xs', transactionFeedback.type === 'error' ? 'text-rose-600' : 'text-emerald-600')}
                      >
                        {transactionFeedback.message}
                      </p>
                    )}
                  </form>
                </CardContent>
              </Card>

              <Card className="border-white/15 bg-white/10">
                <CardHeader className="gap-1">
                  <CardTitle
                    className="text-lg font-semibold text-white"
                    helpText="Review the newest transactions, apply filters, and jump into edits when something looks off."
                  >
                    Recent activity
                  </CardTitle>
                  <p className="text-sm text-slate-400">Swipe through the latest transactions and tidy anything out of place.</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mutualSummaryDisplay && (
                    <div className="rounded-2xl border border-sky-400/30 bg-sky-500/15 p-3 text-xs text-sky-50">
                      <p className="font-medium text-sky-100">{mutualSummaryDisplay.headline}</p>
                      <p className="mt-1 text-[11px] text-sky-100/80">{mutualSummaryDisplay.helper}</p>
                    </div>
                  )}
                  <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-300" htmlFor="transaction-filter-type">
                        Type filter
                      </label>
                      <Select
                        id="transaction-filter-type"
                        value={transactionFilterType}
                        onChange={(event) => setTransactionFilterType(event.target.value as typeof transactionFilterType)}
                        options={typeFilterOptions}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-300" htmlFor="transaction-filter-account">
                        Account filter
                      </label>
                      <Select
                        id="transaction-filter-account"
                        value={transactionAccountFilter || transactionAccountOptions[0]?.value || ''}
                        onChange={(event) => setTransactionAccountFilter(event.target.value)}
                        options={transactionAccountOptions}
                        disabled={transactionAccountOptions.length === 0}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2 lg:col-span-1">
                      <label className="text-xs font-medium text-slate-300" htmlFor="transaction-search">
                        Search description or category
                      </label>
                      <Input
                        id="transaction-search"
                        value={transactionSearch}
                        onChange={(event) => setTransactionSearch(event.target.value)}
                        placeholder="e.g. rent, groceries, bonus"
                      />
                    </div>
                    {(transactionSearch || transactionFilterType !== 'all' || transactionAccountFilter !== defaultTransactionAccountFilter) && (
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-xs text-slate-200"
                          onClick={() => {
                            setTransactionSearch('')
                            setTransactionFilterType('all')
                            setTransactionAccountFilter(defaultTransactionAccountFilter)
                          }}
                        >
                          Reset filters
                        </Button>
                      </div>
                    )}
                  </div>
                  {filteredTransactions.length === 0 && (
                    <p className="text-sm text-slate-300">No transactions match the current filters.</p>
                  )}
                  {filteredTransactions.map((transaction) => {
                    const isCurrentlyEditing = editingTransaction?.id === transaction.id
                    return (
                      <div
                        key={transaction.id}
                        className={cn(
                          'flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 md:flex-row md:items-center md:justify-between',
                          isCurrentlyEditing && 'border-sky-400/60 bg-sky-500/10 text-sky-50',
                        )}
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 font-medium text-white">
                            <span>{transaction.category.name}</span>
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-200">
                              {transaction.account.name}
                            </span>
                            {transaction.isMutual && (
                              <span className="rounded-full border border-sky-400/40 bg-sky-500/20 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-sky-100">
                                Mutual
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-300">
                            {new Date(transaction.date).toLocaleDateString()} · {transaction.description || '—'}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
                          <span
                            className={cn(
                              'text-sm font-semibold',
                              transaction.type === TransactionType.EXPENSE ? 'text-rose-600' : 'text-emerald-600',
                            )}
                          >
                            {formatCurrency(
                              transaction.convertedAmount * (transaction.type === TransactionType.EXPENSE ? -1 : 1),
                              preferredCurrency,
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-xs text-slate-200 hover:bg-white/10"
                              onClick={() => handleTransactionEdit(transaction)}
                              disabled={isCurrentlyEditing}
                            >
                              {isCurrentlyEditing ? 'Editing' : 'Edit'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-xs text-slate-200 hover:bg-white/10"
                              onClick={() => handleTransactionDelete(transaction.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'recurring' && (
          <div
            role="tabpanel"
            id="panel-recurring"
            aria-labelledby="tab-recurring"
            className="space-y-6"
          >
            <div className="grid gap-6 lg:grid-cols-[3fr,2fr]">
              <Card className="border-white/15 bg-white/10">
                <CardHeader className="gap-1">
                  <CardTitle
                    className="text-lg font-semibold text-white"
                    helpText="Manage repeating templates, adjust schedules, and toggle the plans that automate your ledger."
                  >
                    Recurring plans
                  </CardTitle>
                  <p className="text-sm text-slate-400">Keep predictable cashflow on schedule and pause templates when plans change.</p>
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
                    <form id="recurring-form" onSubmit={handleRecurringSubmit} className="grid gap-4 sm:grid-cols-2" tabIndex={-1}>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300" htmlFor="recurringType">
                          Type
                        </label>
                        <Select id="recurringType" name="recurringType" options={transactionTypeOptions} defaultValue={TransactionType.EXPENSE} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300" htmlFor="recurringAccountId">
                          Account
                        </label>
                        <Select
                          id="recurringAccountId"
                          name="recurringAccountId"
                          defaultValue={defaultAccountId}
                          options={data.accounts.map((account) => ({ label: account.name, value: account.id }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300" htmlFor="recurringCategoryId">
                          Category
                        </label>
                        <Select
                          id="recurringCategoryId"
                          name="recurringCategoryId"
                          options={data.categories
                            .filter((category) => !category.isArchived)
                            .map((category) => ({ label: category.name, value: category.id }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300" htmlFor="recurringAmount">
                          Amount
                        </label>
                        <Input name="recurringAmount" id="recurringAmount" type="number" step="0.01" min="0" placeholder="0.00" required />
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
                        <Input name="startMonth" id="startMonth" type="month" required />
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
                    {recurringFeedback && (
                      <p
                        role="status"
                        className={cn('text-xs', recurringFeedback.type === 'error' ? 'text-rose-600' : 'text-emerald-600')}
                      >
                        {recurringFeedback.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    {filteredRecurring.length === 0 && (
                      <p className="text-sm text-slate-300">No recurring templates match the current filters.</p>
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
                            {template.type === TransactionType.EXPENSE ? 'Expense' : 'Income'} · {formatCurrency(template.amount, preferredCurrency)} · Day {template.dayOfMonth}
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
                                {template.type === TransactionType.EXPENSE ? 'Expense' : 'Income'} · {formatCurrency(template.amount, preferredCurrency)} · Day{' '}
                                {template.dayOfMonth}
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
                        preferredCurrency
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
                        preferredCurrency
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div
            role="tabpanel"
            id="panel-categories"
            aria-labelledby="tab-categories"
            className="space-y-6"
          >
            <div className="grid gap-6 lg:grid-cols-[2fr,3fr]">
              <Card className="border-white/15 bg-white/10">
                <CardHeader className="gap-1">
                  <CardTitle
                    className="text-lg font-semibold text-white"
                    helpText="Add bookkeeping categories with type, color, and archive controls for budgeting and rules."
                  >
                    Create categories
                  </CardTitle>
                  <p className="text-sm text-slate-400">Enable, archive, and color-code the buckets your household relies on.</p>
                </CardHeader>
                <CardContent>
                  <form id="category-form" onSubmit={handleCategorySubmit} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5" tabIndex={-1}>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Add new category</h3>
                      <p className="text-xs text-slate-400">Segment transactions with meaningful labels.</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300" htmlFor="categoryName">
                          Name
                        </label>
                        <Input name="categoryName" id="categoryName" placeholder="e.g. Car Leasing" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300" htmlFor="categoryType">
                          Type
                        </label>
                        <Select
                          id="categoryType"
                          name="categoryType"
                          options={transactionTypeOptions}
                          defaultValue={TransactionType.EXPENSE}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300" htmlFor="categoryColor">
                          Color (optional)
                        </label>
                        <Input name="categoryColor" id="categoryColor" type="color" defaultValue="#0ea5e9" />
                      </div>
                    </div>
                    <Button type="submit" loading={isPendingCategory} className="w-full">
                      Add category
                    </Button>
                    {categoryFeedback && (
                      <p
                        role="status"
                        className={cn('text-xs', categoryFeedback.type === 'error' ? 'text-rose-600' : 'text-emerald-600')}
                      >
                        {categoryFeedback.message}
                      </p>
                    )}
                  </form>
                </CardContent>
              </Card>

            <Card className="border-white/15 bg-white/10">
              <CardHeader>
                <CardTitle
                  className="text-lg font-semibold text-white"
                  helpText="Search, filter, and archive categories; changes sync across budgeting and transaction forms."
                >
                  Category library
                </CardTitle>
                <p className="text-sm text-slate-400">Toggle availability to keep dropdowns focused and reports meaningful.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300" htmlFor="category-filter-type">
                      Type filter
                    </label>
                    <Select
                      id="category-filter-type"
                      value={categoryTypeFilter}
                      onChange={(event) => setCategoryTypeFilter(event.target.value as typeof categoryTypeFilter)}
                      options={typeFilterOptions}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2 lg:col-span-1">
                    <label className="text-xs font-medium text-slate-300" htmlFor="category-filter-search">
                      Search categories
                    </label>
                    <Input
                      id="category-filter-search"
                      value={categorySearch}
                      onChange={(event) => setCategorySearch(event.target.value)}
                      placeholder="e.g. groceries, rent"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs text-slate-200"
                      onClick={() => setShowArchivedCategories((prev) => !prev)}
                    >
                      {showArchivedCategories ? 'Hide archived' : 'Show archived'}
                    </Button>
                  </div>
                </div>
                {filteredCategoryList.length === 0 && (
                  <p className="text-sm text-slate-300">No categories match the current filters.</p>
                )}
                {filteredCategoryList.map((category) => (
                  <div
                    key={category.id}
                    className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 font-medium text-white">
                          <span>{category.name}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            {category.type === TransactionType.EXPENSE ? 'Expense' : 'Income'}
                          </span>
                          {category.isHolding && (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-200">
                              Holding
                            </span>
                          )}
                          {category.isArchived && (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-300">
                              Archived
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        className="text-xs text-slate-400 hover:bg-slate-100"
                        onClick={() => handleCategoryArchive(category.id, !category.isArchived)}
                      >
                        {category.isArchived ? 'Reactivate' : 'Archive'}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
              {holdingsCategories.length > 0 && (
                <Card className="border-white/15 bg-white/10">
                  <CardHeader>
                    <CardTitle
                      className="text-lg font-semibold text-white"
                      helpText="Lists asset categories flagged for holdings so the portfolio tools know where to post positions."
                    >
                      Holdings overview
                    </CardTitle>
                    <p className="text-sm text-slate-400">
                      Stocks, ETFs, and savings tracked as accumulating assets rather than cash flow events.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-200">
                    {holdingsCategories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2">
                        <span className="font-medium text-white">{category.name}</span>
                        <span className="text-xs uppercase tracking-wide text-slate-300">Category</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Holdings Tab */}
        {activeTab === 'holdings' && (
          <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
            {/* Left: Add Holding Form */}
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
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
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

                    startTransaction(async () => {
                      const result = await createHoldingAction(payload)
                      if (result?.error) {
                        setTransactionFeedback({
                          type: 'error',
                          message: Object.values(result.error).flat().join(', ') || 'Unable to add holding',
                        })
                        return
                      }
                      setTransactionFeedback({ type: 'success', message: 'Holding added successfully' })
                      form.reset()
                    })
                  }}
                >
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300" htmlFor="holdingAccount">
                      Account
                    </label>
                    <Select
                      name="accountId"
                      id="holdingAccount"
                      value={activeAccount}
                      onChange={(e) => setActiveAccount(e.target.value)}
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
                      options={data.categories
                        .filter((cat) => cat.isHolding && !cat.isArchived)
                        .map((cat) => ({ label: cat.name, value: cat.id }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-300" htmlFor="symbol">
                        Symbol
                      </label>
                      <Input
                        name="symbol"
                        id="symbol"
                        placeholder="e.g. AMZN, SPY"
                        required
                        className="uppercase"
                      />
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
                      <Input
                        name="averageCost"
                        id="averageCost"
                        type="number"
                        step="0.01"
                        placeholder="150.00"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-300" htmlFor="holdingCurrency">
                        Currency
                      </label>
                      <Select name="currency" id="holdingCurrency" options={currencyOptions} defaultValue={Currency.USD} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300" htmlFor="holdingNotes">
                      Notes (optional)
                    </label>
                    <Textarea name="notes" id="holdingNotes" rows={2} placeholder="Investment thesis or notes" />
                  </div>
                  <Button type="submit" className="w-full" disabled={isPendingTransaction}>
                    {isPendingTransaction ? 'Adding...' : 'Add holding'}
                  </Button>
                  {transactionFeedback && (
                    <div
                      className={cn(
                        'rounded-lg px-3 py-2 text-xs',
                        transactionFeedback.type === 'success'
                          ? 'bg-emerald-500/20 text-emerald-200'
                          : 'bg-rose-500/20 text-rose-200',
                      )}
                    >
                      {transactionFeedback.message}
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>

            {/* Right: Holdings List */}
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
                  onClick={() => {
                    startTransaction(async () => {
                      const result = await refreshHoldingPricesAction({ accountId: activeAccount })
                      if ('error' in result) {
                        setTransactionFeedback({ type: 'error', message: 'Failed to refresh prices' })
                        return
                      }
                      setTransactionFeedback({
                        type: 'success',
                        message: `Updated ${result.updated} price${result.updated !== 1 ? 's' : ''}`,
                      })
                    })
                  }}
                  disabled={isPendingTransaction || data.holdings.length === 0}
                  className="gap-2"
                >
                  <RefreshCcw className={cn('h-4 w-4', isPendingTransaction && 'animate-spin')} />
                  Refresh prices
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.holdings.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center text-sm text-slate-400">
                    <TrendingUp className="mx-auto mb-2 h-8 w-8 text-slate-500" />
                    <p>No holdings tracked yet.</p>
                    <p className="mt-1 text-xs">Add your first stock or ETF to start tracking portfolio value.</p>
                  </div>
                )}
                {data.holdings.map((holding) => {
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
                    <div
                      key={holding.id}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sm font-bold tracking-wide text-sky-200">
                            {holding.symbol}
                          </span>
                          <span className="text-xs text-slate-400">×{holding.quantity}</span>
                          {staleBadge}
                        </div>
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${holding.symbol} holding?`)) {
                              startTransaction(async () => {
                                const result = await deleteHoldingAction({ id: holding.id })
                                if ('error' in result) {
                                  setTransactionFeedback({ type: 'error', message: 'Failed to delete holding' })
                                  return
                                }
                                setTransactionFeedback({ type: 'success', message: 'Holding deleted' })
                              })
                            }
                          }}
                          className="text-xs text-rose-400 hover:text-rose-300 transition"
                        >
                          Delete
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-slate-400">Market Value</p>
                          <p className="font-semibold text-white">
                            {formatCurrency(holding.marketValue, holding.currency)}
                          </p>
                          {holding.currency !== preferredCurrency && holding.marketValueConverted !== undefined && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {formatCurrency(holding.marketValueConverted, preferredCurrency)}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Cost Basis</p>
                          <p className="text-slate-300">{formatCurrency(holding.costBasis, holding.currency)}</p>
                          {holding.currency !== preferredCurrency && holding.costBasisConverted !== undefined && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {formatCurrency(holding.costBasisConverted, preferredCurrency)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="text-slate-400">Gain/Loss: </span>
                          <span
                            className={cn(
                              'font-medium',
                              holding.gainLoss >= 0 ? 'text-emerald-300' : 'text-rose-400',
                            )}
                          >
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
                              <span className="ml-1">
                                ({formatCurrency(holding.currentPriceConverted, preferredCurrency)})
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {holding.notes && (
                        <p className="text-xs text-slate-400 border-t border-white/5 pt-2 mt-2">{holding.notes}</p>
                      )}

                      <p className="text-[10px] text-slate-500">Last updated: {priceAge}</p>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        )}
      </section>
    </div>
  )
}
