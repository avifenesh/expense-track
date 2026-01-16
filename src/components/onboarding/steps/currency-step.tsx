'use client'

import { Currency } from '@prisma/client'
import { Button } from '@/components/ui/button'

type CurrencyStepProps = {
  selectedCurrency: Currency
  onSelect: (currency: Currency) => void
  onBack: () => void
  isPending: boolean
}

const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string }[] = [
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '\u20AC' },
  { value: 'ILS', label: 'Israeli Shekel', symbol: '\u20AA' },
]

export function CurrencyStep({ selectedCurrency, onSelect, onBack, isPending }: CurrencyStepProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3">
        {CURRENCY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            disabled={isPending}
            className={`flex items-center gap-4 rounded-xl border p-4 text-left transition ${
              selectedCurrency === option.value
                ? 'border-emerald-400/60 bg-emerald-400/10'
                : 'border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10'
            } ${isPending ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-lg font-semibold text-white">
              {option.symbol}
            </span>
            <div>
              <p className="font-medium text-white">{option.label}</p>
              <p className="text-xs text-slate-400">{option.value}</p>
            </div>
            {selectedCurrency === option.value && (
              <span className="ml-auto text-emerald-400">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            )}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        This will be your default currency for new transactions and budgets. You can always change it later in settings.
      </p>

      <div className="flex gap-3">
        <Button onClick={onBack} variant="outline" disabled={isPending}>
          Back
        </Button>
      </div>
    </div>
  )
}
