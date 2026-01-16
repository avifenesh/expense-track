'use client'

import { useState } from 'react'
import { Currency } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

type BudgetStepProps = {
  accounts: { id: string; name: string }[]
  categories: { id: string; name: string }[]
  currency: Currency
  onSubmit: (data: { accountId: string; categoryId: string; monthKey: string; planned: number }) => void
  onBack: () => void
  onSkip: () => void
  isPending: boolean
}

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  EUR: '\u20AC',
  ILS: '\u20AA',
}

function getMonthKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function BudgetStep({ accounts, categories, currency, onSubmit, onBack, onSkip, isPending }: BudgetStepProps) {
  const currentMonthKey = getMonthKey(new Date())

  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id ?? '')
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id ?? '')
  const [amount, setAmount] = useState('')

  const hasCategories = categories.length > 0
  const hasAccounts = accounts.length > 0
  const canSubmit = hasAccounts && hasCategories && selectedAccount && selectedCategory && amount && Number(amount) > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({
      accountId: selectedAccount,
      categoryId: selectedCategory,
      monthKey: currentMonthKey,
      planned: Number(amount),
    })
  }

  if (!hasAccounts) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p className="font-medium">No accounts found</p>
          <p className="mt-1 text-xs text-amber-200/80">
            You need at least one account to create a budget. You can create one from the dashboard after completing
            onboarding.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={onBack} variant="outline" disabled={isPending}>
            Back
          </Button>
          <Button onClick={onSkip} className="flex-1" disabled={isPending}>
            Skip for now
          </Button>
        </div>
      </div>
    )
  }

  if (!hasCategories) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p className="font-medium">No categories created</p>
          <p className="mt-1 text-xs text-amber-200/80">
            Go back and select some categories first, or skip this step and create budgets from the dashboard.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={onBack} variant="outline" disabled={isPending}>
            Back
          </Button>
          <Button onClick={onSkip} className="flex-1" disabled={isPending}>
            Skip for now
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="budget-account" className="text-xs font-medium uppercase tracking-wide text-slate-300">
            Account
          </label>
          <Select
            id="budget-account"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="budget-category" className="text-xs font-medium uppercase tracking-wide text-slate-300">
            Category
          </label>
          <Select
            id="budget-category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="budget-amount" className="text-xs font-medium uppercase tracking-wide text-slate-300">
            Monthly Budget ({CURRENCY_SYMBOLS[currency]})
          </label>
          <Input
            id="budget-amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isPending}
          />
          <p className="text-xs text-slate-400">
            How much do you plan to spend on{' '}
            {categories.find((c) => c.id === selectedCategory)?.name || 'this category'} this month?
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={onBack} variant="outline" disabled={isPending}>
          Back
        </Button>
        <Button onClick={handleSubmit} className="flex-1" disabled={!canSubmit || isPending} loading={isPending}>
          Create Budget
        </Button>
        <Button onClick={onSkip} variant="ghost" disabled={isPending}>
          Skip
        </Button>
      </div>
    </div>
  )
}
