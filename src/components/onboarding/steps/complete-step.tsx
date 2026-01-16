'use client'

import { Button } from '@/components/ui/button'

type CompleteStepProps = {
  hasSampleData: boolean
  categoriesCount: number
  onComplete: () => void
  isPending: boolean
}

export function CompleteStep({ hasSampleData, categoriesCount, onComplete, isPending }: CompleteStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/20">
          <svg
            className="h-8 w-8 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      <div className="space-y-4 text-center text-sm text-slate-300">
        <p className="text-base font-medium text-white">Your account is ready!</p>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-left">
          <p className="font-medium text-white">Setup Summary</p>
          <ul className="mt-2 space-y-1 text-slate-400">
            {categoriesCount > 0 && (
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">+</span>
                {categoriesCount} categor{categoriesCount === 1 ? 'y' : 'ies'} created
              </li>
            )}
            {hasSampleData && (
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">+</span>
                Sample transactions and budget added
              </li>
            )}
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">+</span>
              Currency preference saved
            </li>
          </ul>
        </div>

        <p>
          You can now start tracking your expenses, creating budgets, and managing your finances. All settings can be
          adjusted from the dashboard at any time.
        </p>
      </div>

      <Button onClick={onComplete} className="w-full" loading={isPending}>
        Go to Dashboard
      </Button>
    </div>
  )
}
