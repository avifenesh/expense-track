'use client'

import { Button } from '@/components/ui/button'

type WelcomeStepProps = {
  displayName: string
  onContinue: () => void
  onSkip: () => void
  isPending: boolean
}

export function WelcomeStep({ displayName, onContinue, onSkip, isPending }: WelcomeStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4 text-sm text-slate-300">
        <p>
          Hi <span className="font-medium text-white">{displayName}</span>, we are excited to have you on board.
        </p>
        <p>
          This quick setup will help you customize Balance Beacon to match how you manage your money. You can skip this
          and configure everything later, but we recommend taking a minute to get started.
        </p>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="font-medium text-white">What we will set up:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-slate-400">
            <li>Your preferred currency</li>
            <li>Expense and income categories</li>
            <li>Your first budget</li>
          </ul>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={onContinue} className="flex-1" disabled={isPending}>
          Get Started
        </Button>
        <Button onClick={onSkip} variant="ghost" disabled={isPending} loading={isPending}>
          Skip for now
        </Button>
      </div>
    </div>
  )
}
