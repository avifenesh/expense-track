'use client'

import { Suspense, useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { TransactionType, Currency, AccountType } from '@prisma/client'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarRange,
  CreditCard,
  Download,
  FileSpreadsheet,
  Gauge,
  Layers,
  PiggyBank,
  RefreshCcw,
  Repeat,
  Scale,
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
  createTransactionRequestAction,
  updateTransactionAction,
  deleteBudgetAction,
  deleteTransactionAction,
  logoutAction,
  toggleRecurringTemplateAction,
  upsertBudgetAction,
  upsertRecurringTemplateAction,
  persistActiveAccountAction,
  refreshExchangeRatesAction,
  setBalanceAction,
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
import { ChatWidget } from '@/components/ai/chat-widget'
import { RequestList } from '@/components/dashboard/request-list'

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

  if (utcDate.getUTCFullYear() !== year || utcDate.getUTCMonth() !== monthIndex || utcDate.getUTCDate() !== day) {
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

const HoldingsTab = dynamic(() => import('./holdings-tab'), {
  ssr: false,
  loading: () => <HoldingsFallback />,
})

function HoldingsFallback() {
  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <Card className="border-white/15 bg-white/10 h-fit">
        <CardHeader className="gap-1">
          <CardTitle className="text-lg font-semibold text-white">Loading holdings…</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 animate-pulse rounded-xl bg-white/5" />
        </CardContent>
      </Card>
      <Card className="border-white/15 bg-white/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Preparing data…</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
        </CardContent>
      </Card>
    </div>
  )
}

const TABS: Array<{
  value: TabValue
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { value: 'overview', label: 'Overview', icon: Gauge },
  { value: 'transactions', label: 'Transactions', icon: CreditCard },
  { value: 'budgets', label: 'Budgets', icon: FileSpreadsheet },
  { value: 'recurring', label: 'Auto-repeat', icon: Repeat },
  { value: 'categories', label: 'Labels', icon: Tags },
  { value: 'holdings', label: 'Investments', icon: TrendingUp },
]

const STAT_VARIANT_STYLES: Record<
  NonNullable<DashboardData['stats'][number]['variant']>,
  {
    border: string
    chip: string
    chipText: string
    icon: string
  }
> = {
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
  const _initialAccountRecord = data.accounts.find((account) => account.id === initialAccountId) ?? null
  const defaultExpenseCategoryId =
    data.categories.find((category) => category.type === TransactionType.EXPENSE && !category.isArchived)?.id ?? ''
  const initialTransactionAccountFilterValue = initialAccountId
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
    isRequest: boolean
  }>(() => {
    const loggableAccounts = data.accounts
    const initialLoggableAccountId =
      loggableAccounts.find((account) => account.id === initialAccountId)?.id ?? loggableAccounts[0]?.id ?? ''

    return {
      type: TransactionType.EXPENSE,
      accountId: initialLoggableAccountId,
      categoryId: defaultExpenseCategoryId,
      amount: '',
      currency: Currency.USD,
      date: `${monthKey}-01`,
      description: '',
      isRecurring: false,
      isRequest: false,
    }
  })
  const [editingTransaction, setEditingTransaction] = useState<DashboardTransaction | null>(null)
  const [transactionFeedback, setTransactionFeedback] = useState<Feedback | null>(null)
  const [budgetFeedback, setBudgetFeedback] = useState<Feedback | null>(null)
  const [recurringFeedback, setRecurringFeedback] = useState<Feedback | null>(null)
  const [categoryFeedback, setCategoryFeedback] = useState<Feedback | null>(null)
  const [accountFeedback, setAccountFeedback] = useState<Feedback | null>(null)
  const [showBalanceForm, setShowBalanceForm] = useState(false)
  const [balanceAmount, setBalanceAmount] = useState('')
  const [balanceFeedback, setBalanceFeedback] = useState<Feedback | null>(null)
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
  const [_isPendingAccount, startPersistAccount] = useTransition()
  const [isPendingLogout, startLogout] = useTransition()
  const [isPendingRates, startRates] = useTransition()
  const [isPendingBalance, startBalance] = useTransition()

  const accountsOptions = useMemo(
    () => data.accounts.map((account) => ({ label: account.name, value: account.id })),
    [data.accounts],
  )

  const transactionLoggableAccounts = useMemo(() => data.accounts, [data.accounts])

  const resolveLoggableAccountId = useCallback(
    (preferredAccountId?: string) => {
      if (preferredAccountId && transactionLoggableAccounts.some((account) => account.id === preferredAccountId)) {
        return preferredAccountId
      }

      return transactionLoggableAccounts[0]?.id ?? ''
    },
    [transactionLoggableAccounts],
  )

  const transactionFormAccountOptions = useMemo(() => {
    const options = transactionLoggableAccounts.map((account) => ({
      label: account.name,
      value: account.id,
    }))

    return options
  }, [transactionLoggableAccounts])

  const activeAccountRecord = useMemo(
    () => data.accounts.find((account) => account.id === activeAccount) ?? null,
    [data.accounts, activeAccount],
  )

  const transactionAccountOptions = accountsOptions

  const _selfAccountName = useMemo(
    () => data.accounts.find((account) => account.type === AccountType.SELF)?.name ?? 'Self',
    [data.accounts],
  )

  const _partnerAccountName = useMemo(
    () => data.accounts.find((account) => account.type === AccountType.PARTNER)?.name ?? 'Partner',
    [data.accounts],
  )

  const getDefaultCategoryId = useCallback(
    (type: TransactionType) =>
      data.categories.find((category) => category.type === type && !category.isArchived)?.id ?? '',
    [data.categories],
  )

  const defaultTransactionAccountFilter = activeAccount || ''

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
    if (editingTransaction) return
    if (!activeAccount) return

    const nextAccountId = resolveLoggableAccountId(activeAccount)

    setTransactionFormState((prev) => {
      if (prev.accountId === nextAccountId) {
        return prev
      }

      return {
        ...prev,
        accountId: nextAccountId,
      }
    })
  }, [activeAccount, activeAccountRecord, editingTransaction, resolveLoggableAccountId])

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
    const fallbackAccountId = resolveLoggableAccountId(activeAccount)
    setTransactionFormState({
      type: TransactionType.EXPENSE,
      accountId: fallbackAccountId,
      categoryId: getDefaultCategoryId(TransactionType.EXPENSE),
      amount: '',
      currency: Currency.USD,
      date: `${monthKey}-01`,
      description: '',
      isRecurring: false,
      isRequest: false,
    })
    setEditingTransaction(null)
  }, [activeAccount, getDefaultCategoryId, monthKey, resolveLoggableAccountId])

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
        }
      })
    },
    [data.categories, getDefaultCategoryId],
  )

  const handleTransactionEdit = useCallback((transaction: DashboardTransaction) => {
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
      isRequest: false,
    })
    setTransactionFeedback(null)
  }, [])

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
        accountId: transactionAccountFilter === 'all' ? undefined : transactionAccountFilter || undefined,
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
            ? (firstErrorSet[0] ?? 'Unable to remember selection.')
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
      })

      if (result?.error) {
        const firstErrorSet = Object.values(result.error)[0]
        const message: string =
          Array.isArray(firstErrorSet) && firstErrorSet.length > 0
            ? (firstErrorSet[0] ?? 'Unable to set balance.')
            : 'Unable to set balance.'
        setBalanceFeedback({ type: 'error', message })
        return
      }

      const adjustment = result?.adjustment ?? 0
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
      setShowBalanceForm(false)
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

    startTransaction(async () => {
      let result
      if (transactionFormState.isRequest && !editingTransaction) {
        const partnerAccount = data.accounts.find((acc) => acc.type === AccountType.PARTNER)
        if (!partnerAccount) {
          setTransactionFeedback({ type: 'error', message: 'Partner account not found.' })
          return
        }
        result = await createTransactionRequestAction({
          toId: partnerAccount.id,
          categoryId: transactionFormState.categoryId,
          amount: parsedAmount,
          currency: transactionFormState.currency,
          date: dateInput,
          description: description.length > 0 ? description : undefined,
        })
      } else {
        const payload = {
          accountId: transactionFormState.accountId || activeAccount || defaultAccountId,
          categoryId: transactionFormState.categoryId,
          type: transactionFormState.type,
          amount: parsedAmount,
          currency: transactionFormState.currency,
          date: dateInput,
          description: description.length > 0 ? description : undefined,
          isRecurring: transactionFormState.isRecurring,
        }
        result = editingTransaction
          ? await updateTransactionAction({ id: editingTransaction.id, ...payload })
          : await createTransactionAction(payload)
      }

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
        message: transactionFormState.isRequest
          ? 'Request sent to partner.'
          : editingTransaction
            ? 'Transaction updated.'
            : 'Transaction saved.',
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

  const handleExportCSV = useCallback(() => {
    const headers = ['Date', 'Type', 'Category', 'Account', 'Amount', 'Currency', 'Description']
    const rows = filteredTransactions.map((t) => [
      new Date(t.date).toISOString().slice(0, 10),
      t.type,
      t.category.name,
      t.account.name,
      t.type === TransactionType.EXPENSE ? -t.amount : t.amount,
      t.currency,
      (t.description || '').replace(/"/g, '""'),
    ])

    const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `transactions-${monthKey}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [filteredTransactions, monthKey])

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pt-14 lg:gap-6 lg:px-6 lg:pt-16">
      {/* Floating top bar */}
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-slate-900/95 px-4 py-2.5 backdrop-blur-md lg:px-6 lg:py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          {/* Tab navigation */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {TABS.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                type="button"
                variant="ghost"
                className={cn(
                  'h-8 gap-1.5 rounded-full px-3 text-xs font-medium transition',
                  activeTab === value ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
                )}
                onClick={() => setActiveTab(value)}
                title={label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
            <div className="mx-1 h-4 w-px bg-white/20" />
            <Button
              type="button"
              variant="ghost"
              className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setShowBalanceForm((prev) => !prev)}
              title="Set balance"
            >
              <Scale className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Balance</span>
            </Button>
          </div>

          {/* Right side actions */}
          <Button
            type="button"
            variant="ghost"
            className="h-8 rounded-full px-3 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white"
            onClick={handleLogout}
            loading={isPendingLogout}
          >
            Sign out
          </Button>
        </div>
      </div>

      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-xl lg:p-6">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),_transparent_55%)]"
          aria-hidden
        />
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Month selector */}
              <div className="inline-flex items-center gap-0.5 rounded-full border border-white/15 bg-white/10 px-1.5 py-0.5 backdrop-blur">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-6 w-6 rounded-full text-white/90 transition hover:bg-white/20"
                  onClick={() => handleMonthChange(-1)}
                >
                  <ArrowLeft className="h-3 w-3" />
                </Button>
                <div className="flex items-center gap-1 px-1.5 text-xs font-medium text-white">
                  <CalendarRange className="h-3 w-3" />
                  {formatMonthLabel(monthKey)}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-6 w-6 rounded-full text-white/90 transition hover:bg-white/20"
                  onClick={() => handleMonthChange(1)}
                >
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-200 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Financial clarity
              </span>
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Balance Beacon</h1>
              <p className="text-sm leading-relaxed text-slate-200/80">
                Track personal, partner, and shared spending with insights that highlight what changed and where to
                focus your next dollar.
              </p>
            </div>
            {netStat && (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                <TrendingUp className="h-3.5 w-3.5" />
                {formatRelativeAmount(netStat.amount)} net flow
              </span>
            )}
          </div>

          <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl bg-white/10 p-5 backdrop-blur lg:max-w-sm">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-200/80">
              <span>Cashflow snapshot</span>
              <RefreshCcw className="h-4 w-4 opacity-70" />
            </div>
            <div className="h-28 w-full">
              <Sparkline
                values={netHistory}
                strokeClassName="stroke-white"
                fillClassName="fill-white/15"
                ariaLabel="Net cashflow snapshot"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-slate-100/80">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-200/70">Income this month</p>
                <p className="text-lg font-semibold text-white">
                  {formatCurrency(latestHistory?.income ?? 0, preferredCurrency)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-200/70">Spending this month</p>
                <p className="text-lg font-semibold text-white">
                  {formatCurrency(latestHistory?.expense ?? 0, preferredCurrency)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-200/70">Change vs last month</p>
                <p className={cn('text-lg font-semibold', netDeltaVariant)}>
                  {formatRelativeAmount(netDelta, preferredCurrency)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Compact stat cards at the bottom of header */}
        <div className="relative z-10 mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {data.stats.map((stat) => {
            const variantKey = stat.variant ?? 'neutral'
            const styles = STAT_VARIANT_STYLES[variantKey]
            const Icon = resolveStatIcon(stat.label)
            return (
              <div
                key={stat.label}
                className={cn(
                  'flex items-center gap-3 rounded-xl border bg-white/5 px-3 py-2 backdrop-blur transition hover:bg-white/10',
                  styles.border,
                )}
              >
                <span className={cn('inline-flex shrink-0 items-center justify-center rounded-lg p-1.5', styles.chip)}>
                  <Icon className={cn('h-3.5 w-3.5', styles.icon)} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-300">
                    {stat.label}
                  </p>
                  <p className="truncate text-sm font-semibold text-white">
                    {formatCurrency(stat.amount, preferredCurrency)}
                  </p>
                </div>
                <InfoTooltip
                  description={STAT_TOOLTIPS[stat.label] ?? DEFAULT_STAT_TOOLTIP}
                  label={`Explain ${stat.label}`}
                  placement="left"
                />
              </div>
            )
          })}
        </div>

        {/* Exchange rate refresh - compact */}
        {data.exchangeRateLastUpdate && (
          <div className="relative z-10 mt-3 flex items-center justify-end gap-2 text-xs text-slate-400">
            <span>
              Rates:{' '}
              {new Date(data.exchangeRateLastUpdate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <Button
              type="button"
              variant="ghost"
              className="h-6 px-2 text-xs text-slate-300 hover:bg-white/10"
              onClick={handleRefreshRates}
              loading={isPendingRates}
              title="Refresh exchange rates"
            >
              <RefreshCcw className="h-3 w-3" />
            </Button>
          </div>
        )}
      </header>

      <section className="space-y-6">
        {activeTab === 'overview' && (
          <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" className="space-y-6">
            {/* Partner requests shown prominently at top */}
            {data.transactionRequests.length > 0 && (
              <RequestList requests={data.transactionRequests} preferredCurrency={preferredCurrency} />
            )}
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
                            Income {formatRelativeAmount(point.income)} · Expenses{' '}
                            {formatRelativeAmount(-point.expense)}
                          </div>
                        </div>
                        <div
                          className={cn('text-sm font-semibold', point.net >= 0 ? 'text-emerald-300' : 'text-rose-400')}
                        >
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
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          data.comparison.change >= 0 ? 'text-emerald-300' : 'text-rose-300',
                        )}
                      >
                        {formatRelativeAmount(data.comparison.change, preferredCurrency)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-300">
                      {formatMonthLabel(data.comparison.previousMonth)} net:{' '}
                      {formatCurrency(data.comparison.previousNet, preferredCurrency)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <span className="text-xs uppercase tracking-wide text-slate-300">Budgets remaining</span>
                    <div className="mt-2 text-xl font-semibold text-white">
                      {formatCurrency(
                        data.budgets
                          .filter((budget) => budget.categoryType === TransactionType.EXPENSE)
                          .reduce((sum, budget) => sum + budget.remaining, 0),
                        preferredCurrency,
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
                        preferredCurrency,
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {showBalanceForm && (
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
                      <span className="text-sm font-semibold text-white">
                        {formatCurrency(
                          data.stats.find((s) => s.label === 'Actual net')?.amount ?? 0,
                          preferredCurrency,
                        )}
                      </span>
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
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowBalanceForm(false)
                          setBalanceAmount('')
                          setBalanceFeedback(null)
                        }}
                      >
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
            )}

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
                    <p className="text-sm text-slate-300">
                      A quick snapshot of the categories closest to their limits.
                    </p>
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
                              {formatCurrency(budget.actual, preferredCurrency)} {actualLabel} /{' '}
                              {formatCurrency(budget.planned, preferredCurrency)} planned
                            </p>
                          </div>
                          <span className="text-sm font-medium text-slate-200">{Math.round(progress * 100)}%</span>
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
                      {data.budgets.length === 0 ? (
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
                      <Input
                        name="planned"
                        id="planned"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        required
                      />
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
          <div role="tabpanel" id="panel-transactions" aria-labelledby="tab-transactions" className="space-y-6">
            {data.transactionRequests.length > 0 && (
              <RequestList requests={data.transactionRequests} preferredCurrency={preferredCurrency} />
            )}
            <div className="grid gap-6 xl:grid-cols-[2fr,3fr]">
              <Card className="border-white/15 bg-white/10">
                <CardHeader className="gap-1">
                  <CardTitle
                    className="text-lg font-semibold text-white"
                    helpText="Record income or expenses with account, category, currency, and optional notes."
                  >
                    Add expense or income
                  </CardTitle>
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
                          options={transactionFormAccountOptions}
                          disabled={transactionFormAccountOptions.length === 0}
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
                      {transactionFormState.type === TransactionType.EXPENSE && !editingTransaction && (
                        <div className="flex items-center gap-2 sm:col-span-2">
                          <input
                            id="isRequest"
                            name="isRequest"
                            type="checkbox"
                            className="h-4 w-4 rounded border border-white/30 bg-white/10 text-sky-400 focus:ring-sky-400/40"
                            checked={transactionFormState.isRequest}
                            onChange={(event) =>
                              setTransactionFormState((prev) => ({
                                ...prev,
                                isRequest: event.target.checked,
                              }))
                            }
                          />
                          <label htmlFor="isRequest" className="text-sm text-slate-300">
                            Ask partner to pay this
                          </label>
                        </div>
                      )}
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
                        className={cn(
                          'text-xs',
                          transactionFeedback.type === 'error' ? 'text-rose-600' : 'text-emerald-600',
                        )}
                      >
                        {transactionFeedback.message}
                      </p>
                    )}
                  </form>
                </CardContent>
              </Card>

              <Card className="border-white/15 bg-white/10">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle
                      className="text-lg font-semibold text-white"
                      helpText="Review the newest transactions, apply filters, and jump into edits when something looks off."
                    >
                      Recent activity
                    </CardTitle>
                    <p className="text-sm text-slate-400">
                      Swipe through the latest transactions and tidy anything out of place.
                    </p>
                  </div>
                  {filteredTransactions.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="shrink-0 gap-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
                      onClick={handleExportCSV}
                      title="Download transactions as CSV"
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Export</span>
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-300" htmlFor="transaction-filter-type">
                        Type filter
                      </label>
                      <Select
                        id="transaction-filter-type"
                        value={transactionFilterType}
                        onChange={(event) =>
                          setTransactionFilterType(event.target.value as typeof transactionFilterType)
                        }
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
                    {(transactionSearch ||
                      transactionFilterType !== 'all' ||
                      transactionAccountFilter !== defaultTransactionAccountFilter) && (
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
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
                      <div className="rounded-full bg-white/10 p-3">
                        <CreditCard className="h-6 w-6 text-slate-300" />
                      </div>
                      {data.transactions.length === 0 ? (
                        <>
                          <p className="text-sm font-medium text-white">No transactions yet</p>
                          <p className="text-xs text-slate-400">
                            Log your first expense or income using the form on the left.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-white">No matching transactions</p>
                          <p className="text-xs text-slate-400">Try adjusting the filters or search term.</p>
                        </>
                      )}
                    </div>
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
                        <Input
                          name="recurringAmount"
                          id="recurringAmount"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          required
                        />
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
                        className={cn(
                          'text-xs',
                          recurringFeedback.type === 'error' ? 'text-rose-600' : 'text-emerald-600',
                        )}
                      >
                        {recurringFeedback.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    {filteredRecurring.length === 0 && (
                      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
                        <div className="rounded-full bg-white/10 p-3">
                          <Repeat className="h-6 w-6 text-slate-300" />
                        </div>
                        {data.recurringTemplates.length === 0 ? (
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
        )}

        {activeTab === 'categories' && (
          <div role="tabpanel" id="panel-categories" aria-labelledby="tab-categories" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[2fr,3fr]">
              <Card className="border-white/15 bg-white/10">
                <CardHeader className="gap-1">
                  <CardTitle
                    className="text-lg font-semibold text-white"
                    helpText="Add bookkeeping categories with type, color, and archive controls for budgeting and rules."
                  >
                    Create categories
                  </CardTitle>
                  <p className="text-sm text-slate-400">
                    Enable, archive, and color-code the buckets your household relies on.
                  </p>
                </CardHeader>
                <CardContent>
                  <form
                    id="category-form"
                    onSubmit={handleCategorySubmit}
                    className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5"
                    tabIndex={-1}
                  >
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
                        className={cn(
                          'text-xs',
                          categoryFeedback.type === 'error' ? 'text-rose-600' : 'text-emerald-600',
                        )}
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
                  <p className="text-sm text-slate-400">
                    Toggle availability to keep dropdowns focused and reports meaningful.
                  </p>
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
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
                      <div className="rounded-full bg-white/10 p-3">
                        <Tags className="h-6 w-6 text-slate-300" />
                      </div>
                      {data.categories.length === 0 ? (
                        <>
                          <p className="text-sm font-medium text-white">No labels yet</p>
                          <p className="text-xs text-slate-400">Create labels to organize your spending and income.</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-white">No matching labels</p>
                          <p className="text-xs text-slate-400">Try adjusting the filters above.</p>
                        </>
                      )}
                    </div>
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
            </div>
          </div>
        )}

        {/* Holdings Tab */}
        {activeTab === 'holdings' && (
          <Suspense fallback={<HoldingsFallback />}>
            <HoldingsTab
              activeAccount={activeAccount}
              accountsOptions={accountsOptions}
              categories={data.categories}
              preferredCurrency={preferredCurrency}
              onSelectAccount={handleAccountSelect}
            />
          </Suspense>
        )}
      </section>

      {/* AI Chat Widget */}
      {process.env.NEXT_PUBLIC_AI_ENABLED !== 'false' && (
        <ChatWidget accountId={accountId} monthKey={monthKey} preferredCurrency={preferredCurrency} />
      )}

      {/* Floating scroll-to-top button */}
      <Button
        type="button"
        variant="secondary"
        className="fixed bottom-6 left-6 h-10 w-10 rounded-full shadow-lg"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        title="Scroll to top"
      >
        <ArrowUp className="h-5 w-5" />
      </Button>
    </div>
  )
}
