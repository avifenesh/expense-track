'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TransactionType, Currency, AccountType } from '@prisma/client'
import { Download, CreditCard } from 'lucide-react'
import {
  createTransactionAction,
  createTransactionRequestAction,
  updateTransactionAction,
  deleteTransactionAction,
} from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { filterTransactions } from '@/lib/dashboard-ux'
import { createAccountOptions } from '@/lib/select-options'
import { formatRelativeAmount } from '@/utils/format'
import { normalizeDateInput } from '@/utils/date'
import { cn } from '@/utils/cn'
import { RequestList } from '@/components/dashboard/request-list'
import { useFeedback } from '@/hooks/useFeedback'
import {
  DashboardCategory,
  DashboardAccount,
  DashboardTransaction,
  DashboardTransactionRequest,
  transactionTypeOptions,
  typeFilterOptions,
  currencyOptions,
} from './types'

export type TransactionsTabProps = {
  transactions: DashboardTransaction[]
  transactionRequests: DashboardTransactionRequest[]
  accounts: DashboardAccount[]
  categories: DashboardCategory[]
  activeAccount: string
  monthKey: string
  preferredCurrency: Currency
}

export function TransactionsTab({
  transactions,
  transactionRequests,
  accounts,
  categories,
  activeAccount,
  monthKey,
  preferredCurrency,
}: TransactionsTabProps) {
  const router = useRouter()

  // Derived values (memoized to prevent unnecessary re-renders)
  const defaultExpenseCategoryId = useMemo(
    () => categories.find((category) => category.type === TransactionType.EXPENSE && !category.isArchived)?.id ?? '',
    [categories],
  )

  const transactionLoggableAccounts = accounts // Direct reference is stable from parent

  const resolveLoggableAccountId = useCallback(
    (preferredAccountId?: string) => {
      if (preferredAccountId && transactionLoggableAccounts.some((account) => account.id === preferredAccountId)) {
        return preferredAccountId
      }
      return transactionLoggableAccounts[0]?.id ?? ''
    },
    [transactionLoggableAccounts],
  )

  const accountsOptions = useMemo(() => createAccountOptions(accounts), [accounts])

  const defaultAccountId = useMemo(() => activeAccount || accounts[0]?.id || '', [activeAccount, accounts])

  // Local state
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
    const initialLoggableAccountId =
      transactionLoggableAccounts.find((account) => account.id === activeAccount)?.id ??
      transactionLoggableAccounts[0]?.id ??
      ''

    return {
      type: TransactionType.EXPENSE,
      accountId: initialLoggableAccountId,
      categoryId: defaultExpenseCategoryId,
      amount: '',
      currency: preferredCurrency,
      date: `${monthKey}-01`,
      description: '',
      isRecurring: false,
      isRequest: false,
    }
  })

  const [editingTransaction, setEditingTransaction] = useState<DashboardTransaction | null>(null)
  const { feedback: transactionFeedback, showSuccess, showError, clear: clearFeedback } = useFeedback()
  const [transactionFilterType, setTransactionFilterType] = useState<'all' | TransactionType>('all')
  const [transactionAccountFilter, setTransactionAccountFilter] = useState<string>(activeAccount)
  const [transactionSearch, setTransactionSearch] = useState('')
  const [isPendingTransaction, startTransaction] = useTransition()

  const isEditingTransaction = Boolean(editingTransaction)

  // Computed
  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === transactionFormState.type && !category.isArchived),
    [categories, transactionFormState.type],
  )

  const transactionCategoryOptions = useMemo(
    () => filteredCategories.map((category) => ({ label: category.name, value: category.id })),
    [filteredCategories],
  )

  const transactionFormAccountOptions = useMemo(
    () => createAccountOptions(transactionLoggableAccounts),
    [transactionLoggableAccounts],
  )

  const transactionAccountOptions = accountsOptions

  const filteredTransactions = useMemo(
    () =>
      filterTransactions(transactions, {
        type: transactionFilterType,
        search: transactionSearch,
        accountId: transactionAccountFilter === 'all' ? undefined : transactionAccountFilter || undefined,
      }),
    [transactions, transactionFilterType, transactionSearch, transactionAccountFilter],
  )

  const getDefaultCategoryId = useCallback(
    (type: TransactionType) => categories.find((category) => category.type === type && !category.isArchived)?.id ?? '',
    [categories],
  )

  // Effects
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
  }, [activeAccount, editingTransaction, resolveLoggableAccountId])

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

  // Handlers
  const resetTransactionForm = useCallback(() => {
    const fallbackAccountId = resolveLoggableAccountId(activeAccount)
    setTransactionFormState({
      type: TransactionType.EXPENSE,
      accountId: fallbackAccountId,
      categoryId: getDefaultCategoryId(TransactionType.EXPENSE),
      amount: '',
      currency: preferredCurrency,
      date: `${monthKey}-01`,
      description: '',
      isRecurring: false,
      isRequest: false,
    })
    setEditingTransaction(null)
  }, [activeAccount, getDefaultCategoryId, monthKey, preferredCurrency, resolveLoggableAccountId])

  const handleTransactionTypeChange = useCallback(
    (nextType: TransactionType) => {
      setTransactionFormState((prev) => {
        const categoryStillValid = categories.some(
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
    [categories, getDefaultCategoryId],
  )

  const handleTransactionEdit = useCallback(
    (transaction: DashboardTransaction) => {
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
      clearFeedback()
    },
    [clearFeedback],
  )

  const handleCancelTransactionEdit = useCallback(() => {
    resetTransactionForm()
    clearFeedback()
  }, [resetTransactionForm, clearFeedback])

  const handleTransactionSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()

    if (!transactionFormState.categoryId) {
      showError('Please select a category.')
      return
    }

    const dateInput = normalizeDateInput(transactionFormState.date)
    if (!dateInput) {
      showError('Please select a valid date.')
      return
    }

    const parsedAmount = Number.parseFloat(transactionFormState.amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showError('Enter an amount greater than zero.')
      return
    }

    const description = transactionFormState.description.trim()

    startTransaction(async () => {
      let result
      if (transactionFormState.isRequest && !editingTransaction) {
        const partnerAccount = accounts.find((acc) => acc.type === AccountType.PARTNER)
        if (!partnerAccount) {
          showError('Partner account not found.')
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

      if ('error' in result) {
        showError(
          editingTransaction
            ? 'Unable to update transaction. Please check required fields.'
            : 'Unable to save transaction. Please check required fields.',
        )
        return
      }

      showSuccess(
        transactionFormState.isRequest
          ? 'Request sent to partner.'
          : editingTransaction
            ? 'Transaction updated.'
            : 'Transaction saved.',
      )
      resetTransactionForm()
      router.refresh()
    })
  }

  const handleTransactionDelete = (id: string) => {
    startTransaction(async () => {
      const result = await deleteTransactionAction({ id })
      if ('error' in result) {
        showError('Could not delete transaction.')
        return
      }
      if (editingTransaction?.id === id) {
        resetTransactionForm()
      }
      showSuccess('Transaction removed.')
      router.refresh()
    })
  }

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
    <div role="tabpanel" id="panel-transactions" aria-labelledby="tab-transactions" className="space-y-6">
      {transactionRequests.length > 0 && (
        <RequestList requests={transactionRequests} preferredCurrency={preferredCurrency} />
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
                    value={transactionFormState.date}
                    onChange={(event) =>
                      setTransactionFormState((prev) => ({
                        ...prev,
                        date: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300" htmlFor="transactionDescription">
                  Description (optional)
                </label>
                <Textarea
                  id="transactionDescription"
                  name="description"
                  placeholder="What was this for?"
                  rows={2}
                  value={transactionFormState.description}
                  onChange={(event) =>
                    setTransactionFormState((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    name="isRecurring"
                    checked={transactionFormState.isRecurring}
                    onChange={(event) =>
                      setTransactionFormState((prev) => ({
                        ...prev,
                        isRecurring: event.target.checked,
                      }))
                    }
                    className="size-4 rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
                  />
                  Recurring
                </label>
                {!isEditingTransaction && (
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      name="isRequest"
                      checked={transactionFormState.isRequest}
                      onChange={(event) =>
                        setTransactionFormState((prev) => ({
                          ...prev,
                          isRequest: event.target.checked,
                        }))
                      }
                      className="size-4 rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
                    />
                    Request from partner
                  </label>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" loading={isPendingTransaction} className="flex-1">
                  {isEditingTransaction ? 'Update transaction' : 'Save transaction'}
                </Button>
                {isEditingTransaction && (
                  <Button type="button" variant="outline" onClick={handleCancelTransactionEdit}>
                    Cancel
                  </Button>
                )}
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
          <CardHeader>
            <CardTitle
              className="text-lg font-semibold text-white"
              helpText="Search, filter by type, or export your transaction history."
            >
              Recent transactions
            </CardTitle>
            <p className="text-sm text-slate-400">Review, edit, or delete entries from the current month.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
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
                  value={transactionAccountFilter}
                  onChange={(event) => setTransactionAccountFilter(event.target.value)}
                  options={[{ label: 'All accounts', value: 'all' }, ...transactionAccountOptions]}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300" htmlFor="transaction-filter-search">
                  Search
                </label>
                <Input
                  id="transaction-filter-search"
                  value={transactionSearch}
                  onChange={(event) => setTransactionSearch(event.target.value)}
                  placeholder="description, category"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex items-center gap-2 text-xs"
                  onClick={handleExportCSV}
                  disabled={filteredTransactions.length === 0}
                >
                  <Download className="h-3 w-3" />
                  Export CSV
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {filteredTransactions.length === 0 && (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
                  <div className="rounded-full bg-white/10 p-3">
                    <CreditCard className="h-6 w-6 text-slate-300" />
                  </div>
                  {transactions.length === 0 ? (
                    <>
                      <p className="text-sm font-medium text-white">No transactions yet</p>
                      <p className="text-xs text-slate-400">Record your first expense or income on the left panel.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-white">No matching transactions</p>
                      <p className="text-xs text-slate-400">Try adjusting the filters above.</p>
                    </>
                  )}
                </div>
              )}
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 font-medium text-white">
                      <span>{transaction.category.name}</span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-200">
                        {transaction.account.name}
                      </span>
                      {transaction.isRecurring && (
                        <span className="rounded-full bg-sky-400/20 px-2 py-0.5 text-[11px] font-medium text-sky-200">
                          Recurring
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-300">
                      {new Date(transaction.date).toLocaleDateString()} · {transaction.description || 'No description'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        transaction.type === TransactionType.EXPENSE ? 'text-rose-300' : 'text-emerald-300',
                      )}
                    >
                      {formatRelativeAmount(
                        transaction.type === TransactionType.EXPENSE ? -transaction.amount : transaction.amount,
                        preferredCurrency,
                      )}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs text-slate-400 hover:bg-slate-100"
                      onClick={() => handleTransactionEdit(transaction)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs text-rose-200 hover:bg-rose-500/20"
                      onClick={() => handleTransactionDelete(transaction.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
