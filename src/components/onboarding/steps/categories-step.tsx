'use client'

import { useState } from 'react'
import { TransactionType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '@/lib/default-categories'

type CategorySelection = {
  name: string
  type: TransactionType
  color: string
  selected: boolean
}

type CategoriesStepProps = {
  existingCount: number
  onSubmit: (categories: { name: string; type: 'INCOME' | 'EXPENSE'; color?: string | null }[]) => void
  onBack: () => void
  onSkip: () => void
  isPending: boolean
}

export function CategoriesStep({ existingCount, onSubmit, onBack, onSkip, isPending }: CategoriesStepProps) {
  const [expenseCategories, setExpenseCategories] = useState<CategorySelection[]>(
    DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({
      ...cat,
      type: TransactionType.EXPENSE,
      selected: true,
    })),
  )

  const [incomeCategories, setIncomeCategories] = useState<CategorySelection[]>(
    DEFAULT_INCOME_CATEGORIES.map((cat) => ({
      ...cat,
      type: TransactionType.INCOME,
      selected: true,
    })),
  )

  const toggleExpense = (name: string) => {
    setExpenseCategories((prev) => prev.map((cat) => (cat.name === name ? { ...cat, selected: !cat.selected } : cat)))
  }

  const toggleIncome = (name: string) => {
    setIncomeCategories((prev) => prev.map((cat) => (cat.name === name ? { ...cat, selected: !cat.selected } : cat)))
  }

  const handleSubmit = () => {
    const selectedExpense = expenseCategories.filter((c) => c.selected)
    const selectedIncome = incomeCategories.filter((c) => c.selected)
    const all = [...selectedExpense, ...selectedIncome].map((c) => ({
      name: c.name,
      type: c.type,
      color: c.color,
    }))
    if (all.length > 0) {
      onSubmit(all)
    } else {
      onSkip()
    }
  }

  const selectedCount =
    expenseCategories.filter((c) => c.selected).length + incomeCategories.filter((c) => c.selected).length

  return (
    <div className="space-y-6">
      {existingCount > 0 && (
        <div className="rounded-lg border border-sky-400/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
          You already have {existingCount} categor{existingCount === 1 ? 'y' : 'ies'} set up. Select additional ones
          below or skip this step.
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h4 className="mb-2 text-sm font-medium text-white">Expense Categories</h4>
          <div className="grid grid-cols-2 gap-2">
            {expenseCategories.map((cat) => (
              <label
                key={cat.name}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition ${
                  cat.selected
                    ? 'border-emerald-400/40 bg-emerald-400/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                } ${isPending ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <Checkbox checked={cat.selected} onChange={() => toggleExpense(cat.name)} disabled={isPending} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} aria-hidden />
                <span className="text-slate-200">{cat.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-white">Income Categories</h4>
          <div className="grid grid-cols-2 gap-2">
            {incomeCategories.map((cat) => (
              <label
                key={cat.name}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition ${
                  cat.selected
                    ? 'border-emerald-400/40 bg-emerald-400/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                } ${isPending ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <Checkbox checked={cat.selected} onChange={() => toggleIncome(cat.name)} disabled={isPending} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} aria-hidden />
                <span className="text-slate-200">{cat.name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        {selectedCount} categor{selectedCount === 1 ? 'y' : 'ies'} selected. You can add custom categories later.
      </p>

      <div className="flex gap-3">
        <Button onClick={onBack} variant="outline" disabled={isPending}>
          Back
        </Button>
        <Button onClick={handleSubmit} className="flex-1" disabled={isPending} loading={isPending}>
          {selectedCount > 0 ? `Create ${selectedCount} Categories` : 'Continue'}
        </Button>
        <Button onClick={onSkip} variant="ghost" disabled={isPending}>
          Skip
        </Button>
      </div>
    </div>
  )
}
